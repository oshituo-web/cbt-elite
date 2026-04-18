require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkSchema() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    console.log("Checking tables existence...");
    const tables = ['questions', 'answers', 'question_answers', 'question_groups', 'question_explanations', 'theory_details'];
    
    for (const table of tables) {
        const { error } = await supabase.from(table).select('*').limit(0);
        if (error) {
            console.error(`Table ${table}: ❌ Error - ${error.message}`);
        } else {
            console.log(`Table ${table}: ✅ OK`);
        }
    }

    console.log("\nChecking 'questions' columns...");
    // We can't easily query information_schema via standard supabase-js without an RPC or raw PG
    // But we can try to select one row and see the keys
    const { data, error } = await supabase.from('questions').select('*').limit(1);
    if (error) {
        console.error("Error fetching questions:", error.message);
    } else if (data && data.length > 0) {
        console.log("Columns in 'questions':", Object.keys(data[0]).join(', '));
    } else {
        console.log("No questions found to check columns.");
    }
}

checkSchema().catch(console.error);
