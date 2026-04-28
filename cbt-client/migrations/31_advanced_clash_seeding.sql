-- =======================================================================
-- MIGRATION: 31_advanced_clash_seeding
-- DESCRIPTION: Improves the clash seed generator with smarter date logic,
--              case-insensitive subject matching, and Engineering department support.
-- =======================================================================

-- 1. Remove the old function with the different return type
DROP FUNCTION IF EXISTS generate_weekly_clash_seeds();

-- 2. Create the improved version
CREATE OR REPLACE FUNCTION generate_weekly_clash_seeds()
RETURNS JSONB AS $$
DECLARE
    -- Logic: If called on Sunday, targets NEXT Saturday. Otherwise targets THIS Saturday.
    v_saturday DATE := date_trunc('week', now() + INTERVAL '1 day')::date + INTERVAL '5 days';
    v_sunday DATE := v_saturday + INTERVAL '1 day';
    v_eng_id UUID; v_math_id UUID; v_phys_id UUID; v_chem_id UUID;
    v_bio_id UUID; v_lit_id UUID; v_gov_id UUID; v_crs_id UUID;
    v_econ_id UUID; v_acc_id UUID;
    v_science_q UUID[]; v_arts_q UUID[]; v_comm_q UUID[]; v_eng_dep_q UUID[]; v_super_q UUID[];
BEGIN
    -- Get Subject IDs (case-insensitive lookup)
    SELECT id INTO v_eng_id FROM public.subjects WHERE lower(subject_name) IN ('english', 'use of english') LIMIT 1;
    SELECT id INTO v_math_id FROM public.subjects WHERE lower(subject_name) = 'mathematics' LIMIT 1;
    SELECT id INTO v_phys_id FROM public.subjects WHERE lower(subject_name) = 'physics' LIMIT 1;
    SELECT id INTO v_chem_id FROM public.subjects WHERE lower(subject_name) = 'chemistry' LIMIT 1;
    SELECT id INTO v_bio_id FROM public.subjects WHERE lower(subject_name) = 'biology' LIMIT 1;
    SELECT id INTO v_lit_id FROM public.subjects WHERE lower(subject_name) LIKE '%literature%' LIMIT 1;
    SELECT id INTO v_gov_id FROM public.subjects WHERE lower(subject_name) = 'government' LIMIT 1;
    SELECT id INTO v_crs_id FROM public.subjects WHERE lower(subject_name) IN ('crs', 'christian religious studies') LIMIT 1;
    SELECT id INTO v_econ_id FROM public.subjects WHERE lower(subject_name) = 'economics' LIMIT 1;
    SELECT id INTO v_acc_id FROM public.subjects WHERE lower(subject_name) IN ('financial accounting', 'accounting') LIMIT 1;

    -- 1. Science Saturday
    v_science_q := COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_eng_id AND is_active = true ORDER BY random() LIMIT 15), '{}') ||
                   COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_math_id AND is_active = true ORDER BY random() LIMIT 10), '{}') ||
                   COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_phys_id AND is_active = true ORDER BY random() LIMIT 10), '{}') ||
                   COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_chem_id AND is_active = true ORDER BY random() LIMIT 10), '{}');
    
    INSERT INTO public.scheduled_clashes (week_date, type, department, questions_json)
    VALUES (v_saturday, 'Normal', 'Science', to_jsonb(v_science_q))
    ON CONFLICT (week_date, type, department) DO UPDATE SET questions_json = EXCLUDED.questions_json;

    -- 2. Arts Saturday
    v_arts_q := COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_eng_id AND is_active = true ORDER BY random() LIMIT 15), '{}') ||
                COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_lit_id AND is_active = true ORDER BY random() LIMIT 10), '{}') ||
                COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_gov_id AND is_active = true ORDER BY random() LIMIT 10), '{}') ||
                COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_crs_id AND is_active = true ORDER BY random() LIMIT 10), '{}');
    
    INSERT INTO public.scheduled_clashes (week_date, type, department, questions_json)
    VALUES (v_saturday, 'Normal', 'Arts', to_jsonb(v_arts_q))
    ON CONFLICT (week_date, type, department) DO UPDATE SET questions_json = EXCLUDED.questions_json;

    -- 3. Commercial Saturday
    v_comm_q := COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_eng_id AND is_active = true ORDER BY random() LIMIT 15), '{}') ||
                COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_math_id AND is_active = true ORDER BY random() LIMIT 10), '{}') ||
                COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_econ_id AND is_active = true ORDER BY random() LIMIT 10), '{}') ||
                COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_acc_id AND is_active = true ORDER BY random() LIMIT 10), '{}');
    
    INSERT INTO public.scheduled_clashes (week_date, type, department, questions_json)
    VALUES (v_saturday, 'Normal', 'Commercial', to_jsonb(v_comm_q))
    ON CONFLICT (week_date, type, department) DO UPDATE SET questions_json = EXCLUDED.questions_json;

    -- 4. Engineering Saturday
    v_eng_dep_q := COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_eng_id AND is_active = true ORDER BY random() LIMIT 15), '{}') ||
                   COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_math_id AND is_active = true ORDER BY random() LIMIT 15), '{}') ||
                   COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_phys_id AND is_active = true ORDER BY random() LIMIT 15), '{}');

    INSERT INTO public.scheduled_clashes (week_date, type, department, questions_json)
    VALUES (v_saturday, 'Normal', 'Engineering', to_jsonb(v_eng_dep_q))
    ON CONFLICT (week_date, type, department) DO UPDATE SET questions_json = EXCLUDED.questions_json;

    -- 5. Super League Sunday (General)
    v_super_q := COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_eng_id AND is_active = true ORDER BY random() LIMIT 30), '{}') ||
                 COALESCE(ARRAY(SELECT id FROM public.questions WHERE subject_id = v_math_id AND is_active = true ORDER BY random() LIMIT 20), '{}');

    INSERT INTO public.scheduled_clashes (week_date, type, department, questions_json)
    VALUES (v_sunday, 'Super', 'General', to_jsonb(v_super_q))
    ON CONFLICT (week_date, type, department) DO UPDATE SET questions_json = EXCLUDED.questions_json;

    RETURN jsonb_build_object(
        'status', 'success',
        'saturday_target', v_saturday,
        'sunday_target', v_sunday,
        'departments', ARRAY['Science', 'Arts', 'Commercial', 'Engineering', 'General']
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
