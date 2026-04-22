-- Fix for "Global Rankings" showing duplicate users
-- The previous query pulled all rows from weekly_summaries without aggregating them,
-- which meant users with multiple weeks of history appeared multiple times.
-- This RPC securely aggregates total lifetime questions per user.

CREATE OR REPLACE FUNCTION get_global_leaderboard()
RETURNS TABLE (
    username TEXT,
    total_questions BIGINT,
    daily_questions_count INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.username,
        SUM(COALESCE(ws.total_questions_answered, 0))::BIGINT as total_questions,
        MAX(COALESCE(u.daily_questions_count, 0)) as daily_questions_count
    FROM users u
    JOIN weekly_summaries ws ON ws.user_id = u.id
    GROUP BY u.id, u.username
    ORDER BY total_questions DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
