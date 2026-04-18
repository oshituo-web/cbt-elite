require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function seed() {
    const data = JSON.parse(fs.readFileSync('reference_questions.json', 'utf8'));
    console.log(`Seeding ${data.length} reference questions...`);

    const inserts = data.map(q => ({
        exam_type: q.exam_type,
        subject: q.subject,
        topic: q.topic,
        question_text: q.question,
        model_answer: q.model_answer,
        key_points: q.key_points,
        max_score: q.max_score
    }));

    const { error } = await supabase.from('reference_questions').insert(inserts);
    if (error) console.error("Error seeding:", error.message);
    else console.log("✅ Seeding complete.");
}

seed();
