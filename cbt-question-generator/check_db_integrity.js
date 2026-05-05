require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkIntegrity() {
    console.log("🚀 Starting Optimized Database Integrity Check...");

    let offset = 0;
    const batchSize = 1000;
    const orphans = [];
    const incomplete = [];
    let duplicateOptionsCount = 0;

    while (true) {
        const { data: questions, error } = await supabase
            .from('questions')
            .select(`
                id,
                question_text,
                question_answers (
                    option_text,
                    option_letter
                )
            `)
            .range(offset, offset + batchSize - 1);

        if (error) {
            console.error("Error fetching data:", error);
            break;
        }
        if (!questions || questions.length === 0) break;

        for (const q of questions) {
            const answers = q.question_answers || [];
            
            // 1. Check for Orphans / Incomplete
            if (answers.length === 0) {
                orphans.push(q);
            } else if (answers.length < 4) {
                incomplete.push({ id: q.id, count: answers.length });
            }

            // 2. Check for Duplicate Option Text
            const texts = answers.map(a => a.option_text.trim().toLowerCase());
            const uniqueTexts = new Set(texts);
            if (uniqueTexts.size < texts.length && texts.length > 0) {
                console.log(`\n❌ Question ${q.id} has duplicate option text!`);
                console.log(`Options: ${JSON.stringify(texts)}`);
                duplicateOptionsCount++;
            }
        }

        offset += questions.length;
        process.stdout.write(`\rScanned ${offset} questions...`);
        if (questions.length < batchSize) break;
    }

    console.log(`\n\n--- Results ---`);
    console.log(`Orphaned Questions (0 answers): ${orphans.length}`);
    console.log(`Incomplete Questions (<4 answers): ${incomplete.length}`);
    console.log(`Questions with Duplicate Options: ${duplicateOptionsCount}`);
    
    if (orphans.length > 0) {
        console.log("\nSample Orphans:", orphans.slice(0, 3).map(o => o.id));
    }
    if (incomplete.length > 0) {
        console.log("\nSample Incomplete:", incomplete.slice(0, 3));
    }

    console.log("\n✅ Integrity Check Finished.");
}

checkIntegrity().catch(console.error);
