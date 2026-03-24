-- Phase 6: Diagram Support for CBT Elite
-- Run this in your Supabase SQL Editor to enable visual questions.

-- 1. Add diagram_url to the questions table
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS diagram_url TEXT;

-- 2. Performance Indexing for Diagrams
CREATE INDEX IF NOT EXISTS idx_questions_has_diagram ON public.questions (subject_id) WHERE (diagram_url IS NOT NULL);

-- 3. Update RLS (if needed, usually covers existing columns automatically)
COMMENT ON COLUMN public.questions.diagram_url IS 'URL to an image, diagram, or illustration associated with the question.';
