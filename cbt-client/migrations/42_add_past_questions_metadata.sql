-- Migration: 42_add_past_questions_metadata.sql
-- Description: Adds columns to support the "Real Past Questions Archive" feature.

BEGIN;

-- 1. Add metadata columns to the questions table
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS is_past_question BOOLEAN DEFAULT false;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS exam_year INTEGER;

-- 2. Index for fast filtering in the Archive UI
CREATE INDEX IF NOT EXISTS idx_questions_archive_filter 
ON public.questions (exam_type, subject_id, exam_year) 
WHERE is_past_question = true;

-- 3. Tag existing questions that look like past questions (Optional/Safety)
-- If we already have questions with specific years in the text, we could try to extract them,
-- but for now, we'll keep them as 'false' and let the importer handle the new ones.

COMMIT;
