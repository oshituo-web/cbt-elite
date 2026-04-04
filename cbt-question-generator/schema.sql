-- =======================================================================
-- 1. USERS TABLE
-- Tracks students using the platform.
-- =======================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    full_name TEXT,
    role TEXT DEFAULT 'student' CHECK (role IN ('student', 'moderator', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure the role column exists (in case table was created earlier)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student' CHECK (role IN ('student', 'moderator', 'admin'));

-- =======================================================================
-- 2. QUESTIONS TABLE (Enhanced)
-- Stores the generated questions.
-- =======================================================================
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    exam_type TEXT NOT NULL, -- WAEC, NECO, JAMB
    exam_year INTEGER,
    question_text TEXT UNIQUE NOT NULL,
    explanation TEXT NOT NULL,
    diagram_url TEXT,
    
    -- New Fields for Advanced Features
    difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')) DEFAULT 'Medium',
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE, -- Allows soft deletion of bad questions
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster querying by subject, topic, and difficulty
CREATE INDEX IF NOT EXISTS idx_questions_subject_topic ON public.questions(subject, topic);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions(difficulty);

-- =======================================================================
-- 3. ANSWERS TABLE
-- Links 4 options to each question.
-- =======================================================================
CREATE TABLE IF NOT EXISTS public.answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    option_letter CHAR(1) NOT NULL CHECK (option_letter IN ('A', 'B', 'C', 'D')),
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(question_id, option_letter)
);

CREATE INDEX IF NOT EXISTS idx_answers_question_id ON public.answers(question_id);

-- =======================================================================
-- 4. EXAM SESSIONS TABLE
-- Tracks when a student takes a practice test.
-- =======================================================================
CREATE TABLE IF NOT EXISTS public.exam_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    session_type TEXT NOT NULL, -- 'Mock Exam', 'Topic Practice', etc.
    subject TEXT, -- Nullable if it's a multi-subject exam (like JAMB)
    total_questions INTEGER NOT NULL,
    correct_answers INTEGER DEFAULT 0,
    time_taken_seconds INTEGER,
    score_percentage DECIMAL(5, 2),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_exam_sessions_user_id ON public.exam_sessions(user_id);

-- =======================================================================
-- 5. USER RESPONSES TABLE
-- Tracks every single answer a user clicked during a session.
-- =======================================================================
CREATE TABLE IF NOT EXISTS public.user_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    selected_answer_id UUID REFERENCES public.answers(id), -- Null if they skipped it
    user_answer_text TEXT, -- NEW: Stores the actual text or theory response
    is_correct BOOLEAN, -- Stored here for fast Analytics querying
    time_spent_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_responses_session_id ON public.user_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_user_responses_question_id ON public.user_responses(question_id);

-- =======================================================================
-- 6. TOPIC MASTERY TABLE (ANALYTICS)
-- Continuously updated summary of a student's performance per topic.
-- =======================================================================
CREATE TABLE IF NOT EXISTS public.topic_mastery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    total_attempted INTEGER DEFAULT 0,
    total_correct INTEGER DEFAULT 0,
    mastery_percentage DECIMAL(5, 2) DEFAULT 0.00,
    last_practiced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, subject, topic)
);

-- =======================================================================
-- 7. WEEKLY SUMMARIES TABLE
-- Stores pre-calculated weekend recaps for users.
-- =======================================================================
CREATE TABLE IF NOT EXISTS public.weekly_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    total_questions_answered INTEGER DEFAULT 0,
    average_score_percentage DECIMAL(5, 2),
    total_study_duration_seconds INTEGER DEFAULT 0,
    leaderboard_rank INTEGER,
    top_subject TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_weekly_summaries_user_id ON public.weekly_summaries(user_id);

-- =======================================================================
-- 8. BOOKMARKS TABLE
-- Allows students to save questions for review.
-- =======================================================================
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON public.bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_mastery_user_subject ON public.topic_mastery(user_id, subject);

-- =======================================================================
-- AUTOMATIC TIMESTAMPS TRIGGER FUNCTION
-- =======================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_modtime ON public.users;
CREATE TRIGGER update_users_modtime
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =======================================================================
-- 9. SECURITY FUNCTIONS
-- =======================================================================
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================================================================
-- 10. SECURITY POLICIES (Row Level Security)
-- =======================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- USERS Table Policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile" ON public.users FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.users;
CREATE POLICY "Admins can view all profiles" ON public.users FOR SELECT USING (public.is_admin());

-- QUESTIONS & ANSWERS (Read access for all authenticated users)
DROP POLICY IF EXISTS "Anyone can view questions" ON public.questions;
CREATE POLICY "Anyone can view questions" ON public.questions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view answers" ON public.answers;
CREATE POLICY "Anyone can view answers" ON public.answers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage questions" ON public.questions;
CREATE POLICY "Admins can manage questions" ON public.questions FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage answers" ON public.answers;
CREATE POLICY "Admins can manage answers" ON public.answers FOR ALL USING (public.is_admin());

-- EXAM SESSIONS & RESPONSES (User specific)
DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.exam_sessions;
CREATE POLICY "Users can manage their own sessions" ON public.exam_sessions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own responses" ON public.user_responses;
CREATE POLICY "Users can manage their own responses" ON public.user_responses FOR ALL USING (auth.uid() = user_id);

-- TOPIC MASTERY & SUMMARIES (User specific)
DROP POLICY IF EXISTS "Users can view their own mastery" ON public.topic_mastery;
CREATE POLICY "Users can view their own mastery" ON public.topic_mastery FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own summaries" ON public.weekly_summaries;
CREATE POLICY "Users can view their own summaries" ON public.weekly_summaries FOR SELECT USING (auth.uid() = user_id);

-- BOOKMARKS (User specific)
DROP POLICY IF EXISTS "Users can manage their own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can manage their own bookmarks" ON public.bookmarks FOR ALL USING (auth.uid() = user_id);
