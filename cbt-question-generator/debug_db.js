require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    console.log("Fetching check constraints for 'questions' table...");
    const { data, error } = await supabase.rpc('get_check_constraints', { table_name: 'questions' });
    
    if (error) {
        console.log("RPC 'get_check_constraints' failed. Falling back to direct query...");
        const { data: rawData, error: rawError } = await supabase.from('_dummy').select('*').limit(0); // This is just to test connection
        
        // Let's try to get table info via information_schema if possible
        const { data: columns, error: colError } = await supabase.from('questions').select('*').limit(1);
        if (columns) console.log("Sample row keys:", Object.keys(columns[0]));
        
        // Fetch first available subject and exam for a valid test
        const { data: sub } = await supabase.from('subjects').select('id').limit(1).single();
        const { data: exam } = await supabase.from('exams').select('id').limit(1).single();
        
        if (!sub || !exam) {
            console.error("Could not find any subjects or exams in DB for testing.");
            return;
        }

        // Actually, let's just try to insert a single row with 'easy' and see the exact Postgres error
        const { error: insError } = await supabase.from('questions').insert({
            question_text: "Test Question " + Date.now(),
            subject: "Civic",
            topic: "Democracy",
            difficulty: "easy",
            exam_type: "WAEC",
            subject_id: sub.id,
            exam_id: exam.id
        });
        if (insError) console.error("Direct Insert Error with 'easy':", insError);
        else console.log("Direct Insert Success with 'easy'!");
    } else {
        console.log("Constraints:", data);
    }
}

checkSchema();
