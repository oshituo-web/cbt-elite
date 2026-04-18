require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function syncRepairs() {
    console.log("Loading questions.json...");
    const masterQuestions = JSON.parse(fs.readFileSync('questions.json', 'utf8'));
    const qMap = new Map();
    masterQuestions.forEach(q => {
        if (q.option_a || q.correct_option) {
            qMap.set(q.question || q.question_text, q);
        }
    });

    console.log(`Knowledge Base: ${qMap.size} complete questions ready for sync.`);

    console.log("Fetching questions from DB missing answers...");
    let offset = 0;
    let totalUpdated = 0;
    let hasMore = true;
    let retryCount = 0;

    while (hasMore && retryCount < 10) {
        // Fetch objective questions in smaller batches to avoid URI limits
        const batchSize = 200;
        const { data: dbQuestions, error } = await supabase
            .from('questions')
            .select('id, question_text')
            .eq('question_type', 'objective')
            .range(offset, offset + batchSize - 1);

        if (error) {
            console.error("Fetch Error:", error.message);
            retryCount++;
            continue;
        }
        if (!dbQuestions || dbQuestions.length === 0) {
            hasMore = false;
            break;
        }

        console.log(`Checking batch ${offset / 1000 + 1} (${dbQuestions.length} rows)...`);
        
        // Check which ones are missing answers
        const { data: existingAnswers, error: ansErr } = await supabase
            .from('question_answers')
            .select('question_id')
            .in('question_id', dbQuestions.map(dq => dq.id));
        
        if (ansErr) {
            console.error("Error fetching answers:", ansErr.message);
            continue;
        }

        const answeredIds = new Set((existingAnswers || []).map(a => a.question_id));
        const missingBatch = dbQuestions.filter(dq => !answeredIds.has(dq.id));

        if (missingBatch.length > 0) {
            console.log(`Found ${missingBatch.length} questions in this batch needing options.`);
            
            const answerInserts = [];
            for (const dq of missingBatch) {
                const local = qMap.get(dq.question_text);
                if (local) {
                    answerInserts.push({
                        question_id: dq.id,
                        option_a: local.option_a || local.options?.A,
                        option_b: local.option_b || local.options?.B,
                        option_c: local.option_c || local.options?.C,
                        option_d: local.option_d || local.options?.D,
                        correct_option: local.correct_option || local.correct_answer,
                        explanation: local.explanation
                    });
                }
            }

            if (answerInserts.length > 0) {
                const { error: insErr } = await supabase
                    .from('question_answers')
                    .upsert(answerInserts, { onConflict: 'question_id' });
                
                if (insErr) {
                    console.error("Error syncing answers:", insErr.message);
                } else {
                    totalUpdated += answerInserts.length;
                    console.log(`Updated ${answerInserts.length} questions with complete options.`);
                }
            }
        }

        offset += dbQuestions.length;
        if (dbQuestions.length < batchSize) hasMore = false;
    }

    console.log(`\nSync Completed! Total questions restored in database: ${totalUpdated}`);
}

syncRepairs().catch(console.error);
