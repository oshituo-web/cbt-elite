require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanup() {
    console.log("Starting database cleanup...");

    // 1. Identify Orphan Questions (No Answers)
    const { data: allQIds } = await supabase.from('questions').select('id');
    const { data: allAIds } = await supabase.from('question_answers').select('question_id');
    const answerSet = new Set(allAIds.map(a => a.question_id));
    const orphans = allQIds.filter(q => !answerSet.has(q.id)).map(q => q.id);
    
    if (orphans.length > 0) {
        console.log(`Deleting ${orphans.length} orphaned questions...`);
        const { error: delErr } = await supabase.from('questions').delete().in('id', orphans);
        if (delErr) console.error("Error deleting orphans:", delErr.message);
        else console.log("Successfully removed orphaned questions.");
    }

    // 2. Identify Incomplete Questions (<20 chars or ends in ...)
    const { data: allQuestions } = await supabase.from('questions').select('id, question_text');
    const incomplete = allQuestions.filter(q => q.question_text.length < 20 || q.question_text.endsWith('...')).map(q => q.id);

    if (incomplete.length > 0) {
        console.log(`Deleting ${incomplete.length} incomplete questions...`);
        const { error: delIncErr } = await supabase.from('questions').delete().in('id', incomplete);
        if (delIncErr) console.error("Error deleting incomplete:", delIncErr.message);
        else console.log("Successfully removed incomplete questions.");
    }
    
    // 3. Create Reports Table (If not exists via SQL)
    console.log("Preparing to create 'question_reports' table...");
    // Since I can't run raw SQL easily via JS without a specific edge function or RPC, 
    // I will try to perform a dummy insert to see if it exists, or just tell the user to run it if it fails.
    // Actually, I can use the Supabase SQL editor tool if available, or just create it via a scratch script using a helper.
}

cleanup();
