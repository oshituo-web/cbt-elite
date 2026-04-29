require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY.trim());

async function getYesterdayReport() {
    const yesterdayStart = '2026-04-25T00:00:00Z';
    const yesterdayEnd = '2026-04-26T00:00:00Z';
    console.log(`Generating report for 2026-04-25...`);

    const { data, error } = await supabase
        .from('questions')
        .select('subject')
        .gte('created_at', yesterdayStart)
        .lt('created_at', yesterdayEnd);

    if (error) {
        console.error("Error fetching data:", error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No questions generated yesterday.");
        return;
    }

    const subjectCounts = {};
    data.forEach(q => {
        const sub = q.subject || 'Unknown';
        subjectCounts[sub] = (subjectCounts[sub] || 0) + 1;
    });

    console.log(`Total questions generated: ${data.length}`);
    console.log("Breakdown by subject:");
    Object.entries(subjectCounts).sort((a, b) => b[1] - a[1]).forEach(([subject, count]) => {
        console.log(`- ${subject}: ${count}`);
    });
}

getYesterdayReport();
