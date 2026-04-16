require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function backfill() {
    console.log("🚀 Starting Explanation Backfill...");

    let totalSynced = 0;
    let offset = 0;
    const batchSize = 500;
    let hasMore = true;

    while (hasMore) {
        console.log(`Fetching batch: ${offset} - ${offset + batchSize}...`);
        
        // 1. Fetch explanations from the source table
        const { data: explanations, error: fetchErr } = await supabase
            .from('question_explanations')
            .select('question_id, explanation')
            .range(offset, offset + batchSize - 1);

        if (fetchErr) {
            console.error("Fetch Error:", fetchErr.message);
            break;
        }

        if (!explanations || explanations.length === 0) {
            hasMore = false;
            break;
        }

        console.log(`Processing ${explanations.length} explanations...`);

        // 2. Perform updates one by one (Supabase JS doesn't support bulk update with different values per row easily)
        // We'll use a batch of promises to speed it up while keeping it stable
        const updatePromises = explanations.map(exp => 
            supabase
                .from('questions')
                .update({ explanation: exp.explanation })
                .eq('id', exp.question_id)
        );

        const results = await Promise.all(updatePromises);
        
        const errors = results.filter(r => r.error);
        if (errors.length > 0) {
            console.warn(`${errors.length} updates failed in this batch.`);
        }

        totalSynced += (explanations.length - errors.length);
        console.log(`Progress: ${totalSynced} explanations synced.`);

        offset += batchSize;
        if (explanations.length < batchSize) hasMore = false;
    }

    console.log(`\n✅ Backfill Completed!`);
    console.log(`Total explanations restored to questions table: ${totalSynced}`);
    process.exit(0);
}

backfill();
