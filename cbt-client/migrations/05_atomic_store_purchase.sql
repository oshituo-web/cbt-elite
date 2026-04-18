-- Migration to introduce atomic store purchases and prevent race conditions

CREATE OR REPLACE FUNCTION purchase_streak_freeze(p_user_id UUID, p_cost INT)
RETURNS BOOLEAN AS $$
DECLARE
    v_coins INT;
BEGIN
    -- Select with row-level lock to prevent concurrent modifications
    SELECT elite_coins INTO v_coins FROM users WHERE id = p_user_id FOR UPDATE;
    
    IF v_coins >= p_cost THEN
        UPDATE users SET 
            elite_coins = elite_coins - p_cost,
            streak_freeze_count = COALESCE(streak_freeze_count, 0) + 1
        WHERE id = p_user_id;
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
