require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function syncExplanations() {
    console.log("Searching for questions missing explanations that have them in question_answers...");
    
    // 1. Get all questions with null explanation (paginated)
    let allIds = [];
    let from = 0;
    let hasMore = true;
    while (hasMore) {
        const { data, error } = await supabase
            .from('questions')
            .select('id')
            .is('explanation', null)
            .range(from, from + 999);
        
        if (error) throw error;
        if (data.length === 0) {
            hasMore = false;
        } else {
            allIds = allIds.concat(data.map(d => d.id));
            from += 1000;
        }
    }
    
    console.log(`Found ${allIds.length} questions with NULL explanation.`);

    const ids = allIds;
    let updatedCount = 0;

    // 2. Batch process to check question_answers
    const batchSize = 100;
    for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        
        const { data: qas, error: qaErr } = await supabase
            .from('question_answers')
            .select('question_id, explanation')
            .in('question_id', batchIds)
            .not('explanation', 'is', null);
        
        if (qaErr) {
            console.error("QA Fetch Error:", qaErr.message);
            continue;
        }

        if (qas && qas.length > 0) {
            console.log(`Batch ${i/batchSize + 1}: Found ${qas.length} explanations to sync.`);
            for (const qa of qas) {
                const { error: upErr } = await supabase
                    .from('questions')
                    .update({ explanation: qa.explanation })
                    .eq('id', qa.question_id);
                
                if (!upErr) updatedCount++;
            }
        }
    }

    console.log(`\nSync complete. Total updated: ${updatedCount}`);
    process.exit(0);
}

syncExplanations();
