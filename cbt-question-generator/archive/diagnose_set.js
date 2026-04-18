require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function diagnoseSet() {
    console.log("Fetching ALL existing questions (paginated)...");
    let existingQuestions = new Set();
    let hasMore = true;
    let offset = 0;
    while (hasMore) {
        const { data: page, error } = await supabase
            .from('questions')
            .select('question_text')
            .range(offset, offset + 999);
        
        if (error) {
            console.error("DB Error:", error.message);
            break;
        }
        if (page && page.length > 0) {
            page.forEach(q => existingQuestions.add(q.question_text));
            offset += page.length;
            if (page.length < 1000) hasMore = false;
        } else {
            hasMore = false;
        }
    }
    console.log(`Knowledge Base: ${existingQuestions.size} existing questions loaded.`);
    
    const questions = JSON.parse(fs.readFileSync('questions.json', 'utf8'));
    console.log(`Questions in JSON: ${questions.length}`);
    
    let rawMatch = 0;
    let trimmedMatch = 0;
    const trimmedDB = new Set([...existingQuestions].map(s => s.trim()));

    questions.forEach(q => {
        if (existingQuestions.has(q.question)) rawMatch++;
        if (trimmedDB.has(q.question.trim())) trimmedMatch++;
    });

    console.log(`Raw matches: ${rawMatch}`);
    console.log(`Trimmed matches: ${trimmedMatch}`);
}

diagnoseSet();
