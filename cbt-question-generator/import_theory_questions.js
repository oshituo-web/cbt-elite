require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const INPUT_FILE = 'theory_questions.json';

async function importTheory() {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error("No theory questions found. Run generator first.");
        return;
    }

    const questions = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    console.log(`Importing ${questions.length} theory questions...`);

    const { data: exams } = await supabase.from('exams').select('id, exam_name');
    const { data: subjects } = await supabase.from('subjects').select('id, subject_name');
    const examMap = {}; exams.forEach(e => examMap[e.exam_name] = e.id);
    const subjectMap = {}; subjects.forEach(s => subjectMap[s.subject_name] = s.id);

    for (const q of questions) {
        const examId = examMap[q.exam_type];
        const subjectId = subjectMap[q.subject];

        if (!examId || !subjectId) {
            console.warn(`Skipping ${q.subject} - Missing DB ID`);
            continue;
        }

        // 1. Insert into questions table
        const { data: newQ, error: qErr } = await supabase.from('questions').insert({
            exam_id: examId,
            subject_id: subjectId,
            subject: q.subject,
            topic: q.topic,
            subtopic: q.subtopic,
            exam_type: q.exam_type,
            question_text: q.question,
            question_type: 'theory',
            difficulty: q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1)
        }).select().single();

        if (qErr) {
            console.error("Error inserting question:", qErr.message);
            continue;
        }

        // 2. Insert into theory_details
        const { error: dErr } = await supabase.from('theory_details').insert({
            question_id: newQ.id,
            model_answer: q.model_answer,
            key_points: q.key_points,
            max_score: q.max_score || 5
        });

        if (dErr) console.error("Error inserting details:", dErr.message);
        else console.log(`Successfully imported theory question: ${newQ.id}`);
    }

    console.log("Theory import completed.");
}

importTheory().catch(console.error);
