-- 11_schema_audit_fix.sql
-- Ensuring all user columns required by the Elite Clan system exist

BEGIN;

-- 1. Essential Analytics & Rewards Columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS streak_freeze_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS elite_coins INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_questions_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_daily_reset_date DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_session_date DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_questions_answered INTEGER DEFAULT 0;

-- 2. Department & Clan Columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'General';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS league_tier TEXT DEFAULT 'Bronze';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS current_league_group UUID;

-- 3. Defaults & Sanitization
UPDATE public.users SET streak_count = 0 WHERE streak_count IS NULL;
UPDATE public.users SET elite_coins = 0 WHERE elite_coins IS NULL;
UPDATE public.users SET department = 'General' WHERE department IS NULL;
UPDATE public.users SET league_tier = 'Bronze' WHERE league_tier IS NULL;

COMMIT;
