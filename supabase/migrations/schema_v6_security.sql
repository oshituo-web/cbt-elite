-- Phase 12: Security Lockdown (RLS)
-- Target: Protect tier and ai_credits from client-side manipulation

-- 1. Redefine USERS update policy (Restrict to non-sensitive columns)
-- We need to drop the old generic update policy if it exists
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;

-- Create a restrictive policy: Users can only update their own username/full_name
-- Note: Supabase RLS is row-level, not column-level directly for UPDATE. 
-- Best practice: Use a trigger or separate security definer functions for sensitive fields.

CREATE POLICY "Users can update their own profile" ON public.users 
FOR UPDATE USING (auth.uid() = id);
-- To truly prevent 'tier' update via RLS, we'd need a trigger or to move those fields to a separate table.
-- For now, we'll implement a TRIGGER that blocks self-updates to sensitive columns.

CREATE OR REPLACE FUNCTION public.protect_user_fields()
RETURNS TRIGGER AS $$
DECLARE
    v_new JSONB := to_jsonb(NEW);
    v_old JSONB := to_jsonb(OLD);
BEGIN
    -- If the user is NOT an admin AND they are trying to change sensitive fields
    IF NOT public.is_admin() THEN
        -- Check 'tier'
        IF v_new ? 'tier' AND (v_new->>'tier' IS DISTINCT FROM v_old->>'tier') THEN
            RAISE EXCEPTION 'You are not authorized to modify your subscription tier.';
        END IF;

        -- Check 'ai_credits'
        IF v_new ? 'ai_credits' AND (v_new->>'ai_credits' IS DISTINCT FROM v_old->>'ai_credits') THEN
            RAISE EXCEPTION 'You are not authorized to modify your AI credits.';
        END IF;

        -- Check 'is_activated' or 'activation_status'
        IF (v_new ? 'is_activated' AND (v_new->>'is_activated' IS DISTINCT FROM v_old->>'is_activated')) OR
           (v_new ? 'activation_status' AND (v_new->>'activation_status' IS DISTINCT FROM v_old->>'activation_status')) THEN
            RAISE EXCEPTION 'You are not authorized to modify your activation status.';
        END IF;

        -- Check 'premium_until' or 'subscription_expiry'
        IF (v_new ? 'premium_until' AND (v_new->>'premium_until' IS DISTINCT FROM v_old->>'premium_until')) OR
           (v_new ? 'subscription_expiry' AND (v_new->>'subscription_expiry' IS DISTINCT FROM v_old->>'subscription_expiry')) THEN
            RAISE EXCEPTION 'You are not authorized to modify your subscription expiry.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_protect_user_fields ON public.users;
CREATE TRIGGER tr_protect_user_fields
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_user_fields();

-- 2. Create Security Definer Functions for legitimate system updates
-- These functions run with 'postgres' privileges to bypass the trigger above.

CREATE OR REPLACE FUNCTION public.secure_deduct_credit(p_user_id UUID, p_action TEXT)
RETURNS VOID AS $$
DECLARE
    current_credits INTEGER;
BEGIN
    SELECT ai_credits INTO current_credits FROM public.users WHERE id = p_user_id;
    
    IF current_credits <= 0 THEN
        RAISE EXCEPTION 'No AI credits remaining.';
    END IF;

    UPDATE public.users 
    SET ai_credits = ai_credits - 1 
    WHERE id = p_user_id;

    INSERT INTO public.monetization_logs (user_id, action_type, credits_change, new_balance, metadata)
    VALUES (p_user_id, 'deduction', -1, current_credits - 1, jsonb_build_object('action', p_action));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.secure_activate_user(p_user_id UUID, p_plan TEXT)
RETURNS VOID AS $$
DECLARE
    v_expiry TIMESTAMP WITH TIME ZONE;
BEGIN
    v_expiry := NOW() + INTERVAL '30 days';

    UPDATE public.users SET 
        tier = 'premium',
        activation_status = true,
        activation_date = NOW(),
        subscription_expiry = v_expiry,
        ai_credits = 120,
        subscription_type = p_plan
    WHERE id = p_user_id;

    INSERT INTO public.monetization_logs (user_id, action_type, credits_change, new_balance, tier_change_to, metadata)
    VALUES (p_user_id, 'activation', 120, 120, 'premium', jsonb_build_object('plan', p_plan));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.secure_subscribe_user(p_user_id UUID, p_plan TEXT)
RETURNS VOID AS $$
DECLARE
    v_days INTEGER;
    v_credits INTEGER;
    v_expiry TIMESTAMP WITH TIME ZONE;
BEGIN
    IF p_plan = 'weekly' THEN
        v_days := 7;
        v_credits := 40;
    ELSE
        v_days := 30;
        v_credits := 120;
    END IF;

    v_expiry := NOW() + (v_days || ' days')::INTERVAL;

    UPDATE public.users SET 
        tier = 'premium',
        subscription_type = p_plan,
        subscription_expiry = v_expiry,
        ai_credits = v_credits,
        last_credit_reset = NOW()
    WHERE id = p_user_id;

    INSERT INTO public.monetization_logs (user_id, action_type, credits_change, new_balance, tier_change_to, metadata)
    VALUES (p_user_id, 'subscription', v_credits, v_credits, 'premium', jsonb_build_object('plan', p_plan));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

