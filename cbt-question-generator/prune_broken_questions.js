require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function pruneBroken() {
    console.log("Identifying questions that still have missing options after the repair attempt...");
    
    // We fetch all questions and their answers
    const { data: questions, error } = await supabase
        .from('questions')
        .select(`
            id,
            answers (
                id,
                option_text
            )
        `);

    if (error) {
        console.error("Fetch error:", error);
        return;
    }

    let toDelete = [];

    questions.forEach(q => {
        if (!q.answers || q.answers.length < 4) {
            toDelete.push(q.id);
            return;
        }
        
        const hasEmptyOption = q.answers.some(a => !a.option_text || a.option_text.trim() === '');
        if (hasEmptyOption) {
            toDelete.push(q.id);
        }
    });

    console.log(`Found ${toDelete.length} questions that are irrepairable and broken.`);
    
    if (toDelete.length > 0) {
        console.log("Deleting broken questions to ensure exam quality...");
        
        // Supabase limits .in() to somewhat small batches, let's chunk it
        const chunkSize = 100;
        for (let i = 0; i < toDelete.length; i += chunkSize) {
            const chunk = toDelete.slice(i, i + chunkSize);
            const { error: delErr } = await supabase.from('questions').delete().in('id', chunk);
            if (delErr) {
                console.error(`Error deleting chunk ${i}:`, delErr.message);
            } else {
                console.log(`Deleted chunk ${i} to ${i + chunk.length}`);
            }
        }
        console.log("Pruning complete.");
    } else {
        console.log("No broken questions remain!");
    }
}

pruneBroken();
