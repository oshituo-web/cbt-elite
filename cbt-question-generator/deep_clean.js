require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function deepClean() {
    console.log("Starting deep clean pagination...");
    let allQuestions = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('questions')
            .select('id, question_text, subject, answers(id, option_text)')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error(error);
            return;
        }

        if (data.length > 0) {
            allQuestions = allQuestions.concat(data);
            page++;
            if (data.length < pageSize) {
                hasMore = false;
            }
        } else {
            hasMore = false;
        }
    }

    console.log(`Successfully fetched all ${allQuestions.length} questions from DB.`);

    let badIds = [];
    let sampleBad = null;

    allQuestions.forEach(q => {
        if (!q.answers || q.answers.length < 4) {
            badIds.push(q.id);
            if(!sampleBad) sampleBad = q;
            return;
        }
        
        const hasEmptyOption = q.answers.some(a => !a.option_text || a.option_text.trim() === '');
        if (hasEmptyOption) {
            badIds.push(q.id);
            if(!sampleBad) sampleBad = q;
        }
    });

    console.log(`Found ${badIds.length} broken questions spanning the entire DB.`);
    
    if (sampleBad) {
        console.log("Sample of a broken question being deleted:", sampleBad.question_text.substring(0, 100));
    }

    if (badIds.length > 0) {
        console.log("Deleting...");
        // chunk deletions
        const chunkSize = 100;
        for (let i = 0; i < badIds.length; i += chunkSize) {
            const chunk = badIds.slice(i, i + chunkSize);
            const { error: delErr } = await supabase.from('questions').delete().in('id', chunk);
            if (delErr) {
                console.error(`Error deleting chunk:`, delErr.message);
            }
        }
        console.log(`Done. Deleted all ${badIds.length} broken questions.`);
    }
}

deepClean();
