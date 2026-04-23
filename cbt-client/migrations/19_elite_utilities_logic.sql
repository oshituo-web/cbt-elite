-- MIGRATION: 19_elite_utilities_logic
-- DESCRIPTION: Logic for League Insurance and AI Score Prediction storage

-- A. Add columns for Insurance and Predictions
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS has_league_insurance BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_ai_score_prediction JSONB;

-- B. Update Store Logic to handle Insurance and Prediction Tokens
CREATE OR REPLACE FUNCTION atomic_store_purchase(
    p_user_id UUID,
    p_cost INT,
    p_item_id TEXT
) RETURNS VOID AS $$
BEGIN
    -- Check balance
    IF (SELECT elite_coins FROM users WHERE id = p_user_id) < p_cost THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    -- Deduct coins
    UPDATE users SET elite_coins = elite_coins - p_cost WHERE id = p_user_id;

    -- Apply item effect
    IF p_item_id = 'streak_freeze' THEN
        UPDATE users SET streak_freeze_count = COALESCE(streak_freeze_count, 0) + 1 WHERE id = p_user_id;
    ELSIF p_item_id = 'league_insurance' THEN
        UPDATE users SET has_league_insurance = TRUE WHERE id = p_user_id;
    ELSIF p_item_id = 'score_prediction' THEN
        -- We just allow the frontend to proceed; the cost was already deducted
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. Update League Logic to RESPECT Insurance
-- We modify the join_league_group function to check 'has_league_insurance'
CREATE OR REPLACE FUNCTION join_league_group(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_current_week DATE := date_trunc('week', now())::DATE;
    v_last_sync DATE;
    v_tier TEXT;
    v_group UUID;
    v_last_week DATE;
    v_rank INT;
    v_has_insurance BOOLEAN;
BEGIN
    -- Get current state
    SELECT last_league_sync_week, league_tier, current_league_group, has_league_insurance
    INTO v_last_sync, v_tier, v_group, v_has_insurance
    FROM users WHERE id = p_user_id;

    -- Check if the week has changed
    IF v_last_sync IS NULL OR v_last_sync < v_current_week THEN
        
        -- PROMOTION / DEMOTION CALCULATION
        IF v_group IS NOT NULL AND v_last_sync IS NOT NULL THEN
            v_last_week := v_last_sync;
            
            -- Calculate rank in their group for that specific week
            WITH group_ranks AS (
                SELECT 
                    u.id as user_id,
                    RANK() OVER (ORDER BY COALESCE(ws.total_questions_answered, 0) DESC) as user_rank
                FROM users u
                LEFT JOIN weekly_summaries ws ON ws.user_id = u.id AND ws.week_start_date = v_last_week
                WHERE u.current_league_group = v_group
            )
            SELECT user_rank INTO v_rank FROM group_ranks WHERE user_id = p_user_id;

            -- Promotion Logic (Top 5)
            IF v_rank <= 5 THEN
                v_tier := CASE 
                    WHEN v_tier = 'Bronze' THEN 'Silver'
                    WHEN v_tier = 'Silver' THEN 'Gold'
                    WHEN v_tier = 'Gold' THEN 'Diamond'
                    WHEN v_tier = 'Diamond' THEN 'Elite'
                    ELSE v_tier
                END;
            -- Demotion Logic (Bottom 5)
            ELSIF v_rank >= 15 THEN
                -- 🔥 INSURANCE CHECK: Only demote if they DON'T have insurance
                IF NOT v_has_insurance THEN
                    v_tier := CASE 
                        WHEN v_tier = 'Elite' THEN 'Diamond'
                        WHEN v_tier = 'Diamond' THEN 'Gold'
                        WHEN v_tier = 'Gold' THEN 'Silver'
                        WHEN v_tier = 'Silver' THEN 'Bronze'
                        ELSE v_tier
                    END;
                END IF;
            END IF;
        END IF;

        -- Assign to a new group for THIS week
        SELECT current_league_group INTO v_group
        FROM users 
        WHERE league_tier = v_tier 
          AND last_league_sync_week = v_current_week
        GROUP BY current_league_group
        HAVING COUNT(*) < 20
        LIMIT 1;

        IF v_group IS NULL THEN
            v_group := gen_random_uuid();
        END IF;

        -- Update User and RESET insurance for the new week
        UPDATE users SET 
            league_tier = v_tier,
            current_league_group = v_group,
            last_league_sync_week = v_current_week,
            has_league_insurance = FALSE -- reset for the new week
        WHERE id = p_user_id;
    END IF;

    RETURN jsonb_build_object(
        'tier', v_tier,
        'group_id', v_group,
        'week_start', v_current_week,
        'insurance_active', v_has_insurance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
