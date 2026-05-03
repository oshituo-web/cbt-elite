-- Migration 43: Add question_source to sessions and responses
-- Objective: Support strict separation of AI and Past Questions

ALTER TABLE public.exam_sessions 
ADD COLUMN IF NOT EXISTS question_source TEXT DEFAULT 'ai' CHECK (question_source IN ('ai', 'past'));

ALTER TABLE public.user_responses
ADD COLUMN IF NOT EXISTS question_source TEXT DEFAULT 'ai' CHECK (question_source IN ('ai', 'past'));

-- Update existing records to 'past' if is_past_question metadata was likely used
-- This is a best-effort backfill for historical data
UPDATE public.exam_sessions
SET question_source = 'past'
WHERE session_type = 'archive';

-- Refresh the sync_user_performance RPC to handle the new field
-- (We will update the JS side first, then refine the RPC if strictly needed for analytics)
