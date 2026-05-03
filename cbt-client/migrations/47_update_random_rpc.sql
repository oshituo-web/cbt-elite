-- Migration 47: Update get_random_question_ids to support question source
-- This fixes the bug where AI mode returns only 2 questions and Past mode returns 0
-- by pushing the is_past_question filter down into the random selection RPC.

CREATE OR REPLACE FUNCTION get_random_question_ids(
    p_subject_id UUID DEFAULT NULL,
    p_exam_id UUID DEFAULT NULL,
    p_exam_type TEXT DEFAULT NULL,
    p_topic TEXT DEFAULT NULL,
    p_question_type TEXT DEFAULT 'objective',
    p_limit INT DEFAULT 20,
    p_exclude_ids INT[] DEFAULT '{}',
    p_is_past_question BOOLEAN DEFAULT NULL
)
RETURNS TABLE (id INT)
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
