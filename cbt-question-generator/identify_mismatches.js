require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function identifyMismatches() {
    const syllabus = JSON.parse(fs.readFileSync('syllabus.json', 'utf8'));
    
    // Flatten syllabus for easier lookup: exam|subject|topic
    const validTopics = new Set();
    Object.keys(syllabus).forEach(exam => {
        Object.keys(syllabus[exam]).forEach(subject => {
            syllabus[exam][subject].forEach(topic => {
                validTopics.add(`${exam}|${subject}|${topic}`);
            });
        });
    });

    // Fetch all unique topics currently in DB
    let allData = [];
    let start = 0;
    const batchSize = 1000;
    
    console.log("Fetching unique topics from DB...");
    while (true) {
        const { data, error } = await supabase
            .from('questions')
            .select('exam_type, subject, topic')
            .range(start, start + batchSize - 1);
        if (error) { console.error(error); break; }
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        start += batchSize;
        if (data.length < batchSize) break;
    }

    const dbTopics = new Set();
    allData.forEach(q => {
        dbTopics.add(`${q.exam_type}|${q.subject}|${q.topic}`);
    });

    const mismatches = [];
    dbTopics.forEach(dbKey => {
        if (!validTopics.has(dbKey)) {
            mismatches.push(dbKey);
        }
    });

    console.log("Found", mismatches.length, "potential topic mismatches:");
    fs.writeFileSync('mismatches.json', JSON.stringify(mismatches.sort(), null, 2));
    console.log("Saved to mismatches.json");
}
identifyMismatches();
