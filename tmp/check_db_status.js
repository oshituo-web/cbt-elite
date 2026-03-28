require('dotenv').config({ path: 'c:/Users/Precious/CBT app/cbt-question-generator/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkStatus() {
    console.log("📊 Polling Live Database Status...");
    
    const { count: qCount, error: qErr } = await supabase.from('questions').select('*', { count: 'exact', head: true });
    const { count: gCount, error: gErr } = await supabase.from('question_groups').select('*', { count: 'exact', head: true });

    if (qErr) console.error("Error fetching questions:", qErr.message);
    if (gErr) console.error("Error fetching groups:", gErr.message);

    console.log(`\x1b[32m✅ Questions in DB: ${qCount}\x1b[0m`);
    console.log(`\x1b[36m✅ Passages/Data Sets in DB: ${gCount}\x1b[0m`);
    process.exit(0);
}

checkStatus();
