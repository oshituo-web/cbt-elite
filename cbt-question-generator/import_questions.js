require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

/**
 * DEFINITIVE CBT IMPORT ENGINE (Standardized)
 * Supports:
 * - Questions table (Metadata & Text)
 * - Answers table (Normalized 1:M)
 * - Question_Answers table (Denormalized for frontend compatibility)
 */

const BATCH_SIZE = 50; 
const INPUT_FILE = 'questions.json';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function withRetry(operation, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const { data, error } = await operation();
            if (error) throw error;
            return { data, error: null };
        } catch (err) {
            if (attempt === maxRetries) return { data: null, error: err };
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(res => setTimeout(res, delay));
        }
    }
}

async function runImport() {
    console.log("🚀 Starting Standardized Import Engine...");

    if (!fs.existsSync(INPUT_FILE)) {
        console.error("Missing questions.json!");
        return;
    }

    const questions = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    console.log(`Loaded ${questions.length} questions from local file.`);

    // 1. Fetch Mappings
    const { data: exams } = await supabase.from('exams').select('id, exam_name');
    const { data: subjects } = await supabase.from('subjects').select('id, subject_name');
    const examMap = Object.fromEntries(exams.map(e => [e.exam_name, e.id]));
    const subjectMap = Object.fromEntries(subjects.map(s => [s.subject_name, s.id]));

    // 2. Load Existing questions to avoid duplicates
    console.log("Loading existing question cache...");
    const existingTexts = new Set();
    let offset = 0;
    while(true) {
        const { data } = await supabase.from('questions').select('question_text').range(offset, offset + 999);
        if (!data || data.length === 0) break;
        data.forEach(q => existingTexts.add(q.question_text));
        offset += 1000;
    }
    console.log(`Cache ready: ${existingTexts.size} existing questions.`);

    // 3. Process in batches
    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
        const batch = questions.slice(i, i + BATCH_SIZE);
        const toInsert = [];

        for (const q of batch) {
            const text = (q.question || q.question_text).trim();
            if (existingTexts.has(text)) {
                skipCount++;
                continue;
            }

            const examId = examMap[q.exam_type || q.exam];
            const subjectId = subjectMap[q.subject];

            if (!examId || !subjectId) {
                console.warn(`Skipping (Mapping missing): ${q.subject} / ${q.exam_type}`);
                continue;
            }

            toInsert.push({
                question: q, // Keep original for second phase
                dbRow: {
                    exam_id: examId,
                    subject_id: subjectId,
                    subject: q.subject,
                    topic: q.topic,
                    subtopic: q.subtopic,
                    exam_type: q.exam_type || q.exam,
                    question_text: text,
                    explanation: q.explanation || "",
                    difficulty: q.difficulty || "Medium",
                    tags: q.tags || [],
                    is_active: true
                }
            });
        }

        if (toInsert.length === 0) {
            process.stdout.write(".");
            continue;
        }

        // Phase 1: Insert Questions
        const { data: insertedQs, error: qErr } = await withRetry(() => 
            supabase.from('questions').insert(toInsert.map(item => item.dbRow)).select()
        );

        if (qErr) {
            console.error(`\nBatch Error:`, qErr.message);
            continue;
        }

        // Phase 2: Insert Answers (Normalized)
        const answerInserts = [];

        insertedQs.forEach(insQ => {
            const original = toInsert.find(item => item.dbRow.question_text === insQ.question_text).question;
            const optA = original.option_a || original.options?.A || original.options?.a;
            const optB = original.option_b || original.options?.B || original.options?.b;
            const optC = original.option_c || original.options?.C || original.options?.c;
            const optD = original.option_d || original.options?.D || original.options?.d;
            let correct = (original.correct_option || original.answer || "A").trim().toUpperCase().charAt(0);

            // Normalized (answers table)
            answerInserts.push(
                { question_id: insQ.id, option_letter: 'A', option_text: optA, is_correct: correct === 'A' },
                { question_id: insQ.id, option_letter: 'B', option_text: optB, is_correct: correct === 'B' },
                { question_id: insQ.id, option_letter: 'C', option_text: optC, is_correct: correct === 'C' },
                { question_id: insQ.id, option_letter: 'D', option_text: optD, is_correct: correct === 'D' }
            );
        });

        const { error: aErr } = await withRetry(() => supabase.from('answers').insert(answerInserts));

        if (aErr) {
            console.error("\nAnswer insertion error:", aErr.message);
        } else {
            successCount += insertedQs.length;
        }

        process.stdout.write(`\rImported: ${successCount} | Skipped: ${skipCount} | Total: ${i + batch.length}`);
    }

    console.log(`\n\n✅ Import Process Finished!`);
    console.log(`New Questions Added: ${successCount}`);
    console.log(`Duplicates Skipped: ${skipCount}`);
}

runImport().catch(console.error);
