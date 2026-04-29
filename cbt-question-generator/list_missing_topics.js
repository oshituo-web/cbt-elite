require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function listMissingTopics() {
    const supabase = createClient(process.env.SUPABASE_URL.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY.trim());
    const syllabus = JSON.parse(fs.readFileSync('syllabus.json', 'utf8'));

    console.log("Fetching existing questions to identify missing topics...");
    const { data: questions, error } = await supabase
        .from('questions')
        .select('exam_type, subject, topic');

    if (error) {
        console.error("Error:", error);
        return;
    }

    const existingMap = new Set(questions.map(q => `${q.exam_type}|${q.subject}|${q.topic}`));

    const missingTopics = [];
    ['WAEC', 'NECO'].forEach(exam => {
        Object.keys(syllabus[exam] || {}).forEach(subject => {
            syllabus[exam][subject].forEach(topic => {
                const key = `${exam}|${subject}|${topic}`;
                if (!existingMap.has(key)) {
                    missingTopics.push({ exam, subject, topic });
                }
            });
        });
    });

    fs.writeFileSync('missing_topics.json', JSON.stringify(missingTopics, null, 2));
    console.log(`Found ${missingTopics.length} missing topics. Saved to missing_topics.json`);
}

listMissingTopics().catch(console.error);
