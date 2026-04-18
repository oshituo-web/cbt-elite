-- FIX: PostgREST View Relationships
-- Run this securely inside your Supabase SQL Editor.

-- Since 'question_answers' is a dynamic VIEW powered by a GROUP BY clause,
-- Supabase's API engine (PostgREST) naturally lost the foreign key trace. 
-- We gracefully restore the API relationship using a declarative hint comment!

COMMENT ON VIEW public.question_answers IS '@foreignKey (question_id) REFERENCES questions (id)';

-- Reload PostgREST API schema cache forcefully
NOTIFY pgrst, 'reload schema';
