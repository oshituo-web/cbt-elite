-- Phase 2 Database Extensions for CBT Elite

-- 1. Add question_type to existing questions table (default to 'objective')
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS question_type TEXT DEFAULT 'objective';

-- Ensure existing records default cleanly
UPDATE public.questions SET question_type = 'objective' WHERE question_type IS NULL;

-- 2. Create theory_details table
CREATE TABLE IF NOT EXISTS public.theory_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    model_answer TEXT NOT NULL,
    key_points JSONB NOT NULL,
    max_score INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup by question
CREATE INDEX IF NOT EXISTS idx_theory_details_question_id ON public.theory_details(question_id);

-- 3. Create theory_submissions table
CREATE TABLE IF NOT EXISTS public.theory_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    user_answer TEXT NOT NULL,
    score INTEGER NOT NULL,
    feedback TEXT NOT NULL,
    session_id UUID REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookup by user and question
CREATE INDEX IF NOT EXISTS idx_theory_submissions_user_id ON public.theory_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_theory_submissions_question_id ON public.theory_submissions(question_id);

-- Secure RLS policies
ALTER TABLE public.theory_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.theory_details AS PERMISSIVE FOR SELECT USING (true);
CREATE POLICY "Enable all access for service role" ON public.theory_details AS PERMISSIVE FOR ALL USING (true);

ALTER TABLE public.theory_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable insert for authenticated users" ON public.theory_submissions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own submissions" ON public.theory_submissions AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Enable all access for service role" ON public.theory_submissions AS PERMISSIVE FOR ALL USING (true);
