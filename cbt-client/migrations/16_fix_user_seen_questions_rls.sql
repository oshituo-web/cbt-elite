-- Fix RLS policy on user_seen_questions table
-- Resolves: "new row violates row-level security policy for table 'user_seen_questions'"

-- 1. Ensure table has RLS enabled
ALTER TABLE public.user_seen_questions ENABLE ROW LEVEL SECURITY;

-- 2. Add INSERT policy for authenticated users
DROP POLICY IF EXISTS "Users can insert their own seen questions" ON public.user_seen_questions;
CREATE POLICY "Users can insert their own seen questions" 
ON public.user_seen_questions 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 3. Ensure SELECT policy exists so the platform can query them for exclusion
DROP POLICY IF EXISTS "Users can select their own seen questions" ON public.user_seen_questions;
CREATE POLICY "Users can select their own seen questions" 
ON public.user_seen_questions 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);
