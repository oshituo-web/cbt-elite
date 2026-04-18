-- PHASE 2: DRASTIC SECURITY & PERFORMANCE UPGRADES

-- 0. Ensure Schema Consistency
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_activated BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'freemium';
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_credits INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_daily_usage INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ai_reset_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_session_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_sessions INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_questions_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_daily_reset_date DATE;


-- 1. Explanatory Content Partitioning (Server-Side Gating)
CREATE TABLE IF NOT EXISTS question_explanations (
    question_id UUID PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
    explanation TEXT,
    model_answer TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Migrate existing explanations from question_answers
INSERT INTO question_explanations (question_id, explanation)
SELECT question_id, explanation FROM question_answers
ON CONFLICT (question_id) DO NOTHING;

-- Remove explanation from public table (Optional but recommended after DataService update)
-- ALTER TABLE question_answers DROP COLUMN explanation;

-- Enable RLS on explanations
ALTER TABLE question_explanations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gated Explanations" ON question_explanations
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND (is_activated = true OR premium_until > now() OR role IN ('admin', 'moderator'))
    )
);

-- 2. Atomic Analytics (RPC)
CREATE OR REPLACE FUNCTION sync_user_performance(
    p_user_id UUID,
    p_total_questions INT,
    p_score_percentage INT,
    p_time_taken INT,
    p_topics JSONB -- Format: [{"topic": "...", "subject": "...", "correct": true/false}]
) RETURNS VOID AS $$
DECLARE
    v_week_start DATE := date_trunc('week', now())::DATE;
    v_topic RECORD;
    v_last_session DATE;
    v_streak INT;
BEGIN
    -- Update Weekly Summary
    INSERT INTO weekly_summaries (user_id, week_start_date, total_questions_answered, average_score_percentage, total_study_duration_seconds)
    VALUES (p_user_id, v_week_start, p_total_questions, p_score_percentage, p_time_taken)
    ON CONFLICT (user_id, week_start_date) DO UPDATE SET
        total_questions_answered = weekly_summaries.total_questions_answered + p_total_questions,
        -- Weighted Average calculation
        average_score_percentage = ((weekly_summaries.average_score_percentage * weekly_summaries.total_questions_answered) + (p_score_percentage * p_total_questions)) / (weekly_summaries.total_questions_answered + p_total_questions),
        total_study_duration_seconds = weekly_summaries.total_study_duration_seconds + p_time_taken;

    -- Update Topic Mastery
    FOR v_topic IN SELECT * FROM jsonb_to_recordset(p_topics) AS x(topic TEXT, subject TEXT, is_correct BOOLEAN)
    LOOP
        INSERT INTO topic_mastery (user_id, topic, subject, total_attempted, total_correct, mastery_percentage, last_practiced_at)
        VALUES (p_user_id, v_topic.topic, v_topic.subject, 1, CASE WHEN v_topic.is_correct THEN 1 ELSE 0 END, CASE WHEN v_topic.is_correct THEN 100 ELSE 0 END, now())
        ON CONFLICT (user_id, subject, topic) DO UPDATE SET
            total_attempted = topic_mastery.total_attempted + 1,
            total_correct = topic_mastery.total_correct + (CASE WHEN v_topic.is_correct THEN 1 ELSE 0 END),
            mastery_percentage = ROUND(((topic_mastery.total_correct + (CASE WHEN v_topic.is_correct THEN 1 ELSE 0 END))::FLOAT / (topic_mastery.total_attempted + 1)::FLOAT) * 100);
    END LOOP;

    -- Update User Streak and Stats
    SELECT last_session_date, COALESCE(streak_count, 0) INTO v_last_session, v_streak
    FROM users WHERE id = p_user_id;

    -- STREAK LOGIC:
    -- 1. If never played before, start at 1
    -- 2. If played yesterday, increment
    -- 3. If played today, keep current streak
    -- 4. If skipped a day or more, reset to 1
    IF v_last_session IS NULL THEN
        v_streak := 1;
    ELSIF v_last_session = (CURRENT_DATE - INTERVAL '1 day')::DATE THEN
        v_streak := v_streak + 1;
    ELSIF v_last_session = CURRENT_DATE THEN
        -- Streak already counted for today, keep v_streak
    ELSE
        v_streak := 1;
    END IF;

    -- DAILY QUESTIONS RESET LOGIC:
    UPDATE users SET
        streak_count = v_streak,
        last_session_date = CURRENT_DATE,
        total_questions_answered = COALESCE(total_questions_answered, 0) + p_total_questions,
        daily_questions_count = CASE 
            WHEN last_daily_reset_date = CURRENT_DATE THEN COALESCE(daily_questions_count, 0) + p_total_questions
            ELSE p_total_questions
        END,
        last_daily_reset_date = CURRENT_DATE
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Promo Code Security
DROP POLICY IF EXISTS "Allow public read on promo_codes" ON promo_codes;
CREATE POLICY "Strict Promo Code Access" ON promo_codes 
FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'moderator')));

CREATE OR REPLACE FUNCTION validate_promo_code(p_code TEXT)
RETURNS TABLE(percent INT, valid BOOLEAN) AS $$
BEGIN
    RETURN QUERY
    SELECT promo_codes.percent, (expiry_date IS NULL OR expiry_date >= now()::DATE)
    FROM promo_codes
    WHERE code = p_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
