-- Migration 14: Single Device Session Tracking
-- Adds a tracked token to ensure only one device can maintain an active authorized state.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS current_session_token UUID;

-- Optional: Create an index to speed up verification lookups
CREATE INDEX IF NOT EXISTS idx_users_session_token ON public.users(current_session_token);
