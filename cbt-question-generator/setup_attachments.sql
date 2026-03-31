-- 1. Extend the news schema to support attached files
ALTER TABLE public.news_updates 
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- 2. Create the Storage Bucket for PDF attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('news_attachments', 'news_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Secure the Storage Bucket using Row Level Security (RLS)
-- Allow anyone (public/students) to download the PDFs
DROP POLICY IF EXISTS "Public access to news attachments" ON storage.objects;
CREATE POLICY "Public access to news attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'news_attachments');

-- Allow ONLY verified Admins to upload new PDFs to the bucket
DROP POLICY IF EXISTS "Admin upload news attachments" ON storage.objects;
CREATE POLICY "Admin upload news attachments"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'news_attachments' 
    AND auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'super-admin'))
);

-- Allow Admins to update or overwrite PDFs
DROP POLICY IF EXISTS "Admin update news attachments" ON storage.objects;
CREATE POLICY "Admin update news attachments"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'news_attachments' 
    AND auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'super-admin'))
);

-- Allow Admins to delete PDFs
DROP POLICY IF EXISTS "Admin delete news attachments" ON storage.objects;
CREATE POLICY "Admin delete news attachments"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'news_attachments' 
    AND auth.uid() IN (SELECT id FROM public.users WHERE role IN ('admin', 'super-admin'))
);
