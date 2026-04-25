-- Phase 21: Secure Monetization RPCs
-- Revoke execution privileges from public/authenticated users to prevent client-side exploits

-- 1. Secure secure_activate_user
REVOKE EXECUTE ON FUNCTION public.secure_activate_user(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.secure_activate_user(UUID, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.secure_activate_user(UUID, TEXT) TO service_role;

-- 2. Secure secure_subscribe_user 
REVOKE EXECUTE ON FUNCTION public.secure_subscribe_user(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.secure_subscribe_user(UUID, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.secure_subscribe_user(UUID, TEXT) TO service_role;

-- 3. Secure secure_deduct_credit against cross-user manipulation
-- We keep EXECUTE for authenticated users, but enforce that they can only deduct their own credits.
CREATE OR REPLACE FUNCTION public.secure_deduct_credit(p_user_id UUID, p_action TEXT)
RETURNS VOID AS $$
DECLARE
    current_credits INTEGER;
BEGIN
    -- Authorization check: Ensure the caller is the owner or an admin (or service_role)
    IF auth.role() = 'authenticated' AND auth.uid() != p_user_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: You can only deduct your own credits.';
    END IF;

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
