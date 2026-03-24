-- Phase 10: Reference Questions for AI Training
CREATE TABLE IF NOT EXISTS public.reference_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_type TEXT NOT NULL, -- JAMB, WAEC, NECO
    subject TEXT NOT NULL,
    topic TEXT,
    question_text TEXT NOT NULL,
    model_answer TEXT,
    key_points JSONB,
    max_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing for fast search during generation
CREATE INDEX IF NOT EXISTS idx_ref_questions_exam_subject ON public.reference_questions (exam_type, subject);

-- RLS
ALTER TABLE public.reference_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Access" ON public.reference_questions FOR SELECT TO anon, authenticated USING (true);
