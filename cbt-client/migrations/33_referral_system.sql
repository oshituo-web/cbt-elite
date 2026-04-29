-- 33_referral_system.sql
-- Viral Referral System Implementation

-- 1. Add referral_code to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- 2. Function to generate a unique random referral code (e.g., ELITE-XXXX)
CREATE OR REPLACE FUNCTION generate_referral_code() 
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  exists_code BOOLEAN;
BEGIN
  LOOP
    new_code := 'ELITE-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = new_code) INTO exists_code;
    EXIT WHEN NOT exists_code;
  END LOOP;
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger to assign referral code on profile creation
CREATE OR REPLACE FUNCTION trigger_assign_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_created_assign_code
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION trigger_assign_referral_code();

-- 4. Create referrals tracking table
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID REFERENCES public.profiles(id) NOT NULL,
    referred_id UUID REFERENCES public.profiles(id) NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, completed
    reward_granted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(referred_id) -- A user can only be referred once
);

-- 5. Security & RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referrers can view their own referrals"
ON public.referrals FOR SELECT
USING (auth.uid() = referrer_id);

-- 6. RPC to claim referral reward
-- This would be called when a referred user completes their first session or similar milestone
CREATE OR REPLACE FUNCTION public.claim_referral_reward(p_referred_id UUID)
RETURNS JSON AS $$
DECLARE
    v_referrer_id UUID;
    v_already_claimed BOOLEAN;
BEGIN
    -- Verify caller
    IF auth.uid() != p_referred_id THEN
        RETURN json_build_object('error', 'Unauthorized');
    END IF;

    -- Get referral record
    SELECT referrer_id, reward_granted INTO v_referrer_id, v_already_claimed
    FROM public.referrals
    WHERE referred_id = p_referred_id;

    IF v_referrer_id IS NULL THEN
        RETURN json_build_object('error', 'No referral found');
    END IF;

    IF v_already_claimed THEN
        RETURN json_build_object('error', 'Reward already granted');
    END IF;

    -- Grant rewards (e.g., 100 coins to both)
    UPDATE public.profiles SET elite_coins = elite_coins + 100 WHERE id = v_referrer_id;
    UPDATE public.profiles SET elite_coins = elite_coins + 100 WHERE id = p_referred_id;

    -- Mark as granted
    UPDATE public.referrals SET reward_granted = TRUE, status = 'completed' WHERE referred_id = p_referred_id;

    RETURN json_build_object('success', true, 'reward', 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
