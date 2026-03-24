require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function auditQuestions() {
    console.log("Auditing questions for missing options...");
    
    // Check for questions where options are missing in the question_answers table
    const { data: missingOptions, error: optErr } = await supabase
        .from('question_answers')
        .select('question_id, option_a, option_b, option_c, option_d')
        .or('option_a.is.null,option_b.is.null,option_c.is.null,option_d.is.null');

    if (optErr) console.error("Error checking options:", optErr.message);
    else console.log(`Questions with missing options: ${missingOptions.length}`);

    // Check for questions without any answers at all
    const { data: noAnswers, error: ansErr } = await supabase
        .from('questions')
        .select('id, question_text')
        .not('id', 'in', `(${missingOptions.map(m => m.question_id).join(',') || '00000000-0000-0000-0000-000000000000'})`);
    
    // Actually, a better way is to use a left join or check count
    const { data: questionsWithoutAnswers, error: qErr } = await supabase.rpc('get_questions_without_answers');
    
    if (qErr) {
        console.log("RPC 'get_questions_without_answers' missing. Checking manually...");
        // Manual check for questions not found in question_answers
        const { data: allQIds } = await supabase.from('questions').select('id');
        const { data: allAIds } = await supabase.from('question_answers').select('question_id');
        const answerSet = new Set(allAIds.map(a => a.question_id));
        const orphans = allQIds.filter(q => !answerSet.has(q.id));
        console.log(`Questions completely missing answer records: ${orphans.length}`);
    } else {
        console.log(`Questions without answers (RPC): ${questionsWithoutAnswers.length}`);
    }

    // Check for incomplete questions (arbitrary length < 30 chars as a heuristic)
    const { data: shortQuestions, error: shortErr } = await supabase
        .from('questions')
        .select('id, question_text')
        .lt('question_text', '...'.length + 27); // Not exactly how 'lt' works on strings, let's use a raw query or length filter if possible
    
    // Better heuristic: find questions that end abruptly or are too short
    const { data: allQuestions } = await supabase.from('questions').select('id, question_text');
    const incomplete = allQuestions.filter(q => q.question_text.length < 20 || q.question_text.endsWith('...'));
    console.log(`Potentially incomplete questions (<20 chars or ends in ...): ${incomplete.length}`);
}

auditQuestions();
