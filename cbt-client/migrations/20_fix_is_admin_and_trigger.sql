-- MIGRATION: 20_fix_is_admin_and_trigger
-- DESCRIPTION: Defines the missing public.is_admin() helper function that
-- is referenced by protect_user_fields trigger and RLS policies but was
-- never defined, causing every UPDATE on users to crash silently.
-- Also hardens the trigger to allow SECURITY DEFINER system functions to
-- bypass field protection (so sync_user_performance can save streak/coins).

-- ========================================================================
-- 1. Define public.is_admin()
-- ========================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- Allow postgres superuser and service_role to always pass
    IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
        RETURN TRUE;
    END IF;

    -- Check the authenticated user's role in the users table
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
          AND role IN ('admin', 'super-admin', 'moderator')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;


-- ========================================================================
-- 2. Rebuild protect_user_fields trigger with safe bypass for system functions
-- ========================================================================
CREATE OR REPLACE FUNCTION public.protect_user_fields()
RETURNS TRIGGER AS $$
DECLARE
    v_new JSONB := to_jsonb(NEW);
    v_old JSONB := to_jsonb(OLD);
BEGIN
    -- SYSTEM BYPASS: Allow postgres/service_role/SECURITY DEFINER functions
    IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
        RETURN NEW;
    END IF;

    -- ADMIN BYPASS
    IF public.is_admin() THEN
        RETURN NEW;
    END IF;

    -- PROTECTION: Block normal users from modifying sensitive fields

    IF v_new ? 'tier' AND (v_new->>'tier' IS DISTINCT FROM v_old->>'tier') THEN
        RAISE EXCEPTION 'You are not authorized to modify your subscription tier.';
    END IF;

    IF v_new ? 'ai_credits' AND (v_new->>'ai_credits' IS DISTINCT FROM v_old->>'ai_credits') THEN
        RAISE EXCEPTION 'You are not authorized to modify your AI credits.';
    END IF;

    IF (v_new ? 'is_activated' AND (v_new->>'is_activated' IS DISTINCT FROM v_old->>'is_activated')) OR
       (v_new ? 'activation_status' AND (v_new->>'activation_status' IS DISTINCT FROM v_old->>'activation_status')) THEN
        RAISE EXCEPTION 'You are not authorized to modify your activation status.';
    END IF;

    IF (v_new ? 'premium_until' AND (v_new->>'premium_until' IS DISTINCT FROM v_old->>'premium_until')) OR
       (v_new ? 'subscription_expiry' AND (v_new->>'subscription_expiry' IS DISTINCT FROM v_old->>'subscription_expiry')) THEN
        RAISE EXCEPTION 'You are not authorized to modify your subscription expiry.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_protect_user_fields ON public.users;
CREATE TRIGGER tr_protect_user_fields
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_user_fields();


-- ========================================================================
-- 3. Grant EXECUTE on sync_user_performance to authenticated users
-- ========================================================================
GRANT EXECUTE ON FUNCTION public.sync_user_performance(
    UUID, INT, INT, INT, JSONB, INT, DATE, TEXT
) TO authenticated;
