-- ELITE LEAGUES SETUP (DUOLINGO STYLE)

-- 1. Add league columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS league_tier TEXT DEFAULT 'Bronze';
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_league_group UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_league_sync_week DATE;

-- 2. Create the Join/Sync League logic
-- This function handles:
-- a) Promoting/Demoting from last week
-- b) Assigning a new group for the current week
CREATE OR REPLACE FUNCTION join_league_group(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_current_week DATE := date_trunc('week', now())::DATE;
    v_last_sync DATE;
    v_tier TEXT;
    v_group UUID;
    v_last_week DATE;
    v_rank INT;
    v_outcomes JSONB;
BEGIN
    -- Get current state
    SELECT last_league_sync_week, league_tier, current_league_group 
    INTO v_last_sync, v_tier, v_group
    FROM users WHERE id = p_user_id;

    -- A. Check if the week has changed (Reset/Promotion Logic)
    IF v_last_sync IS NULL OR v_last_sync < v_current_week THEN
        
        -- If user were in a group last week, determine their promotion/demotion
        IF v_group IS NOT NULL AND v_last_sync IS NOT NULL THEN
            v_last_week := v_last_sync;
            
            -- Calculate rank in their group for that specific week
            WITH group_ranks AS (
                SELECT 
                    u.id as user_id,
                    RANK() OVER (ORDER BY COALESCE(ws.total_questions_answered, 0) DESC) as user_rank,
                    COUNT(*) OVER () as group_size
                FROM users u
                LEFT JOIN weekly_summaries ws ON ws.user_id = u.id AND ws.week_start_date = v_last_week
                WHERE u.current_league_group = v_group
            )
            SELECT user_rank INTO v_rank FROM group_ranks WHERE user_id = p_user_id;

            -- Promotion/Demotion Logic
            IF v_rank <= 10 THEN
                -- PROMOTE
                v_tier := CASE 
                    WHEN v_tier = 'Bronze' THEN 'Silver'
                    WHEN v_tier = 'Silver' THEN 'Gold'
                    WHEN v_tier = 'Gold' THEN 'Diamond'
                    WHEN v_tier = 'Diamond' THEN 'Elite'
                    ELSE v_tier
                END;
            ELSIF v_rank >= 45 THEN
                -- DEMOTE
                v_tier := CASE 
                    WHEN v_tier = 'Elite' THEN 'Diamond'
                    WHEN v_tier = 'Diamond' THEN 'Gold'
                    WHEN v_tier = 'Gold' THEN 'Silver'
                    WHEN v_tier = 'Silver' THEN 'Bronze'
                    ELSE v_tier
                END;
            END IF;
        END IF;

        -- B. Assign to a new group for THIS week in the (potentially new) tier
        -- Find a group in this tier that has < 50 people active this week
        SELECT current_league_group INTO v_group
        FROM users 
        WHERE league_tier = v_tier 
          AND last_league_sync_week = v_current_week
        GROUP BY current_league_group
        HAVING COUNT(*) < 50
        LIMIT 1;

        -- If no group found, generate new UUID
        IF v_group IS NULL THEN
            v_group := gen_random_uuid();
        END IF;

        -- Update User
        UPDATE users SET 
            league_tier = v_tier,
            current_league_group = v_group,
            last_league_sync_week = v_current_week
        WHERE id = p_user_id;
    END IF;

    -- Return status
    RETURN jsonb_build_object(
        'tier', v_tier,
        'group_id', v_group,
        'week_start', v_current_week
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create RPC to fetch the league table
-- This returns the leaderboard for the user's specific group and current week
CREATE OR REPLACE FUNCTION get_league_table(p_user_id UUID)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    weekly_score INT,
    rank BIGINT
) AS $$
DECLARE
    v_group UUID;
    v_week DATE := date_trunc('week', now())::DATE;
BEGIN
    SELECT current_league_group INTO v_group FROM users WHERE id = p_user_id;
    
    RETURN QUERY
    SELECT 
        u.id,
        u.username,
        COALESCE(ws.total_questions_answered, 0)::INT as weekly_score,
        RANK() OVER (ORDER BY COALESCE(ws.total_questions_answered, 0) DESC) as rank
    FROM users u
    LEFT JOIN weekly_summaries ws ON ws.user_id = u.id AND ws.week_start_date = v_week
    WHERE u.current_league_group = v_group
    ORDER BY weekly_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
