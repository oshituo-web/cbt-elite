require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function extractBrokenFromDB() {
    console.log("🔍 Extracting IDs of broken questions from database...");
    let broken = [];
    let processed = 0;
    const batchSize = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('questions')
            .select('id, question_text, answers(id)')
            .range(processed, processed + batchSize - 1);

        if (error) {
            console.error("Fetch Error:", error);
            break;
        }
        if (!data || data.length === 0) break;

        data.forEach(q => {
            if (!q.answers || q.answers.length < 4) {
                broken.push({ id: q.id, text: q.question_text });
            }
        });

        processed += data.length;
        process.stdout.write(`\rProcessed ${processed} questions... Found ${broken.length} broken.`);
        if (data.length < batchSize) break;
    }

    fs.writeFileSync('incomplete.json', JSON.stringify(broken, null, 2));
    console.log(`\n✅ Saved ${broken.length} broken question IDs to incomplete.json`);
}

extractBrokenFromDB().catch(console.error);
