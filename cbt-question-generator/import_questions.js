require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
const supabase = createClient(supabaseUrl, supabaseKey);

const INPUT_FILE = 'questions.json';
const CONCURRENCY = 10; // Number of parallel requests

async function withRetry(fn, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
    }
}

async function startImport() {
    console.log("🚀 STARTING PARALLEL BULK IMPORT...");
    
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`Error: ${INPUT_FILE} not found!`);
        return;
    }

    const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    console.log(`Loaded ${data.length} records from ${INPUT_FILE}`);

    // Pre-fetch Subjects and Exams
    const { data: dbSubjects } = await supabase.from('subjects').select('id, subject_name');
    const { data: dbExams } = await supabase.from('exams').select('id, exam_name');
    
    const subjectMap = {};
    dbSubjects.forEach(s => subjectMap[s.subject_name.toLowerCase()] = s.id);
    
    const examMap = {};
    dbExams.forEach(e => examMap[e.exam_name.toUpperCase()] = e.id);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    async function processQuestion(q) {
        try {
            const subName = (q.subject || "").toLowerCase();
            const examName = (q.exam_type || q.exam || "").toUpperCase();
            const subjectId = subjectMap[subName];
            const examId = examMap[examName];

            if (!subjectId) {
                return { status: 'skip', reason: 'subject_not_found' };
            }

            const qType = q.question_type || 'objective';
            const text = (q.question_text || q.question || "").trim();

            if (qType === 'objective') {
                const optA = (q.option_a || (q.options && q.options.A) || "").trim();
                if (!text || !optA) return { status: 'skip', reason: 'incomplete' };
            } else {
                if (!text || !q.model_answer) return { status: 'skip', reason: 'incomplete' };
            }

            const { data: insQ, error: qErr } = await withRetry(() => supabase.from('questions').insert({
                subject_id: subjectId,
                exam_id: examId,
                subject: q.subject,
                topic: q.topic || 'General',
                exam_type: q.exam_type || q.exam,
                exam_year: q.exam_year || null,
                question_text: text,
                explanation: q.explanation || "",
                difficulty: q.difficulty || "Medium",
                tags: q.tags || [],
                is_active: true,
                is_past_question: false,
                question_type: qType
            }).select().single());

            if (qErr) {
                if (qErr.code === '23505') return { status: 'skip', reason: 'duplicate' };
                throw qErr;
            }

            if (qType === 'objective') {
                const { error: aErr } = await withRetry(() => supabase.from('question_answers').insert({
                    question_id: insQ.id,
                    option_a: q.option_a || q.options?.A || q.options?.a || '',
                    option_b: q.option_b || q.options?.B || q.options?.b || '',
                    option_c: q.option_c || q.options?.C || q.options?.c || '',
                    option_d: q.option_d || q.options?.D || q.options?.d || '',
                    correct_option: (q.correct_option || q.answer || "A").toUpperCase(),
                    explanation: q.explanation || ""
                }));
                if (aErr) throw aErr;
            } else {
                const { error: dErr } = await withRetry(() => supabase.from('theory_details').insert({
                    question_id: insQ.id,
                    model_answer: q.model_answer || '',
                    key_points: q.key_points || [],
                    max_score: q.max_score || 5
                }));
                if (dErr) throw dErr;
            }

            return { status: 'success' };
        } catch (err) {
            return { status: 'error', message: err.message };
        }
    }

    for (let i = 0; i < data.length; i += CONCURRENCY) {
        const batch = data.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(processQuestion));

        results.forEach(res => {
            if (res.status === 'success') successCount++;
            else if (res.status === 'skip') skipCount++;
            else {
                errorCount++;
                console.error("   ❌ Error:", res.message);
            }
        });

        if (i % 100 === 0) {
            process.stdout.write(`\rProgress: ${i}/${data.length} | ✅ ${successCount} | ⏭️ ${skipCount} | ❌ ${errorCount}`);
        }
    }

    console.log("\n\n🎉 IMPORT FINISHED.");
    console.log(`✅ Success: ${successCount}`);
    console.log(`⏭️ Skipped/Duplicates: ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);
}

startImport().catch(console.error);
