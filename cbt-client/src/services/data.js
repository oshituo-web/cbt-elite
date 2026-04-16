import { supabase } from '../utils/supabase'
import { IndexedDbService } from './indexedDbService'

export const DataService = {
  supabase,
  // --- CORE DATA ---
  async getExams() {
    const { data, error } = await supabase.from('exams').select('*').order('exam_name')
    return { data: data || [], error }
  },

  async getSubjects() {
    const { data, error } = await supabase.from('subjects').select('*').order('subject_name')
    return { data: data || [], error }
  },

  async getTopics(subjectId, examId) {
    let query = supabase
      .from('syllabus_topics')
      .select('topic')
      .eq('subject_id', subjectId)

    if (examId) query = query.eq('exam_id', examId)

    const { data, error } = await query
    if (error) return { data: [], error }

    const uniqueTopics = [...new Set(data.map(q => q.topic).filter(Boolean))].sort()
    return { data: uniqueTopics, error: null }
  },

  // --- QUESTIONS ---
  async getQuestions(filters = {}) {
    let query = supabase
      .from('questions')
      .select(`
        *,
        subjects (subject_name),
        question_groups (*),
        question_answers (*),
        question_explanations (explanation),
        theory_details (*)
      `, { count: 'exact' })
      .eq('is_active', true)

    if (filters.question_type === 'theory') {
      query = query.eq('question_type', 'theory')
    } else {
      query = query.or('question_type.eq.objective,question_type.is.null')
    }

    if (filters.subject_id) query = query.eq('subject_id', filters.subject_id)
    if (filters.exam_id) query = query.eq('exam_id', filters.exam_id)
    if (filters.topic) query = query.eq('topic', filters.topic)
    if (filters.exam_type) query = query.eq('exam_type', filters.exam_type)
    if (filters.difficulty) query = query.eq('difficulty', filters.difficulty)
    if (filters.search) query = query.ilike('question_text', `%${filters.search}%`)

    if (filters.randomize) {
      try {
        const { data: randomIds, error: idError } = await supabase.rpc('get_random_question_ids', {
          p_subject_id: filters.subject_id || null,
          p_exam_id: filters.exam_id || null,
          p_exam_type: filters.exam_type || null,
          p_topic: filters.topic || null,
          p_question_type: filters.question_type || 'objective',
          p_limit: filters.limit || 20
        })
        
        if (idError) throw idError
        
        if (randomIds && Array.isArray(randomIds) && randomIds.length > 0) {
          // 🔥 ROBUST MAP: Handle both [{id: '...'}, ...] and ['...', ...] formats
          const ids = randomIds.map(r => (typeof r === 'object' && r !== null) ? r.id : r).filter(Boolean);
          if (ids.length > 0) {
            query = query.in('id', ids)
          } else {
            query = query.limit(filters.limit || 20)
          }
        } else {
          console.warn("RPC returned no random questions or invalid format. Falling back to sequential.")
          query = query.limit(filters.limit || 20)
        }
      } catch (err) {
        console.error("DataService.getQuestions Randomization RPC Error:", err)
        query = query.limit(filters.limit || 20)
      }
    } else if (filters.offset !== undefined) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1)
    } else {
      query = query.limit(filters.limit || 20)
    }

    const { data, error, count } = await query
    
    if (error) {
        console.error("DataService.getQuestions Query Error:", error)
        throw error // Throw to be caught by component level try-catch
    }

    return { data: this._formatQuestions(data || []), error, count }
  },

  _formatQuestions(questions) {
    if (!Array.isArray(questions)) return []
    
    return questions.map(q => {
      // Create a shallow copy to avoid mutating data if it's cached/reused elsewhere
      const formatted = { ...q }
      
      // Flatten subject name for grouping consistency
      formatted.subject = q.subject || (Array.isArray(q.subjects) ? q.subjects[0]?.subject_name : q.subjects?.subject_name) || 'General'
      
      try {
        if (formatted.question_type === 'theory') {
          const details = Array.isArray(formatted.theory_details) ? formatted.theory_details[0] : formatted.theory_details
          if (details) {
            formatted.model_answer = details.model_answer
            formatted.key_points = details.key_points
            formatted.max_score = details.max_score
            formatted.marking_scheme = details.marking_scheme
          }
          formatted.answers = []
        } else {
          // Normalize options/answers
          const qa = Array.isArray(formatted.question_answers) ? formatted.question_answers[0] : formatted.question_answers
          if (qa && (qa.option_a || qa.option_A)) {
            // 🔥 STABLE IDs: Always A, B, C, D regardless of database ID
            formatted.answers = [
              { id: 'A', db_id: qa.id_a, option_text: qa.option_a || qa.option_A, is_correct: qa.correct_option === 'A' },
              { id: 'B', db_id: qa.id_b, option_text: qa.option_b || qa.option_B, is_correct: qa.correct_option === 'B' },
              { id: 'C', db_id: qa.id_c, option_text: qa.option_c || qa.option_C, is_correct: qa.correct_option === 'C' },
              { id: 'D', db_id: qa.id_d, option_text: qa.option_d || qa.option_D, is_correct: qa.correct_option === 'D' }
            ]
            const qe = Array.isArray(formatted.question_explanations) ? formatted.question_explanations[0] : formatted.question_explanations
            formatted.explanation = qe?.explanation || qa.explanation || formatted.explanation
          } else {
            formatted.answers = []
          }
        }
      } catch (err) {
        console.error("Question formatting failed for:", q.id, err)
        // Ensure minimum required fields exist even if formatting fails
        formatted.answers = formatted.answers || []
      }
      
      return formatted
    })
  },

  // --- USER & SESSIONS ---
  async getProfile(userId) {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single()
    return { data, error }
  },

  async updateUser(userId, updates) {
    // Note: Restricted columns (tier, credits) will be blocked by DB trigger
    return await supabase.from('users').update(updates).eq('id', userId).select()
  },

  async saveExamSession(userId, sessionData, questions, userAnswers, isSyncing = false) {
    try {
      const { data: session, error: sError } = await supabase
        .from('exam_sessions')
        .insert({ user_id: userId, ...sessionData, completed_at: new Date().toISOString() })
        .select()
        .single()

      if (sError) throw sError

      const responses = questions.map((q, i) => ({
        session_id: session.id,
        user_id: userId,
        question_id: q.id,
        user_answer_text: userAnswers[i]?.toString() || (q.question_type === 'theory' ? "No answer provided." : null),
        is_correct: q.question_type !== 'theory' && (userAnswers[i] === q.answers.find(a => a.is_correct)?.id),
        time_spent_seconds: 0
      }))

      await supabase.from('user_responses').insert(responses)
      await this.syncPerformanceData(userId, sessionData, questions, userAnswers)
      
      return { session, error: null }
    } catch (err) {
      if (!isSyncing) {
        console.warn("Retrying session save via Offline Queue:", err)
        await IndexedDbService.queueOfflineSession({ userId, sessionData, questions, userAnswers })
      } else {
        console.warn("Offline Sync Failed for session (will retry later):", err)
      }
      return { session: null, error: "Network lost. Result saved locally." }
    }
  },

  async syncPerformanceData(userId, sessionData, questions, userAnswers) {
    const topicsPayload = questions.map((q, i) => ({
        topic: q.topic || 'General',
        subject: q.subject || 'General',
        is_correct: q.question_type !== 'theory' && (userAnswers[i] === q.answers.find(a => a.is_correct)?.id)
    }))

    return await supabase.rpc('sync_user_performance', {
        p_user_id: userId,
        p_total_questions: sessionData.total_questions,
        p_score_percentage: sessionData.score_percentage,
        p_time_taken: sessionData.time_taken_seconds || 0,
        p_topics: topicsPayload
    })
  },

  // --- ANALYTICS ---
  async getUserAnalytics(userId) {
    const { data: sessions, error: hError } = await supabase
      .from('exam_sessions')
      .select('total_questions, correct_answers, completed_at')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(50)

    const history = sessions ? sessions.map(s => ({
      total_questions: s.total_questions || 0,
      correct_answers: s.correct_answers || 0,
      score_percentage: s.total_questions > 0 ? Math.round(((s.correct_answers || 0) / (s.total_questions || 1)) * 100) : 0,
      created_at: s.completed_at
    })) : []

    const { data: masteryData, error: mError } = await supabase
      .from('topic_mastery')
      .select('subject, mastery_percentage, total_attempted')
      .eq('user_id', userId)

    const subjectMap = {}
    if (masteryData) {
      masteryData.forEach(m => {
        const sub = m.subject || 'General'
        if (!subjectMap[sub]) subjectMap[sub] = { sum: 0, count: 0, total_attempted: 0 }
        subjectMap[sub].sum += m.mastery_percentage || 0
        subjectMap[sub].count += 1
        subjectMap[sub].total_attempted += m.total_attempted || 0
      })
    }
    const processedMastery = Object.keys(subjectMap).map(sub => ({
      subject: sub,
      average: Math.round(subjectMap[sub].sum / subjectMap[sub].count),
      total_attempted: subjectMap[sub].total_attempted
    }))

    return { history, mastery: processedMastery, error: hError || mError }
  },

  async getReadinessScore(userId, subjectName) {
    try {
      const { data: topics } = await supabase.from('syllabus_topics').select('topic, subjects!inner(subject_name)').eq('subjects.subject_name', subjectName)
      const { data: mastery } = await supabase.from('topic_mastery').select('topic').eq('user_id', userId).eq('subject', subjectName).gt('mastery_percentage', 70)

      const totalTopics = [...new Set((topics || []).map(t => t.topic))].length
      const masteredTopics = (mastery || []).length
      return { data: totalTopics > 0 ? Math.round((masteredTopics / totalTopics) * 100) : 0, error: null }
    } catch (err) {
      return { data: 0, error: err.message }
    }
  },

  // --- SECURE MONETIZATION (RPCs) ---
  async activateUserLifetime(userId) {
    return await supabase.rpc('secure_activate_user', { p_user_id: userId, p_plan: 'lifetime' })
  },

  async subscribeUser(userId, plan = 'monthly') {
    return await supabase.rpc('secure_subscribe_user', { p_user_id: userId, p_plan: plan })
  },

  async useAICredit(userId, action = 'explanation') {
    return await supabase.rpc('secure_deduct_credit', { p_user_id: userId, p_action: action })
  },

  async getPracticeQuestions(subjectName, topic = '', limit = 25, examType = '') {
    let subjectId = undefined;
    let examId = undefined;

    try {
        if (subjectName) {
            let { data: subs, error: sErr } = await supabase.from('subjects').select('id').eq('subject_name', subjectName);
            if (sErr) console.error("DataService.getPracticeQuestions Subject Select Error:", sErr);

            if (!subs || subs.length === 0) {
                let fuzzySearch = subjectName.toLowerCase().includes('english') ? '%English%' : `%${subjectName}%`;
                const res = await supabase.from('subjects').select('id').ilike('subject_name', fuzzySearch);
                subs = res.data;
            }

            if (subs && subs.length > 0) {
                subjectId = subs[0].id;
            } else {
                console.error(`ERROR: Subject mapping failed for "${subjectName}". Refusing to fetch random subjects.`);
                return { data: [], error: 'Subject mapping failed in DB', count: 0 };
            }
        }

        if (examType) {
            // Also securely map the examType string (JAMB, WAEC, NECO) to its true exam_id
            let { data: exams, error: eErr } = await supabase.from('exams').select('id').ilike('exam_name', `%${examType}%`);
            if (eErr) console.error("DataService.getPracticeQuestions Exam Select Error:", eErr);
            
            if (exams && exams.length > 0) {
                examId = exams[0].id;
            }
        }

        return await this.getQuestions({
            subject_id: subjectId,
            exam_id: examId,
            topic: topic || undefined,
            limit: limit,
            randomize: true,
            exam_type: examType || undefined // keep this just in case backend expects the literal string here too
        })
    } catch (err) {
        console.error("DataService.getPracticeQuestions Fatal Error:", err);
        throw err;
    }
  },

  async getGlobalStats(userId) {
    const { data, error } = await supabase.from('users').select('streak_count, total_questions_answered, last_session_date').eq('id', userId).single()
    return { data, error }
  },

  async markTourAsSeen(userId) {
    return await supabase.from('users').update({ has_seen_tour: true }).eq('id', userId)
  },

  async toggleBookmark(userId, questionId) {
    const { data: existing } = await supabase.from('bookmarks').select('id').eq('user_id', userId).eq('question_id', questionId).maybeSingle()
    if (existing) {
      const { error } = await supabase.from('bookmarks').delete().eq('id', existing.id)
      return { bookmarked: false, error }
    } else {
      const { error } = await supabase.from('bookmarks').insert({ user_id: userId, question_id: questionId })
      return { bookmarked: true, error }
    }
  },

  async reportQuestion(userId, questionId, reason, details) {
    return await supabase.from('question_reports').insert({
      user_id: userId,
      question_id: questionId,
      reason,
      details,
      status: 'pending'
    })
  },

    // --- AI SERVICES ---
    async getAIExplanation(question, selectedId = null) {
      const correctAns = question.answers?.find(a => a.is_correct)
      const selectedAns = selectedId ? question.answers?.find(a => a.id === selectedId) : null

      try {
        const { data, error } = await supabase.functions.invoke('gemini-api', {
          body: { 
            action: 'explain', 
            payload: { 
              questionText: question.question_text,
              correctAnswer: correctAns?.option_text || 'Unknown',
              studentAnswer: selectedAns?.option_text || 'Skipped'
            } 
          }
        })
        if (error) throw error

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ""
        const jsonMatch = text.match(/\{.*\}/s)
        const aiResult = JSON.parse(jsonMatch ? jsonMatch[0] : text)
        return { explanation: aiResult.explanation }
      } catch (err) {
        console.error("AI Error:", err)
        return { explanation: "Our AI Tutor is currently busy. Please try again in a few moments." }
      }
    },

  async getRecommendedQuestions(userId) {
    try {
      const { data: mastery } = await supabase.from('topic_mastery').select('*').eq('user_id', userId).order('mastery_percentage', { ascending: true }).limit(3)
      if (!mastery || mastery.length === 0) return null

      const { data: weakQs } = await supabase.from('questions').select('*, question_answers(*)').in('topic', mastery.map(m => m.topic)).limit(15)
      return this._formatQuestions(weakQs || [])
    } catch (err) {
      return null
    }
  },

  // --- UTILS ---
  async getNewsUpdates(limit = 10) {
    const { data, error } = await supabase.from('news_updates').select('*').order('created_at', { ascending: false }).limit(limit)
    return { data, error }
  },

  async getNewsArticle(articleId) {
    return await supabase.from('news_updates').select('*').eq('id', articleId).single()
  },

  async getNewsAttachments(articleId) {
    return await supabase.from('news_attachments').select('*').eq('news_id', articleId)
  },

  async adminCreateNews(payload) {
    return await supabase.from('news_updates').insert(payload).select()
  },

  async adminUpdateNews(id, payload) {
    return await supabase.from('news_updates').update(payload).eq('id', id).select()
  },

  async adminDeleteNews(id) {
    return await supabase.from('news_updates').delete().eq('id', id)
  },

  async adminUploadNewsAttachment(file) {
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`
    const { data, error } = await supabase.storage.from('news-attachments').upload(fileName, file)
    if (error) return { url: null, error }
    const { data: { publicUrl } } = supabase.storage.from('news-attachments').getPublicUrl(fileName)
    return { url: publicUrl, error: null }
  },

  async getSystemConfig(key) {
    return await supabase.from('system_config').select('value').eq('key', key).maybeSingle()
  },

  async getGlobalConfigs(keys = []) {
    let query = supabase.from('system_config').select('key, value')
    if (keys.length > 0) query = query.in('key', keys)
    const { data, error } = await query
    return { data: data || [], error }
  },

  async getBookmarkCount(userId) {
    const { count, error } = await supabase.from('bookmarks').select('*', { count: 'exact', head: true }).eq('user_id', userId)
    return { count: count || 0, error }
  },

  async getBookmarks(userId) {
    const { data, error } = await supabase.from('bookmarks').select('*, questions(*, question_answers(*))').eq('user_id', userId)
    const questions = data ? data.map(b => b.questions).filter(Boolean) : []
    return { data: this._formatQuestions(questions), error }
  },

  async getLeaderboard() {
    return await supabase.from('weekly_summaries').select('total_questions_answered, users!inner(username)').order('total_questions_answered', { ascending: false }).limit(10)
  },

  async syncOfflinePool() {
    const { data } = await supabase.from('questions').select('*, question_answers(*)').eq('is_active', true).limit(100)
    if (data) await IndexedDbService.saveQuestions(this._formatQuestions(data))
  },

  // --- ADMIN: USER MANAGEMENT ---
  async getAllUsers() {
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    return { data: data || [], error }
  },

  async updateUserRole(email, role) {
    return await supabase.from('users').update({ role }).eq('email', email)
  },

  async flagUser(userId, reason) {
    return await supabase.from('users').update({ 
      is_flagged: true, 
      flag_reason: reason 
    }).eq('id', userId)
  },

  // --- ADMIN: SYLLABUS ---
  async getFullSyllabus() {
    const { data, error } = await supabase
      .from('syllabus_topics')
      .select(`
        *,
        exams (exam_name),
        subjects (subject_name)
      `)
      .order('topic')
    return { data: data || [], error }
  },

  async addSyllabusTopic(examId, subjectId, topic) {
    return await supabase.from('syllabus_topics').insert({
      exam_id: examId,
      subject_id: subjectId,
      topic,
      importance: 1
    })
  },

  async deleteSyllabusTopic(id) {
    return await supabase.from('syllabus_topics').delete().eq('id', id)
  },

  async updateSyllabusTopic(id, updates) {
    return await supabase.from('syllabus_topics').update(updates).eq('id', id)
  },

  // --- ADMIN: QUESTIONS ---
  async deleteQuestion(id) {
    return await supabase.from('questions').delete().eq('id', id)
  },

  async deactivateQuestion(id) {
    return await supabase.from('questions').update({ is_active: false }).eq('id', id)
  },

  async updateQuestionAnswers(questionId, updates) {
    // Check if record exists first to decide insert/update
    const { data: existing } = await supabase.from('question_answers').select('id').eq('question_id', questionId).maybeSingle()
    if (existing) {
      return await supabase.from('question_answers').update(updates).eq('question_id', questionId)
    } else {
      return await supabase.from('question_answers').insert({ question_id: questionId, ...updates })
    }
  },

  async bulkAddQuestions(questions) {
    let successCount = 0;
    
    for (const q of questions) {
      const { data: question, error: qErr } = await supabase.from('questions').insert({
        question_text: q.question_text,
        exam_type: q.exam_type,
        subject: q.subject,
        topic: q.topic,
        explanation: q.explanation || '',
        is_active: true
      }).select().single()

      if (qErr) {
        console.error("Bulk Import Error on Question:", qErr)
        continue
      }

      if (q.answers && Array.isArray(q.answers)) {
        const { error: aErr } = await this.updateQuestionAnswers(question.id, {
          option_a: q.answers[0]?.text || '',
          option_b: q.answers[1]?.text || '',
          option_c: q.answers[2]?.text || '',
          option_d: q.answers[3]?.text || '',
          correct_option: q.answers.find(a => a.is_correct)?.id || 
                          (q.answers[0]?.is_correct ? 'A' : (q.answers[1]?.is_correct ? 'B' : (q.answers[2]?.is_correct ? 'C' : 'D'))),
          explanation: q.explanation || ''
        })
        if (aErr) console.error("Bulk Import Error on Answers:", aErr)
      }
      successCount++
    }
    
    return { count: successCount, error: null }
  },

  // --- ADMIN: REPORTS ---
  async getQuestionReports() {
    const { data, error } = await supabase
      .from('question_reports')
      .select(`
        *,
        questions (id, question_text)
      `)
      .order('created_at', { ascending: false })
    return { data: data || [], error }
  },

  async updateReportStatus(id, status) {
    return await supabase.from('question_reports').update({ status }).eq('id', id)
  },

  // --- ADMIN: MARKETING & CONFIG ---
  async getPromoCodes() {
    return await supabase.from('promo_codes').select('*').order('created_at', { ascending: false })
  },

  async addPromoCode(code, percent, expiry) {
    return await supabase.from('promo_codes').insert({ code, percent, expiry })
  },

  async deletePromoCode(id) {
    return await supabase.from('promo_codes').delete().eq('id', id)
  },

  async updateSystemConfig(key, value) {
    const { data: existing } = await supabase.from('system_config').select('id').eq('key', key).maybeSingle()
    if (existing) {
      return await supabase.from('system_config').update({ value }).eq('key', key)
    } else {
      return await supabase.from('system_config').insert({ key, value })
    }
  },

  // --- ADMIN: ANALYTICS & AUDIT ---
  async getGlobalAnalytics() {
    const { data: sessions } = await supabase.from('exam_sessions').select('score_percentage')
    const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true })
    const { count: questionCount } = await supabase.from('questions').select('*', { count: 'exact', head: true })
    
    const avgScore = sessions && sessions.length > 0 
      ? Math.round(sessions.reduce((acc, s) => acc + (s.score_percentage || 0), 0) / sessions.length)
      : 0

    return {
      stats: {
        totalUsers: userCount || 0,
        totalQuestions: questionCount || 0,
        averagePerformance: avgScore
      },
      sessions: sessions || [],
      error: null
    }
  },

  async getRevenueStats() {
    return await supabase.from('users').select('tier, email')
  },

  async getAuditLogs() {
    return await supabase.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(100)
  },

  async logAdminAction(adminEmail, action, targetId, details) {
    try {
      return await supabase.from('admin_audit_logs').insert({
        admin_email: adminEmail,
        action,
        target_id: targetId,
        details: String(details)
      })
    } catch (e) {
      console.error("Audit log failed (table might missing):", e)
      return { error: e }
    }
  },

  async aiRegenerateQuestion(qid, reason, details) {
    try {
      const { data, error } = await supabase.functions.invoke('gemini-api', {
        body: { 
          action: 'repair', 
          payload: { qid, reason, details } 
        }
      })
      if (error) throw error
      return { data, error: null }
    } catch (err) {
      return { data: null, error: err.message }
    }
  }
}
