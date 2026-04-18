require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function checkRLSToFile() {
    const studentSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const tables = ['questions', 'answers', 'question_answers', 'question_groups', 'question_explanations', 'theory_details', 'syllabus_topics'];
    
    let results = "RLS Checks for Student (Anon Role):\n";
    for (const table of tables) {
        const { data, error } = await studentSupabase.from(table).select('*').limit(1);
        if (error) {
            results += `Table ${table}: ❌ FAILED - ${error.message} (Code: ${error.code})\n`;
        } else {
            results += `Table ${table}: ✅ OK (Rows: ${data ? data.length : 0})\n`;
        }
    }
    fs.writeFileSync('rls_check.txt', results);
}

checkRLSToFile().catch(console.error);
