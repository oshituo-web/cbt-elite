require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function checkCoverage() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const syllabus = JSON.parse(fs.readFileSync('syllabus.json', 'utf8'));
    
    // 1. Get all questions grouped by exam_type, subject, topic
    const { data: questions, error } = await supabase.from('questions').select('exam_type, subject, topic');
    if (error) {
        console.error(error);
        return;
    }

    const coverageMap = {};
    questions.forEach(q => {
        const key = `${q.exam_type}|${q.subject}|${q.topic}`;
        coverageMap[key] = (coverageMap[key] || 0) + 1;
    });

    const report = [];
    Object.keys(syllabus).forEach(exam => {
        if (exam === 'NECO') return; // Skip NECO as per user request
        
        Object.keys(syllabus[exam]).forEach(subject => {
            syllabus[exam][subject].forEach(topic => {
                const key = `${exam}|${subject}|${topic}`;
                const count = coverageMap[key] || 0;
                if (count === 0) { // Strictly leave only topics WITHOUT questions
                    report.push({ exam, subject, topic, count });
                }
            });
        });
    });

    // Sort by count (ascending) to show empty topics first
    report.sort((a, b) => a.count - b.count);
    
    fs.writeFileSync('coverage_report.json', JSON.stringify(report, null, 2));
    console.log(`Research complete. Found ${report.length} topics with 0 questions. Report saved to coverage_report.json`);
}

checkCoverage().catch(console.error);
