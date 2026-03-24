require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkDiff() {
    try {
        console.log("Loading local questions...");
        const localData = fs.readFileSync('questions.json', 'utf8');
        const localQuestions = JSON.parse(localData);
        console.log(`Total questions in local questions.json: ${localQuestions.length}`);

        console.log("Fetching DB questions...");
        const { data: dbData, error } = await supabase.from('questions').select('question_text');
        
        if (error) {
            console.error("DB Error:", error.message);
            return;
        }
        
        console.log(`Total questions in live Database: ${dbData.length}`);
        
        // Let's find exactly which ones are missing
        const dbSet = new Set(dbData.map(q => q.question_text.trim()));
        let missingFromDb = 0;
        
        localQuestions.forEach(lq => {
            const localText = (lq.question || lq.question_text || "").trim();
            if (!dbSet.has(localText)) {
                missingFromDb++;
            }
        });
        
        console.log(`\n=== Summary ===`);
        console.log(`Local questions NOT YET in the database: ${missingFromDb}`);
        
    } catch(e) {
        console.log(e);
    }
}

checkDiff();
