-- Migration: Add User Consent Tracking
-- Description: Adds columns to track when users accepted Privacy Policy and Terms of Use.

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS privacy_policy_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS terms_of_use_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT FALSE;

-- Update RLS if necessary (usually 'users' table update policy already allows users to update their own rows)
-- We check if the 'protect_user_fields' trigger allows these new columns.

-- 🛡️ Update trigger to allow these specific fields to be updated by the user
-- In schema_v6_security.sql, the trigger 'tr_protect_user_fields' blocks updates to 'tier', 'ai_credits', etc.
-- It uses 'to_jsonb(NEW)' and 'to_jsonb(OLD)' to check fields.
-- The current trigger logic in schema_v6_security.sql ONLY blocks:
-- - tier
-- - ai_credits
-- - is_activated / activation_status
-- - premium_until / subscription_expiry
-- So these new columns should be safe by default.
