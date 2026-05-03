-- Migration 46: Push Notifications Token Storage
-- Stores VAPID endpoint and cryptographic keys for sending Web Push Notifications

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by user_id
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON public.user_push_tokens(user_id);

-- Enable RLS
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only view, insert, and update their own tokens
CREATE POLICY "Users can manage their own push tokens" 
ON public.user_push_tokens
FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Allow service role full access (for sending notifications from edge functions)
CREATE POLICY "Service role can read all tokens" 
ON public.user_push_tokens
FOR SELECT USING (true);
