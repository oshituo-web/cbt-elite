-- =======================================================================
-- SYLLABUS ARCHITECTURE MIGRATION
-- =======================================================================

-- 1. Create EXAMS Table
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initial Exam Types
INSERT INTO public.exams (exam_name) VALUES ('JAMB'), ('WAEC'), ('NECO') ON CONFLICT DO NOTHING;

-- 2. Create SUBJECTS Table
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initial Subject List
INSERT INTO public.subjects (subject_name) VALUES 
('Mathematics'), ('English'), ('Physics'), ('Chemistry'), 
('Biology'), ('Literature'), ('Government'), ('Economics'), 
('CRS'), ('Commerce'), ('Financial Accounting'), ('Geography'), 
('Agriculture'), ('Civic Education'), ('Marketing') 
ON CONFLICT DO NOTHING;

-- 3. Create SYLLABUS_TOPICS Table
CREATE TABLE IF NOT EXISTS public.syllabus_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    subtopic TEXT,
    difficulty_relevance TEXT, -- Legacy/Metadata support
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(exam_id, subject_id, topic, subtopic)
);

-- 4. Update QUESTIONS Table
-- Add foreign keys and new columns
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS exam_id UUID REFERENCES public.exams(id);
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id);
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS subtopic TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON public.questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_questions_subject_id ON public.questions(subject_id);

-- 5. Create NEW_ANSWERS Table (Denormalized structure)
-- We'll use a temporary table to transition if needed, 
-- but here we'll define the final required structure.
CREATE TABLE IF NOT EXISTS public.question_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
    explanation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(question_id)
);

-- =======================================================================
-- SECURITY POLICIES
-- =======================================================================
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view exams" ON public.exams FOR SELECT USING (true);
CREATE POLICY "Anyone can view subjects" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "Anyone can view syllabus" ON public.syllabus_topics FOR SELECT USING (true);
CREATE POLICY "Anyone can view q_answers" ON public.question_answers FOR SELECT USING (true);

CREATE POLICY "Admins can manage exams" ON public.exams FOR ALL USING (public.is_admin());
CREATE POLICY "Admins can manage subjects" ON public.subjects FOR ALL USING (public.is_admin());
CREATE POLICY "Admins can manage syllabus" ON public.syllabus_topics FOR ALL USING (public.is_admin());
CREATE POLICY "Admins can manage q_answers" ON public.question_answers FOR ALL USING (public.is_admin());
