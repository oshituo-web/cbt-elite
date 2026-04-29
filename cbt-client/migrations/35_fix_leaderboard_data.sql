-- 1. BACKFILL HISTORICAL CORRECT ANSWERS
-- This restores scores for everyone who practiced before the leaderboard was score-based.
UPDATE public.weekly_summaries ws
SET total_correct_answers = (
    SELECT COALESCE(SUM(correct_answers), 0)
    FROM public.exam_sessions es
    WHERE es.user_id = ws.user_id
    AND date_trunc('week', es.completed_at)::DATE = ws.week_start_date
);

-- 2. HARDEN GLOBAL LEADERBOARD RPC
-- Uses LEFT JOIN to ensure users with NO weekly summaries (new users) still appear if they have a username.
-- Also adds a secondary sort by daily_questions_count to break ties.
DROP FUNCTION IF EXISTS get_global_leaderboard();
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
        COALESCE(SUM(ws.total_correct_answers), 0)::BIGINT as total_score,
        MAX(COALESCE(u.daily_questions_count, 0)) as daily_questions_count
    FROM public.users u
    LEFT JOIN public.weekly_summaries ws ON ws.user_id = u.id
    WHERE u.username IS NOT NULL AND u.username != ''
    GROUP BY u.id, u.username
    ORDER BY total_score DESC, daily_questions_count DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
