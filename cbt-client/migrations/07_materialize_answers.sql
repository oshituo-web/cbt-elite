-- FIX: Restore missing Foreign Key on question_answers table
-- Run this in Supabase SQL Editor.
-- 
-- question_answers is already a proper table (not a view).
-- The Foreign Key linking it to questions was either never created
-- or was dropped during a CSV import. This script restores it safely.
-- =======================================================================

BEGIN;

-- 1. Remove any orphaned rows in question_answers that have no matching question
--    (prevents FK creation from failing due to invalid references)
DELETE FROM public.question_answers
WHERE question_id NOT IN (SELECT id FROM public.questions);

-- 2. Drop the old constraint if partially exists (avoid duplicate error)
ALTER TABLE public.question_answers 
DROP CONSTRAINT IF EXISTS fk_question_answers_question_id;

ALTER TABLE public.question_answers 
DROP CONSTRAINT IF EXISTS question_answers_question_id_fkey;

-- 3. Add the proper Foreign Key constraint
ALTER TABLE public.question_answers
ADD CONSTRAINT question_answers_question_id_fkey
FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;

-- 4. Force PostgREST to reload and discover the new FK relationship
NOTIFY pgrst, 'reload schema';

COMMIT;

-- SUCCESS: The exam loading error (PGRST200) should now be resolved.
-- Refresh the app in your browser after running this.
