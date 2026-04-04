import { supabase } from '../utils/supabase'
import { IndexedDbService } from './indexedDbService'

export const DataService = {
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
      .select('id, topic')
      .eq('subject_id', subjectId)

    if (examId) query = query.eq('exam_id', examId)

    const { data, error } = await query
    if (error) return { data: [], error }

    const uniqueTopics = [...new Set(data.map(q => q.topic).filter(Boolean))].sort()
    return { data: uniqueTopics, error: null }
  },

  async addSyllabusTopic(examId, subjectId, topic) {
    const { data, error } = await supabase
      .from('syllabus_topics')
      .insert({ exam_id: examId, subject_id: subjectId, topic })
      .select()
    return { data, error }
  },

  async updateSyllabusTopic(id, updates) {
    const { data, error } = await supabase
      .from('syllabus_topics')
      .update(updates)
      .eq('id', id)
      .select()
    return { data, error }
  },

  async deleteSyllabusTopic(topicId) {
    const { error } = await supabase
      .from('syllabus_topics')
      .delete()
      .eq('id', topicId)
    return { error }
  },

  // Phase 4: Marketing & Configuration
  async validatePromoCode(code) {
    const { data, error } = await supabase.rpc('validate_promo_code', { p_code: code })
    if (error) return { data: null, error }
    const result = data?.[0]
    return { data: result, error: null }
  },

  async getPromoCodes() {
    // Note: This will now only work for Admins due to new RLS policies
    return await supabase.from('promo_codes').select('*').order('created_at', { ascending: false })
  },

  async addPromoCode(code, percent, expiry) {
    return await supabase.from('promo_codes').insert({ code, percent, expiry_date: expiry }).select()
  },

  async deletePromoCode(id) {
    return await supabase.from('promo_codes').delete().eq('id', id)
  },

  async getSystemConfig(key) {
    return await supabase.from('system_config').select('value').eq('key', key).maybeSingle()
  },

  async updateSystemConfig(key, value) {
    // Upsert logic
    const { data: existing } = await supabase.from('system_config').select('id').eq('key', key).single()
    if (existing) {
      return await supabase.from('system_config').update({ value }).eq('key', key).select()
    } else {
      return await supabase.from('system_config').insert({ key, value }).select()
    }
  },

  // Phase 5: Security & Analytics
  async logAdminAction(adminEmail, action, targetId, details) {
    return await supabase.from('admin_audit_logs').insert({
        admin_email: adminEmail,
        action,
        target_id: targetId,
        details: typeof details === 'object' ? JSON.stringify(details) : details
    })
  },

  async getAuditLogs(limit = 100) {
    return await supabase.from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
  },

  async getRevenueStats() {
    // Aggregating tiers from users as a proxy for revenue if table not dedicated
    return await supabase.from('users').select('tier, created_at')
  },

  async getQuestionReports() {
    return await supabase
      .from('question_reports')
      .select('*, questions(question_text, id)')
      .order('status', { ascending: false })
      .order('created_at', { ascending: false })
  },

  async updateReportStatus(id, status) {
    return await supabase
      .from('question_reports')
      .update({ status })
      .eq('id', id)
  },

  async deactivateQuestion(id) {
    return await supabase
      .from('questions')
      .update({ is_active: false })
      .eq('id', id)
  },

  async getFlaggedUsers() {
    return await supabase.from('users').select('*').eq('is_flagged', true)
  },

  async flagUser(userId, reason) {
    return await supabase.from('users').update({ is_flagged: true, flag_reason: reason }).eq('id', userId)
  },

  async getAllUsers() {
    return await supabase.from('users').select('*').order('created_at', { ascending: false })
  },

  async updateUser(userId, updates) {
    return await supabase.from('users').update(updates).eq('id', userId).select()
  },

  async updateUserRole(email, role) {
    const { data, error } = await supabase.from('users').update({ role }).eq('email', email).select()
    if (!error && (!data || data.length === 0)) {
        return { error: { message: 'User not found with this email.' } }
    }
    return { data, error }
  },


  async getFullSyllabus() {
    const { data, error } = await supabase
      .from('syllabus_topics')
      .select(`
        id,
        topic,
        subject_id,
        exam_id,
        subjects:subject_id (subject_name),
        exams:exam_id (exam_name)
      `)
    return { data: data || [], error }
  },

  async getQuestions(filters = {}) {
    let query = supabase
      .from('questions')
      .select(`
        *,
        question_groups (*),
        question_answers (*),
        question_explanations (explanation),
        answers (*),
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
    if (filters.subject && !filters.subject_id) query = query.eq('subject', filters.subject)
    if (filters.topic) query = query.eq('topic', filters.topic)
    if (filters.exam_type) query = query.eq('exam_type', filters.exam_type)
    if (filters.difficulty) query = query.eq('difficulty', filters.difficulty)
    if (filters.search) query = query.ilike('question_text', `%${filters.search}%`)

    const isPaginated = filters.offset !== undefined && filters.offset !== null
    let usingRandomOffset = false

    if (filters.randomize) {
      const idQuery = supabase.from('questions').select('id').eq('is_active', true)
      if (filters.subject_id) idQuery.eq('subject_id', filters.subject_id)
      if (filters.exam_id) idQuery.eq('exam_id', filters.exam_id)
      if (filters.exam_type) idQuery.eq('exam_type', filters.exam_type)
      if (filters.topic) idQuery.eq('topic', filters.topic)

      try {
        const { data: idPool, error: idError } = await idQuery
        if (idError) throw idError

        if (idPool && idPool.length > 0) {
          const sampledIds = idPool
            .sort(() => Math.random() - 0.5)
            .slice(0, filters.limit || 20)
            .map(i => i.id)

          if (sampledIds.length > 0) {
            query = query.in('id', sampledIds)
          } else {
            query = query.limit(0)
          }
        } else {
          query = query.limit(0)
        }
      } catch (err) {
        console.error("DataService.getQuestions Randomization Error:", err)
        return { data: [], error: err, count: 0 }
      }
    } else if (isPaginated) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1)
    } else {
      query = query.limit(filters.limit || 20)
    }

    const { data, error, count } = await query
    return { data: this._formatQuestions(data || []), error, count }
  },

  _formatQuestions(questions) {
    if (!Array.isArray(questions)) return []
    
    questions.forEach(q => {
      if (q.question_type === 'theory') {
        q.answers = []
        // Partitioned theory details (usually joins return arrays)
        const details = Array.isArray(q.theory_details) ? q.theory_details[0] : q.theory_details
        if (details) {
          q.model_answer = details.model_answer
          q.key_points = details.key_points
          q.max_score = details.max_score
          q.marking_scheme = details.marking_scheme
        }
      } else {
        // Partitioned question answers (usually joins return arrays)
        const qa = Array.isArray(q.question_answers) ? q.question_answers[0] : q.question_answers
        
        if (qa && (qa.option_a || qa.option_A)) {
          q.answers = [
            { id: 'A', db_id: qa.id_a || null, option_letter: 'A', option_text: qa.option_a || qa.option_A, is_correct: qa.correct_option === 'A' },
            { id: 'B', db_id: qa.id_b || null, option_letter: 'B', option_text: qa.option_b || qa.option_B, is_correct: qa.correct_option === 'B' },
            { id: 'C', db_id: qa.id_c || null, option_letter: 'C', option_text: qa.option_c || qa.option_C, is_correct: qa.correct_option === 'C' },
            { id: 'D', db_id: qa.id_d || null, option_letter: 'D', option_text: qa.option_d || qa.option_D, is_correct: qa.correct_option === 'D' }
          ]
          // Partitioned explanation (usually joins return arrays)
          const qe = Array.isArray(q.question_explanations) ? q.question_explanations[0] : q.question_explanations
          q.explanation = qe?.explanation || qa.explanation || q.explanation
      } else if (q.answers && Array.isArray(q.answers) && q.answers.length > 0) {
        q.answers = q.answers.map(a => ({
          id: a.option_letter || a.id,
          db_id: a.id,
          option_letter: a.option_letter || '',
          option_text: a.option_text,
          is_correct: a.is_correct
        })).sort((a, b) => (a.option_letter || '').localeCompare(b.option_letter || ''));
      } else {
          q.answers = []
        }
      }
    })
    return questions
  },

  async getQuestionCount(filters = {}) {
    let query = supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    if (filters.question_type === 'theory') {
      query = query.eq('question_type', 'theory')
    } else if (filters.question_type === 'objective') {
      query = query.or('question_type.eq.objective,question_type.is.null')
    }

    if (filters.subject_id) query = query.eq('subject_id', filters.subject_id)
    if (filters.exam_id) query = query.eq('exam_id', filters.exam_id)
    if (filters.subject && !filters.subject_id) query = query.eq('subject', filters.subject)
    if (filters.topic) query = query.eq('topic', filters.topic)
    if (filters.exam_type) query = query.eq('exam_type', filters.exam_type)
    if (filters.difficulty) query = query.eq('difficulty', filters.difficulty)
    if (filters.search) query = query.ilike('question_text', `%${filters.search}%`)

    const { count, error } = await query
    return { count: count || 0, error }
  },

  async getLeaderboard() {
    const { data, error } = await supabase
      .from('weekly_summaries')
      .select('total_questions_answered, users!inner(username)')
      .order('total_questions_answered', { ascending: false })
      .limit(10)

    return { data, error }
  },

  async getWeeklyRecap(userId) {
    const now = new Date()
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay())).toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('weekly_summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start_date', weekStart)
      .maybeSingle()

    return { data, error }
  },


  async deleteQuestion(id) {
    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', id)
    return { error }
  },

  async updateQuestion(id, updates) {
    const { data, error } = await supabase
      .from('questions')
      .update(updates)
      .eq('id', id)
      .select()
    return { data, error }
  },

  async toggleBookmark(userId, questionId) {
    const { data: existing } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('user_id', userId)
      .eq('question_id', questionId)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase.from('bookmarks').delete().eq('id', existing.id)
      return { bookmarked: false, error }
    } else {
      const { error } = await supabase.from('bookmarks').insert({ user_id: userId, question_id: questionId })
      return { bookmarked: true, error }
    }
  },

  async reportQuestion(userId, questionId, reason, details = '') {
    const { data, error } = await supabase
      .from('question_reports')
      .insert({
        user_id: userId,
        question_id: questionId,
        reason,
        details,
        status: 'pending'
      })
      .select()
    return { data, error }
  },

  async updateReportStatus(reportId, status) {
    const { data, error } = await supabase
      .from('question_reports')
      .update({ status })
      .eq('id', reportId)
      .select()
    return { data, error }
  },

  async bulkAddQuestions(questions) {
    let successCount = 0
    let lastError = null

    for (const q of questions) {
      const { data: qData, error: qErr } = await supabase
        .from('questions')
        .insert({
          question_text: q.question_text,
          exam_type: q.exam_type,
          subject: q.subject,
          topic: q.topic,
          explanation: q.explanation,
          diagram_url: q.diagram_url
        })
        .select()

      if (qErr) {
        lastError = qErr.message
        continue
      }

      if (qData && qData[0] && q.answers && q.answers.length > 0) {
        const questionId = qData[0].id
        const answersToInsert = q.answers.map(a => ({
          question_id: questionId,
          option_text: a.text,
          is_correct: !!a.is_correct
        }))

        const { error: aErr } = await supabase.from('answers').insert(answersToInsert)
        if (aErr) lastError = aErr.message
        else successCount++
      } else if (qData && qData[0]) {
        successCount++
      }
    }

    return { success: successCount > 0, count: successCount, error: lastError }
  },

  async getBookmarks(userId) {
    const { data, error } = await supabase
      .from('bookmarks')
      .select(`
        *,
        questions (
          *,
          question_groups (*),
          question_answers (*),
          answers (*)
        )
      `)
      .eq('user_id', userId)

    const formatted = data ? data.map(b => {
      const q = b.questions
      const qa = q.question_answers?.[0]

      if (qa && qa.option_a) {
        q.answers = [
          { id: 'A', option_letter: 'A', option_text: qa.option_a, is_correct: qa.correct_option === 'A' },
          { id: 'B', option_letter: 'B', option_text: qa.option_b, is_correct: qa.correct_option === 'B' },
          { id: 'C', option_letter: 'C', option_text: qa.option_c, is_correct: qa.correct_option === 'C' },
          { id: 'D', option_letter: 'D', option_text: qa.option_d, is_correct: qa.correct_option === 'D' }
        ]
        q.explanation = qa.explanation
      } else if (q.answers && Array.isArray(q.answers) && q.answers.length > 0) {
        q.answers = q.answers.map(a => ({
          id: a.id || a.option_letter,
          option_letter: a.option_letter || '',
          option_text: a.option_text,
          is_correct: a.is_correct
        })).sort((a, b) => (a.option_letter || '').localeCompare(b.option_letter || ''));
      } else {
        q.answers = []
      }
      return q
    }) : []

    return { data: formatted, error }
  },

  async getBookmarkCount(userId) {
    const { count, error } = await supabase
      .from('bookmarks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    return { count, error }
  },

  async getLifetimeStats(userId) {
    const { data: sessions, error } = await supabase
      .from('exam_sessions')
      .select('session_type, subject, total_questions, correct_answers, time_taken_seconds')
      .eq('user_id', userId)

    if (error) return { data: null, error }

    const stats = {
      overall: { total: 0, correct: 0, time: 0, accuracy: 0 },
      byMode: {},
      bySubject: {}
    }

    sessions.forEach(s => {
      stats.overall.total += s.total_questions || 0
      stats.overall.correct += s.correct_answers || 0
      stats.overall.time += s.time_taken_seconds || 0

      const modeKey = s.session_type || 'Legacy / Practice'
      if (!stats.byMode[modeKey]) stats.byMode[modeKey] = { total: 0, correct: 0 }
      stats.byMode[modeKey].total += s.total_questions || 0
      stats.byMode[modeKey].correct += s.correct_answers || 0

      const sub = s.subject || 'Various'
      if (!stats.bySubject[sub]) stats.bySubject[sub] = { total: 0, correct: 0 }
      stats.bySubject[sub].total += s.total_questions || 0
      stats.bySubject[sub].correct += s.correct_answers || 0
    })

    stats.overall.accuracy = stats.overall.total > 0
      ? Math.round((stats.overall.correct / stats.overall.total) * 100)
      : 0

    return { data: stats, error: null }
  },

  async getTopicMastery(userId) {
    const { data, error } = await supabase
      .from('topic_mastery')
      .select('*')
      .eq('user_id', userId)
      .order('mastery_percentage', { ascending: false })

    return { data, error }
  },

  async getReadinessScore(userId, subjectName) {
    if (!userId || !subjectName) return { data: 0, error: "Missing params" }

    try {
      // 1. Get total topics for this subject from syllabus
      const { data: topics, error: tError } = await supabase
        .from('syllabus_topics')
        .select(`
          topic,
          subjects!inner(subject_name)
        `)
        .eq('subjects.subject_name', subjectName)
      
      if (tError) throw tError

      // 2. Get user's mastery for these topics
      const { data: mastery, error: mError } = await supabase
        .from('topic_mastery')
        .select('topic, mastery_percentage')
        .eq('user_id', userId)
        .eq('subject', subjectName)
        .gt('mastery_percentage', 70) // Threshold for "Ready"

      if (mError) throw mError

      const totalTopics = [...new Set(topics.map(t => t.topic))].length
      const masteredTopics = mastery ? mastery.length : 0
      
      const score = totalTopics > 0 ? Math.round((masteredTopics / totalTopics) * 100) : 0
      return { data: score, error: null }
    } catch (err) {
      console.error("DataService.getReadinessScore error:", err)
      return { data: 0, error: err.message }
    }
  },

  async getLeaderboard() {
    const { data, error } = await supabase
      .from('weekly_summaries')
      .select('total_questions_answered, users!inner(username)')
      .order('total_questions_answered', { ascending: false })
      .limit(10)
    return { data, error }
  },

  async getUserAnalytics(userId) {
    const { data: sessions, error: hError } = await supabase
      .from('exam_sessions')
      .select('total_questions, correct_answers, completed_at')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(50) // Increased limit to capture full day activity better

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
    if (masteryData && masteryData.length > 0) {
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

  async saveExamSession(userId, sessionData, questions, userAnswers) {
    try {
      const { data: session, error: sError } = await supabase
        .from('exam_sessions')
        .insert({ user_id: userId, ...sessionData, completed_at: new Date().toISOString() })
        .select()
        .single()

      if (sError) throw sError

    const responses = questions.map((q, i) => {
      const isTheory = q.question_type === 'theory'
      const selectedAnswerObj = isTheory ? null : q.answers.find(a => a.id === userAnswers[i] || a.option_letter === userAnswers[i])
      const isCorrect = isTheory ? false : (userAnswers[i] === q.answers.find(a => a.is_correct)?.id)
      
      // Defensively resolve DB ID: Only use it if it's a long UUID-like string
      const finalAnswerId = (selectedAnswerObj?.db_id && selectedAnswerObj.db_id.length > 20) ? selectedAnswerObj.db_id : 
                            (selectedAnswerObj?.id && selectedAnswerObj.id.length > 20) ? selectedAnswerObj.id : null;

      return {
        session_id: session.id,
        user_id: userId,
        question_id: q.id,
        selected_answer_id: finalAnswerId,
        user_answer_text: userAnswers[i]?.toString() || (isTheory ? "No answer provided." : null),
        is_correct: isCorrect,
        time_spent_seconds: 0
      }
    })

    const { error: rError } = await supabase.from('user_responses').insert(responses)
    if (rError) console.error("Error saving responses:", rError)

    const theoryResults = []
    for (const [i, q] of questions.entries()) {
      if (q.question_type === 'theory' && userAnswers[i]) {
        try {
          const result = await this.gradeTheorySubmission(q, userAnswers[i])
          const submission = {
            user_id: userId,
            question_id: q.id,
            user_answer: userAnswers[i],
            score: result.score,
            feedback: result.feedback,
            session_id: session.id
          }
          const { data: savedSub } = await supabase.from('theory_submissions').insert(submission).select().single()
          theoryResults.push({ ...q, graded: savedSub })
        } catch (err) {
          console.error("Theory grading failed for question:", q.id, err)
        }
      }
    }

      await this.syncPerformanceData(userId, sessionData, questions, userAnswers)
      return { session, theoryResults, error: null }
    } catch (err) {
      console.warn("Retrying session save via Offline Queue:", err)
      await IndexedDbService.queueOfflineSession({ userId, sessionData, questions, userAnswers })
      return { session: null, error: "Network lost. Result saved locally and will sync when online." }
    }
  },

  async syncPerformanceData(userId, sessionData, questions, userAnswers) {
    try {
      // Prepare topic aggregates for RPC
      const topicsPayload = questions.map((q, i) => {
        let isCorrect = false
        if (q.question_type !== 'theory') {
            const correctAnswer = q.answers?.find(a => a.is_correct)
            isCorrect = (userAnswers[i] === correctAnswer?.id)
        }
        return {
            topic: q.topic || 'General',
            subject: q.subject || 'General',
            is_correct: isCorrect
        }
      })

      // Call Atomic Database RPC
      const { error } = await supabase.rpc('sync_user_performance', {
          p_user_id: userId,
          p_total_questions: sessionData.total_questions,
          p_score_percentage: sessionData.score_percentage,
          p_time_taken: sessionData.time_taken_seconds || 0,
          p_topics: topicsPayload
      })

      if (error) throw error
    } catch (err) {
      console.error("Atomic Sync Performance Error:", err)
    }
  },

  async submitTheoryAnswer(userId, questionId, userAnswer, sessionId) {
    const submission = {
      user_id: userId,
      question_id: questionId,
      user_answer: userAnswer || "No answer provided.",
      score: 0,
      feedback: "Processing...",
      status: 'pending',
      session_id: sessionId
    }
    
    const { data, error } = await supabase.from('theory_submissions').insert(submission).select().single()
    if (data) this.processTheoryGrading(data.id, questionId, userAnswer)
    return { data, error }
  },

  async processTheoryGrading(submissionId, questionId, userAnswer) {
    const { data: question } = await supabase.from('questions').select(`
      *,
      theory_details (*)
    `).eq('id', questionId).single()
    
    if (!question) return
    const result = await this.gradeTheorySubmission(question, userAnswer)
    
    await supabase.from('theory_submissions').update({
      score: result.score,
      feedback: result.feedback,
      status: 'completed'
    }).eq('id', submissionId)
  },

  async gradeTheorySubmission(question, userAnswer) {
    let score = 0
    const details = question.theory_details?.[0] || question.theory_details || {}
    const markingScheme = details.marking_scheme || []
    const keyPoints = details.key_points || []
    const maxScore = details.max_score || 5
    
    const normalizedAnswer = (userAnswer || '').toLowerCase()
    const matchedPoints = []

    if (markingScheme.length > 0) {
      markingScheme.forEach(item => {
        const hasMatch = item.keywords.some(kw => normalizedAnswer.includes(kw.toLowerCase()))
        if (hasMatch) {
          score += (item.marks || 1)
          matchedPoints.push(item.point)
        }
      })
    } else if (keyPoints.length > 0) {
      keyPoints.forEach(point => {
        if (normalizedAnswer.includes(point.toLowerCase())) {
          score += 1
          matchedPoints.push(point)
        }
      })
    }

    score = Math.min(score, maxScore)

    try {
      const { data, error } = await supabase.functions.invoke('gemini-api', {
        body: { 
          action: 'grade', 
          payload: { 
            studentAnswer: userAnswer,
            keyPoints: matchedPoints
          } 
        }
      })

      if (error) throw error
      const text = data.candidates[0].content.parts[0].text
      const jsonMatch = text.match(/\{.*\}/s)
      const aiResult = JSON.parse(jsonMatch ? jsonMatch[0] : text)

      return result

    } catch (err) {
      return { 
        score: score, 
        feedback: `Grading matched ${matchedPoints.length} points. Feedback generation failed: ${err.message}`
      }
    }
  },

  // (Duplicate syncPerformanceData removed)

  async getGlobalAnalytics() {
    try {
      const { count: users } = await supabase.from('users').select('*', { count: 'exact', head: true })
      const { count: questions } = await supabase.from('questions').select('*', { count: 'exact', head: true })
      const { data: sessions } = await supabase.from('exam_sessions').select('score_percentage')
      
      const avgScore = sessions.length > 0 
        ? Math.round(sessions.reduce((a, b) => a + b.score_percentage, 0) / sessions.length)
        : 0

      return {
        stats: {
          totalUsers: users || 0,
          totalQuestions: questions || 0,
          averagePerformance: avgScore
        },
        sessions: sessions || []
      }
    } catch (err) {
      console.error("Global Analytics Error:", err)
      return { error: err.message }
    }
  },

  async getAIExplanation(question, selectedId = null) {
    const correctAns = question.answers?.find(a => a.is_correct)
    const selectedAns = selectedId ? question.answers?.find(a => a.id === selectedId) : null


    try {
      const { data, error } = await supabase.functions.invoke('gemini-api', {
        body: { 
          action: 'explain', 
          payload: { 
            questionText: question.question_text,
            correctAnswer: correctAns.option_text,
            studentAnswer: selectedAns?.option_text || 'Skipped'
          } 
        }
      })

      if (error) throw error
      const text = data.candidates[0].content.parts[0].text
      const jsonMatch = text.match(/\{.*\}/s)
      const aiResult = JSON.parse(jsonMatch ? jsonMatch[0] : text)

      return { explanation: aiResult.explanation }
    } catch (err) {
      console.error("AI Explanation Error:", err)
      return { error: err?.message?.includes("Credit") ? err.message : "Could not generate explanation at this time." }
    }
  },



  async getProfile(userId) {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single()
    return { data, error }
  },


  async getTodaySessionCount(userId) {
    const today = new Date().toISOString().split('T')[0]
    const { count, error } = await supabase
        .from('exam_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('completed_at', today)
    
    return { count: count || 0, error }
  },

  async getNewsUpdates(limit = 10) {
    const { data, error } = await supabase
      .from('news_updates')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(limit)
    return { data, error }
  },

  async getNewsArticle(id) {
    const { data, error } = await supabase
      .from('news_updates')
      .select('*')
      .eq('id', id)
      .single()
    return { data, error }
  },

  async upgradeUserTier(userId, tier, creditsToAdd) {
    // First get current credits to add onto them
    const { data: user } = await supabase.from('users').select('ai_credits').eq('id', userId).single()
    const newCredits = (user?.ai_credits || 0) + creditsToAdd

    const { data, error } = await supabase
      .from('users')
      .update({ tier, ai_credits: newCredits })
      .eq('id', userId)
      .select()
    return { data, error }
  },

  async getBookmarkCount(userId) {
    const { count, error } = await supabase
        .from('bookmarks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
    return { count: count || 0, error }
  },

  async getBookmarks(userId) {
    // Join with questions table to get the full question text
    const { data, error } = await supabase
        .from('bookmarks')
        .select('*, questions(*)')
        .eq('user_id', userId)
    
    // Map it to match the standard questions structure used by the exam engine
    const questions = data ? data.map(b => b.questions).filter(Boolean) : []
    return { data: this._formatQuestions(questions), error }
  },

  async getGlobalStats(userId) {
    try {
      const { data: sessions, error } = await supabase
        .from('exam_sessions')
        .select('*')
        .eq('user_id', userId)

      if (error) throw error

      const stats = {
        overall: { total: 0, correct: 0, time: 0, accuracy: 0 },
        byMode: {},
        bySubject: {}
      }

      if (sessions && sessions.length > 0) {
        sessions.forEach(s => {
          const total = s.total_questions || 0
          const correct = s.correct_answers || 0
          const time = s.time_spent_seconds || 0
          const mode = s.mode || 'practice'
          const subject = s.subject || 'Unknown'

          stats.overall.total += total
          stats.overall.correct += correct
          stats.overall.time += time

          if (!stats.byMode[mode]) stats.byMode[mode] = { total: 0, correct: 0 }
          stats.byMode[mode].total += total
          stats.byMode[mode].correct += correct

          if (!stats.bySubject[subject]) stats.bySubject[subject] = { total: 0, correct: 0 }
          stats.bySubject[subject].total += total
          stats.bySubject[subject].correct += correct
        })

        if (stats.overall.total > 0) {
          stats.overall.accuracy = Math.round((stats.overall.correct / stats.overall.total) * 100)
        }
      }

      return { data: stats, error: null }
    } catch (err) {
      console.error("Global Stats Error:", err)
      return { data: null, error: err }
    }
  },

  async updateUserStreak(userId) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('streak_count, last_active_at')
        .eq('id', userId)
        .single()
      
      if (error) throw error

      const today = new Date().toISOString().split('T')[0]
      const lastActive = user.last_active_at ? new Date(user.last_active_at).toISOString().split('T')[0] : null
      
      let newStreak = user.streak_count || 0
      
      if (!lastActive) {
        newStreak = 1
      } else if (lastActive === today) {
        // Already active today, do nothing to streak
      } else {
        const diffInDays = (new Date(today) - new Date(lastActive)) / (1000 * 60 * 60 * 24)
        if (diffInDays === 1) {
          newStreak += 1
        } else {
          newStreak = 1 // Reset streak if missed a day
        }
      }

      const { data, error: upError } = await supabase
        .from('users')
        .update({ streak_count: newStreak, last_active_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
      
      return { data, error: upError }
    } catch (err) {
      console.error("Streak Update Error:", err)
      return { error: err }
    }
  },

  async getNewsUpdates(limit = 10) {
    const { data, error } = await supabase
      .from('news_updates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    return { data, error }
  },

  async getNewsArticle(id) {
    const { data, error } = await supabase
      .from('news_updates')
      .select('*')
      .eq('id', id)
      .single()
    return { data, error }
  },

  async upgradeUserTier(userId, tier, creditsToAdd = 0) {
    const { data: user } = await supabase.from('users').select('ai_credits').eq('id', userId).single()
    const newCredits = (user?.ai_credits || 0) + creditsToAdd

    const { data, error } = await supabase
      .from('users')
      .update({ tier, ai_credits: newCredits })
      .eq('id', userId)
      .select()
    return { data, error }
  },

  // --- Admin News Management ---
  async adminCreateNews(newsData) {
    const { data, error } = await supabase
      .from('news_updates')
      .insert([newsData])
      .select()
    return { data, error }
  },

  async adminUpdateNews(id, newsData) {
    const { data, error } = await supabase
      .from('news_updates')
      .update(newsData)
      .eq('id', id)
      .select()
    return { data, error }
  },

  async adminDeleteNews(id) {
    const { error } = await supabase
      .from('news_updates')
      .delete()
      .eq('id', id)
    return { error }
  },

  async adminUploadNewsAttachment(file) {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
    
    // Upload to bucket
    const { error: uploadError } = await supabase.storage
      .from('news_attachments')
      .upload(fileName, file)
      
    if (uploadError) return { url: null, error: uploadError }
    
    // Get public URL
    const { data } = supabase.storage
      .from('news_attachments')
      .getPublicUrl(fileName)
      
    return { url: data.publicUrl, error: null }
  },

  async markTourAsSeen(userId) {
    const { error } = await supabase
      .from('users')
      .update({ has_seen_tour: true })
      .eq('id', userId)
    return { error }
  },

  // --- Phase 3: AI Recommendations & Offline Pool ---
  async getRecommendedQuestions(userId) {
    try {
      // 1. Get Topic Mastery gaps
      const { data: mastery } = await supabase
        .from('topic_mastery')
        .select('*')
        .eq('user_id', userId)
        .order('mastery_percentage', { ascending: true })
        .limit(3)

      if (!mastery || mastery.length === 0) return null

      // 2. Fetch questions from weak topics
      const weakTopics = mastery.map(m => m.topic)
      const { data: weakQs } = await supabase
        .from('questions')
        .select('*, answers(*)')
        .in('topic', weakTopics)
        .eq('is_active', true)
        .limit(15)

      // 3. Fetch "Maintenance" questions (high mastery)
      const { data: strongMastery } = await supabase
        .from('topic_mastery')
        .select('topic')
        .eq('user_id', userId)
        .order('mastery_percentage', { ascending: false })
        .limit(1)

      let strongQs = []
      if (strongMastery?.[0]) {
        const { data } = await supabase
          .from('questions')
          .select('*, answers(*)')
          .eq('topic', strongMastery[0].topic)
          .eq('is_active', true)
          .limit(5)
        strongQs = data || []
      }

      const combined = [...(weakQs || []), ...strongQs]
      return this._formatQuestions(combined)
    } catch (err) {
      console.error("AI Recommendation Error:", err)
      return null
    }
  },

  async syncOfflinePool() {
    try {
      // Fetch a safety pool of 100 questions
      const { data, error } = await supabase
        .from('questions')
        .select('*, answers(*)')
        .eq('is_active', true)
        .limit(100)
      
      if (error) throw error
      if (data) {
        await IndexedDbService.saveQuestions(this._formatQuestions(data))
        console.log("Offline Pool Synced: 100 questions cached.")
      }
    } catch (err) {
      console.error("Offline Sync Error:", err)
    }
  }
}









