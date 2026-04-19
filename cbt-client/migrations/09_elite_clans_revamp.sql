-- ELITE CLANS & SCHEDULED COMPETITION OVERHAUL
-- =======================================================================
-- 1. Extend User Profiles
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'General';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_clash_points BIGINT DEFAULT 0;

-- 2. League Groups Table (Clans)
CREATE TABLE IF NOT EXISTS public.league_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clan_name TEXT NOT NULL,
    department TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'Bronze',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Scheduled Clashes (Competitions)
CREATE TABLE IF NOT EXISTS public.scheduled_clashes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_date DATE NOT NULL,
    type TEXT NOT NULL, -- 'Normal' (Sat) or 'Super' (Sun)
    department TEXT,    -- For 'Normal' type
    questions_json JSONB NOT NULL,
    duration_minutes INT DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(week_date, type, department)
);

-- 4. JOIN_LEAGUE_GROUP RPC (Department / 20-member cap)
CREATE OR REPLACE FUNCTION join_league_group(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_tier TEXT;
    v_dept TEXT;
    v_group_id UUID;
    v_clan_name TEXT;
    v_names_pool TEXT[];
BEGIN
    SELECT tier, department INTO v_tier, v_dept FROM public.users WHERE id = p_user_id;
    
    -- Find a group in the same tier and department with < 20 members
    SELECT lg.id INTO v_group_id
    FROM public.league_groups lg
    LEFT JOIN public.users u ON u.current_league_group = lg.id
    WHERE lg.tier = v_tier AND lg.department = v_dept
    GROUP BY lg.id
    HAVING COUNT(u.id) < 20
    LIMIT 1;

    -- Create new group if none found
    IF v_group_id IS NULL THEN
        -- Generate name based on department
        CASE v_dept
            WHEN 'Science' THEN v_names_pool := ARRAY['Neutron Knights', 'Quantum Phantoms', 'Galactic Chemists', 'Orbital Oracles', 'Atomic Archers'];
            WHEN 'Arts' THEN v_names_pool := ARRAY['Renaissance Scribes', 'Poetic Archers', 'Sovereign Scribes', 'Dramatic Dynasts', 'Lyric Legends'];
            WHEN 'Commercial' THEN v_names_pool := ARRAY['Capital Kings', 'Market Monarchs', 'Fiscal Titans', 'Wealth Wizards', 'Trade Templars'];
            ELSE v_names_pool := ARRAY['Universal Scholars', 'Omni Elites', 'Polymath Pioneers', 'Knowledge Keepers', 'Wisdom Warriors'];
        END CASE;
        
        v_clan_name := v_names_pool[1 + floor(random() * array_length(v_names_pool, 1))::int];
        
        INSERT INTO public.league_groups (clan_name, department, tier)
        VALUES (v_clan_name, v_dept, v_tier)
        RETURNING id INTO v_group_id;
    END IF;

    UPDATE public.users SET current_league_group = v_group_id WHERE id = p_user_id;
    
    RETURN jsonb_build_object('group_id', v_group_id);
END;
$$ LANGUAGE plpgsql;

-- 5. GENERATE_WEEKLY_SEEDS (Admin)
CREATE OR REPLACE FUNCTION generate_weekly_clash_seeds()
RETURNS VOID AS $$
DECLARE
    v_week DATE := date_trunc('week', now())::date + INTERVAL '5 days'; -- Saturday
    v_science_q UUID[];
    v_arts_q UUID[];
    v_comm_q UUID[];
    v_super_q UUID[];
    v_eng_id UUID;
    v_math_id UUID;
    v_phys_id UUID;
    v_chem_id UUID;
    v_lit_id UUID;
    v_gov_id UUID;
    v_crs_id UUID;
    v_econ_id UUID;
    v_acc_id UUID;
BEGIN
    -- Get Subject IDs (using names from get_subjects output)
    SELECT id INTO v_eng_id FROM public.subjects WHERE subject_name = 'English';
    SELECT id INTO v_math_id FROM public.subjects WHERE subject_name = 'Mathematics';
    SELECT id INTO v_phys_id FROM public.subjects WHERE subject_name = 'Physics';
    SELECT id INTO v_chem_id FROM public.subjects WHERE subject_name = 'Chemistry';
    SELECT id INTO v_lit_id FROM public.subjects WHERE subject_name = 'Literature';
    SELECT id INTO v_gov_id FROM public.subjects WHERE subject_name = 'Government';
    SELECT id INTO v_crs_id FROM public.subjects WHERE subject_name = 'CRS';
    SELECT id INTO v_econ_id FROM public.subjects WHERE subject_name = 'Economics';
    SELECT id INTO v_acc_id FROM public.subjects WHERE subject_name = 'Financial Accounting';

    -- 1. Science Saturday Clash (15 Eng, 10 Math, 10 Phys, 10 Chem = 45)
    v_science_q := ARRAY(SELECT id FROM public.questions WHERE subject_id = v_eng_id AND is_active = true ORDER BY random() LIMIT 15) ||
                   ARRAY(SELECT id FROM public.questions WHERE subject_id = v_math_id AND is_active = true ORDER BY random() LIMIT 10) ||
                   ARRAY(SELECT id FROM public.questions WHERE subject_id = v_phys_id AND is_active = true ORDER BY random() LIMIT 10) ||
                   ARRAY(SELECT id FROM public.questions WHERE subject_id = v_chem_id AND is_active = true ORDER BY random() LIMIT 10);
    
    INSERT INTO scheduled_clashes (week_date, type, department, questions_json)
    VALUES (v_week, 'Normal', 'Science', to_jsonb(v_science_q))
    ON CONFLICT (week_date, type, department) DO UPDATE SET questions_json = EXCLUDED.questions_json;

    -- 2. Arts Saturday Clash (15 Eng, 10 Lit, 10 Gov, 10 CRS = 45)
    v_arts_q := ARRAY(SELECT id FROM public.questions WHERE subject_id = v_eng_id AND is_active = true ORDER BY random() LIMIT 15) ||
                ARRAY(SELECT id FROM public.questions WHERE subject_id = v_lit_id AND is_active = true ORDER BY random() LIMIT 10) ||
                ARRAY(SELECT id FROM public.questions WHERE subject_id = v_gov_id AND is_active = true ORDER BY random() LIMIT 10) ||
                ARRAY(SELECT id FROM public.questions WHERE subject_id = v_crs_id AND is_active = true ORDER BY random() LIMIT 10);
    
    INSERT INTO scheduled_clashes (week_date, type, department, questions_json)
    VALUES (v_week, 'Normal', 'Arts', to_jsonb(v_arts_q))
    ON CONFLICT (week_date, type, department) DO UPDATE SET questions_json = EXCLUDED.questions_json;

    -- 3. Commercial Saturday Clash (15 Eng, 10 Math, 10 Econ, 10 Acc = 45)
    v_comm_q := ARRAY(SELECT id FROM public.questions WHERE subject_id = v_eng_id AND is_active = true ORDER BY random() LIMIT 15) ||
                ARRAY(SELECT id FROM public.questions WHERE subject_id = v_math_id AND is_active = true ORDER BY random() LIMIT 10) ||
                ARRAY(SELECT id FROM public.questions WHERE subject_id = v_econ_id AND is_active = true ORDER BY random() LIMIT 10) ||
                ARRAY(SELECT id FROM public.questions WHERE subject_id = v_acc_id AND is_active = true ORDER BY random() LIMIT 10);
    
    INSERT INTO scheduled_clashes (week_date, type, department, questions_json)
    VALUES (v_week, 'Normal', 'Commercial', to_jsonb(v_comm_q))
    ON CONFLICT (week_date, type, department) DO UPDATE SET questions_json = EXCLUDED.questions_json;

    -- 4. Super League Sunday Clash (30 Eng, 20 Math = 50)
    v_super_q := ARRAY(SELECT id FROM public.questions WHERE subject_id = v_eng_id AND is_active = true ORDER BY random() LIMIT 30) ||
                 ARRAY(SELECT id FROM public.questions WHERE subject_id = v_math_id AND is_active = true ORDER BY random() LIMIT 20);
    
    INSERT INTO scheduled_clashes (week_date, type, department, questions_json)
    VALUES (v_week + 1, 'Super', 'General', to_jsonb(v_super_q))
    ON CONFLICT (week_date, type, department) DO UPDATE SET questions_json = EXCLUDED.questions_json;

END;
$$ LANGUAGE plpgsql;

-- Trigger logic for Sunday Promotions
CREATE OR REPLACE FUNCTION run_weekly_league_reset()
RETURNS VOID AS $$
BEGIN
    -- 1. Identify Super Elite candidates (Top 3 of every Normal group)
    -- This would typically be a more complex multi-step process for a production system
    -- but here we'll move them to 'Elite' (Super League) tier.
    
    UPDATE public.users u
    SET tier = 'Elite',
        current_league_group = NULL -- Will rejoin Super League group on next dashboard sync
    WHERE id IN (
        SELECT user_id FROM (
            SELECT user_id, rank() OVER (PARTITION BY current_league_group ORDER BY weekly_score DESC) as r
            FROM public.users
            WHERE tier != 'Elite'
        ) t WHERE r <= 3
    );

    -- 2. Reset weekly scores
    -- (Assuming weekly_score is a column derived from weekly_summaries or stored on users)
END;
$$ LANGUAGE plpgsql;
