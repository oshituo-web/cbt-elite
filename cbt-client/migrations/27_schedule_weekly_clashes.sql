-- =======================================================================
-- MIGRATION: 27_schedule_weekly_clashes
-- DESCRIPTION: Sets up an automatic pg_cron job to generate clash seeds
-- every Saturday at 12:01 AM WAT (11:01 PM Friday UTC).
-- 
-- REQUIREMENT: pg_cron extension must be enabled in Supabase.
--   Go to: Dashboard → Database → Extensions → Search "pg_cron" → Enable
-- =======================================================================

-- Step 1: Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: Grant usage to postgres user (required by Supabase)
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Step 3: Remove any existing clash scheduler jobs to avoid duplicates
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'weekly_clash_generator';

-- Step 4: Schedule the clash seed function to run every Saturday at 23:01 UTC
-- (= 12:01 AM Sunday WAT = midnight start of clash day)
-- This seeds BOTH this week's Saturday clash AND Sunday's Super Clash in one call.
-- 
-- Cron format: minute hour day-of-month month day-of-week
--   23 01 * * 6  → 1:23 AM UTC every Saturday = right after midnight WAT Saturday
SELECT cron.schedule(
    'weekly_clash_generator',   -- job name
    '01 23 * * 5',              -- 11:01 PM UTC Friday = 12:01 AM WAT Saturday
    'SELECT generate_weekly_clash_seeds()'
);

-- Verify the job was scheduled
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'weekly_clash_generator';
