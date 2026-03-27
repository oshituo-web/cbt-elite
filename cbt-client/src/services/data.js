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

    const uniqueTopics = data.map(q => ({ id: q.id, topic: q.topic }))
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
    return await supabase.from('system_config').select('value').eq('key', key).single()
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

  async deductCredit(userId, actionType) {
    const costMap = { 'theory_grading': 5, 'explanation': 1 }
    const cost = costMap[actionType] || 1
    const { data: user } = await supabase.from('users').select('ai_credits').eq('id', userId).single()
    if (!user) return { error: 'User not found' }
    const newCredits = Math.max(0, (user.ai_credits || 0) - cost)
    return await supabase.from('users').update({ ai_credits: newCredits }).eq('id', userId)
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
        // Phase 8: Smart Randomization
        // We fetch the total count first to pick a random page index
        const { count: totalCount } = await DataService.getQuestionCount(filters)
        const limit = filters.limit || 20
        if (totalCount && totalCount > limit) {
             const maxOffset = totalCount - limit
             const randomOffset = Math.floor(Math.random() * maxOffset)
             query = query.range(randomOffset, randomOffset + limit - 1)
             usingRandomOffset = true
        } else {
             query = query.limit(limit)
        }
    } else if (isPaginated) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1)
    } else {
      query = query.limit(filters.limit || 20)
    }

    const { data, error, count } = await query
    
    let finalQuestions = data || []
    
    // In-memory shuffle to break up sequential database groupings
    if (filters.randomize && finalQuestions.length > 0) {
        finalQuestions.sort(() => Math.random() - 0.5)
    }

    finalQuestions.forEach(q => {
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
            option_letter: a.option_letter,
            option_text: a.option_text,
            is_correct: a.is_correct
          })).sort((a, b) => a.option_letter.localeCompare(b.option_letter));
        } else {
          q.answers = []
        }
      }
    })
    return { data: finalQuestions, error, count }
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
      .from('exam_sessions')
      .select(`
        score_percentage,
        total_questions,
        users (
          username
        )
      `)
      .order('score_percentage', { ascending: false })
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
          option_letter: a.option_letter,
          option_text: a.option_text,
          is_correct: a.is_correct
        })).sort((a, b) => a.option_letter.localeCompare(b.option_letter));
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
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`
    
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

    const prompt = `
      As an expert examiner, provide constructive feedback for this student's answer.
      The student was awarded ${score}/${maxScore} based on a rubric matching these points: ${JSON.stringify(matchedPoints)}.
      
      Question: ${question.question_text}
      Model Answer: ${details.model_answer || 'N/A'}
      Student's Answer: ${userAnswer}
      
      Requirements:
      1. Explain WHY the student got this score.
      2. Point out what they missed from the model answer.
      3. Suggest how to improve the response for full marks.
      
      Return ONLY a JSON object: {"feedback": "detailed string"}
    `

    try {
      const { data, error } = await supabase.functions.invoke('gemini-api', {
        body: { 
          action: 'grade', 
          payload: { 
            studentAnswer: userAnswer,
            modelAnswer: question.model_answer,
            keyPoints: matchedPoints
          } 
        }
      })

      if (error) throw error
      const text = data.candidates[0].content.parts[0].text
      const jsonMatch = text.match(/\{.*\}/s)
      const aiResult = JSON.parse(jsonMatch ? jsonMatch[0] : text)

      
      const result = { 
        score: score, 
        feedback: aiResult.feedback || "Based on your answer, you matched " + matchedPoints.length + " key points."
      }

      // Deduct Credit
      const userId = question.user_id // Assuming passed or available context
      if (userId) await this.deductCredit(userId, 'theory_grading')

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
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`

    const correctAns = question.answers?.find(a => a.is_correct)
    const selectedAns = selectedId ? question.answers?.find(a => a.id === selectedId) : null

    const prompt = `
      As a friendly educational tutor for a CBT practice app, explain this question clearly.
      Question: ${question.question_text}
      Correct Answer: ${correctAns?.option_letter}: ${correctAns?.option_text}
      ${selectedAns ? `The student selected: ${selectedAns.option_letter}: ${selectedAns.option_text}` : ''}
      
      Requirements:
      1. Provide a simple, 2-3 sentence explanation of the concept.
      2. If the student was wrong, gently explain the common mistake.
      3. Keep it encouraging and high-fidelity.
      
      Return ONLY a JSON object: {"explanation": "string"}
    `

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

      
      // Deduct Credit (userId should be passed)
      const userId = localStorage.getItem('cbt_user_id') // Fallback check or prefer explicit passing
      if (userId) await this.deductCredit(userId, 'explanation')

      return { explanation: aiResult.explanation }
    } catch (err) {
      console.error("AI Explanation Error:", err)
      return { error: "Could not generate explanation at this time." }
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
  }
}









