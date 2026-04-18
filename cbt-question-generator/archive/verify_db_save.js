const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
    try {
        console.log("Verifying User Responses insertion...");
        
        // 1. Get a random session, user, and question to create a valid foreign key set
        const { data: session, error: sErr } = await supabase.from('exam_sessions').select('id, user_id').limit(1).single();
        const { data: question, error: qErr } = await supabase.from('questions').select('id').limit(1).single();
        
        if (sErr || qErr || !session || !question) {
            console.error("Could not find test data (session/question) in DB.", sErr, qErr);
            return;
        }

        const testResponse = {
            session_id: session.id,
            user_id: session.user_id,
            question_id: question.id,
            selected_answer_id: null, // This is the UUID field that was causing errors
            user_answer_text: "Test Answer (Option C)", // This is the NEW column
            is_correct: true,
            time_spent_seconds: 5
        };

        console.log("Attempting insert:", JSON.stringify(testResponse, null, 2));
        
        const { data, error } = await supabase.from('user_responses').insert(testResponse).select();
        
        if (error) {
            console.error("❌ INSERT FAILED:", error.message);
            if (error.code === '22P02') console.log("HINT: This is likely a UUID type mismatch.");
        } else {
            console.log("✅ INSERT SUCCESSFUL! Response ID:", data[0].id);
            
            // Cleanup: remove the test record
            await supabase.from('user_responses').delete().eq('id', data[0].id);
            console.log("Test record cleaned up.");
        }
    } catch (err) {
        console.error("FATAL ERROR:", err);
    }
}

verify();
