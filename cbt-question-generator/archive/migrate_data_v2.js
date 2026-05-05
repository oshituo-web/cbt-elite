require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
    console.log("Starting data migration...");

    // 1. Fetch Exams and Subjects mapping
    const { data: exams, error: eErr } = await supabase.from('exams').select('id, exam_name');
    if (eErr) {
        console.error("Error fetching exams:", eErr.message);
        process.exit(1);
    }
    const { data: subjects, error: sErr } = await supabase.from('subjects').select('id, subject_name');
    if (sErr) {
        console.error("Error fetching subjects:", sErr.message);
        process.exit(1);
    }

    const examMap = {};
    exams.forEach(e => examMap[e.exam_name] = e.id);

    const subjectMap = {};
    subjects.forEach(s => subjectMap[s.subject_name] = s.id);

    console.log("Mappings loaded.");

    // 2. Fetch all questions that need migration (exam_id is null)
    const { data: questions, error: qError } = await supabase
        .from('questions')
        .select('*')
        .is('exam_id', null);

    if (qError) {
        console.error("Error fetching questions:", qError);
        return;
    }

    console.log(`Migrating ${questions.length} questions in batches...`);
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
        const batch = questions.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(questions.length/BATCH_SIZE)}...`);

        const questionUpdates = [];
        const answerInserts = [];

        for (const q of batch) {
            const eId = examMap[q.exam_type];
            const sId = subjectMap[q.subject];

            if (!eId || !sId) {
                console.warn(`Skipping question ${q.id}: Could not map ${q.exam_type} or ${q.subject}`);
                continue;
            }

            questionUpdates.push({
                id: q.id,
                subject: q.subject,
                topic: q.topic,
                exam_type: q.exam_type,
                exam_id: eId,
                subject_id: sId
            });

            // Fetch answers for this question (still needs individual fetch due to structure, but we can parallelize)
            // For now, let's just do them one by one but in the batch loop
            const { data: answers } = await supabase
                .from('question_answers')
                .select('*')
                .eq('question_id', q.id)
                .order('option_letter', { ascending: true });

            if (answers && answers.length >= 4) {
                answerInserts.push({
                    question_id: q.id,
                    option_a: answers.find(a => a.option_letter === 'A')?.option_text || '',
                    option_b: answers.find(a => a.option_letter === 'B')?.option_text || '',
                    option_c: answers.find(a => a.option_letter === 'C')?.option_text || '',
                    option_d: answers.find(a => a.option_letter === 'D')?.option_text || '',
                    correct_option: answers.find(a => a.is_correct)?.option_letter || 'A',
                    explanation: q.explanation
                });
            }
        }

        // 1. Bulk Update Questions
        if (questionUpdates.length > 0) {
            const { error: upError } = await supabase
                .from('questions')
                .upsert(questionUpdates);
            if (upError) console.error("Batch update questions error:", upError.message);
        }

        // 2. Bulk Upsert Answers
        if (answerInserts.length > 0) {
            const { error: ansError } = await supabase
                .from('question_answers')
                .upsert(answerInserts, { onConflict: 'question_id' });
            if (ansError) console.error("Batch insert answers error:", ansError.message);
        }
        
        console.log(`Batch ${Math.floor(i/BATCH_SIZE) + 1} completed.`);
    }

    console.log("Migration finished.");
}

migrate().catch(console.error);
