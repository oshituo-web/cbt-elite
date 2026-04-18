require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function repair() {
    console.log("🚀 Starting Surgical Database Repair...");

    // 1. Load Local Data
    console.log("Loading local questions.json...");
    const localQuestions = JSON.parse(fs.readFileSync('questions.json', 'utf8'));
    const localMap = new Map();
    localQuestions.forEach(q => {
        const text = (q.question || q.question_text || "").trim();
        if (text) localMap.set(text, q);
    });
    console.log(`Loaded ${localMap.size} unique local questions.`);

    // 2. Fetch all broken questions (missing answers)
    // We do this by checking which questions in DB don't have ANY entries in the answers table
    console.log("Identifying broken questions in database...");
    let offset = 0;
    const batchSize = 1000;
    let allBrokenIds = [];
    
    while (true) {
        const { data: batch, error } = await supabase
            .from('questions')
            .select('id, question_text, explanation')
            .range(offset, offset + batchSize - 1);

        if (error) {
            console.error("Error fetching questions:", error);
            break;
        }
        if (!batch || batch.length === 0) break;

        // For each batch, check answer counts in smaller chunks to avoid URI limits
        const answeredIds = new Set();
        const chunkSize = 100;
        for (let j = 0; j < batch.length; j += chunkSize) {
            const chunk = batch.slice(j, j + chunkSize);
            const { data: answerCounts, error: countErr } = await supabase
                .from('answers')
                .select('question_id')
                .in('question_id', chunk.map(q => q.id));

            if (countErr) {
                console.error("Error checking answers chunk:", countErr);
                continue;
            }
            answerCounts.forEach(a => answeredIds.add(a.question_id));
        }

        const brokenInBatch = batch.filter(q => !answeredIds.has(q.id) || !q.explanation);
        allBrokenIds.push(...brokenInBatch);

        offset += batch.length;
        console.log(`Scanned ${offset} questions... found ${allBrokenIds.length} potentially broken.`);
        if (batch.length < batchSize) break;
    }

    console.log(`\nFound ${allBrokenIds.length} questions needing repair.`);

    // 3. Repair in batches
    const repairBatchSize = 50;
    let repairedCount = 0;
    let skipCount = 0;

    for (let i = 0; i < allBrokenIds.length; i += repairBatchSize) {
        const chunk = allBrokenIds.slice(i, i + repairBatchSize);
        
        await Promise.all(chunk.map(async (dbQ) => {
            const localQ = localMap.get(dbQ.question_text.trim());
            
            if (!localQ) {
                skipCount++;
                return;
            }

            const optA = localQ.option_a || localQ.options?.A || localQ.options?.a;
            const optB = localQ.option_b || localQ.options?.B || localQ.options?.b;
            const optC = localQ.option_c || localQ.options?.C || localQ.options?.c;
            const optD = localQ.option_d || localQ.options?.D || localQ.options?.d;
            let correctOpt = localQ.correct_option || localQ.answer || 'A';
            correctOpt = correctOpt.trim().toUpperCase().charAt(0);

            if (!optA || !optB || !optC || !optD) {
                skipCount++;
                return;
            }

            // A. Update Explanation if missing
            if (!dbQ.explanation || dbQ.explanation !== localQ.explanation) {
                await supabase.from('questions')
                    .update({ explanation: localQ.explanation || "No explanation available." })
                    .eq('id', dbQ.id);
            }

            // B. Insert Answers (only if missing)
            const { data: existing } = await supabase.from('answers').select('id').eq('question_id', dbQ.id).limit(1);
            if (!existing || existing.length === 0) {
                const answerInserts = [
                    { question_id: dbQ.id, option_letter: 'A', option_text: optA, is_correct: correctOpt === 'A' },
                    { question_id: dbQ.id, option_letter: 'B', option_text: optB, is_correct: correctOpt === 'B' },
                    { question_id: dbQ.id, option_letter: 'C', option_text: optC, is_correct: correctOpt === 'C' },
                    { question_id: dbQ.id, option_letter: 'D', option_text: optD, is_correct: correctOpt === 'D' }
                ];
                const { error: insErr } = await supabase.from('answers').insert(answerInserts);
                if (insErr) {
                    console.error(`Error inserting answers for ${dbQ.id}:`, insErr.message);
                } else {
                    repairedCount++;
                }
            } else {
                // If answers exist but question was marked broken (e.g. missing explanation)
                repairedCount++;
            }
        }));

        process.stdout.write(`\rProgress: ${i + chunk.length}/${allBrokenIds.length} | Repaired: ${repairedCount} | Skipped: ${skipCount}`);
    }

    console.log(`\n\n✅ Repair Finished!`);
    console.log(`Repaired: ${repairedCount}`);
    console.log(`Skipped: ${skipCount} (Local data missing)`);
}

repair().catch(console.error);
