-- Update the get_random_question_ids function to exclude seen questions
CREATE OR REPLACE FUNCTION get_random_question_ids(
    p_subject_id uuid DEFAULT NULL,
    p_exam_id uuid DEFAULT NULL,
    p_exam_type text DEFAULT NULL,
    p_topic text DEFAULT NULL,
    p_question_type text DEFAULT 'objective',
    p_limit int DEFAULT 20,
    p_exclude_ids uuid[] DEFAULT ARRAY[]::uuid[] -- New parameter to exclude seen questions
)
RETURNS TABLE(id uuid) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT q.id
    FROM public.questions q
    WHERE
        q.is_active = TRUE
        AND (p_question_type IS NULL OR q.question_type = p_question_type)
        AND (p_subject_id IS NULL OR q.subject_id = p_subject_id)
        AND (p_exam_id IS NULL OR q.exam_id = p_exam_id)
        AND (p_exam_type IS NULL OR q.exam_type = p_exam_type)
        AND (p_topic IS NULL OR q.topic = p_topic)
        AND (q.id IS NOT NULL AND NOT (q.id = ANY(p_exclude_ids))) -- Exclude seen IDs
    ORDER BY random()
    LIMIT p_limit;
END;
$$;

-- Grant usage to authenticated role
GRANT EXECUTE ON FUNCTION get_random_question_ids(
    uuid, uuid, text, text, text, int, uuid[]
) TO authenticated;
