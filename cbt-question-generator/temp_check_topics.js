require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    let allData = [];
    const batchSize = 1000;
    let start = 0;
    
    console.log("Fetching questions in batches using range...");
    
    while (true) {
        const { data, error } = await supabase
            .from('questions')
            .select('exam_type, subject, topic')
            .range(start, start + batchSize - 1);
            
        if (error) {
            console.error(error);
            break;
        }
        if (!data || data.length === 0) break;
        
        allData = allData.concat(data);
        start += batchSize;
        process.stdout.write(`\rFetched ${allData.length} questions...`);
        if (data.length < batchSize) break;
    }
    
    console.log("\nTotal fetched:", allData.length);
    
    const counts = {};
    allData.forEach(q => {
        const key = `${q.exam_type} | ${q.subject} | ${q.topic}`;
        counts[key] = (counts[key] || 0) + 1;
    });
    
    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
    console.log("Top 20 Topics by Question Count:");
    console.log(JSON.stringify(sorted.slice(0, 20), null, 2));
    console.log("\nTotal unique topic keys in DB:", sorted.length);
}
run();
