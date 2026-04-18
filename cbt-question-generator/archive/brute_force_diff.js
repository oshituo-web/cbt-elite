require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkDifficultyConstraint() {
    console.log("Investigating 'questions_difficulty_check'...");
    
    // Attempt 1: Check what difficulty levels already exist
    const { data: existing, error: exErr } = await supabase
        .from('questions')
        .select('difficulty')
        .limit(10);
        
    if (existing) {
        const uniqueDiffs = [...new Set(existing.map(q => q.difficulty))];
        console.log("Existing difficulty values in DB:", uniqueDiffs);
    }

    // Attempt 2: Try variations to see what works
    const testValues = ['easy', 'Easy', 'EASY', 'medium', 'hard', 'General'];
    const { data: sub } = await supabase.from('subjects').select('id').limit(1).single();
    const { data: exam } = await supabase.from('exams').select('id').limit(1).single();

    for (const val of testValues) {
        const { error } = await supabase.from('questions').insert({
            question_text: `Constraint Test ${val} ${Date.now()}`,
            subject: "Civic",
            topic: "Democracy",
            difficulty: val,
            exam_type: "WAEC",
            subject_id: sub.id,
            exam_id: exam.id
        });
        
        if (error) {
            console.log(`❌ Value '${val}' REJECTED: ${error.message}`);
        } else {
            console.log(`✅ Value '${val}' ACCEPTED`);
        }
    }
}

checkDifficultyConstraint();
