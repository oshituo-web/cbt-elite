require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function syncQuestionAnswers() {
    console.log("🚀 Syncing 'question_answers' for frontend compatibility...");

    // 1. Fetch all active questions
    console.log("Fetching active questions from database...");
    let offset = 0;
    const batchSize = 1000;
    let allActiveIds = [];
    
    while (true) {
        const { data: batch, error } = await supabase
            .from('questions')
            .select('id, question_text, explanation')
            .eq('is_active', true)
            .range(offset, offset + batchSize - 1);

        if (error) {
            console.error("Error fetching questions:", error);
            break;
        }
        if (!batch || batch.length === 0) break;
        allActiveIds.push(...batch);
        offset += batch.length;
        process.stdout.write(`\rLoaded ${allActiveIds.length} active questions...`);
        if (batch.length < batchSize) break;
    }

    console.log(`\nFound ${allActiveIds.length} active questions. Checking for missing entries in 'question_answers'...`);

    // 2. Filter for those missing question_answers
    let missingQA = [];
    const checkBatchSize = 100;
    for (let i = 0; i < allActiveIds.length; i += checkBatchSize) {
        const chunk = allActiveIds.slice(i, i + checkBatchSize);
        const { data: existing, error } = await supabase
            .from('question_answers')
            .select('question_id')
            .in('question_id', chunk.map(q => q.id));

        if (error) {
            console.error("Error checking question_answers:", error);
            continue;
        }

        const existingSet = new Set(existing.map(e => e.question_id));
        const missing = chunk.filter(q => !existingSet.has(q.id));
        missingQA.push(...missing);
        process.stdout.write(`\rChecked ${i + chunk.length}/${allActiveIds.length} | Missing: ${missingQA.length}`);
    }

    console.log(`\n\nFound ${missingQA.length} questions missing from 'question_answers'. Syncing from 'answers' table...`);

    // 3. Populate missing entries from 'answers' table
    const syncBatchSize = 50;
    let syncedCount = 0;

    for (let i = 0; i < missingQA.length; i += syncBatchSize) {
        const chunk = missingQA.slice(i, i + syncBatchSize);
        
        const inserts = await Promise.all(chunk.map(async (q) => {
            const { data: answers, error } = await supabase
                .from('answers')
                .select('option_letter, option_text, is_correct')
                .eq('question_id', q.id);

            if (error || !answers || answers.length < 4) {
                return null;
            }

            const getOpt = (letter) => answers.find(a => a.option_letter === letter)?.option_text || "";
            const correctLetter = answers.find(a => a.is_correct)?.option_letter || "A";

            return {
                question_id: q.id,
                option_a: getOpt('A'),
                option_b: getOpt('B'),
                option_c: getOpt('C'),
                option_d: getOpt('D'),
                correct_option: correctLetter,
                explanation: q.explanation
            };
        }));

        const finalInserts = inserts.filter(Boolean);
        if (finalInserts.length > 0) {
            const { error: insErr } = await supabase.from('question_answers').insert(finalInserts);
            if (insErr) {
                console.error(`\nError inserting batch:`, insErr.message);
            } else {
                syncedCount += finalInserts.length;
            }
        }
        process.stdout.write(`\rProgress: ${i + chunk.length}/${missingQA.length} | Synced: ${syncedCount}`);
    }

    console.log(`\n\n✅ Frontend Sync Finished!`);
    console.log(`Synced ${syncedCount} questions to 'question_answers' table.`);
}

syncQuestionAnswers().catch(console.error);
