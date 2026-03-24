-- Phase 1 Stability: Async Grading Support

-- Add status column to theory_submissions
ALTER TABLE public.theory_submissions 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';

-- Update previous records
UPDATE public.theory_submissions SET status = 'completed' WHERE status IS NULL;
