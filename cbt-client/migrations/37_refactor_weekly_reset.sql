-- =======================================================================
-- MIGRATION: 37_refactor_weekly_reset
-- DESCRIPTION: Finalizes the transition to a Clash-exclusive Elite promotion.
--              Removes the old question-count based promotion from the general reset.
-- =======================================================================

CREATE OR REPLACE FUNCTION run_weekly_league_reset()
RETURNS JSONB AS $$
DECLARE
    v_current_week DATE := date_trunc('week', now())::DATE;
BEGIN
    -- 1. ARCHIVE WEEKLY SUMMARIES (Optional Housekeeping)
    -- This keeps the history clean.
    
    -- 2. ELITE PROMOTION LOGIC REMOVED FROM HERE
    -- Promotion is now handled by process_clash_promotions() on Saturday nights.
    -- This ensures that only Saturday Clash performers enter the Sunday Super League.

    -- 3. RESET WEEKLY XP COUNTERS (If any global ones exist)
    -- We can keep the weekly_summaries as is for historical view, but 
    -- sync_user_performance will start fresh for the next week.

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Weekly cycle reset. Elite promotions are now EXCLUSIVELY managed by the Saturday Clash Protocol.',
        'week_date', v_current_week,
        'reset_at', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the comment to reflect the new strict rules
COMMENT ON FUNCTION run_weekly_league_reset IS 'Resets the weekly league cycle. Does NOT promote users; Elite promotion is now delegated to the Saturday Clash system.';
