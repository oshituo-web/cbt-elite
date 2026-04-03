require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkRLS() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    console.log("Checking RLS policies for critical tables...");
    const { data, error } = await supabase.rpc('get_policies'); // This RPC might not exist, but let's try a direct query if possible
    
    // Since we usually can't query pg_policies easily via supabase-js without raw SQL,
    // we'll try to select as a student using the ANON key for each table.
    const studentSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const tables = ['questions', 'answers', 'question_answers', 'question_groups', 'question_explanations', 'theory_details', 'syllabus_topics'];
    
    for (const table of tables) {
        const { data, error } = await studentSupabase.from(table).select('*').limit(1);
        if (error) {
            console.error(`Table ${table}: ❌ STUDENT READ FAILED - ${error.message} (Code: ${error.code})`);
        } else {
            console.log(`Table ${table}: ✅ STUDENT READ OK (Rows found: ${data.length})`);
        }
    }
}

checkRLS().catch(console.error);
