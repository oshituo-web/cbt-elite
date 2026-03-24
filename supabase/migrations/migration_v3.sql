-- Phase 1 Stability: Schema Upgrades

-- 1. Add marking_scheme to theory_details
ALTER TABLE public.theory_details 
ADD COLUMN IF NOT EXISTS marking_scheme JSONB DEFAULT '[]';

-- 2. Performance Indexes (Admin and Load)
CREATE INDEX IF NOT EXISTS idx_questions_subject_id ON public.questions(subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON public.questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_questions_exam_type ON public.questions(exam_type);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON public.questions(topic);

-- 3. Update existing records: Migrate key_points to marking_scheme if in old format
-- Note: This is a safe migration that maps key_points string array to basic point objects
UPDATE public.theory_details 
SET marking_scheme = (
  SELECT jsonb_agg(jsonb_build_object('point', x, 'keywords', ARRAY[x], 'marks', 1))
  FROM jsonb_array_elements_text(key_points) AS x
)
WHERE marking_scheme = '[]' AND key_points != '[]';
