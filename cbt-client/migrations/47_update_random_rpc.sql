-- Migration 47: Update get_random_question_ids to support question source
-- Corrected version: questions.id is actually a UUID, not an INT.
-- This also cleans up overloaded versions of the function to prevent PGRST203 errors.

-- 1. Cleanup existing overloaded functions to ensure a clean slate
DROP FUNCTION IF EXISTS public.get_random_question_ids(uuid, uuid, text, text, text, integer);
DROP FUNCTION IF EXISTS public.get_random_question_ids(uuid, uuid, text, text, text, integer, uuid[]);
DROP FUNCTION IF EXISTS public.get_random_question_ids(uuid, uuid, text, text, text, integer, int[]);
DROP FUNCTION IF EXISTS public.get_random_question_ids(uuid, uuid, text, text, text, integer, int[], boolean);

-- 2. Create the final version with UUID support and Question Source filtering
CREATE OR REPLACE FUNCTION get_random_question_ids(
    p_subject_id UUID DEFAULT NULL,
    p_exam_id UUID DEFAULT NULL,
    p_exam_type TEXT DEFAULT NULL,
    p_topic TEXT DEFAULT NULL,
    p_question_type TEXT DEFAULT 'objective',
    p_limit INT DEFAULT 20,
    p_exclude_ids UUID[] DEFAULT '{}',
    p_is_past_question BOOLEAN DEFAULT NULL
)
RETURNS TABLE (id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT q.id
    FROM public.questions q
    WHERE q.is_active = true
      AND (p_subject_id IS NULL OR q.subject_id = p_subject_id)
      AND (p_exam_id IS NULL OR q.exam_id = p_exam_id)
      AND (p_exam_type IS NULL OR q.exam_type ILIKE '%' || p_exam_type || '%')
      AND (p_topic IS NULL OR q.topic = p_topic)
      AND (
          p_question_type IS NULL 
          OR (p_question_type = 'theory' AND q.question_type = 'theory')
          OR (p_question_type != 'theory' AND (q.question_type = 'objective' OR q.question_type IS NULL))
      )
      AND (p_is_past_question IS NULL OR q.is_past_question = p_is_past_question)
      AND NOT (q.id = ANY(p_exclude_ids))
    ORDER BY random()
    LIMIT p_limit;
END;
$$;
