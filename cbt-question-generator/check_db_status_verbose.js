require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkStatus() {
    try {
        let allData = [];
        let from = 0;
        let to = 999;
        let hasMore = true;

        console.log("Fetching all subject data in batches...");
        while (hasMore) {
            const { data, error } = await supabase.from('questions').select('subject').range(from, to);
            if (error) throw error;
            if (data.length === 0) {
                hasMore = false;
            } else {
                allData = allData.concat(data);
                from += 1000;
                to += 1000;
            }
        }

        const counts = {};
        allData.forEach(r => {
            const s = r.subject || 'NULL_SUBJECT';
            counts[s] = (counts[s] || 0) + 1;
        });
        
        console.log("Subject Counts:");
        Object.entries(counts).sort((a,b) => b[1] - a[1]).forEach(([s, c]) => {
            console.log(`${s}: ${c}`);
        });

        const { count: total } = await supabase.from('questions').select('*', { count: 'exact', head: true });
        console.log(`\nTotal questions: ${total}`);
        
        process.exit(0);
    } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }
}

checkStatus();
