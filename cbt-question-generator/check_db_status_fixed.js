require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkStatus() {
    try {
        console.log("📊 Fetching Database Status...");
        const { data, error } = await supabase.from('questions').select('subject');
        if (error) throw error;
        
        const counts = {};
        data.forEach(r => {
            counts[r.subject] = (counts[r.subject] || 0) + 1;
        });
        
        console.table(Object.entries(counts).map(([subject, count]) => ({ subject, count })));
        
        const { count: missingExp } = await supabase.from('questions').select('*', { count: 'exact', head: true }).is('explanation', null);
        console.log(`\n⚠️ Questions missing explanations in 'questions' table: ${missingExp}`);
        
        process.exit(0);
    } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }
}

checkStatus();
