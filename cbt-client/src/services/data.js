import { supabase } from '../utils/supabase'
import { IndexedDbService } from './indexedDbService'

export const DataService = {
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
        if (randomIds && randomIds.length > 0) {
          query = query.in('id', randomIds.map(r => r.id))
        } else {
          return { data: [], error: null, count: 0 }
        }
      } catch (err) {
        console.error("DataService.getQuestions Randomization RPC Error:", err)
        return { data: [], error: err, count: 0 }
      }
    } else if (filters.offset !== undefined) {
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
        const details = Array.isArray(q.theory_details) ? q.theory_details[0] : q.theory_details
        if (details) {
          q.model_answer = details.model_answer
          q.key_points = details.key_points
          q.max_score = details.max_score
          q.marking_scheme = details.marking_scheme
        }
        q.answers = []
      } else {
        const qa = Array.isArray(q.question_answers) ? q.question_answers[0] : q.question_answers
        if (qa && (qa.option_a || qa.option_A)) {
          // 🔥 STABLE IDs: Always A, B, C, D regardless of database ID
          q.answers = [
            { id: 'A', db_id: qa.id_a, option_text: qa.option_a || qa.option_A, is_correct: qa.correct_option === 'A' },
            { id: 'B', db_id: qa.id_b, option_text: qa.option_b || qa.option_B, is_correct: qa.correct_option === 'B' },
            { id: 'C', db_id: qa.id_c, option_text: qa.option_c || qa.option_C, is_correct: qa.correct_option === 'C' },
            { id: 'D', db_id: qa.id_d, option_text: qa.option_d || qa.option_D, is_correct: qa.correct_option === 'D' }
          ]
          const qe = Array.isArray(q.question_explanations) ? q.question_explanations[0] : q.question_explanations
          q.explanation = qe?.explanation || qa.explanation || q.explanation
        } else {
          q.answers = []
        }
      }
    })
    return questions
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

  async saveExamSession(userId, sessionData, questions, userAnswers) {
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
      console.warn("Retrying session save via Offline Queue:", err)
      await IndexedDbService.queueOfflineSession({ userId, sessionData, questions, userAnswers })
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

  async getPracticeQuestions(subjectName, topic = '', limit = 20) {
    // 1. Resolve name to ID
    const { data: sub } = await supabase.from('subjects').select('id').eq('subject_name', subjectName).single()
    const subjectId = sub?.id

    // 2. Fetch using correct ID
    return await this.getQuestions({
        subject_id: subjectId,
        topic: topic || undefined,
        limit: limit,
        randomize: true
    })
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
  }
}
