require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkStatus() {
    console.log("📊 Polling Live Database Status...");
    
    // Count questions
    const { count: qCount, error: qErr } = await supabase.from('questions').select('*', { count: 'exact', head: true });
    // Count groups
    const { count: gCount, error: gErr } = await supabase.from('question_groups').select('*', { count: 'exact', head: true });

    if (qErr) console.error("Error fetching questions:", qErr.message);
    if (gErr) console.error("Error fetching groups:", gErr.message);

    console.log(`\n\x1b[32m✅ Total Questions Native to DB: ${qCount}\x1b[0m`);
    console.log(`\x1b[36m✅ Total Formatted Passages/Diagrams: ${gCount}\x1b[0m\n`);
    process.exit(0);
}

checkStatus();
