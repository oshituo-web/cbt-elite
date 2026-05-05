-- MIGRATION: 50_fix_users_table_columns
-- DESCRIPTION: Ensures the public.users table has all the columns expected by the application code,
-- specifically columns that were erroneously added to a 'profiles' table in earlier migrations.

BEGIN;

-- 1. Ensure referral columns exist on users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- 2. Ensure department column exists (just in case)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'General';

-- 3. Ensure streak freeze count exists (expected by sync_user_performance)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS streak_freeze_count INT DEFAULT 0;

-- 4. Ensure milestones awarded exists
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS milestones_awarded TEXT[] DEFAULT '{}';

-- 5. Ensure last session tracking exists
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_session_date DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_daily_reset_date DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_questions_count INT DEFAULT 0;

-- 6. Ensure monetization columns exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS activation_status BOOLEAN DEFAULT false;

-- 7. Fix RLS for registration (Ensuring it's fully open for the registration step)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile" 
ON public.users 
FOR INSERT 
WITH CHECK ( auth.uid() = id );

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" 
ON public.users 
FOR UPDATE 
USING ( auth.uid() = id )
WITH CHECK ( auth.uid() = id );

-- 8. Allow users to see basic info of others (Required for leaderboard/username check)
DROP POLICY IF EXISTS "Users can view all usernames" ON public.users;
CREATE POLICY "Users can view all usernames" 
ON public.users 
FOR SELECT 
USING ( true ); -- Everyone can see everyone's basic profile (standard for leaderboard)

COMMIT;
