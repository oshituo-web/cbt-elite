/*
  =======================================================================
  CBT ELITE: PERFORMANCE OPTIMIZATION (RANDOMIZATION RPC)
  =======================================================================
  Moves the heavy lifting of question randomization from the client to
  the database. This avoids fetching thousands of IDs across the wire.
*/

CREATE OR REPLACE FUNCTION public.get_random_question_ids(
  p_subject_id UUID DEFAULT NULL,
  p_exam_id UUID DEFAULT NULL,
  p_exam_type TEXT DEFAULT NULL,
  p_topic TEXT DEFAULT NULL,
  p_question_type TEXT DEFAULT 'objective',
  p_limit INT DEFAULT 20
)
RETURNS TABLE (id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT q.id
  FROM public.questions q
  WHERE q.is_active = true
    AND (p_subject_id IS NULL OR q.subject_id = p_subject_id)
    AND (p_exam_id IS NULL OR q.exam_id = p_exam_id)
    AND (p_exam_type IS NULL OR q.exam_type = p_exam_type)
    AND (p_topic IS NULL OR q.topic = p_topic)
    AND (
      (p_question_type = 'theory' AND q.question_type = 'theory') OR
      (p_question_type = 'objective' AND (q.question_type = 'objective' OR q.question_type IS NULL))
    )
  ORDER BY random()
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_random_question_ids TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_random_question_ids TO service_role;
