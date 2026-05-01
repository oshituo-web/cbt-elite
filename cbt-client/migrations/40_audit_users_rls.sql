-- =======================================================================
-- MIGRATION: 40_audit_users_rls
-- DESCRIPTION: Enforces strict Row Level Security (RLS) on the `users` table
-- specifically for the SELECT operation. Previously, non-admin users might 
-- have been able to fetch the full table if they bypassed client-side code.
-- This ensures users can ONLY read their own row, while admins can read all.
-- =======================================================================

BEGIN;

-- Enable RLS (in case it wasn't already)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing SELECT policies on users table to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
DROP POLICY IF EXISTS "Public read access for users" ON public.users;
DROP POLICY IF EXISTS "Allow individual read access" ON public.users;

-- Policy 1: Users can view their own row
CREATE POLICY "Users can view their own profile" 
ON public.users 
FOR SELECT 
USING ( auth.uid() = id );

-- Policy 2: Admins (admin, super-admin, moderator) can view all rows
-- Note: We use the existing public.is_admin() helper for consistency and safety
CREATE POLICY "Admins can view all profiles" 
ON public.users 
FOR SELECT 
USING ( public.is_admin() );

-- Ensure service_role can bypass RLS (Supabase default, but good practice to note)
-- (PostgREST uses authenticated or anon roles, service_role is immune to RLS by default)

COMMIT;
