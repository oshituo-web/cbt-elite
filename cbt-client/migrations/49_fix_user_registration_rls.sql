-- ========================================================================
-- MIGRATION: 49_fix_user_registration_rls
-- DESCRIPTION: 
--   1. Adds INSERT policy for public.users to allow new users to create their profile.
--   2. Adds UPDATE policy for public.users to allow users to update their profile.
--   Note: Field protection is already handled by tr_protect_user_fields trigger.
-- ========================================================================

BEGIN;

-- Allow users to insert their own profile
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile" 
ON public.users 
FOR INSERT 
WITH CHECK ( auth.uid() = id );

-- Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" 
ON public.users 
FOR UPDATE 
USING ( auth.uid() = id )
WITH CHECK ( auth.uid() = id );

-- Ensure SELECT policy exists (it was added in migration 40, but let's be sure)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile" 
ON public.users 
FOR SELECT 
USING ( auth.uid() = id );

-- Allow admins to manage all profiles (handled by public.is_admin())
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.users;
CREATE POLICY "Admins can manage all profiles" 
ON public.users 
FOR ALL 
USING ( public.is_admin() );

COMMIT;
