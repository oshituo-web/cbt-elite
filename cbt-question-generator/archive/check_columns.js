require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkColumns() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase.from('questions').select('*').limit(1);
    if (error) {
        console.error("Error:", error.message);
    } else if (data && data.length > 0) {
        console.log("Columns:", Object.keys(data[0]).sort().join(', '));
    } else {
        console.log("No questions found.");
    }
}

checkColumns().catch(console.error);
