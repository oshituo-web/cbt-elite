-- Migration 44: Refine Question Duplicates
-- Objective: Allow cross-year duplicates for official Past Questions, 
-- but strictly prevent any duplicates for AI-generated questions.

BEGIN;

-- 1. Drop the old blanket unique constraint
-- (This removes the rule that blocked identical text entirely)
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_question_text_key;

-- 2. Create a strict UNIQUE INDEX for AI Questions ONLY
-- This guarantees no duplicate text for AI questions (is_past_question = false).
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_ai_questions 
ON public.questions (question_text) 
WHERE is_past_question = false;

-- 3. Create a composite UNIQUE INDEX for Past Questions
-- This guarantees that a past question can repeat across different years, 
-- but NOT in the same year/exam/subject combo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_past_questions 
ON public.questions (question_text, exam_year, exam_type, subject_id) 
WHERE is_past_question = true;

COMMIT;
