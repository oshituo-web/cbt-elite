import { supabase } from '../utils/supabase'

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
  async getPromoCodes() {
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

        const { data: idPool } = await idQuery
        if (idPool && idPool.length > 0) {
            const sampledIds = idPool.sort(() => Math.random() - 0.5).slice(0, filters.limit || 20).map(i => i.id)
            query = query.in('id', sampledIds)
        } else {
            query = query.limit(0)
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
    questions.forEach(q => {
      if (q.question_type === 'theory') {
        q.answers = []
        const details = q.theory_details?.[0] || q.theory_details
        if (details) {
          q.model_answer = details.model_answer
          q.key_points = details.key_points
          q.max_score = details.max_score
          q.marking_scheme = details.marking_scheme
        }
      } else {
        const qa = q.question_answers?.[0] || q.question_answers
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
      .select('total_questions, correct_answers, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(20)

    const history = sessions ? sessions.map(s => ({
      total_questions: s.total_questions || 0,
      correct_answers: s.correct_answers || 0,
      score_percentage: s.total_questions > 0 ? Math.round(((s.correct_answers || 0) / (s.total_questions || 1)) * 100) : 0,
      created_at: s.created_at
    })) : []

    const { data: masteryData, error: mError } = await supabase
      .from('topic_mastery')
      .select('subject, mastery_percentage')
      .eq('user_id', userId)

    const subjectMap = {}
    if (masteryData && masteryData.length > 0) {
      masteryData.forEach(m => {
        const sub = m.subject || 'General'
        if (!subjectMap[sub]) subjectMap[sub] = { sum: 0, count: 0 }
        subjectMap[sub].sum += m.mastery_percentage || 0
        subjectMap[sub].count += 1
      })
    }
    const processedMastery = Object.keys(subjectMap).map(sub => ({
      subject: sub,
      average: Math.round(subjectMap[sub].sum / subjectMap[sub].count)
    }))

    return { history, mastery: processedMastery, error: hError || mError }
  },

  async saveExamSession(userId, sessionData, questions, userAnswers) {
    const { data: session, error: sError } = await supabase
      .from('exam_sessions')
      .insert({ user_id: userId, ...sessionData, completed_at: new Date().toISOString() })
      .select()
      .single()

    if (sError) throw sError

    const responses = questions.map((q, i) => {
      const isTheory = q.question_type === 'theory'
      const isCorrect = isTheory ? false : (userAnswers[i] === q.answers.find(a => a.is_correct)?.id)

      return {
        session_id: session.id,
        user_id: userId,
        question_id: q.id,
        selected_answer_id: isTheory ? null : userAnswers[i],
        user_answer_text: isTheory ? userAnswers[i] : null,
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

    try {
      await this.syncPerformanceData(userId, sessionData, questions, userAnswers)
    } catch (err) {
      console.error("Analytics sync failed:", err)
    }

    return { data: { ...session, theoryResults }, error: null }
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

  async syncPerformanceData(userId, sessionData, questions, userAnswers) {
    const topicUpdates = {}
    questions.forEach((q, i) => {
      const topic = q.topic || 'General'
      if (!topicUpdates[topic]) topicUpdates[topic] = { subject: q.subject || 'General', total: 0, correct: 0 }
      topicUpdates[topic].total++

      if (q.question_type !== 'theory') {
        const correctAnswer = q.answers?.find(a => a.is_correct)
        if (userAnswers[i] === correctAnswer?.id) topicUpdates[topic].correct++
      }
    })

    for (const [topic, stats] of Object.entries(topicUpdates)) {
      const { data: current } = await supabase
        .from('topic_mastery')
        .select('*')
        .eq('user_id', userId)
        .eq('topic', topic)
        .maybeSingle()

      const total_attempted = (current?.total_attempted || 0) + stats.total
      const total_correct = (current?.total_correct || 0) + stats.correct
      const mastery_percentage = Math.round((total_correct / total_attempted) * 100)

      await supabase.from('topic_mastery').upsert({
        user_id: userId,
        subject: stats.subject,
        topic: topic,
        total_attempted,
        total_correct,
        mastery_percentage,
        last_practiced_at: new Date().toISOString()
      })
    }

    const now = new Date()
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay())).toISOString().split('T')[0]

    const { data: currentWeekly } = await supabase
      .from('weekly_summaries')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start_date', weekStart)
      .maybeSingle()

    const total_questions_answered = (currentWeekly?.total_questions_answered || 0) + sessionData.total_questions
    const prevTotal = currentWeekly?.total_questions_answered || 0
    const currentAvg = currentWeekly?.average_score_percentage || 0
    const newAvg = Math.round(((currentAvg * prevTotal) + (sessionData.score_percentage * sessionData.total_questions)) / total_questions_answered)

    await supabase.from('weekly_summaries').upsert({
      user_id: userId,
      week_start_date: weekStart,
      total_questions_answered,
      average_score_percentage: newAvg,
      total_study_duration_seconds: (currentWeekly?.total_study_duration_seconds || 0) + sessionData.time_taken_seconds
    })
  },

  async getUserAnalytics(userId) {
    try {
      const { data: history, error: hError } = await supabase
        .from('exam_sessions')
        .select('completed_at, score_percentage, session_type')
        .eq('user_id', userId)
        .order('completed_at', { ascending: true })
        .limit(20)

      const { data: mastery, error: mError } = await supabase
        .from('topic_mastery')
        .select('subject, mastery_percentage')
        .eq('user_id', userId)

      if (hError || mError) throw (hError || mError)

      const subjectAverages = {}
      mastery.forEach(m => {
        if (!subjectAverages[m.subject]) subjectAverages[m.subject] = []
        subjectAverages[m.subject].push(m.mastery_percentage)
      })

      const processedMastery = Object.entries(subjectAverages).map(([subject, scores]) => ({
        subject,
        average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      }))

      return {
        history: history || [],
        mastery: processedMastery,
        error: null
      }
    } catch (err) {
      console.error("Analytics Error:", err)
      return { error: err.message }
    }
  },

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
  }
}









