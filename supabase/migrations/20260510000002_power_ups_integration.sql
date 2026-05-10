-- 1. Add eliminate_2_uses column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS eliminate_2_uses INT DEFAULT 0;

-- 2. Update atomic_store_purchase to handle all store items explicitly
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
        UPDATE users SET last_ai_score_prediction = '{"purchased": true}'::jsonb WHERE id = p_user_id;
    ELSIF p_item_id = 'power_up_bundle' THEN
        UPDATE users SET eliminate_2_uses = COALESCE(eliminate_2_uses, 0) + 5 WHERE id = p_user_id;
    ELSIF p_item_id = 'eliminate_2_use' THEN
        -- Individual on-the-fly purchase from exam
        UPDATE users SET eliminate_2_uses = COALESCE(eliminate_2_uses, 0) + 1 WHERE id = p_user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create RPC to securely consume a power-up during practice
CREATE OR REPLACE FUNCTION use_power_up(
    p_user_id UUID,
    p_power_up_type TEXT
) RETURNS VOID AS $$
BEGIN
    IF p_power_up_type = 'eliminate_2' THEN
        IF (SELECT COALESCE(eliminate_2_uses, 0) FROM users WHERE id = p_user_id) < 1 THEN
            RAISE EXCEPTION 'No eliminate 2 uses remaining';
        END IF;
        UPDATE users SET eliminate_2_uses = eliminate_2_uses - 1 WHERE id = p_user_id;
    ELSE
        RAISE EXCEPTION 'Invalid power up type';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
