import { supabase } from '../utils/supabase'
import { IndexedDbService } from './indexedDbService'
import { AiService } from './aiService'
import { RepetitionManager } from '../utils/repetitionManager'

export const DataService = {
  supabase,

  // --- PUSH NOTIFICATIONS ---
  async savePushToken(userId, subscription) {
    try {
      const { endpoint, keys } = subscription.toJSON();
      const { error } = await supabase.from('user_push_tokens').upsert({
        user_id: userId,
        endpoint: endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        updated_at: new Date().toISOString()
      }, { onConflict: 'endpoint' });
      
      if (error) throw error;
      return true;
    } catch (e) {
      console.error("DataService: Failed to save push token", e);
      return false;
    }
  },

  // --- CORE DATA ---
  
  /**
   * Fetches all available exams from the database.
   * @returns {Promise<{data: Array<Object>, error: Object|null}>} List of exams ordered by name.
   */
  async getExams() {
    const { data, error } = await supabase.from('exams').select('*').order('exam_name')
    return { data: data || [], error }
  },

  /**
   * Fetches all available subjects from the database.
   * @returns {Promise<{data: Array<Object>, error: Object|null}>} List of subjects ordered by name.
   */
  async getSubjects() {
    const { data, error } = await supabase.from('subjects').select('*').order('subject_name')
    return { data: data || [], error }
  },

  /**
   * Fetches unique syllabus topics for a given subject and optional exam.
   * @param {string|number} subjectId - The ID of the subject.
   * @param {string|number} [examId] - Optional exam ID to filter topics.
   * @returns {Promise<{data: Array<string>, error: Object|null}>} Sorted array of unique topic names.
   */
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

  /**
   * Fetches unique years available in the Past Questions Archive.
   */
  async getArchiveYears(examType, subjectId, minCount = 0) {
    let query = supabase
      .from('questions')
      .select('exam_year')
      .eq('is_past_question', true)
      .is('is_active', true);

    if (examType) query = query.eq('exam_type', examType);
    if (subjectId) query = query.eq('subject_id', subjectId);

    const { data, error } = await query;
    if (error) return { data: [], error };

    // Group by year and count
    const yearCounts = data.reduce((acc, q) => {
        if (q.exam_year) {
            acc[q.exam_year] = (acc[q.exam_year] || 0) + 1;
        }
        return acc;
    }, {});

    // Filter by minimum threshold
    const filteredYears = Object.entries(yearCounts)
        .filter(([year, count]) => count >= minCount)
        .map(([year]) => parseInt(year))
        .sort((a, b) => b - a);

    return { data: filteredYears, error: null };
  },

  // --- QUESTIONS ---
  
  /**
   * Retrieves a filtered list of questions with their answers and optional relationships.
   * Implements randomisation, tier-based restrictions, and repetition management logic.
   * @param {Object} filters - Search and filtering parameters.
   * @param {string|number} [filters.subject_id] - Filter by subject ID.
   * @param {string|number} [filters.exam_id] - Filter by exam ID.
   * @param {string} [filters.topic] - Filter by syllabus topic.
   * @param {string} [filters.exam_type] - Exam type identifier.
   * @param {string} [filters.difficulty] - Question difficulty level.
   * @param {string} [filters.search] - Full-text search string.
   * @param {boolean} [filters.randomize=false] - Whether to randomise the returned questions.
   * @param {number} [filters.limit=20] - Max questions to return.
   * @param {boolean} [filters.include_explanations=true] - Whether to join explanations.
   * @param {string} [filters.question_type='objective'] - Type of question ('objective' or 'theory').
   * @returns {Promise<{data: Array<Object>, error: Object|null}>} Formatted question list.
   */
  async getQuestions(filters = {}) {
    let selectFields = `
        *,
        subjects (subject_name),
        question_answers (*)
    `;
    
    if (filters.include_explanations !== false) {
        selectFields += `, question_explanations (explanation)`;
    }
    
    if (filters.question_type === 'theory') {
        selectFields += `, theory_details (*)`;
    } else {
        selectFields += `, question_groups (*)`;
    }

    const user = (await supabase.auth.getUser()).data.user;
    const userId = user?.id;
    
    let isPremium = false;
    if (userId) {
        const [{ data: profile }, { data: globalPremium }] = await Promise.all([
            this.getProfile(userId),
            this.getPremiumGlobalStatus()
        ]);
        isPremium = profile?.tier === 'premium' || profile?.tier === 'medium' || globalPremium === true;
    }

    if (!isPremium && filters.randomize) {
        filters.limit = Math.min(filters.limit || 10, 10);
    }

    let query = supabase
      .from('questions')
      .select(selectFields, { count: 'exact' })
      .eq('is_active', true)

    if (filters.question_type === 'theory') {
      query = query.eq('question_type', 'theory')
    } else {
      query = query.or('question_type.eq.objective,question_type.is.null')
    }

    if (filters.subject_id) query = query.eq('subject_id', filters.subject_id)
    if (filters.exam_id) query = query.eq('exam_id', filters.exam_id)
    if (filters.topic) query = query.eq('topic', filters.topic)
    
    // Determine the exam type for filtering and randomization
    const finalExamType = filters.exam_type || this.profile?.preferred_exam_type || 'JAMB';

    if (filters.difficulty) query = query.eq('difficulty', filters.difficulty)
    
    // 🔥 ENFORCEMENT: Filter by exam type unless explicitly told not to (e.g. for Admin Repository)
    if (filters.exam_type) {
        query = query.eq('exam_type', filters.exam_type)
    } else if (filters.require_exam_type !== false) {
        query = query.eq('exam_type', finalExamType)
    }
    if (filters.is_past_question !== undefined) query = query.eq('is_past_question', filters.is_past_question)
    
    // 🔥 DUAL SYSTEM: Strict source filtering
    if (filters.question_source === 'past') query = query.eq('is_past_question', true)
    if (filters.question_source === 'ai') query = query.eq('is_past_question', false)

    if (filters.exam_year) query = query.eq('exam_year', filters.exam_year)
    // 🛡️ FIX WARN-02: Validate search term length to prevent full-table scans.
    // A bare '%' or single-char search causes a sequential scan on the questions table.
    if (filters.search) {
      const term = String(filters.search).trim().substring(0, 100) // max 100 chars
      if (term.length >= 3) {
        query = query.ilike('question_text', `%${term}%`)
      }
      // Silently skip searches shorter than 3 chars — UI should enforce this too
    }

    if (filters.randomize) {
      try {
        let excludeIds = [];
        if (isPremium && userId && userId !== 'anon') {
            const { data: seenData } = await supabase
                .from('user_seen_questions')
                .select('question_id')
                .eq('user_id', userId);
            if (seenData) excludeIds = seenData.map(s => s.question_id);
        }

        const seenIds = RepetitionManager.getSeenIds();
        const combinedExclude = [...new Set([...excludeIds, ...seenIds])];
        
        const isPastReq = filters.question_source === 'past' ? true : (filters.question_source === 'ai' ? false : (filters.is_past_question ?? null));
        
        const { data: randomIds, error: idError } = await supabase.rpc('get_random_question_ids', {
          p_subject_id: filters.subject_id || null,
          p_exam_id: filters.exam_id || null,
          p_exam_type: finalExamType,
          p_topic: filters.topic || null,
          p_question_type: filters.question_type || 'objective',
          p_limit: filters.limit || 20,
          p_exclude_ids: combinedExclude,
          p_is_past_question: isPastReq
        })
        
        if (idError) throw idError
        
        if (randomIds && Array.isArray(randomIds) && randomIds.length > 0) {
          let ids = randomIds.map(r => (typeof r === 'object' && r !== null) ? r.id : r).filter(Boolean);
          query = query.in('id', ids)
        } else {
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
        throw error
    }

    const formattedData = this._formatQuestions(data || []);
    
    if (formattedData.length > 0 && filters.randomize) {
        const questionIds = formattedData.map(q => q.id);
        RepetitionManager.markAsSeen(questionIds);
        
        if (isPremium && userId) {
            const seenPayload = questionIds.map(qid => ({ user_id: userId, question_id: qid }));
            supabase.from('user_seen_questions')
                .upsert(seenPayload, { onConflict: 'user_id,question_id', ignoreDuplicates: true })
                .then(({ error }) => {
                    if (error) console.warn("Error recording seen questions:", error.message);
                });
        }
    }

    return { data: formattedData, error, count }
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

  async getQuestionsByIds(ids) {
    if (!ids || ids.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
      .from('questions')
      .select(`
        *,
        subjects (subject_name),
        question_groups (*),
        question_answers (*),
        question_explanations (explanation),
        theory_details (*)
      `)
      .in('id', ids)
      .eq('is_active', true);
    
    return { data: data || [], error };
  },

  async getUnresolvedMistakeIds(userId, limit = 50) {
    // 💡 Logic: Find questions where the user's LATEST attempt was incorrect.
    const { data, error } = await supabase
      .from('user_responses')
      .select('question_id, is_correct, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200); 

    if (error) return { data: [], error };

    const latestAttempts = new Map();
    data.forEach(resp => {
      if (!latestAttempts.has(resp.question_id)) {
        latestAttempts.set(resp.question_id, resp.is_correct);
      }
    });

    const unresolvedIds = [];
    for (const [qid, isCorrect] of latestAttempts.entries()) {
      if (!isCorrect) {
        unresolvedIds.push(qid);
      }
    }

    return { data: unresolvedIds.slice(0, limit), error: null };
  },

  // --- USER & SESSIONS ---
  async getProfile(userId) {
    if (!userId || userId === 'anon') return { data: null, error: 'Invalid User ID' }
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single()
    return { data, error }
  },

  async getPremiumGlobalStatus() {
    const { data, error } = await supabase.from('system_config').select('value').eq('key', 'exams_free_access').maybeSingle()
    return { data: data?.value === true || data?.value === 'true', error }
  },

  // NOTE: purchaseEliteItem is defined below (uses atomic_store_purchase RPC).
  // buyStreakFreeze is handled by the atomic_store_purchase RPC on the DB side.

  async updateUser(userId, updates) {
    // Note: Restricted columns (tier, credits) will be blocked by DB trigger
    return await supabase.from('users').update(updates).eq('id', userId).select()
  },

  async saveExamSession(userId, sessionData, questions, userAnswers, isSyncing = false, questionSource = 'ai') {
    try {
      let payload = { 
        user_id: userId, 
        ...sessionData, 
        question_source: questionSource,
        completed_at: new Date().toISOString() 
      }
      let { data: session, error: sError } = await supabase
        .from('exam_sessions')
        .insert(payload)
        .select()
        .single()

      // Fallback for unapplied DB migrations (rescues stuck offline syncs)
      if (sError && sError.code === 'PGRST204') {
         console.warn("Supabase schema cache missing new columns. Retrying with legacy shape...")
         delete payload.answered_questions
         delete payload.time_taken_seconds
         
         const fallback = await supabase
            .from('exam_sessions')
            .insert(payload)
            .select()
            .single()
            
         session = fallback.data
         sError = fallback.error
      }

      if (sError) throw sError

      const responses = questions.map((q, i) => ({
        session_id: session.id,
        user_id: userId,
        question_id: q.id,
        user_answer_text: userAnswers[i]?.toString() || (q.question_type === 'theory' ? "No answer provided." : null),
        is_correct: q.question_type !== 'theory' && (userAnswers[i] === q.answers.find(a => a.is_correct)?.id)
      }))

      await supabase.from('user_responses').insert(responses)
      const { error: syncError } = await this.syncPerformanceData(userId, sessionData, questions, userAnswers, questionSource)
      
      if (syncError) {
          console.error("Critical Sync Error:", syncError)
          throw syncError
      }
      
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

  async syncPerformanceData(userId, sessionData, questions, userAnswers, questionSource = 'ai') {
    const topicsPayload = questions.map((q, i) => ({
        topic: q.topic || 'General',
        subject: q.subject || 'General',
        is_correct: q.question_type !== 'theory' && (userAnswers[i] === q.answers.find(a => a.is_correct)?.id)
    }))

    // 💡 Use Intl.DateTimeFormat with en-CA locale to get a stable YYYY-MM-DD string in WAT
    const localDate = new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'Africa/Lagos' 
    }).format(new Date());

    // 🛡️ HARDENING: Ensure all types are strictly correct to prevent 400 Bad Request
    const payload = {
        p_user_id: userId,
        p_total_questions: parseInt(sessionData.total_questions) || 0,
        p_score_percentage: parseInt(sessionData.score_percentage) || 0,
        p_time_taken: parseInt(sessionData.time_taken_seconds) || 0,
        p_topics: topicsPayload,
        p_answered_questions: parseInt(sessionData.answered_questions) || 0,
        p_client_date: localDate,
        p_session_type: (sessionData.session_type || 'practice').toString(),
        p_question_source: questionSource
    };

    console.log("DataService: Syncing performance with payload:", payload);

    // 🛡️ STREAK & COINS LOGIC: Increment or Reset based on date difference
    try {
        const { data: profile } = await supabase.from('users').select('streak_count, last_session_date, elite_coins').eq('id', userId).single();
        if (profile) {
            const todayStr = localDate; // YYYY-MM-DD
            
            // Normalize dates to UTC midnight to avoid timezone math bugs
            const todayObj = new Date(todayStr + "T00:00:00.000Z");
            let lastDateObj = null;
            if (profile.last_session_date) {
                const lastStr = profile.last_session_date.substring(0, 10);
                lastDateObj = new Date(lastStr + "T00:00:00.000Z");
            }
            
            const diffDays = lastDateObj ? Math.round((todayObj - lastDateObj) / (1000 * 60 * 60 * 24)) : 1;
            
            let newStreak = profile.streak_count || 0;
            let finalFreezes = profile.streak_freeze_count || 0;
            
            if (diffDays === 1) {
                newStreak += 1;
                console.log("Streak Increment:", { todayStr, lastStr: profile.last_session_date, diffDays, newStreak });
            } else if (diffDays > 1) {
                // MISSING DAY: Check for Freeze
                if (finalFreezes > 0) {
                    finalFreezes -= 1;
                    console.log("Streak FROZEN:", { todayStr, lastStr: profile.last_session_date, diffDays, remainingFreezes: finalFreezes });
                } else {
                    newStreak = 1;
                    console.log("Streak Reset:", { todayStr, lastStr: profile.last_session_date, diffDays, newStreak });
                }
            } else if (!lastDateObj) {
                newStreak = 1;
            } else {
                console.log("Streak: Already recorded today.");
            }

            // Calculate Elite Coins
            const scorePercent = parseInt(sessionData.score_percentage) || 0;
            const totalQs = parseInt(sessionData.total_questions) || 0;
            const earnedCoins = Math.ceil((totalQs * (scorePercent / 100)) / 2);
            
            // 🔥 CLASH SUPER BONUS (Handled manually here if needed, or rely on existing clash logic, but session rewards are baseline)
            const isClash = sessionData.session_type === 'clash';
            const day = new Date().getDay();
            const isSunday = day === 0;
            const bonusCoins = (isClash && scorePercent >= 80) ? (isSunday ? 200 : 100) : 0;
            
            const newCoins = (profile.elite_coins || 0) + earnedCoins + bonusCoins;

            // Persist the verified streak, date, and coins
            await supabase.from('users').update({ 
                streak_count: newStreak, 
                last_session_date: todayStr,
                elite_coins: newCoins,
                streak_freeze_count: finalFreezes
            }).eq('id', userId);
        }
    } catch (e) {
        console.warn("Streak sync failed, continuing performance save:", e);
    }

    return await supabase.rpc('sync_user_performance', payload);
  },

  // --- LEAGUES ---
  async syncLeagueStatus(userId) {
    return await supabase.rpc('join_league_group', { p_user_id: userId })
  },

  async getLeagueTable(userId) {
    return await supabase.rpc('get_league_table', { p_user_id: userId })
  },

  async getWeeklyClash(userId) {
    const { data, error } = await supabase.rpc('get_weekly_clash', { p_user_id: userId });
    
    if (error) return { data: null, error: error.message };
    
    // RPC returns a table/array, pick the first one if it exists
    const clash = (data && data.length > 0) ? data[0] : null;

    if (!clash) {
      const now = new Date();
      const isSunday = now.getDay() === 0;
      return { 
        data: null, 
        error: isSunday ? "Elite League Restricted: Only Top 3 from Saturday can enter." : "No clash active for your department yet." 
      };
    }
    
    const { data: questions } = await this.getQuestionsByIds(clash.data);
    return { 
        data: this._formatQuestions(questions || []), 
        duration: clash.duration || 45,
        clashId: clash.clash_id 
    };
  },

  async generateWeeklyClashSeeds() {
    return await supabase.rpc('generate_weekly_clash_seeds')
  },

  async processClashPromotions() {
    return await supabase.rpc('process_clash_promotions')
  },

  // --- CLASH HARDENING & RANKINGS ---
  getWATDate() {
    // 💡 Returns a Date object representing the current time in West Africa (GMT+1)
    const now = new Date();
    return new Date(now.toLocaleString("en-US", {timeZone: "Africa/Lagos"}));
  },

  async syncClashProgress(clashId, userId, answers, answeredCount, totalCount) {
    return await supabase.rpc('sync_clash_progress', {
        p_clash_id: clashId,
        p_user_id: userId,
        p_answers: answers,
        p_answered_count: answeredCount,
        p_total_count: totalCount
    })
  },

  async submitClashResults(clashId, userId, score, timeTaken) {
    return await supabase.rpc('submit_clash_results', {
        p_clash_id: clashId,
        p_user_id: userId,
        p_score: score,
        p_time_taken: timeTaken
    })
  },

  async getClashLeaderboard(clashId) {
    return await supabase.rpc('get_clash_leaderboard', { p_clash_id: clashId })
  },

  // --- ANALYTICS ---
  async getUserAnalytics(userId) {
    if (!userId || userId === 'anon') {
      return { 
        history: [], 
        mastery: [], 
        subjectMastery: [], 
        stats: {
          overall: { total: 0, correct: 0, time: 0 },
          bySubject: {},
          byMode: { 'practice': { total: 0, correct: 0 }, 'exam': { total: 0, correct: 0 } }
        },
        weekly: {
          total_questions_answered: 0,
          correct_answers: 0,
          time_taken_seconds: 0,
          average_score_percentage: 0
        },
        profile: null,
        error: null 
      };
    }

    let userProfile = {
        daily_questions_count: 0,
        streak_count: 0,
        last_daily_reset_date: null
    }

    try {
        const { data, error } = await supabase
            .from('users')
            .select('daily_questions_count, streak_count, last_daily_reset_date, elite_coins, streak_freeze_count, league_tier, has_seen_tour, username, has_league_insurance, last_ai_score_prediction, total_questions_answered, eliminate_2_uses')
            .eq('id', userId)
            .single()
        
        if (data && !error) {
            userProfile = data
        } else if (error) {
            console.warn("DataService: Profile column fetch failed (might be missing columns). Using safe defaults.", error.message)
        }
    } catch (err) {
        console.error("DataService: Critical error in getUserAnalytics profile fetch:", err)
    }
    
    let sessions = []
    let hError = null
    try {
        const { data, error } = await supabase
          .from('exam_sessions')
          .select('total_questions, correct_answers, completed_at, answered_questions, time_taken_seconds')
          .eq('user_id', userId)
          .order('completed_at', { ascending: false })
          .limit(50)
        
        if (data) sessions = data
        hError = error
    } catch (err) {
        console.error("DataService: Exam sessions fetch failed:", err)
    }

    const history = sessions ? sessions.map(s => ({
      total_questions: s.total_questions || 0,
      answered_questions: s.answered_questions ?? s.total_questions ?? 0, // Fallback to total for legacy data
      correct_answers: s.correct_answers || 0,
      score_percentage: s.total_questions > 0 ? Math.round(((s.correct_answers || 0) / (s.total_questions || 1)) * 100) : 0,
      time_taken_seconds: s.time_taken_seconds || 0,
      created_at: s.completed_at
    })) : []

    const { data: statsData } = await supabase
      .from('user_responses')
      .select('is_correct, time_spent_seconds, questions(subject)')
      .eq('user_id', userId)

    const stats = {
      overall: { 
          total: Math.max(sessions.reduce((acc, s) => acc + (s.answered_questions ?? s.total_questions ?? 0), 0), userProfile.total_questions_answered || 0), 
          correct: sessions.reduce((acc, s) => acc + (s.correct_answers || 0), 0), 
          time: sessions.reduce((acc, s) => acc + (s.time_taken_seconds || 0), 0) 
      },
      bySubject: {},
      byMode: { 'practice': { total: 0, correct: 0 }, 'exam': { total: 0, correct: 0 } }
    }

    // Weekly Snapshot Calculation
    const nowWAT = this.getWATDate()
    const sevenDaysAgo = new Date(nowWAT)
    sevenDaysAgo.setDate(nowWAT.getDate() - 7)

    const weekly = {
      total_questions_answered: 0,
      correct_answers: 0,
      time_taken_seconds: 0,
      average_score_percentage: 0
    }

    // Aggregate subjects from user_responses, but don't override the overall session-based totals
    if (statsData) {
      statsData.forEach(r => {
        const sub = r.questions?.subject || 'General'
        if (!stats.bySubject[sub]) stats.bySubject[sub] = { total: 0, correct: 0 }
        stats.bySubject[sub].total++
        if (r.is_correct) stats.bySubject[sub].correct++
      })
    }

    // Calculate By Mode and Weekly from sessions
    if (sessions) {
      sessions.forEach(s => {
        const mode = s.session_type === 'exam' ? 'exam' : 'practice'
        if (!stats.byMode[mode]) stats.byMode[mode] = { total: 0, correct: 0 }
        stats.byMode[mode].total += (s.answered_questions ?? s.total_questions ?? 0)
        stats.byMode[mode].correct += (s.correct_answers || 0)

        const compDate = new Date(s.completed_at)
        if (compDate >= sevenDaysAgo) {
          weekly.total_questions_answered += (s.answered_questions ?? s.total_questions ?? 0)
          weekly.correct_answers += (s.correct_answers || 0)
          weekly.time_taken_seconds += (s.time_taken_seconds || 0)
        }
      })
      if (weekly.total_questions_answered > 0) {
        weekly.average_score_percentage = Math.round((weekly.correct_answers / weekly.total_questions_answered) * 100)
      }
    }

    const { data: masteryData, error: mError } = await supabase
      .from('topic_mastery')
      .select('subject, mastery_percentage, total_attempted, topic')
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
    
    return { 
      history, 
      mastery: masteryData || [], // Keep full mastery for Topic Analysis
      subjectMastery: processedMastery, 
      stats, 
      weekly,
      profile: userProfile,
      error: hError || mError 
    }
  },

  async getReadinessScore(userId, subjectName) {
    try {
      const { data: topics } = await supabase.from('syllabus_topics').select('topic, subjects!inner(subject_name)').eq('subjects.subject_name', subjectName)
      const { data: mastery } = await supabase.from('topic_mastery').select('topic').eq('user_id', userId).eq('subject', subjectName).gt('mastery_percentage', 70)

      const totalTopics = [...new Set((topics || []).map(t => t.topic))].length
      const masteredTopics = (mastery || []).length
      return { data: totalTopics > 0 ? Math.round((masteredTopics / totalTopics) * 100) : 0, error: null }
    } catch (err) {
      return { error: err.message }
    }
  },

  async aiRegenerateQuestion(questionId, reason, details) {
    try {
      const { data: q, error: qErr } = await supabase
        .from('questions')
        .select('*')
        .eq('id', questionId)
        .single();
      
      if (qErr) throw qErr;

      // Import AiService dynamically to avoid circular dependencies
      const { AiService } = await import('./aiService');
      const repaired = await AiService.repairQuestion(q.question_text, reason, details);
      
      return { data: repaired, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  // --- SECURE MONETIZATION (RPCs) ---

  async useAICredit(userId, action = 'explanation') {
    return await supabase.rpc('secure_deduct_credit', { p_user_id: userId, p_action: action })
  },

  async getPracticeQuestions(subjectName, topic = '', limit = 25, examType = '', questionSource = 'ai', examYear = '') {
    let subjectId = undefined;
    let examId = undefined;

    try {
        const fetchSubject = async () => {
            if (!subjectName) return null;
            let { data: subs } = await supabase.from('subjects').select('id').eq('subject_name', subjectName);
            if (!subs || subs.length === 0) {
                let fuzzySearch = subjectName.toLowerCase().includes('english') ? '%English%' : `%${subjectName}%`;
                const res = await supabase.from('subjects').select('id').ilike('subject_name', fuzzySearch);
                subs = res.data;
            }
            return subs?.[0]?.id;
        };

        const fetchExam = async () => {
            if (!examType) return null;
            let { data: exams } = await supabase.from('exams').select('id').ilike('exam_name', `%${examType}%`);
            return exams?.[0]?.id;
        };

        const [sId, eId] = await Promise.all([fetchSubject(), fetchExam()]);
        subjectId = sId;
        examId = eId;

        if (subjectName && !subjectId) {
            console.error(`ERROR: Subject mapping failed for "${subjectName}".`);
            return { data: [], error: 'Subject mapping failed in DB', count: 0 };
        }

        // --- VARIETY SAFEGUARD ---
        if (topic) {
            const seenIds = RepetitionManager.getSeenIds();
            const { count: totalInTopic } = await supabase
                .from('questions')
                .select('*', { count: 'exact', head: true })
                .eq('subject_id', subjectId)
                .eq('topic', topic)
                .eq('is_active', true);

            if (totalInTopic > 0 && seenIds.length > (totalInTopic * 0.8)) {
                topic = undefined; 
            }
        }

        return await this.getQuestions({
            subject_id: subjectId,
            topic: topic || undefined,
            limit: limit,
            randomize: true,
            exam_type: examType || undefined,
            question_source: questionSource,
            exam_year: examYear ? parseInt(examYear) : undefined
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

  async purchaseEliteItem(userId, itemId, price) {
    return await supabase.rpc('atomic_store_purchase', {
        p_user_id: userId,
        p_item_id: itemId,
        p_cost: price
    })
  },

  async usePowerUp(userId, powerUpType) {
    return await supabase.rpc('use_power_up', {
        p_user_id: userId,
        p_power_up_type: powerUpType
    })
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
      try {
        const correctAns = question.answers?.find(a => a.is_correct)
        const correctId = correctAns?.id || 'unknown'
        
        const explanation = await AiService.getDeepExplanation(question, selectedId, correctId)
        return { explanation }
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
    const { data, error } = await supabase.rpc('get_global_leaderboard');
    if (error || !data) return { data: data || [], error };
    
    // Map the flat RPC output back into the nested shape the UI expects
    // Also include top-level username for easier lookups
    const mappedData = data.map(d => ({
        username: d.username,
        total_questions_answered: d.total_questions || 0,
        total_score: d.total_score || 0,
        users: { 
            username: d.username, 
            daily_questions_count: d.daily_questions_count 
        }
    }));
    
    return { data: mappedData, error: null };
  },

  async getLatestClashLeaderboard(userId, department) {
    try {
        // 1. Find the latest completed clash for this department
        const { data: clash, error: cErr } = await supabase
            .from('scheduled_clashes')
            .select('id')
            .eq('department', department)
            .eq('type', 'Normal')
            .lte('week_date', new Date().toISOString())
            .order('week_date', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (cErr || !clash) throw new Error("No recent clan clash found for your department.");

        // 2. Fetch the leaderboard for this clash
        return await this.getClashLeaderboard(clash.id);
    } catch (err) {
        return { data: null, error: err.message };
    }
  },

  async getAuditQuestions(filters = {}) {
    const limit = filters.limit || 50;
    
    // 1. Fetch questions with high report counts (priority)
    const { data: reported } = await supabase
      .from('question_reports')
      .select('question_id, questions(*, question_answers(*))')
      .eq('status', 'pending')
      .limit(limit);

    // 2. Fetch questions with structural gaps (missing explanation or null options)
    const { data: gaps } = await supabase
      .from('questions')
      .select('*, question_answers(*)')
      .or('explanation.eq.,explanation.is.null')
      .limit(limit);

    // 3. Fetch questions with logical gaps (missing correct answer)
    const { data: logicalGaps } = await supabase
      .from('question_answers')
      .select('question_id, questions(*, question_answers(*))')
      .or('correct_option.is.null,correct_option.eq.')
      .limit(limit);

    // Merge and deduplicate
    const combined = [];
    const seenIds = new Set();

    if (reported) {
      reported.forEach(r => {
        if (r.questions && !seenIds.has(r.questions.id)) {
          combined.push({ ...r.questions, audit_reason: 'User Reported' });
          seenIds.add(r.questions.id);
        }
      });
    }

    if (gaps) {
      gaps.forEach(g => {
        if (!seenIds.has(g.id)) {
          combined.push({ ...g, audit_reason: 'Structural Gap' });
          seenIds.add(g.id);
        }
      });
    }

    if (logicalGaps) {
      logicalGaps.forEach(lg => {
        if (lg.questions && !seenIds.has(lg.questions.id)) {
          combined.push({ ...lg.questions, audit_reason: 'Missing Correct Answer' });
          seenIds.add(lg.questions.id);
        }
      });
    }

    // Shuffle combined array so admin doesn't always see the exact same 50 errors
    for (let i = combined.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combined[i], combined[j]] = [combined[j], combined[i]];
    }

    // Filter by subject if specified
    const filtered = filters.subject 
      ? combined.filter(q => q.subject === filters.subject)
      : combined;

    const formattedData = this._formatQuestions(filtered.slice(0, limit));

    return { data: formattedData, error: null };
  },

  async getMockHistory(userId, examType = 'JAMB') {
    const { data, error } = await supabase
      .from('exam_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('session_type', 'exam')  // 'exam' is the session_type for mock exams
      .order('completed_at', { ascending: false })
      .limit(20);
    
    // Filter client-side for JAMB mock sessions (100+ questions) since DB schema
    // doesn't have exam_type or total_questions columns yet
    const filtered = (data || []).filter(s => 
      (s.total_questions >= 100) || (s.subject && s.subject.toLowerCase().includes('jamb'))
    );
    
    return { data: filtered, error };
  },

  async syncOfflinePool() {
    // 🛡️ FIX WARN-09: Fetch a truly randomized pool using DB-side RPC
    const { data: randomIds } = await supabase.rpc('get_random_question_ids', {
      p_limit: 500
    });

    if (!randomIds || randomIds.length === 0) return;

    const { data } = await supabase
      .from('questions')
      .select('*, question_answers(*)')
      .in('id', randomIds);
    
    if (data) {
      const shuffled = [...data].sort(() => Math.random() - 0.5);
      await IndexedDbService.saveQuestions(this._formatQuestions(shuffled));
      console.log(`✅ Synced ${data.length} questions to offline storage.`);
    }
  },

  // --- ADMIN: USER MANAGEMENT ---
  async getAllUsers() {
    // 🛡️ FIX: Fetch all necessary columns for Tier Resolution and UI
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email, tier, role, created_at, is_flagged, flag_reason, league_tier, streak_count, elite_coins, total_questions_answered, activation_status, last_session_date, premium_until, ai_credits, ai_daily_usage, last_active_at')
      .order('created_at', { ascending: false })
    return { data: data || [], error }
  },

  async updateUser(userId, updates) {
    return await supabase.from('users').update(updates).eq('id', userId)
  },

  async deleteUser(userId) {
    return await supabase.from('users').delete().eq('id', userId)
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
  async updateQuestion(id, updates) {
    return await supabase.from('questions').update(updates).eq('id', id)
  },

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
    let failCount = 0;
    let errors = [];
    
    for (const q of questions) {
      // 🛡️ PRE-IMPORT VALIDATION
      const hasCorrect = q.answers && q.answers.some(a => a.is_correct);
      if (!hasCorrect) {
        console.error("Bulk Import Validation Failed: No correct answer for question:", q.question_text.substring(0, 50));
        failCount++;
        errors.push(`Missing correct answer: "${q.question_text.substring(0, 30)}..."`);
        continue;
      }

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
        failCount++;
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
    
    return { count: successCount, failed: failCount, errors, error: null }
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

  async getSystemConfig(key = null) {
    let query = supabase.from('system_config').select('*')
    if (key) {
      const { data, error } = await query.eq('key', key).maybeSingle()
      return { data, error }
    }
    return await query
  },

  // --- ADMIN: ANALYTICS & AUDIT ---
  async getGlobalAnalytics() {
    // 🛡️ FIX WARN-06: Use DB-side aggregate RPC instead of fetching all session rows.
    // The old approach transferred every session to the browser just to compute AVG —
    // this will timeout at scale. The RPC computes everything server-side in one query.
    const { data, error } = await supabase.rpc('get_global_analytics');

    if (error || !data) {
      console.error('getGlobalAnalytics RPC failed:', error);
      return {
        stats: { totalUsers: 0, totalQuestions: 0, averagePerformance: 0 },
        sessions: [],
        error: error?.message || 'Analytics unavailable'
      };
    }

    return {
      stats: {
        totalUsers: data.total_users || 0,
        totalQuestions: data.total_questions || 0,
        averagePerformance: data.average_score || 0,
        totalSessions: data.total_sessions || 0,
        online_users: data.online_users || 0
      },
      // score_dist powers the histogram chart — replaces the raw sessions array
      sessions: (data.score_dist || []).map(b => ({ score_percentage: b.range_label, count: b.count })),
      error: null
    };
  },

  async getRevenueStats() {
    return await supabase.from('users').select('tier, email, created_at')
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
      // Fetch question context first
      const { data: q } = await supabase.from('questions').select('question_text').eq('id', qid).single()
      if (!q) throw new Error("Question not found")

      // Use dynamic import to avoid circular dependency
      const { AiService } = await import('./aiService')
      const data = await AiService.repairQuestion(q.question_text, reason, details)
      return { data, error: null }
    } catch (err) {
      return { data: null, error: err.message }
    }
  },

  async commitRepair(qid, cleanData) {
    // 1. Update Question Text and Basic Metadata
    const { error: qErr } = await this.updateQuestion(qid, {
        question_text: cleanData.question_text,
        explanation: cleanData.explanation
    })
    if (qErr) return { error: qErr }

    // 2. Update Answers and Explanation in linked table
    const { error: aErr } = await this.updateQuestionAnswers(qid, {
        option_a: cleanData.option_a,
        option_b: cleanData.option_b,
        option_c: cleanData.option_c,
        option_d: cleanData.option_d,
        correct_option: cleanData.correct_option,
        explanation: cleanData.explanation
    })
    
    // 3. Mark reports as resolved for this question
    await supabase.from('question_reports').update({ status: 'resolved' }).eq('question_id', qid)

    return { error: aErr }
  },

  async runWeeklyLeagueReset() {
    return await supabase.rpc('run_weekly_league_reset')
  },

  async generateWeeklyClashSeeds() {
    return await supabase.rpc('generate_weekly_clash_seeds')
  },

  async processClashPromotions() {
    return await supabase.rpc('process_clash_promotions')
  },

  // --- ADMIN: NEWS ---
  async getNewsUpdates(limit = 10) {
    return await supabase.from('news_updates').select('*').order('created_at', { ascending: false }).limit(limit)
  },

  async adminCreateNews(news) {
    return await supabase.from('news_updates').insert(news)
  },

  async adminUpdateNews(id, news) {
    return await supabase.from('news_updates').update(news).eq('id', id)
  },

  async adminDeleteNews(id) {
    return await supabase.from('news_updates').delete().eq('id', id)
  },

  async adminUploadNewsAttachment(file) {
    const fileName = `${Date.now()}_${file.name.replace(/\s/g, '_')}`
    const { data, error } = await supabase.storage.from('news_attachments').upload(fileName, file)
    if (error) return { error }
    const { data: { publicUrl } } = supabase.storage.from('news_attachments').getPublicUrl(fileName)
    return { url: publicUrl, error: null }
  },

  async useAICredit(userId, action = 'tutor_chat') {
    const { error } = await supabase.rpc('secure_deduct_credit', { 
      p_user_id: userId, 
      p_action: action 
    })
    return { error }
  }
}
