require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixRecentQuestions() {
    console.log("Fixing questions imported in the last hour...");
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    let processed = 0;
    while (true) {
        const { data: recent, error: fErr } = await supabase
            .from('questions')
            .select('id, question_text')
            .gt('created_at', oneHourAgo)
            .eq('is_past_question', true)
            .limit(1000);

        if (fErr) { console.error(fErr); break; }
        if (!recent || recent.length === 0) break;

        console.log(`Processing ${recent.length} questions...`);

        for (const q of recent) {
            const { error: uErr } = await supabase
                .from('questions')
                .update({ is_past_question: false })
                .eq('id', q.id);
            
            if (uErr) {
                if (uErr.code === '23505') {
                    await supabase.from('questions').delete().eq('id', q.id);
                } else {
                    console.error(`Error updating ${q.id}:`, uErr.message);
                }
            }
        }
        processed += recent.length;
        console.log(`Total processed: ${processed}`);
    }
    console.log("Fix complete.");
}

fixRecentQuestions();
