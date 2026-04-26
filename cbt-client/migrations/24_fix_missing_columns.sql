-- =======================================================================
-- MIGRATION: 24_fix_missing_columns
-- DESCRIPTION: Ensures all required columns for performance tracking exist.
-- =======================================================================

-- 1. Ensure weekly_summaries has total_correct_answers
ALTER TABLE public.weekly_summaries 
ADD COLUMN IF NOT EXISTS total_correct_answers BIGINT DEFAULT 0;

-- 2. Ensure users has streak_count and other engagement columns
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS streak_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_session_date DATE,
ADD COLUMN IF NOT EXISTS daily_questions_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_daily_reset_date DATE,
ADD COLUMN IF NOT EXISTS streak_freeze_count INT DEFAULT 0;

-- 3. Update the sync function one more time to ensure it handles NULLs gracefully
CREATE OR REPLACE FUNCTION sync_user_performance(
    p_user_id UUID,
    p_total_questions INT,
    p_score_percentage INT,
    p_time_taken INT,
    p_topics JSONB,
    p_answered_questions INT DEFAULT NULL,
    p_client_date DATE DEFAULT CURRENT_DATE,
    p_session_type TEXT DEFAULT 'practice'
) RETURNS VOID AS $$
DECLARE
    v_week_start DATE := date_trunc('week', p_client_date)::DATE;
    v_topic RECORD;
    v_last_session DATE;
    v_streak INT;
    v_freeze_count INT;
    v_earned_coins INT;
    v_actual_answered INT;
    v_correct_count INT;
BEGIN
    -- 0. Preparation
    v_actual_answered := COALESCE(p_answered_questions, p_total_questions);
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
    IF p_topics IS NOT NULL AND jsonb_array_length(p_topics) > 0 THEN
        FOR v_topic IN SELECT * FROM jsonb_to_recordset(p_topics) AS x(topic TEXT, subject TEXT, is_correct BOOLEAN)
        LOOP
            INSERT INTO topic_mastery (user_id, topic, subject, total_attempted, total_correct, mastery_percentage, last_practiced_at)
            VALUES (p_user_id, v_topic.topic, v_topic.subject, 1, CASE WHEN v_topic.is_correct THEN 1 ELSE 0 END, CASE WHEN v_topic.is_correct THEN 100 ELSE 0 END, now())
            ON CONFLICT (user_id, subject, topic) DO UPDATE SET
                total_attempted = topic_mastery.total_attempted + 1,
                total_correct = topic_mastery.total_correct + (CASE WHEN v_topic.is_correct THEN 1 ELSE 0 END),
                mastery_percentage = ROUND(((topic_mastery.total_correct + (CASE WHEN v_topic.is_correct THEN 1 ELSE 0 END))::FLOAT / (topic_mastery.total_attempted + 1)::FLOAT) * 100),
                last_practiced_at = now();
        END LOOP;
    END IF;

    -- 3. Calculate Earned Coins
    v_earned_coins := FLOOR(v_correct_count / 2.0);

    -- 4. Update User Streak
    SELECT last_session_date, COALESCE(streak_count, 0), COALESCE(streak_freeze_count, 0) 
    INTO v_last_session, v_streak, v_freeze_count
    FROM users WHERE id = p_user_id;

    IF v_last_session IS NULL THEN
        v_streak := 1;
    ELSIF v_last_session = (p_client_date - INTERVAL '1 day')::DATE THEN
        v_streak := v_streak + 1;
    ELSIF v_last_session = p_client_date THEN
        -- Already done today
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
        last_session_date = p_client_date,
        total_questions_answered = COALESCE(total_questions_answered, 0) + v_actual_answered,
        daily_questions_count = CASE 
            WHEN last_daily_reset_date = p_client_date THEN COALESCE(daily_questions_count, 0) + v_actual_answered
            ELSE v_actual_answered
        END,
        last_daily_reset_date = p_client_date
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
