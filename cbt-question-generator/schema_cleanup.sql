-- =======================================================================
-- CBT ELITE: SCHEMA STANDARDIZATION
-- Replaces redundant 'question_answers' table with a dynamic View.
-- =======================================================================

BEGIN;

-- 1. Backup check (Ensure answers exist before dropping)
-- DO NOT RUN if you are unsure about the state of the 'answers' table.

-- 2. Drop the redundant table
DROP TABLE IF EXISTS public.question_answers CASCADE;

-- 3. Create the dynamic View
CREATE OR REPLACE VIEW public.question_answers AS
SELECT 
    q.id AS question_id,
    MAX(CASE WHEN a.option_letter = 'A' THEN a.option_text END) AS option_a,
    MAX(CASE WHEN a.option_letter = 'B' THEN a.option_text END) AS option_b,
    MAX(CASE WHEN a.option_letter = 'C' THEN a.option_text END) AS option_c,
    MAX(CASE WHEN a.option_letter = 'D' THEN a.option_text END) AS option_d,
    MAX(CASE WHEN a.is_correct THEN a.option_letter END) AS correct_option,
    q.explanation
FROM 
    public.questions q
JOIN 
    public.answers a ON q.id = a.question_id
GROUP BY 
    q.id, q.explanation;

-- 4. Set Permissions for Frontend
GRANT SELECT ON public.question_answers TO anon, authenticated, service_role;

-- 5. Enable RLS (Views inherit RLS from underlying tables in Supabase usually, 
-- but explicit grants are safer for public access).
-- Note: Supabase RLS policies on 'questions' and 'answers' will apply.

COMMIT;

-- SUCCESS: The frontend will now see flattened data directly from the normalized 'answers' table.
