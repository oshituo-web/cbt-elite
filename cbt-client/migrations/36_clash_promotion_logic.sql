-- =======================================================================
-- MIGRATION: 36_clash_promotion_logic
-- DESCRIPTION: Implements the Qualifying (Saturday) -> Championship (Sunday) flow.
--              Top 3 performers in Saturday's Clan Clash are promoted to Elite.
--              Sunday's Super League is restricted to Elite members only.
-- =======================================================================

-- 1. Create function to process promotions after Saturday's Clash
CREATE OR REPLACE FUNCTION process_clash_promotions()
RETURNS TABLE (promoted_count INTEGER) AS $$
DECLARE
    v_saturday DATE;
    v_count INTEGER := 0;
BEGIN
    -- Determine which Saturday to process
    -- If it's Sunday (DOW 0), we process yesterday. Otherwise, we process today.
    IF extract(dow from CURRENT_DATE) = 0 THEN
        v_saturday := (CURRENT_DATE - INTERVAL '1 day')::DATE;
    ELSE
        v_saturday := CURRENT_DATE;
    END IF;

    -- Logic: Find the top 3 scores from every department's Normal clash on that Saturday.
    -- We rank by score (desc) and then time_taken (asc) as the tie-breaker.
    WITH promoted_ids AS (
        SELECT user_id
        FROM (
            SELECT 
                cp.user_id,
                ROW_NUMBER() OVER (PARTITION BY sc.department ORDER BY cp.score DESC, cp.time_taken_seconds ASC) as r
            FROM public.clash_participations cp
            JOIN public.scheduled_clashes sc ON cp.clash_id = sc.id
            WHERE sc.week_date = v_saturday
              AND sc.type = 'Normal'
              AND cp.is_finalized = TRUE
        ) t
        WHERE t.r <= 3
    )
    UPDATE public.users u
    SET league_tier = 'Elite'
    FROM promoted_ids pi
    WHERE u.id = pi.user_id
      AND u.league_tier != 'Elite';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update get_weekly_clash to gate access to the Sunday Super League
-- This ensures ONLY 'Elite' tier members can participate in the Sunday 7PM Championship.
CREATE OR REPLACE FUNCTION get_weekly_clash(p_user_id UUID)
RETURNS TABLE (
    clash_id UUID,
    data JSONB,
    duration INTEGER,
    clash_type TEXT,
    clash_department TEXT
) AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_today DATE := v_now::DATE;
    v_user_tier TEXT;
    v_user_dept TEXT;
BEGIN
    SELECT league_tier, department INTO v_user_tier, v_user_dept FROM public.users WHERE id = p_user_id;

    -- SATURDAY: Normal Qualification Round
    IF extract(dow from v_now) = 6 THEN
        RETURN QUERY
        SELECT id, questions_json, 45, 'Normal', sc.department
        FROM public.scheduled_clashes sc
        WHERE week_date = v_today
          AND type = 'Normal'
          AND sc.department = v_user_dept
        LIMIT 1;
        
    -- SUNDAY: Elite Championship Round
    ELSIF extract(dow from v_now) = 0 THEN
        IF v_user_tier = 'Elite' THEN
            RETURN QUERY
            SELECT id, questions_json, 60, 'Super', sc.department
            FROM public.scheduled_clashes sc
            WHERE week_date = v_today
              AND type = 'Super'
            LIMIT 1;
        ELSE
            -- Non-elite users get no data for Sunday (UI will handle the "Restricted" state)
            RETURN;
        END IF;
    ELSE
        -- No clash active today
        RETURN;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Schedule the promotion processor to run every Saturday at 21:00 WAT (8 PM UTC)
-- This ensures users are promoted right after the 7 PM clash ends, ready for Sunday.
-- (Requirement: pg_cron extension)
SELECT cron.schedule(
    'process_clash_promotions_job',
    '00 20 * * 6', -- 8:00 PM UTC every Saturday
    'SELECT process_clash_promotions()'
);
