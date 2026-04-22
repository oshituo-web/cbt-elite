-- Fix for: Toggle Failed - record "new" has no field "updated_at"
-- 
-- The system_config table has an ON UPDATE trigger expecting an 'updated_at' column, 
-- but the column wasn't originally defined in the schema.

ALTER TABLE public.system_config 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
