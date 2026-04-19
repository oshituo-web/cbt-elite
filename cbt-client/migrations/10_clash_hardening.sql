-- 10_clash_hardening.sql
-- Hardening Elite Clans with Real-time synchronization and Leaderboards

BEGIN;

-- 1. Create table for competition participations
CREATE TABLE IF NOT EXISTS clash_participations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clash_id UUID REFERENCES scheduled_clashes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    answered_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0,
    time_taken_seconds INTEGER DEFAULT 0,
    answers_json JSONB DEFAULT '{}',
    is_finalized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clash_id, user_id)
);

-- 2. Index for fast ranking
CREATE INDEX IF NOT EXISTS idx_clash_rankings ON clash_participations (clash_id, score DESC, time_taken_seconds ASC);

-- 3. RPC to sync progress in real-time
CREATE OR REPLACE FUNCTION sync_clash_progress(
    p_clash_id UUID,
    p_user_id UUID,
    p_answers JSONB,
    p_answered_count INTEGER,
    p_total_count INTEGER
) RETURNS VOID AS $$
BEGIN
    INSERT INTO clash_participations (clash_id, user_id, answers_json, answered_count, total_count, updated_at)
    VALUES (p_clash_id, p_user_id, p_answers, p_answered_count, p_total_count, NOW())
    ON CONFLICT (clash_id, p_user_id) DO UPDATE
    SET 
        answers_json = EXCLUDED.answers_json,
        answered_count = EXCLUDED.answered_count,
        total_count = EXCLUDED.total_count,
        updated_at = NOW()
    WHERE clash_participations.is_finalized = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC to finalize results
CREATE OR REPLACE FUNCTION submit_clash_results(
    p_clash_id UUID,
    p_user_id UUID,
    p_score INTEGER,
    p_time_taken INTEGER
) RETURNS VOID AS $$
BEGIN
    UPDATE clash_participations
    SET 
        score = p_score,
        time_taken_seconds = p_time_taken,
        is_finalized = TRUE,
        updated_at = NOW()
    WHERE clash_id = p_clash_id AND user_id = p_user_id;

    -- Update user's total questions count for the day as well
    -- (Assuming sync_user_performance is called separately, but let's be safe)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC to get clan leaderboard (the 20 members)
CREATE OR REPLACE FUNCTION get_clash_leaderboard(p_clash_id UUID)
RETURNS TABLE (
    rank BIGINT,
    username TEXT,
    department TEXT,
    score INTEGER,
    time_taken INTEGER,
    is_me BOOLEAN
) AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    RETURN QUERY
    WITH rankings AS (
        SELECT 
            cp.user_id,
            u.username,
            u.department,
            cp.score,
            cp.time_taken_seconds,
            ROW_NUMBER() OVER (ORDER BY cp.score DESC, cp.time_taken_seconds ASC) as rnk
        FROM clash_participations cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.clash_id = p_clash_id
        AND cp.is_finalized = TRUE
    )
    SELECT 
        r.rnk,
        r.username,
        r.department,
        r.score,
        r.time_taken_seconds,
        (r.user_id = v_user_id) as is_me
    FROM rankings r
    ORDER BY r.rnk ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Extension and Cron Setup (Optional but recommended)
-- Note: User needs to ensure pg_cron extension is enabled in Supabase dashboard
-- SELECT cron.schedule('generate-weekly-clash', '0 1 * * 1', 'SELECT generate_weekly_clash_seeds()');

COMMIT;
