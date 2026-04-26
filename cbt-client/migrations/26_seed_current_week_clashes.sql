-- =======================================================================
-- MIGRATION: 26_seed_current_week_clashes
-- DESCRIPTION: Immediately seeds clashes for the current week AND next week.
-- Run this manually whenever a week's clashes are missing.
-- =======================================================================

-- First, ensure the generate_weekly_clash_seeds function targets the RIGHT dates.
-- This version uses CURRENT_DATE (WAT-aligned) and handles both Sat and Sun.

CREATE OR REPLACE FUNCTION generate_weekly_clash_seeds()
RETURNS VOID AS $$
DECLARE
    -- Always target this week's Saturday (ISO week: Mon=1, Sat=6)
    v_saturday DATE := date_trunc('week', CURRENT_DATE)::date + INTERVAL '5 days';
    v_sunday DATE := v_saturday + INTERVAL '1 day';
    v_eng_id UUID;
    v_math_id UUID;
    v_phys_id UUID;
    v_chem_id UUID;
    v_bio_id UUID;
    v_lit_id UUID;
    v_gov_id UUID;
    v_crs_id UUID;
    v_econ_id UUID;
    v_acc_id UUID;
    v_science_q UUID[];
    v_arts_q UUID[];
    v_comm_q UUID[];
    v_eng_dep_q UUID[];
    v_super_q UUID[];
BEGIN
    -- Get Subject IDs (case-insensitive lookup)
    SELECT id INTO v_eng_id FROM public.subjects WHERE lower(subject_name) = 'english' LIMIT 1;
    SELECT id INTO v_math_id FROM public.subjects WHERE lower(subject_name) = 'mathematics' LIMIT 1;
    SELECT id INTO v_phys_id FROM public.subjects WHERE lower(subject_name) = 'physics' LIMIT 1;
    SELECT id INTO v_chem_id FROM public.subjects WHERE lower(subject_name) = 'chemistry' LIMIT 1;
    SELECT id INTO v_bio_id FROM public.subjects WHERE lower(subject_name) = 'biology' LIMIT 1;
    SELECT id INTO v_lit_id FROM public.subjects WHERE lower(subject_name) LIKE '%literature%' LIMIT 1;
    SELECT id INTO v_gov_id FROM public.subjects WHERE lower(subject_name) = 'government' LIMIT 1;
    SELECT id INTO v_crs_id FROM public.subjects WHERE lower(subject_name) IN ('crs', 'christian religious studies') LIMIT 1;
    SELECT id INTO v_econ_id FROM public.subjects WHERE lower(subject_name) = 'economics' LIMIT 1;
    SELECT id INTO v_acc_id FROM public.subjects WHERE lower(subject_name) IN ('financial accounting', 'accounting') LIMIT 1;

    -- Science Saturday
    IF v_eng_id IS NOT NULL AND v_math_id IS NOT NULL THEN
        v_science_q := 
            ARRAY(SELECT id FROM public.questions WHERE subject_id = v_eng_id AND is_active = true ORDER BY random() LIMIT 15) ||
            ARRAY(SELECT id FROM public.questions WHERE subject_id = v_math_id AND is_active = true ORDER BY random() LIMIT 10) ||
            COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_phys_id AND is_active = true ORDER BY random() LIMIT 10), '{}') ||
            COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_chem_id AND is_active = true ORDER BY random() LIMIT 10), '{}');

        INSERT INTO scheduled_clashes (week_date, type, department, questions_json)
        VALUES (v_saturday, 'Normal', 'Science', to_jsonb(v_science_q))
        ON CONFLICT (week_date, type, department) DO UPDATE SET questions_json = EXCLUDED.questions_json;
    END IF;

    -- Arts Saturday
    IF v_eng_id IS NOT NULL THEN
        v_arts_q := 
            ARRAY(SELECT id FROM public.questions WHERE subject_id = v_eng_id AND is_active = true ORDER BY random() LIMIT 15) ||
            COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_lit_id AND is_active = true ORDER BY random() LIMIT 10), '{}') ||
            COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_gov_id AND is_active = true ORDER BY random() LIMIT 10), '{}') ||
            COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_crs_id AND is_active = true ORDER BY random() LIMIT 10), '{}');

        INSERT INTO scheduled_clashes (week_date, type, department, questions_json)
        VALUES (v_saturday, 'Normal', 'Arts', to_jsonb(v_arts_q))
        ON CONFLICT (week_date, type, department) DO UPDATE SET questions_json = EXCLUDED.questions_json;
    END IF;

    -- Commercial Saturday
    IF v_eng_id IS NOT NULL AND v_math_id IS NOT NULL THEN
        v_comm_q := 
            ARRAY(SELECT id FROM public.questions WHERE subject_id = v_eng_id AND is_active = true ORDER BY random() LIMIT 15) ||
            ARRAY(SELECT id FROM public.questions WHERE subject_id = v_math_id AND is_active = true ORDER BY random() LIMIT 10) ||
            COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_econ_id AND is_active = true ORDER BY random() LIMIT 10), '{}') ||
            COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_acc_id AND is_active = true ORDER BY random() LIMIT 10), '{}');

        INSERT INTO scheduled_clashes (week_date, type, department, questions_json)
        VALUES (v_saturday, 'Normal', 'Commercial', to_jsonb(v_comm_q))
        ON CONFLICT (week_date, type, department) DO UPDATE SET questions_json = EXCLUDED.questions_json;
    END IF;

    -- Engineering Saturday (for Engineering/Technology departments)
    IF v_eng_id IS NOT NULL AND v_math_id IS NOT NULL THEN
        v_eng_dep_q := 
            ARRAY(SELECT id FROM public.questions WHERE subject_id = v_eng_id AND is_active = true ORDER BY random() LIMIT 15) ||
            ARRAY(SELECT id FROM public.questions WHERE subject_id = v_math_id AND is_active = true ORDER BY random() LIMIT 15) ||
            COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_phys_id AND is_active = true ORDER BY random() LIMIT 15), '{}');

        INSERT INTO scheduled_clashes (week_date, type, department, questions_json)
        VALUES (v_saturday, 'Normal', 'Engineering', to_jsonb(v_eng_dep_q))
        ON CONFLICT (week_date, type, department) DO UPDATE SET questions_json = EXCLUDED.questions_json;
    END IF;

    -- Super League Sunday (General - all departments)
    IF v_eng_id IS NOT NULL AND v_math_id IS NOT NULL THEN
        v_super_q := 
            ARRAY(SELECT id FROM public.questions WHERE subject_id = v_eng_id AND is_active = true ORDER BY random() LIMIT 30) ||
            ARRAY(SELECT id FROM public.questions WHERE subject_id = v_math_id AND is_active = true ORDER BY random() LIMIT 20);

        INSERT INTO scheduled_clashes (week_date, type, department, questions_json)
        VALUES (v_sunday, 'Super', 'General', to_jsonb(v_super_q))
        ON CONFLICT (week_date, type, department) DO UPDATE SET questions_json = EXCLUDED.questions_json;
    END IF;

    RAISE NOTICE 'Clash seeds generated for Saturday: % and Sunday: %', v_saturday, v_sunday;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run immediately to seed this week's clashes
SELECT generate_weekly_clash_seeds();

-- Verify results
SELECT week_date, type, department, jsonb_array_length(questions_json) AS question_count 
FROM scheduled_clashes 
ORDER BY week_date DESC 
LIMIT 10;
