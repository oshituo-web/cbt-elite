require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function backfillFromLegacy() {
    console.log("🚀 Starting Explanation Backfill from 'question_answers'...");

    let totalSynced = 0;
    let offset = 0;
    const batchSize = 500;
    let hasMore = true;

    while (hasMore) {
        console.log(`Fetching batch: ${offset} - ${offset + batchSize}...`);
        
        const { data: qas, error: fetchErr } = await supabase
            .from('question_answers')
            .select('question_id, explanation')
            .not('explanation', 'is', null)
            .range(offset, offset + batchSize - 1);

        if (fetchErr) {
            console.error("Fetch Error:", fetchErr.message);
            break;
        }

        if (!qas || qas.length === 0) {
            hasMore = false;
            break;
        }

        // We only want to update if the question table explanation is actually null
        // To be safe and efficient, we'll fetch the target records to see which ones NEED the update
        const qIds = qas.map(qa => qa.question_id);
        const { data: targets } = await supabase
            .from('questions')
            .select('id')
            .in('id', qIds)
            .is('explanation', null);
        
        const targetIds = new Set(targets?.map(t => t.id) || []);
        const toUpdate = qas.filter(qa => targetIds.has(qa.question_id));

        if (toUpdate.length > 0) {
            console.log(`Processing ${toUpdate.length} missing explanations...`);
            const updatePromises = toUpdate.map(qa => 
                supabase
                    .from('questions')
                    .update({ explanation: qa.explanation })
                    .eq('id', qa.question_id)
            );

            const results = await Promise.all(updatePromises);
            const errors = results.filter(r => r.error);
            totalSynced += (toUpdate.length - errors.length);
            console.log(`Progress: ${totalSynced} synced from this batch.`);
        } else {
            console.log("No missing explanations in this batch.");
        }

        offset += batchSize;
        if (qas.length < batchSize) hasMore = false;
    }

    console.log(`\n✅ Legacy Backfill Completed!`);
    console.log(`Total explanations restored to questions table: ${totalSynced}`);
    process.exit(0);
}

backfillFromLegacy();
