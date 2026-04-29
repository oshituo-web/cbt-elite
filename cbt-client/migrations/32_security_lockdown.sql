-- ========================================================================
-- MIGRATION: 32_security_lockdown
-- DESCRIPTION: 
--   1. Fixes Critical Role Escalation vulnerability in protect_user_fields.
--   2. Adds auth.uid() identity verification to all SECURITY DEFINER RPCs.
--   3. Enables RLS and sets strict policies for all public tables.
--   4. Restricts promo_codes and config visibility.
-- ========================================================================

BEGIN;

--------------------------------------------------------------------------------
-- 1. HARDEN FIELD PROTECTION TRIGGER (Role Escalation Fix)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_user_fields()
RETURNS TRIGGER AS $$
DECLARE
    v_new JSONB := to_jsonb(NEW);
    v_old JSONB := to_jsonb(OLD);
BEGIN
    -- SYSTEM BYPASS: Allow postgres/service_role/SECURITY DEFINER functions
    IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
        RETURN NEW;
    END IF;

    -- ADMIN BYPASS: Admins can modify everything
    IF public.is_admin() THEN
        RETURN NEW;
    END IF;

    -- PROTECTION: Block normal users from modifying sensitive fields
    -- CRITICAL: Added 'role' and 'elite_coins'
    IF v_new ? 'role' AND (v_new->>'role' IS DISTINCT FROM v_old->>'role') THEN
        RAISE EXCEPTION 'Unauthorized: You cannot modify your user role.';
    END IF;

    IF v_new ? 'elite_coins' AND (v_new->>'elite_coins' IS DISTINCT FROM v_old->>'elite_coins') THEN
        RAISE EXCEPTION 'Unauthorized: Elite Coins can only be modified by the system.';
    END IF;

    IF v_new ? 'tier' AND (v_new->>'tier' IS DISTINCT FROM v_old->>'tier') THEN
        RAISE EXCEPTION 'Unauthorized: Subscription tier is managed by the system.';
    END IF;

    IF v_new ? 'ai_credits' AND (v_new->>'ai_credits' IS DISTINCT FROM v_old->>'ai_credits') THEN
        RAISE EXCEPTION 'Unauthorized: AI credits are managed by the system.';
    END IF;

    IF (v_new ? 'is_activated' AND (v_new->>'is_activated' IS DISTINCT FROM v_old->>'is_activated')) OR
       (v_new ? 'activation_status' AND (v_new->>'activation_status' IS DISTINCT FROM v_old->>'activation_status')) THEN
        RAISE EXCEPTION 'Unauthorized: Activation status is managed by the system.';
    END IF;

    IF (v_new ? 'premium_until' AND (v_new->>'premium_until' IS DISTINCT FROM v_old->>'premium_until')) OR
       (v_new ? 'subscription_expiry' AND (v_new->>'subscription_expiry' IS DISTINCT FROM v_old->>'subscription_expiry')) THEN
        RAISE EXCEPTION 'Unauthorized: Subscription expiry is managed by the system.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--------------------------------------------------------------------------------
-- 2. HARDEN RPC FUNCTIONS (Identity Verification)
--------------------------------------------------------------------------------

-- A. sync_user_performance
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
    -- SECURITY CHECK
    IF auth.uid() != p_user_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: You can only sync your own performance.';
    END IF;

    v_actual_answered := COALESCE(p_answered_questions, p_total_questions, 0);
    v_correct_count := FLOOR(v_actual_answered * (COALESCE(p_score_percentage, 0)::FLOAT / 100.0));

    INSERT INTO weekly_summaries (user_id, week_start_date, total_questions_answered, total_correct_answers, average_score_percentage, total_study_duration_seconds)
    VALUES (p_user_id, v_week_start, v_actual_answered, v_correct_count, COALESCE(p_score_percentage, 0), p_time_taken)
    ON CONFLICT (user_id, week_start_date) DO UPDATE SET
        total_questions_answered = COALESCE(weekly_summaries.total_questions_answered, 0) + v_actual_answered,
        total_correct_answers    = COALESCE(weekly_summaries.total_correct_answers, 0) + v_correct_count,
        average_score_percentage = CASE WHEN (COALESCE(weekly_summaries.total_questions_answered, 0) + v_actual_answered) > 0 THEN ((COALESCE(weekly_summaries.average_score_percentage, 0) * COALESCE(weekly_summaries.total_questions_answered, 0)) + (COALESCE(p_score_percentage, 0) * v_actual_answered)) / (COALESCE(weekly_summaries.total_questions_answered, 0) + v_actual_answered) ELSE COALESCE(p_score_percentage, 0) END,
        total_study_duration_seconds = COALESCE(weekly_summaries.total_study_duration_seconds, 0) + p_time_taken;

    IF p_topics IS NOT NULL AND jsonb_array_length(p_topics) > 0 THEN
        FOR v_topic IN SELECT * FROM jsonb_to_recordset(p_topics) AS x(topic TEXT, subject TEXT, is_correct BOOLEAN) LOOP
            INSERT INTO topic_mastery (user_id, topic, subject, total_attempted, total_correct, mastery_percentage, last_practiced_at)
            VALUES (p_user_id, v_topic.topic, v_topic.subject, 1, CASE WHEN v_topic.is_correct THEN 1 ELSE 0 END, CASE WHEN v_topic.is_correct THEN 100 ELSE 0 END, now())
            ON CONFLICT (user_id, subject, topic) DO UPDATE SET total_attempted = topic_mastery.total_attempted + 1, total_correct = topic_mastery.total_correct + (CASE WHEN v_topic.is_correct THEN 1 ELSE 0 END), mastery_percentage = ROUND(((topic_mastery.total_correct + (CASE WHEN v_topic.is_correct THEN 1 ELSE 0 END))::FLOAT / (topic_mastery.total_attempted + 1)::FLOAT) * 100), last_practiced_at = now();
        END LOOP;
    END IF;

    v_earned_coins := FLOOR(v_correct_count / 2.0);
    SELECT last_session_date, COALESCE(streak_count, 0), COALESCE(streak_freeze_count, 0), COALESCE(total_questions_answered, 0), COALESCE(milestones_awarded, '{}')
    INTO v_last_session, v_streak, v_freeze_count, v_old_total, v_milestones_awarded FROM users WHERE id = p_user_id;

    IF v_last_session IS NULL THEN v_streak := 1; ELSIF v_last_session = (p_client_date - INTERVAL '1 day')::DATE THEN v_streak := v_streak + 1; v_streak_bonus := 10; ELSIF v_last_session = p_client_date THEN IF v_streak = 0 THEN v_streak := 1; END IF; ELSE IF v_freeze_count > 0 THEN v_freeze_count := v_freeze_count - 1; ELSE v_streak := 1; END IF; END IF;

    v_new_total := v_old_total + v_actual_answered;
    IF v_old_total < 50 AND v_new_total >= 50 AND NOT ('enthusiast' = ANY(v_milestones_awarded)) THEN v_milestone_coins := v_milestone_coins + 20; v_milestones_awarded := array_append(v_milestones_awarded, 'enthusiast'); END IF;
    IF v_old_total < 100 AND v_new_total >= 100 AND NOT ('master' = ANY(v_milestones_awarded)) THEN v_milestone_coins := v_milestone_coins + 20; v_milestones_awarded := array_append(v_milestones_awarded, 'master'); END IF;
    IF v_old_total < 150 AND v_new_total >= 150 AND NOT ('legend' = ANY(v_milestones_awarded)) THEN v_milestone_coins := v_milestone_coins + 20; v_milestones_awarded := array_append(v_milestones_awarded, 'legend'); END IF;

    UPDATE users SET streak_count = GREATEST(v_streak, 1), streak_freeze_count = COALESCE(v_freeze_count, 0), milestones_awarded = v_milestones_awarded, last_session_date = p_client_date, total_questions_answered = COALESCE(total_questions_answered, 0) + v_actual_answered, daily_questions_count = CASE WHEN last_daily_reset_date = p_client_date THEN COALESCE(daily_questions_count, 0) + v_actual_answered ELSE v_actual_answered END, last_daily_reset_date = p_client_date, elite_coins = COALESCE(elite_coins, 0) + v_earned_coins + v_milestone_coins + v_streak_bonus WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. purchase_streak_freeze
CREATE OR REPLACE FUNCTION purchase_streak_freeze(p_user_id UUID, p_cost INT)
RETURNS BOOLEAN AS $$
DECLARE
    v_coins INT;
BEGIN
    -- SECURITY CHECK
    IF auth.uid() != p_user_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: You can only purchase freezes for your own account.';
    END IF;

    SELECT elite_coins INTO v_coins FROM users WHERE id = p_user_id FOR UPDATE;
    IF v_coins >= p_cost THEN
        UPDATE users SET elite_coins = elite_coins - p_cost, streak_freeze_count = COALESCE(streak_freeze_count, 0) + 1 WHERE id = p_user_id;
        RETURN TRUE;
    END IF;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. join_league_group
CREATE OR REPLACE FUNCTION join_league_group(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_current_week DATE := date_trunc('week', now())::DATE;
    v_last_sync DATE;
    v_tier TEXT;
    v_group UUID;
    v_last_week DATE;
    v_rank INT;
BEGIN
    -- SECURITY CHECK
    IF auth.uid() != p_user_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: You can only join a league for your own account.';
    END IF;

    SELECT last_league_sync_week, league_tier, current_league_group INTO v_last_sync, v_tier, v_group FROM users WHERE id = p_user_id;
    IF v_last_sync IS NULL OR v_last_sync < v_current_week THEN
        IF v_group IS NOT NULL AND v_last_sync IS NOT NULL THEN
            v_last_week := v_last_sync;
            WITH group_ranks AS (SELECT u.id as user_id, RANK() OVER (ORDER BY COALESCE(ws.total_questions_answered, 0) DESC) as user_rank FROM users u LEFT JOIN weekly_summaries ws ON ws.user_id = u.id AND ws.week_start_date = v_last_week WHERE u.current_league_group = v_group)
            SELECT user_rank INTO v_rank FROM group_ranks WHERE user_id = p_user_id;
            IF v_rank <= 10 THEN v_tier := CASE WHEN v_tier = 'Bronze' THEN 'Silver' WHEN v_tier = 'Silver' THEN 'Gold' WHEN v_tier = 'Gold' THEN 'Diamond' WHEN v_tier = 'Diamond' THEN 'Elite' ELSE v_tier END;
            ELSIF v_rank >= 45 THEN v_tier := CASE WHEN v_tier = 'Elite' THEN 'Diamond' WHEN v_tier = 'Diamond' THEN 'Gold' WHEN v_tier = 'Gold' THEN 'Silver' WHEN v_tier = 'Silver' THEN 'Bronze' ELSE v_tier END; END IF;
        END IF;
        SELECT current_league_group INTO v_group FROM users WHERE league_tier = v_tier AND last_league_sync_week = v_current_week GROUP BY current_league_group HAVING COUNT(*) < 50 LIMIT 1;
        IF v_group IS NULL THEN v_group := gen_random_uuid(); END IF;
        UPDATE users SET league_tier = v_tier, current_league_group = v_group, last_league_sync_week = v_current_week WHERE id = p_user_id;
    END IF;
    RETURN jsonb_build_object('tier', v_tier, 'group_id', v_group, 'week_start', v_current_week);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- D. get_league_table
CREATE OR REPLACE FUNCTION get_league_table(p_user_id UUID)
RETURNS TABLE (user_id UUID, username TEXT, weekly_score INT, rank BIGINT) AS $$
DECLARE
    v_group UUID;
    v_week DATE := date_trunc('week', now())::DATE;
BEGIN
    -- SECURITY CHECK
    -- We allow admins to view any league, but students only their own.
    IF auth.uid() != p_user_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: You can only view your own league table.';
    END IF;

    SELECT current_league_group INTO v_group FROM users WHERE id = p_user_id;
    RETURN QUERY
    SELECT u.id, u.username, COALESCE(ws.total_questions_answered, 0)::INT as weekly_score, RANK() OVER (ORDER BY COALESCE(ws.total_questions_answered, 0) DESC) as rank
    FROM users u LEFT JOIN weekly_summaries ws ON ws.user_id = u.id AND ws.week_start_date = v_week WHERE u.current_league_group = v_group ORDER BY weekly_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) LOCKDOWN
--------------------------------------------------------------------------------

-- Enable RLS on all tables (Idempotent)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theory_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_clashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clash_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monetization_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theory_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_seen_questions ENABLE ROW LEVEL SECURITY;

-- DROP ALL INSECURE POLICIES
DROP POLICY IF EXISTS "Allow public read access on subjects" ON subjects;
DROP POLICY IF EXISTS "Allow public read access on syllabus_topics" ON syllabus_topics;
DROP POLICY IF EXISTS "Allow public read access on answers" ON answers;
DROP POLICY IF EXISTS "Allow public read on promo_codes" ON promo_codes;
DROP POLICY IF EXISTS "Allow public read on config" ON system_config;

-- CREATE SECURE POLICIES

-- A. Subjects & Topics: Authenticated Only
CREATE POLICY "Authenticated users can view subjects" ON subjects FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can view topics" ON syllabus_topics FOR SELECT USING (auth.uid() IS NOT NULL);

-- B. Questions & Answers: Strict Read
CREATE POLICY "Students can view active questions" ON questions FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);
CREATE POLICY "Students can view answers" ON answers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Students can view explanations" ON question_explanations FOR SELECT USING (auth.uid() IS NOT NULL);

-- C. Promo Codes: Hidden from Scrapers
CREATE POLICY "Service and Admin only can view promo codes" ON promo_codes FOR SELECT USING (public.is_admin() OR auth.role() = 'service_role');

-- D. User Data Isolation (Ownership)
CREATE POLICY "Users own their sessions" ON exam_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own their responses" ON user_responses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own their seen history" ON user_seen_questions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own their monetization logs" ON monetization_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users own their clash history" ON clash_participations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- E. Content Visibility (Authenticated)
CREATE POLICY "Students can view league groups" ON league_groups FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Students can view scheduled clashes" ON scheduled_clashes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Students can view theory details" ON theory_details FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Students can view question groups" ON question_groups FOR SELECT USING (auth.uid() IS NOT NULL);

-- F. Admin Overrides
CREATE POLICY "Admins manage all questions" ON questions FOR ALL USING (public.is_admin());
CREATE POLICY "Admins manage all answers" ON answers FOR ALL USING (public.is_admin());
CREATE POLICY "Admins manage all config" ON system_config FOR ALL USING (public.is_admin());

COMMIT;
