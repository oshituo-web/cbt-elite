require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkStatus() {
    console.log("📊 Fetching Comprehensive Database Status...");
    
    // 1. Total Counts
    const { count: qCount } = await supabase.from('questions').select('*', { count: 'exact', head: true });
    
    // 2. Questions per Subject
    const { data: subjectStats, error: sErr } = await supabase.rpc('get_subject_counts');
    
    if (sErr) {
        // Fallback if RPC doesn't exist
        const { data: rawData } = await supabase.from('questions').select('subject');
        const counts = {};
        rawData.forEach(r => counts[r.subject] = (counts[r.subject] || 0) + 1);
        console.table(Object.entries(counts).map(([subject, count]) => ({ subject, count })));
    } else {
        console.table(subjectStats);
    }

    // 3. Check for specific issues
    const { count: missingAnswer } = await supabase.from('questions').select('*', { count: 'exact', head: true }).is('explanation', null);
    console.log(`\x1b[31m⚠️ Questions missing explanations: ${missingAnswer}\x1b[0m`);

    process.exit(0);
}

checkStatus();
