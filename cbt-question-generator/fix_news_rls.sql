-- ====================================================================
-- 🛡️ NEWS & USER SECURITY OVERHAUL
-- This script fixes RLS errors for news management and locks roles.
-- ====================================================================

-- 1. SECURE THE NEWS_UPDATES TABLE
--------------------------------------------------------------------
ALTER TABLE public.news_updates ENABLE ROW LEVEL SECURITY;

-- 1a. Allow everyone (students/public) to view news
DROP POLICY IF EXISTS "Public Read News" ON public.news_updates;
CREATE POLICY "Public Read News" 
ON public.news_updates FOR SELECT 
USING (true);

-- 1b. Allow ONLY Admins to Create/Update/Delete news
DROP POLICY IF EXISTS "Admin news management" ON public.news_updates;
CREATE POLICY "Admin news management" 
ON public.news_updates FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super-admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super-admin')
    )
);


-- 2. SECURE THE USERS TABLE (Role-Protection)
--------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS has_seen_tour BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2a. Allow users to see their own profiles and all email/roles for management
DROP POLICY IF EXISTS "Profile viewability" ON public.users;
CREATE POLICY "Profile viewability"
ON public.users FOR SELECT
USING (true);

-- 2b. Allow users to update their OWN profile BUT BLOCK role changes
-- This policy ensures the 'role' column cannot be changed by the user themselves.
DROP POLICY IF EXISTS "Users can update their own non-sensitive data" ON public.users;
CREATE POLICY "Users can update their own non-sensitive data"
ON public.users FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id 
    AND role = (SELECT role FROM public.users WHERE id = auth.uid())
);

-- 2c. Allow Super-Admins (or manual SQL) to update any role
DROP POLICY IF EXISTS "Super-Admins can manage any role" ON public.users;
CREATE POLICY "Super-Admins can manage any role"
ON public.users FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role = 'super-admin'
    )
);


-- 3. ACTIVATE YOUR ADMIN ACCOUNT
--------------------------------------------------------------------
-- ⚠️ IMPORTANT: I have updated this with your email from the error!
-- Paste this entire script back into Supabase and run it.

UPDATE public.users 
SET role = 'admin' 
WHERE email = 'oshituo@gmail.com'; 
