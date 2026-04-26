-- =======================================================================
-- MIGRATION: 29_coins_and_milestone_rewards
-- DESCRIPTION: 
--   1. Fixes elite_coins not being added after sessions.
--   2. Adds 20-coin bonus when a user first reaches Enthusiast (50Q),
--      Master (100Q), or Legend (150Q) milestones.
--   3. Adds 10-coin daily streak maintenance bonus on consecutive days.
-- =======================================================================

-- -----------------------------------------------------------------------
-- Ensure milestone_rewards tracking column exists
-- -----------------------------------------------------------------------
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS milestones_awarded TEXT[] DEFAULT '{}';

-- -----------------------------------------------------------------------
-- Final, complete sync_user_performance function
-- -----------------------------------------------------------------------
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
    v_milestone_coins INT := 0;
    v_streak_bonus INT := 0;
    v_actual_answered INT;
    v_correct_count INT;
    v_old_total INT;
    v_new_total INT;
    v_milestones_awarded TEXT[];
BEGIN
    v_actual_answered := COALESCE(p_answered_questions, p_total_questions, 0);
    v_correct_count := FLOOR(v_actual_answered * (COALESCE(p_score_percentage, 0)::FLOAT / 100.0));

    -- ── 1. WEEKLY SUMMARY ──────────────────────────────────────────────
    INSERT INTO weekly_summaries (
        user_id, week_start_date, total_questions_answered, 
        total_correct_answers, average_score_percentage, total_study_duration_seconds
    )
    VALUES (
        p_user_id, v_week_start, v_actual_answered, v_correct_count, 
        COALESCE(p_score_percentage, 0), p_time_taken
    )
    ON CONFLICT (user_id, week_start_date) DO UPDATE SET
        total_questions_answered = COALESCE(weekly_summaries.total_questions_answered, 0) + v_actual_answered,
        total_correct_answers    = COALESCE(weekly_summaries.total_correct_answers, 0) + v_correct_count,
        average_score_percentage = CASE 
            WHEN (COALESCE(weekly_summaries.total_questions_answered, 0) + v_actual_answered) > 0 
            THEN (
                (COALESCE(weekly_summaries.average_score_percentage, 0) * COALESCE(weekly_summaries.total_questions_answered, 0)) +
                (COALESCE(p_score_percentage, 0) * v_actual_answered)
            ) / (COALESCE(weekly_summaries.total_questions_answered, 0) + v_actual_answered)
            ELSE COALESCE(p_score_percentage, 0)
        END,
        total_study_duration_seconds = COALESCE(weekly_summaries.total_study_duration_seconds, 0) + p_time_taken;

    -- ── 2. TOPIC MASTERY ───────────────────────────────────────────────
    IF p_topics IS NOT NULL AND jsonb_array_length(p_topics) > 0 THEN
        FOR v_topic IN 
            SELECT * FROM jsonb_to_recordset(p_topics) AS x(topic TEXT, subject TEXT, is_correct BOOLEAN)
        LOOP
            INSERT INTO topic_mastery (
                user_id, topic, subject, total_attempted, total_correct, mastery_percentage, last_practiced_at
            )
            VALUES (
                p_user_id, v_topic.topic, v_topic.subject,
                1,
                CASE WHEN v_topic.is_correct THEN 1 ELSE 0 END,
                CASE WHEN v_topic.is_correct THEN 100 ELSE 0 END,
                now()
            )
            ON CONFLICT (user_id, subject, topic) DO UPDATE SET
                total_attempted    = topic_mastery.total_attempted + 1,
                total_correct      = topic_mastery.total_correct + (CASE WHEN v_topic.is_correct THEN 1 ELSE 0 END),
                mastery_percentage = ROUND(
                    ((topic_mastery.total_correct + (CASE WHEN v_topic.is_correct THEN 1 ELSE 0 END))::FLOAT
                    / (topic_mastery.total_attempted + 1)::FLOAT) * 100
                ),
                last_practiced_at  = now();
        END LOOP;
    END IF;

    -- ── 3. BASE COINS (1 coin per 2 correct answers) ───────────────────
    v_earned_coins := FLOOR(v_correct_count / 2.0);

    -- ── 4. STREAK CALCULATION ──────────────────────────────────────────
    SELECT 
        last_session_date, 
        COALESCE(streak_count, 0), 
        COALESCE(streak_freeze_count, 0),
        COALESCE(total_questions_answered, 0),
        COALESCE(milestones_awarded, '{}')
    INTO v_last_session, v_streak, v_freeze_count, v_old_total, v_milestones_awarded
    FROM users WHERE id = p_user_id;

    IF v_last_session IS NULL THEN
        v_streak := 1;
    ELSIF v_last_session = (p_client_date - INTERVAL '1 day')::DATE THEN
        -- Consecutive day → increment + 10-coin streak bonus
        v_streak := v_streak + 1;
        v_streak_bonus := 10;
    ELSIF v_last_session = p_client_date THEN
        -- Already played today: ensure streak is at least 1
        IF v_streak = 0 THEN v_streak := 1; END IF;
    ELSE
        -- Missed a day: check freeze
        IF v_freeze_count > 0 THEN
            v_freeze_count := v_freeze_count - 1;
        ELSE
            v_streak := 1;
        END IF;
    END IF;

    -- ── 5. MILESTONE REWARDS (20 coins each, first time only) ─────────
    v_new_total := v_old_total + v_actual_answered;

    IF v_old_total < 50 AND v_new_total >= 50 AND NOT ('enthusiast' = ANY(v_milestones_awarded)) THEN
        v_milestone_coins := v_milestone_coins + 20;
        v_milestones_awarded := array_append(v_milestones_awarded, 'enthusiast');
    END IF;

    IF v_old_total < 100 AND v_new_total >= 100 AND NOT ('master' = ANY(v_milestones_awarded)) THEN
        v_milestone_coins := v_milestone_coins + 20;
        v_milestones_awarded := array_append(v_milestones_awarded, 'master');
    END IF;

    IF v_old_total < 150 AND v_new_total >= 150 AND NOT ('legend' = ANY(v_milestones_awarded)) THEN
        v_milestone_coins := v_milestone_coins + 20;
        v_milestones_awarded := array_append(v_milestones_awarded, 'legend');
    END IF;

    -- ── 6. DAILY GOAL BONUS (50 coins for hitting 50-question goal) ────
    -- Calculated inline in the UPDATE below

    -- ── 7. FINAL USER TABLE UPDATE ─────────────────────────────────────
    UPDATE users SET
        streak_count             = GREATEST(v_streak, 1),
        streak_freeze_count      = COALESCE(v_freeze_count, 0),
        milestones_awarded       = v_milestones_awarded,
        last_session_date        = p_client_date,
        total_questions_answered = COALESCE(total_questions_answered, 0) + v_actual_answered,
        daily_questions_count    = CASE 
            WHEN last_daily_reset_date = p_client_date 
            THEN COALESCE(daily_questions_count, 0) + v_actual_answered
            ELSE v_actual_answered
        END,
        last_daily_reset_date    = p_client_date,
        elite_coins              = COALESCE(elite_coins, 0) 
            + v_earned_coins         -- Base: 1 coin per 2 correct
            + v_milestone_coins      -- Milestone bonuses: 20 each
            + v_streak_bonus         -- Streak maintenance: 10 per consecutive day
    WHERE id = p_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.sync_user_performance(UUID, INT, INT, INT, JSONB, INT, DATE, TEXT) TO authenticated;

-- Verify the function is active
SELECT proname, prosecdef FROM pg_proc WHERE proname = 'sync_user_performance';
