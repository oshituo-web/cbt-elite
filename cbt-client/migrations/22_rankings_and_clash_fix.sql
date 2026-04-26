-- 1. ENHANCE WEEKLY_SUMMARIES WITH SCORE TRACKING
ALTER TABLE public.weekly_summaries ADD COLUMN IF NOT EXISTS total_correct_answers BIGINT DEFAULT 0;

-- Update the sync function to track correct answers
CREATE OR REPLACE FUNCTION sync_user_performance(
    p_user_id UUID,
    p_total_questions INT,
    p_score_percentage INT,
    p_time_taken INT,
    p_topics JSONB,
    p_answered_questions INT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_week_start DATE := date_trunc('week', now())::DATE;
    v_topic RECORD;
    v_last_session DATE;
    v_streak INT;
    v_freeze_count INT;
    v_earned_coins INT;
    v_actual_answered INT;
    v_correct_count INT;
BEGIN
    v_actual_answered := COALESCE(p_answered_questions, p_total_questions);
    -- Calculate correct answers for this session
    v_correct_count := FLOOR(v_actual_answered * (p_score_percentage::FLOAT / 100.0));

    -- 1. Update Weekly Summary
    INSERT INTO weekly_summaries (user_id, week_start_date, total_questions_answered, total_correct_answers, average_score_percentage, total_study_duration_seconds)
    VALUES (p_user_id, v_week_start, v_actual_answered, v_correct_count, p_score_percentage, p_time_taken)
    ON CONFLICT (user_id, week_start_date) DO UPDATE SET
        total_questions_answered = weekly_summaries.total_questions_answered + v_actual_answered,
        total_correct_answers = weekly_summaries.total_correct_answers + v_correct_count,
        average_score_percentage = CASE 
            WHEN (weekly_summaries.total_questions_answered + v_actual_answered) > 0 
            THEN ((weekly_summaries.average_score_percentage * weekly_summaries.total_questions_answered) + (p_score_percentage * v_actual_answered)) / (weekly_summaries.total_questions_answered + v_actual_answered)
            ELSE p_score_percentage
        END,
        total_study_duration_seconds = weekly_summaries.total_study_duration_seconds + p_time_taken;

    -- 2. Update Topic Mastery
    FOR v_topic IN SELECT * FROM jsonb_to_recordset(p_topics) AS x(topic TEXT, subject TEXT, is_correct BOOLEAN)
    LOOP
        INSERT INTO topic_mastery (user_id, topic, subject, total_attempted, total_correct, mastery_percentage, last_practiced_at)
        VALUES (p_user_id, v_topic.topic, v_topic.subject, 1, CASE WHEN v_topic.is_correct THEN 1 ELSE 0 END, CASE WHEN v_topic.is_correct THEN 100 ELSE 0 END, now())
        ON CONFLICT (user_id, subject, topic) DO UPDATE SET
            total_attempted = topic_mastery.total_attempted + 1,
            total_correct = topic_mastery.total_correct + (CASE WHEN v_topic.is_correct THEN 1 ELSE 0 END),
            mastery_percentage = ROUND(((topic_mastery.total_correct + (CASE WHEN v_topic.is_correct THEN 1 ELSE 0 END))::FLOAT / (topic_mastery.total_attempted + 1)::FLOAT) * 100);
    END LOOP;

    -- 3. Calculate Earned Coins
    v_earned_coins := FLOOR((p_total_questions * (p_score_percentage::FLOAT / 100.0)) / 2.0);

    -- 4. Update User Streak
    SELECT last_session_date, COALESCE(streak_count, 0), COALESCE(streak_freeze_count, 0) 
    INTO v_last_session, v_streak, v_freeze_count
    FROM users WHERE id = p_user_id;

    IF v_last_session IS NULL THEN
        v_streak := 1;
    ELSIF v_last_session = (CURRENT_DATE - INTERVAL '1 day')::DATE THEN
        v_streak := v_streak + 1;
    ELSIF v_last_session = CURRENT_DATE THEN
    ELSE
        IF v_freeze_count > 0 THEN
            v_freeze_count := v_freeze_count - 1;
        ELSE
            v_streak := 1;
        END IF;
    END IF;

    -- 5. Final User Table Update
    UPDATE users SET
        streak_count = v_streak,
        streak_freeze_count = v_freeze_count,
        elite_coins = elite_coins + v_earned_coins + 
            (CASE WHEN (COALESCE(daily_questions_count, 0) < 50 AND COALESCE(daily_questions_count, 0) + v_actual_answered >= 50) THEN 50 ELSE 0 END),
        last_session_date = CURRENT_DATE,
        total_questions_answered = COALESCE(total_questions_answered, 0) + v_actual_answered,
        daily_questions_count = CASE 
            WHEN last_daily_reset_date = CURRENT_DATE THEN COALESCE(daily_questions_count, 0) + v_actual_answered
            ELSE v_actual_answered
        END,
        last_daily_reset_date = CURRENT_DATE
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. UPDATE GLOBAL RANKINGS TO USE SCORE (CUMULATIVE CORRECT ANSWERS)
CREATE OR REPLACE FUNCTION get_global_leaderboard()
RETURNS TABLE (
    username TEXT,
    total_score BIGINT,
    daily_questions_count INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.username,
        SUM(COALESCE(ws.total_correct_answers, 0))::BIGINT as total_score,
        MAX(COALESCE(u.daily_questions_count, 0)) as daily_questions_count
    FROM users u
    JOIN weekly_summaries ws ON ws.user_id = u.id
    GROUP BY u.id, u.username
    ORDER BY total_score DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. FIX CLASH SEED LOGIC (Target NEXT Saturday if called on Sunday)
CREATE OR REPLACE FUNCTION generate_weekly_clash_seeds()
RETURNS VOID AS $$
DECLARE
    -- Logic: If it's Sunday (DOW 0), target NEXT Saturday. If it's Mon-Sat, target THIS week's Saturday.
    v_week DATE := date_trunc('week', now() + INTERVAL '1 day')::date + INTERVAL '5 days'; 
    v_science_q UUID[];
    v_arts_q UUID[];
    v_comm_q UUID[];
    v_super_q UUID[];
    v_eng_id UUID;
    v_math_id UUID;
    v_phys_id UUID;
    v_chem_id UUID;
    v_lit_id UUID;
    v_gov_id UUID;
    v_crs_id UUID;
    v_econ_id UUID;
    v_acc_id UUID;
BEGIN
    -- Get Subject IDs
    SELECT id INTO v_eng_id FROM public.subjects WHERE subject_name = 'English';
    SELECT id INTO v_math_id FROM public.subjects WHERE subject_name = 'Mathematics';
    SELECT id INTO v_phys_id FROM public.subjects WHERE subject_name = 'Physics';
    SELECT id INTO v_chem_id FROM public.subjects WHERE subject_name = 'Chemistry';
    SELECT id INTO v_lit_id FROM public.subjects WHERE subject_name = 'Literature';
    SELECT id INTO v_gov_id FROM public.subjects WHERE subject_name = 'Government';
    SELECT id INTO v_crs_id FROM public.subjects WHERE subject_name = 'CRS';
    SELECT id INTO v_econ_id FROM public.subjects WHERE subject_name = 'Economics';
    SELECT id INTO v_acc_id FROM public.subjects WHERE subject_name = 'Financial Accounting';

    -- Science Saturday
    v_science_q := ARRAY(SELECT id FROM public.questions WHERE subject_id = v_eng_id AND is_active = true ORDER BY random() LIMIT 15) ||
                   ARRAY(SELECT id FROM public.questions WHERE subject_id = v_math_id AND is_active = true ORDER BY random() LIMIT 10) ||
                   ARRAY(SELECT id FROM public.questions WHERE subject_id = v_phys_id AND is_active = true ORDER BY random() LIMIT 10) ||
                   ARRAY(SELECT id FROM public.questions WHERE subject_id = v_chem_id AND is_active = true ORDER BY random() LIMIT 10);
    
    INSERT INTO scheduled_clashes (week_date, type, department, questions_json)
    VALUES (v_week, 'Normal', 'Science', to_jsonb(v_science_q))
    ON CONFLICT (week_date, type, department) DO UPDATE SET questions_json = EXCLUDED.questions_json;

    -- Arts Saturday
    v_arts_q := ARRAY(SELECT id FROM public.questions WHERE subject_id = v_eng_id AND is_active = true ORDER BY random() LIMIT 15) ||
                ARRAY(SELECT id FROM public.questions WHERE subject_id = v_lit_id AND is_active = true ORDER BY random() LIMIT 10) ||
                ARRAY(SELECT id FROM public.questions WHERE subject_id = v_gov_id AND is_active = true ORDER BY random() LIMIT 10) ||
                ARRAY(SELECT id FROM public.questions WHERE subject_id = v_crs_id AND is_active = true ORDER BY random() LIMIT 10);
    
    INSERT INTO scheduled_clashes (week_date, type, department, questions_json)
    VALUES (v_week, 'Normal', 'Arts', to_jsonb(v_arts_q))
    ON CONFLICT (week_date, type, department) DO UPDATE SET questions_json = EXCLUDED.questions_json;

    -- Commercial Saturday
    v_comm_q := ARRAY(SELECT id FROM public.questions WHERE subject_id = v_eng_id AND is_active = true ORDER BY random() LIMIT 15) ||
                ARRAY(SELECT id FROM public.questions WHERE subject_id = v_math_id AND is_active = true ORDER BY random() LIMIT 10) ||
                ARRAY(SELECT id FROM public.questions WHERE subject_id = v_econ_id AND is_active = true ORDER BY random() LIMIT 10) ||
                ARRAY(SELECT id FROM public.questions WHERE subject_id = v_acc_id AND is_active = true ORDER BY random() LIMIT 10);
    
    INSERT INTO scheduled_clashes (week_date, type, department, questions_json)
    VALUES (v_week, 'Normal', 'Commercial', to_jsonb(v_comm_q))
    ON CONFLICT (week_date, type, department) DO UPDATE SET questions_json = EXCLUDED.questions_json;

    -- Super League Sunday
    v_super_q := ARRAY(SELECT id FROM public.questions WHERE subject_id = v_eng_id AND is_active = true ORDER BY random() LIMIT 30) ||
                 ARRAY(SELECT id FROM public.questions WHERE subject_id = v_math_id AND is_active = true ORDER BY random() LIMIT 20);
    
    INSERT INTO scheduled_clashes (week_date, type, department, questions_json)
    VALUES (v_week + 1, 'Super', 'General', to_jsonb(v_super_q))
    ON CONFLICT (week_date, type, department) DO UPDATE SET questions_json = EXCLUDED.questions_json;
END;
$$ LANGUAGE plpgsql;
