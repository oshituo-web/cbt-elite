-- =======================================================================
-- MIGRATION: 38_is_admin_check_rpc
-- DESCRIPTION: Exposes a client-callable RPC wrapper around the internal
-- is_admin() helper. This allows main.js to perform a mandatory server-side
-- admin verification before loading the Admin panel — replacing the previous
-- client-side email string check which was bypassable via DevTools.
--
-- Security model:
--   - The function runs as the CALLING USER (no SECURITY DEFINER)
--   - auth.uid() is implicitly used by is_admin() which reads from users table
--   - A spoofed profile object in the browser cannot affect this result
--   - Returns FALSE for any unauthenticated or non-admin caller
-- =======================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.is_admin_check()
RETURNS BOOLEAN AS $$
BEGIN
    -- Delegates entirely to the existing is_admin() helper which reads
    -- the authenticated user's role from the users table via auth.uid().
    RETURN public.is_admin();
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execution right to authenticated users (non-admins will simply get FALSE)
GRANT EXECUTE ON FUNCTION public.is_admin_check() TO authenticated;

COMMIT;
