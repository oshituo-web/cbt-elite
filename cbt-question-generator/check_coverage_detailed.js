require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function getDetailedCoverage() {
    const supabase = createClient(process.env.SUPABASE_URL.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY.trim());
    const syllabus = JSON.parse(fs.readFileSync('syllabus.json', 'utf8'));
    
    console.log("Fetching question counts from database...");
    
    let allQuestions = [];
    let start = 0;
    const batchSize = 1000;
    
    while (true) {
        const { data: questions, error } = await supabase
            .from('questions')
            .select('exam_type, subject, topic')
            .range(start, start + batchSize - 1);
            
        if (error) {
            console.error("Error fetching questions:", error.message);
            return;
        }
        if (!questions || questions.length === 0) break;
        
        allQuestions = allQuestions.concat(questions);
        start += batchSize;
        process.stdout.write(`\rFetched ${allQuestions.length} questions...`);
        if (questions.length < batchSize) break;
    }

    const coverageMap = {};
    allQuestions.forEach(q => {
        const key = `${q.exam_type}|${q.subject}|${q.topic}`;
        coverageMap[key] = (coverageMap[key] || 0) + 1;
    });

    let emptyCount = 0;
    let lessThan10Count = 0;
    let adequateCount = 0;
    let totalTopics = 0;

    const breakdown = {};

    Object.keys(syllabus).forEach(exam => {
        if (!breakdown[exam]) breakdown[exam] = { empty: 0, lessThan10: 0, adequate: 0, total: 0 };
        
        Object.keys(syllabus[exam]).forEach(subject => {
            syllabus[exam][subject].forEach(topic => {
                totalTopics++;
                breakdown[exam].total++;
                
                const key = `${exam}|${subject}|${topic}`;
                const count = coverageMap[key] || 0;
                
                if (count === 0) {
                    emptyCount++;
                    breakdown[exam].empty++;
                } else if (count < 10) {
                    lessThan10Count++;
                    breakdown[exam].lessThan10++;
                } else {
                    adequateCount++;
                    breakdown[exam].adequate++;
                }
            });
        });
    });

    console.log("\n\n--- Coverage Summary ---");
    console.log(`Total Topics in Syllabus: ${totalTopics}`);
    console.log(`- Empty Topics (0 questions): ${emptyCount}`);
    console.log(`- Low Coverage Topics (1-9 questions): ${lessThan10Count}`);
    console.log(`- Adequate Coverage Topics (10+ questions): ${adequateCount}`);
    
    console.log("\n--- Breakdown by Exam ---");
    Object.entries(breakdown).forEach(([exam, stats]) => {
        console.log(`${exam}:`);
        console.log(`  Total topics: ${stats.total}`);
        console.log(`  Empty: ${stats.empty}`);
        console.log(`  Low (<10): ${stats.lessThan10}`);
        console.log(`  Adequate (10+): ${stats.adequate}`);
    });
}

getDetailedCoverage().catch(console.error);
