-- SUPER ELITE LEAGUE ACTIVATION & SCHEMA UNIFICATION
-- =======================================================================

-- 1. Ensure column names are standardized to league_tier
-- (Safely check and move data if 'tier' exists from old migrations)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tier') THEN
        UPDATE public.users SET league_tier = tier WHERE league_tier IS NULL OR league_tier = 'Bronze';
        ALTER TABLE public.users DROP COLUMN IF EXISTS tier;
    END IF;
END $$;

-- 2. RE-IMPLEMENT JOIN_LEAGUE_GROUP (Unified version)
-- Handles 20-member cap and departmental grouping
DROP FUNCTION IF EXISTS join_league_group(UUID);
CREATE OR REPLACE FUNCTION join_league_group(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_tier TEXT;
    v_dept TEXT;
    v_group_id UUID;
    v_clan_name TEXT;
    v_names_pool TEXT[];
BEGIN
    SELECT league_tier, department INTO v_tier, v_dept FROM public.users WHERE id = p_user_id;
    
    -- Standardize nulls
    IF v_tier IS NULL THEN v_tier := 'Bronze'; END IF;
    IF v_dept IS NULL THEN v_dept := 'General'; END IF;

    -- Find a group in the same tier and department with < 20 members
    SELECT lg.id INTO v_group_id
    FROM public.league_groups lg
    LEFT JOIN public.users u ON u.current_league_group = lg.id
    WHERE lg.tier = v_tier AND lg.department = v_dept
    GROUP BY lg.id
    HAVING COUNT(u.id) < 20
    LIMIT 1;

    -- Create new group if none found
    IF v_group_id IS NULL THEN
        CASE v_dept
            WHEN 'Science' THEN v_names_pool := ARRAY['Neutron Knights', 'Quantum Phantoms', 'Galactic Chemists', 'Orbital Oracles', 'Atomic Archers'];
            WHEN 'Arts' THEN v_names_pool := ARRAY['Renaissance Scribes', 'Poetic Archers', 'Sovereign Scribes', 'Dramatic Dynasts', 'Lyric Legends'];
            WHEN 'Commercial' THEN v_names_pool := ARRAY['Capital Kings', 'Market Monarchs', 'Fiscal Titans', 'Wealth Wizards', 'Trade Templars'];
            ELSE v_names_pool := ARRAY['Universal Scholars', 'Omni Elites', 'Polymath Pioneers', 'Knowledge Keepers', 'Wisdom Warriors'];
        END CASE;
        
        v_clan_name := v_names_pool[1 + floor(random() * array_length(v_names_pool, 1))::int];
        
        INSERT INTO public.league_groups (clan_name, department, tier)
        VALUES (v_clan_name, v_dept, v_tier)
        RETURNING id INTO v_group_id;
    END IF;

    UPDATE public.users SET current_league_group = v_group_id, last_league_sync_week = date_trunc('week', now())::date WHERE id = p_user_id;
    
    RETURN jsonb_build_object('group_id', v_group_id, 'tier', v_tier, 'clan_name', v_clan_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. ACTIVATE WEEKLY RESET (Super Elite Promotion)
-- Promotes the TOP 3 of every Normal clan to the 'Elite' (Super) tier
DROP FUNCTION IF EXISTS run_weekly_league_reset();
CREATE OR REPLACE FUNCTION run_weekly_league_reset()
RETURNS JSONB AS $$
DECLARE
    v_promoted_count INT;
BEGIN
    -- Reset anyone who was promoted but didn't make the cut this week? 
    -- Actually, for now we just handle the promotion of the top performers.

    WITH elite_candidates AS (
        SELECT user_id FROM (
            SELECT 
                u.id as user_id, 
                rank() OVER (PARTITION BY u.current_league_group ORDER BY COALESCE(SUM(ms.points), 0) DESC) as r
            FROM public.users u
            LEFT JOIN public.milestones_earned ms ON ms.user_id = u.id AND ms.created_at >= (now() - INTERVAL '7 days')
            WHERE u.league_tier != 'Elite' AND u.current_league_group IS NOT NULL
            GROUP BY u.id, u.current_league_group
        ) t WHERE r <= 3
    )
    UPDATE public.users u
    SET league_tier = 'Elite',
        current_league_group = NULL -- Will be reassigned on next sync
    FROM elite_candidates ec
    WHERE u.id = ec.user_id;

    GET DIAGNOSTICS v_promoted_count = ROW_COUNT;

    -- Reset all weekly scores/progress markers if necessary
    -- (Assuming milestones/summaries handle the historical data)

    RETURN jsonb_build_object(
        'status', 'success',
        'promoted_count', v_promoted_count,
        'reset_at', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. COMMENTARY
COMMENT ON FUNCTION run_weekly_league_reset IS 'Promotes top 3 members of every normal clan to Super Elite tier every Sunday night.';
