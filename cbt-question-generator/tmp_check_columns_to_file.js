require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function checkColumnsToFile() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.from('questions').select('*').limit(1);
    if (error) {
        fs.writeFileSync('schema_check.txt', "Error: " + error.message);
    } else if (data && data.length > 0) {
        fs.writeFileSync('schema_check.txt', Object.keys(data[0]).sort().join(', '));
    } else {
        fs.writeFileSync('schema_check.txt', "No questions found.");
    }
}

checkColumnsToFile().catch(console.error);
