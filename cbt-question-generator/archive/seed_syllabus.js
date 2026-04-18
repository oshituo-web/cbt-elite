require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
    console.log("Seeding sample syllabus topics...");

    const { data: exams } = await supabase.from('exams').select('*');
    const { data: subjects } = await supabase.from('subjects').select('*');

    const jamb = exams.find(e => e.exam_name === 'JAMB')?.id;
    const waec = exams.find(e => e.exam_name === 'WAEC')?.id;
    
    const physics = subjects.find(s => s.subject_name === 'Physics')?.id;
    const maths = subjects.find(s => s.subject_name === 'Mathematics')?.id;

    if (!jamb || !waec || !physics || !maths) {
        console.error("Missing required exams or subjects. Ensure migration_v2.sql was run.");
        return;
    }

    const sampleTopics = [
        { exam_id: jamb, subject_id: physics, topic: 'Mechanics', subtopic: 'Equations of Motion' },
        { exam_id: jamb, subject_id: physics, topic: 'Waves', subtopic: 'Sound Waves' },
        { exam_id: waec, subject_id: maths, topic: 'Algebra', subtopic: 'Quadratic Equations' },
        { exam_id: waec, subject_id: maths, topic: 'Geometry', subtopic: 'Circle Theorems' }
    ];

    const { error } = await supabase.from('syllabus_topics').upsert(sampleTopics, { onConflict: 'exam_id,subject_id,topic,subtopic' });
    
    if (error) {
        console.error("Seeding error:", error.message);
    } else {
        console.log("Successfully seeded 4 sample topics.");
    }
}

seed();
