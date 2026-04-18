require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTable() {
    const { data, error } = await supabase
        .from('question_reports')
        .select('*', { head: true, count: 'exact' });
    
    if (error) {
        console.error("❌ TABLE ERROR:", error.message);
        if (error.message.includes("does not exist")) {
            console.log("👉 CONFIRMED: The 'question_reports' table is missing from your database.");
        }
    } else {
        console.log("✅ TABLE EXISTS. Current report count:", data);
    }
}

checkTable();
