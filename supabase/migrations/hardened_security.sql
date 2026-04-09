/*
  =======================================================================
  CBT ELITE: PLATFORM HARDENING (RLS & RBAC)
  =======================================================================
  1. Restrict question/answer access to registered students only.
  2. Protect system configuration from non-admin updates.
  3. Ensure role-based access for all administrative operations.
*/

-- 1. QUESTIONS Table: Restrict to Authenticated
DROP POLICY IF EXISTS "Anyone can view questions" ON public.questions;
CREATE POLICY "Registered students can view active questions" 
ON public.questions FOR SELECT 
USING (auth.uid() IS NOT NULL AND is_active = true);

-- 2. ANSWERS Table: Restrict to Authenticated
DROP POLICY IF EXISTS "Anyone can view answers" ON public.answers;
CREATE POLICY "Registered students can view answers" 
ON public.answers FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 3. SYSTEM_CONFIG Table: Restricted Management
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view for config" ON public.system_config;
CREATE POLICY "All users can view configuration" 
ON public.system_config FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Admin manage config" ON public.system_config;
CREATE POLICY "Admins can manage configuration" 
ON public.system_config FOR ALL 
USING (public.is_admin());

-- 4. Ensure Super-Admin can see everything (Recursive Check Protection)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.users;
CREATE POLICY "Admins can view all profiles" 
ON public.users FOR SELECT 
USING (public.is_admin());

-- 5. Audit Log Security
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can view audit logs" 
ON public.admin_audit_logs FOR SELECT 
USING (public.is_admin());

DROP POLICY IF EXISTS "System can insert logs" ON public.admin_audit_logs;
CREATE POLICY "Any authenticated user can insert logs" 
ON public.admin_audit_logs FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);
