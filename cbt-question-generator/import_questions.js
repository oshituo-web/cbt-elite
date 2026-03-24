require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const BATCH_SIZE = 50; 
const INPUT_FILE = 'questions.json';

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_KEY in environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const QUESTIONS_TABLE = 'questions'; 
const ANSWERS_TABLE = 'answers'; 

/**
 * Helper to retry Supabase operations with exponential backoff
 */
async function withRetry(operation, maxRetries = 5) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const { data, error } = await operation();
            if (error) throw error;
            return { data, error: null };
        } catch (err) {
            const isNetworkError = err.message?.includes('fetch') || err.message?.includes('timeout') || err.code === 'ETIMEDOUT' || err.message?.includes('Socket');
            
            if (isNetworkError && attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                console.warn(`⚠️ Connection error. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
                await new Promise(res => setTimeout(res, delay));
                continue;
            }
            return { data: null, error: err };
        }
    }
}

async function importQuestions() {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`File ${INPUT_FILE} not found. Run generate script first.`);
        return;
    }

    const rawData = fs.readFileSync(INPUT_FILE, 'utf8');
    const questions = JSON.parse(rawData);

    if (!Array.isArray(questions) || questions.length === 0) {
        console.error("No questions found in questions.json.");
        return;
    }

    // 1. Fetch Mappings and Existing Questions
    console.log("Fetching database mappings and existing questions...");
    const { data: exams } = await supabase.from('exams').select('id, exam_name');
    const { data: subjects } = await supabase.from('subjects').select('id, subject_name');
    
    // Fetch ALL existing question texts to avoid duplicate hits (paginated)
    let existingQuestions = new Set();
    let hasMore = true;
    let offset = 0;
    while (hasMore) {
        const { data: page, error: pageErr } = await supabase
            .from('questions')
            .select('question_text')
            .range(offset, offset + 999);
        
        if (pageErr) {
            console.error("❌ Error fetching existing questions:", pageErr.message);
            break;
        }
        if (page && page.length > 0) {
            page.forEach(q => existingQuestions.add(q.question_text));
            offset += page.length;
            if (page.length < 1000) hasMore = false;
        } else {
            hasMore = false;
        }
    }
    console.log(`Knowledge Base: ${existingQuestions.size} existing questions loaded.`);

    const examMap = {}; exams.forEach(e => examMap[e.exam_name] = e.id);
    const subjectMap = {}; subjects.forEach(s => subjectMap[s.subject_name] = s.id);

    // 0. Load Syllabus for Validation
    const syllabus = JSON.parse(fs.readFileSync('syllabus.json', 'utf8'));

    console.log(`Loaded ${questions.length} questions. Starting optimized import...`);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
        const batch = questions.slice(i, i + BATCH_SIZE);
        
        // Split batch into 'New' and 'Already Exists'
        const rawToInsert = [];
        batch.forEach(q => {
            if (existingQuestions.has(q.question)) {
                skippedCount++;
            } else {
                rawToInsert.push(q);
            }
        });

        if (rawToInsert.length === 0) {
            process.stdout.write('.'); // Just a dot for fully skipped batches
            continue;
        }

        console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1} (${rawToInsert.length} new questions)...`);

        const questionsToInsert = rawToInsert.map(q => {
            // Step 4: Normalization & Calibration
            let difficulty = (q.difficulty || 'Medium').toLowerCase();
            difficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
            
            const exam_type = q.exam || q.exam_type; 
            
            const examId = examMap[exam_type];
            const subjectId = subjectMap[q.subject];
            
            if (!examId || !subjectId) {
                console.warn(`⚠️ Skipping: Missing database mapping for ${exam_type} or ${q.subject}`);
                return null;
            }

            // Step 4: Validation Layer
            const validExam = syllabus[exam_type];
            if (!validExam) {
                console.warn(`❌ Validation Failed: Exam Type '${exam_type}' not in syllabus.json`);
                return null;
            }
            const validSubject = validExam[q.subject];
            if (!validSubject) {
                console.warn(`❌ Validation Failed: Subject '${q.subject}' not in syllabus topics.`);
                return null;
            }
            if (!validSubject.includes(q.topic)) {
                console.warn(`❌ Validation Failed: Topic '${q.topic}' not found in ${q.subject} syllabus.`);
                return null;
            }

            // Step 15: Option Completeness Check
            const optA = q.option_a || q.options?.A;
            const optB = q.option_b || q.options?.B;
            const optC = q.option_c || q.options?.C;
            const optD = q.option_d || q.options?.D;

            if (!optA || !optB || !optC || !optD) {
                console.warn(`❌ Validation Failed: Question missing one or more options. Text: ${q.question.substring(0, 30)}...`);
                return null;
            }

            return {
                exam_id: examId,
                subject_id: subjectId,
                subject: q.subject,
                topic: q.topic,
                subtopic: q.subtopic,
                exam_type: exam_type,
                question_text: q.question,
                diagram_url: q.diagram_url || null,
                difficulty: difficulty,
                tags: q.tags || [],
                explanation: null 
            };
        }).filter(Boolean);

        if (questionsToInsert.length === 0) continue;

        // 2. Insert Questions
        const { data: inserted, error: qError } = await withRetry(() => 
            supabase.from('questions').insert(questionsToInsert).select()
        );

        let finalInserted = inserted || [];

        if (qError) {
            console.error(`❌ Batch Error: ${qError.message}. Isolating...`);
            for (const row of questionsToInsert) {
                const { data: singleInserted, error: singleError } = await supabase.from('questions').insert(row).select();
                if (singleError) {
                    if (singleError.code === '23505') {
                        skippedCount++;
                    } else {
                        console.error("❌ FAILED ROW:", row.question_text.substring(0, 50) + "...");
                        console.error("REASON:", singleError.message);
                        errorCount++;
                    }
                } else if (singleInserted && singleInserted[0]) {
                    finalInserted.push(singleInserted[0]);
                    successCount++;
                }
            }
        } else {
            successCount += finalInserted.length;
        }

        if (finalInserted.length === 0) continue;

        // 3. Prepare Answer Data
        const answerInserts = finalInserted.map((insQ) => {
            const original = batch.find(bq => bq.question === insQ.question_text);
            if (!original) return null;

            // Handle both flat and nested options
            const optA = original.option_a || original.options?.A;
            const optB = original.option_b || original.options?.B;
            const optC = original.option_c || original.options?.C;
            const optD = original.option_d || original.options?.D;
            const correct = original.correct_option || original.correct_answer;

            return {
                question_id: insQ.id,
                option_a: optA,
                option_b: optB,
                option_c: optC,
                option_d: optD,
                correct_option: correct,
                explanation: original.explanation
            };
        }).filter(Boolean);

        // 4. Insert Question Answers
        if (answerInserts.length > 0) {
            const { error: aError } = await withRetry(() => 
                supabase.from('question_answers').upsert(answerInserts, { onConflict: 'question_id' })
            );

            if (aError) {
                console.error(`❌ Answer Insert Error:`, aError.message);
            }
        }
    }

    console.log(`\n\nImport completed!`);
    console.log(`Successfully added: ${successCount} NEW questions`);
    console.log(`Skipped: ${skippedCount} (Already existed in DB)`);
    console.log(`Failed: ${errorCount} (Actual errors)`);
}

importQuestions().catch(console.error);
