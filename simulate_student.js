const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './cbt-client/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing environment variables. Ensure cbt-client/.env exists.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function simulate() {
    console.log("🚀 Simulating student session preparation...");

    // 1. Mock filters (JAMB Mathematics)
    const filters = {
        subject_id: null, // We'll fetch one
        exam_id: null,
        limit: 20,
        randomize: true,
        question_type: 'objective'
    };

    try {
        // Fetch a subject ID first
        const { data: subjects, error: sError } = await supabase.from('subjects').select('id, subject_name').limit(1);
        if (sError) throw sError;
        if (!subjects.length) {
            console.log("No subjects found. Please seed the database.");
            return;
        }
        filters.subject_id = subjects[0].id;
        console.log(`Using Subject: ${subjects[0].subject_name} (${filters.subject_id})`);

        // 2. Call the RPC (get_random_question_ids)
        console.log("Calling RPC: get_random_question_ids...");
        const { data: randomIds, error: idError } = await supabase.rpc('get_random_question_ids', {
            p_subject_id: filters.subject_id || null,
            p_exam_id: filters.exam_id || null,
            p_exam_type: filters.exam_type || null,
            p_topic: filters.topic || null,
            p_question_type: filters.question_type || 'objective',
            p_limit: filters.limit || 20,
            p_exclude_ids: []
        });

        if (idError) {
            console.error("❌ RPC Error:", idError);
        } else {
            console.log(`✅ RPC Success: Found ${randomIds.length} random IDs.`);
        }

        // 3. Perform the main query with joins
        console.log("Performing main query with joins...");
        let selectFields = `
            *,
            subjects (subject_name),
            question_answers (*)
        `;
        // In practice dashboard, it doesn't include explanations by default sometimes, 
        // but let's test with them as they are often included.
        selectFields += `, question_explanations (explanation)`;
        selectFields += `, question_groups (*)`;

        const query = supabase
            .from('questions')
            .select(selectFields)
            .eq('is_active', true)
            .in('id', randomIds ? randomIds.map(r => typeof r === 'object' ? r.id : r) : []);

        const { data, error } = await query;

        if (error) {
            console.error("❌ Main Query Error:", error);
            if (error.code === 'PGRST200') {
                console.error("Hint: PGRST200 usually means a relationship is not found. Check 'question_answers' join.");
            }
        } else {
            console.log(`✅ Main Query Success: Fetched ${data.length} questions.`);
            if (data.length > 0) {
                console.log("Sample Question:", data[0].question_text.substring(0, 50) + "...");
                console.log("Joined question_answers:", data[0].question_answers ? "Present" : "Missing");
            }
        }

    } catch (err) {
        console.error("💥 Fatal Error:", err);
    }
}

simulate();
