CREATE TABLE IF NOT EXISTS public.news_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    category TEXT CHECK (category IN ('JAMB', 'WAEC', 'NECO', 'Admission', 'General')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.news_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view news" ON public.news_updates;
CREATE POLICY "Anyone can view news" ON public.news_updates
    FOR SELECT
    USING (true);
