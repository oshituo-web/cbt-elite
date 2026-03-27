-- Migration: Add support for Question Groups (Passages, Visuals, Data Sets)

-- 1. Create Question Groups Table
CREATE TABLE IF NOT EXISTS public.question_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('passage', 'map', 'graph', 'data_set', 'instruction')),
    subject TEXT,
    exam_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add group_id to Questions table
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.question_groups(id) ON DELETE SET NULL;

-- 3. Add Index for performance
CREATE INDEX IF NOT EXISTS idx_questions_group_id ON public.questions(group_id);

-- 4. Enable RLS on question_groups
ALTER TABLE public.question_groups ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for question_groups
DROP POLICY IF EXISTS "Public can view question groups" ON public.question_groups;
CREATE POLICY "Public can view question groups" 
ON public.question_groups 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Super Admin can manage question groups" ON public.question_groups;
CREATE POLICY "Super Admin can manage question groups" 
ON public.question_groups 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'admin'
    )
);

-- Trigger to update 'updated_at'
CREATE OR REPLACE FUNCTION update_question_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_question_groups_updated_at ON public.question_groups;
CREATE TRIGGER trigger_update_question_groups_updated_at
BEFORE UPDATE ON public.question_groups
FOR EACH ROW
EXECUTE FUNCTION update_question_groups_updated_at();

-- Add real-time replication if needed
-- ALTER PUBLICATION supabase_realtime ADD TABLE question_groups;
