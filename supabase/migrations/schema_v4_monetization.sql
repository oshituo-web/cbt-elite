-- Phase 4: Monetization & AI Credits
-- Target: public.profiles table expansions

-- 1. Create Tier Enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_tier') THEN
        CREATE TYPE user_tier AS ENUM ('free', 'activated', 'premium');
    END IF;
END $$;

-- 2. Add Monetization Columns to USERS
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS tier user_tier DEFAULT 'free',
ADD COLUMN IF NOT EXISTS activation_status BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS activation_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_type TEXT,
ADD COLUMN IF NOT EXISTS subscription_expiry TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ai_credits INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_credit_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS device_id TEXT;


-- 3. Create Audit Log Table for Monetization
CREATE TABLE IF NOT EXISTS public.monetization_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- 'deduction', 'activation', 'subscription', 'expiry'
    credits_change INTEGER DEFAULT 0,
    new_balance INTEGER,
    tier_change_to user_tier,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_mon_logs_user_id ON public.monetization_logs(user_id);

-- RLS for Logs
ALTER TABLE public.monetization_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own logs" ON public.monetization_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
