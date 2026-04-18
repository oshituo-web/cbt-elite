const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    console.log("Checking columns in 'questions' table...");
    
    // We can't directly query table schema easily without RPC or psql, 
    // but we can try to select one row and see the keys.
    const { data, error } = await supabase.from('questions').select('*').limit(1);
    
    if (error) {
        console.error("Error fetching question:", error.message);
        return;
    }
    
    if (data && data.length > 0) {
        console.log("Available columns in 'questions':", Object.keys(data[0]));
    } else {
        console.log("No questions found to check columns.");
    }

    console.log("\nChecking columns in 'question_answers' table...");
    const { data: qans, error: qerr } = await supabase.from('question_answers').select('*').limit(1);
    if (qans && qans.length > 0) {
        console.log("Available columns in 'question_answers':", Object.keys(qans[0]));
    }
}

checkSchema();
