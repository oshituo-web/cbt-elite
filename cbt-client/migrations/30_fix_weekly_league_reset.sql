-- FIX: RUN_WEEKLY_LEAGUE_RESET
-- Resolves the issue where the function was trying to access the non-existent 'milestones_earned' table.
-- It now correctly uses 'weekly_summaries' to determine top performers for promotion to Super Elite.

CREATE OR REPLACE FUNCTION run_weekly_league_reset()
RETURNS JSONB AS $$
DECLARE
    v_promoted_count INT;
    v_current_week DATE := date_trunc('week', now())::DATE;
BEGIN
    -- We promote the Top 3 members of every Normal clan to the 'Elite' (Super) tier
    -- Rank is based on total_questions_answered in the current week
    WITH elite_candidates AS (
        SELECT user_id FROM (
            SELECT 
                u.id as user_id, 
                rank() OVER (PARTITION BY u.current_league_group ORDER BY COALESCE(ws.total_questions_answered, 0) DESC) as r
            FROM public.users u
            LEFT JOIN public.weekly_summaries ws ON ws.user_id = u.id AND ws.week_start_date = v_current_week
            WHERE u.league_tier != 'Elite' AND u.current_league_group IS NOT NULL
        ) t WHERE r <= 3
    )
    UPDATE public.users u
    SET league_tier = 'Elite',
        current_league_group = NULL -- Forces reassignment to a Super Elite group on next sync
    FROM elite_candidates ec
    WHERE u.id = ec.user_id;

    GET DIAGNOSTICS v_promoted_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'status', 'success',
        'promoted_count', v_promoted_count,
        'week_reset', v_current_week,
        'reset_at', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION run_weekly_league_reset IS 'Corrected version using weekly_summaries. Promotes top 3 members of every normal clan to Super Elite tier.';
