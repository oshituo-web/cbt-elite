-- Migration: Restrict Audit Log Access

-- 1. Restrict INSERT policy for admin_audit_logs
-- Only admins should be able to create audit logs (or the system via functions)
DROP POLICY IF EXISTS "Any authenticated user can insert logs" ON public.admin_audit_logs;

CREATE POLICY "Only admins can insert audit logs" 
ON public.admin_audit_logs FOR INSERT 
WITH CHECK (public.is_admin());

-- 2. Optional: If you need students to log certain errors/actions, 
-- create a dedicated security-definer function with rate limiting.
