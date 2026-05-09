-- Migration: Add User Exam Preference and Harden RPC Filtering

-- 1. Add preferred_exam_type to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS preferred_exam_type TEXT DEFAULT 'JAMB' 
CHECK (preferred_exam_type IN ('JAMB', 'WAEC', 'NECO'));

-- 2. Update existing randomization RPC to handle STRICT exam filtering
CREATE OR REPLACE FUNCTION public.get_random_question_ids(
  p_subject_id UUID DEFAULT NULL,
  p_exam_id UUID DEFAULT NULL,
  p_exam_type TEXT DEFAULT NULL,
  p_topic TEXT DEFAULT NULL,
  p_question_type TEXT DEFAULT 'objective',
  p_limit INT DEFAULT 20,
  p_exclude_ids UUID[] DEFAULT ARRAY[]::UUID[] -- Match the updated v8 signature
)
RETURNS TABLE (id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT q.id
  FROM public.questions q
  WHERE q.is_active = true
    AND (p_subject_id IS NULL OR q.subject_id = p_subject_id)
    AND (p_exam_id IS NULL OR q.exam_id = p_exam_id)
    -- 🔥 STRICT ENFORCEMENT: If p_exam_type is provided, NO nulls or other types allowed.
    AND (p_exam_type IS NULL OR q.exam_type = p_exam_type)
    AND (p_topic IS NULL OR q.topic = p_topic)
    AND (
      (p_question_type = 'theory' AND q.question_type = 'theory') OR
      (p_question_type = 'objective' AND (q.question_type = 'objective' OR q.question_type IS NULL))
    )
    AND (q.id IS NOT NULL AND NOT (q.id = ANY(p_exclude_ids)))
  ORDER BY random()
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
