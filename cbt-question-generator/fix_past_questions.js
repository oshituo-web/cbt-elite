require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixMetadata() {
    console.log("Checking for questions incorrectly marked as past questions...");
    const { count, error } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('is_past_question', true);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${count} questions to fix.`);

    if (count > 0) {
        const { error: uErr } = await supabase
            .from('questions')
            .update({ is_past_question: false })
            .eq('is_past_question', true);
        
        if (uErr) console.error("Update Error:", uErr);
        else console.log("Successfully fixed existing questions.");
    }
}

fixMetadata();
