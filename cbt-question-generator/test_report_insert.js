require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testInsert() {
    // 1. Get a random question ID
    const { data: q } = await supabase.from('questions').select('id').limit(1).single();
    if (!q) { console.error("No questions found."); return; }

    // 2. Try to insert a report (using service role key which bypasses RLS)
    console.log(`Attempting test insert for question ${q.id}...`);
    const { data, error } = await supabase
        .from('question_reports')
        .insert({
            question_id: q.id,
            reason: 'Testing Script',
            details: 'This is a test from the backend',
            status: 'pending'
        })
        .select();

    if (error) {
        console.error("❌ INSERT FAILED:", error.message);
        console.error("CODE:", error.code);
    } else {
        console.log("✅ INSERT SUCCESSFUL:", data);
    }
}

testInsert();
