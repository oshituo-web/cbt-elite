-- Make explanation nullable in questions table
-- to allow moving it to the answers table
ALTER TABLE public.questions ALTER COLUMN explanation DROP NOT NULL;
