const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    let result = "Checking columns in 'questions' table...\n";
    const { data, error } = await supabase.from('questions').select('*').limit(1);
    if (data && data.length > 0) result += JSON.stringify(Object.keys(data[0]), null, 2) + "\n";

    result += "\nChecking columns in 'question_answers' table...\n";
    const { data: qans } = await supabase.from('question_answers').select('*').limit(1);
    if (qans && qans.length > 0) result += JSON.stringify(Object.keys(qans[0]), null, 2) + "\n";

    fs.writeFileSync('schema_check.txt', result);
    console.log("Done. Results in schema_check.txt");
}

checkSchema();
