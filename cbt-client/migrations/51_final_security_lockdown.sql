-- ========================================================================
-- MIGRATION: 51_final_security_lockdown
-- DESCRIPTION: 
--   1. Fixes mistyped RLS on question_answers (previously 'answers').
--   2. Enables RLS and sets policies for 'exams' table.
--   3. Hardens 'users' SELECT policy to require authentication.
--   4. Ensures RLS is active across all core tables.
-- ========================================================================

BEGIN;

--------------------------------------------------------------------------------
-- 1. ENABLE ROW LEVEL SECURITY (Idempotent)
--------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 2. HARDEN USERS POLICY
-- Replaces the broad 'USING (true)' policy with one requiring authentication.
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view all usernames" ON public.users;
DROP POLICY IF EXISTS "Public read access for users" ON public.users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;

CREATE POLICY "Authenticated users can view basic profiles" 
ON public.users 
FOR SELECT 
TO authenticated
USING (true); 
-- Note: 'TO authenticated' restricts this to logged-in users.
-- Sensitive fields are still protected by the 'protect_user_fields' trigger and SELECT policies in migration 40.

--------------------------------------------------------------------------------
-- 3. SECURE QUESTION ANSWERS
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students can view question_answers" ON public.question_answers;
DROP POLICY IF EXISTS "Students can view answers" ON public.question_answers;

CREATE POLICY "Authenticated users can view question_answers" 
ON public.question_answers 
FOR SELECT 
TO authenticated
USING (true);

--------------------------------------------------------------------------------
-- 4. SECURE EXAMS
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view exams" ON public.exams;

CREATE POLICY "Authenticated users can view exams" 
ON public.exams 
FOR SELECT 
TO authenticated
USING (true);

--------------------------------------------------------------------------------
-- 5. ADMIN OVERRIDES (Safety Net)
--------------------------------------------------------------------------------
-- Ensure admins can still do everything on these tables
CREATE POLICY "Admins manage all question_answers" ON public.question_answers FOR ALL USING (public.is_admin());
CREATE POLICY "Admins manage all exams" ON public.exams FOR ALL USING (public.is_admin());

COMMIT;
