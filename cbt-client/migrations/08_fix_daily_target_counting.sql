-- =======================================================================

-- 1. Ensure the column exists on exam_sessions
ALTER TABLE public.exam_sessions ADD COLUMN IF NOT EXISTS answered_questions INT;

-- 2. Update the function to support accurate daily counting
CREATE OR REPLACE FUNCTION sync_user_performance(
    p_user_id UUID,
    p_total_questions INT, -- Still used for Accuracy calculation
    p_score_percentage INT, -- Still used for Coin calculation logic
    p_time_taken INT,
    p_topics JSONB,
    p_answered_questions INT DEFAULT NULL -- NEW: The actual count of answered questions
) RETURNS VOID AS $$
DECLARE
    v_week_start DATE := date_trunc('week', now())::DATE;
    v_topic RECORD;
    v_last_session DATE;
    v_streak INT;
    v_freeze_count INT;
    v_earned_coins INT;
    v_actual_answered INT;
BEGIN
    -- Fallback to total if new param is null (backward compatibility)
    v_actual_answered := COALESCE(p_answered_questions, p_total_questions);

    -- 1. Update Weekly Summary
    INSERT INTO weekly_summaries (user_id, week_start_date, total_questions_answered, average_score_percentage, total_study_duration_seconds)
    VALUES (p_user_id, v_week_start, v_actual_answered, p_score_percentage, p_time_taken)
    ON CONFLICT (user_id, week_start_date) DO UPDATE SET
        total_questions_answered = weekly_summaries.total_questions_answered + v_actual_answered,
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

    -- 3. Calculate Earned Coins (1 coin per 2 correct answers)
    -- Fixed formula: (Total * Score / 100) gives correct answers.
    v_earned_coins := FLOOR((p_total_questions * (p_score_percentage::FLOAT / 100.0)) / 2.0);

    -- 4. Update User Streak with Freeze Logic
    SELECT last_session_date, COALESCE(streak_count, 0), COALESCE(streak_freeze_count, 0) 
    INTO v_last_session, v_streak, v_freeze_count
    FROM users WHERE id = p_user_id;

    IF v_last_session IS NULL THEN
        v_streak := 1;
    ELSIF v_last_session = (CURRENT_DATE - INTERVAL '1 day')::DATE THEN
        v_streak := v_streak + 1;
    ELSIF v_last_session = CURRENT_DATE THEN
        -- Keep current streak
    ELSE
        -- CHECK FOR STREAK FREEZE SPENDING
        IF v_freeze_count > 0 THEN
            v_freeze_count := v_freeze_count - 1;
            -- Keep v_streak (freeze protection)
        ELSE
            v_streak := 1; -- Reset
        END IF;
    END IF;

    -- 5. Final User Table Update
    -- Bonus Coins: Hit 50 and earn 50 coins
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
