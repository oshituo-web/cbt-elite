require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const BATCH_SIZE = 50; 
const INPUT_FILE = 'questions_v2.json';

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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

async function importQuestionsV2() {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`File ${INPUT_FILE} not found. Run generate_questions_v2 script first.`);
        return;
    }

    const rawData = fs.readFileSync(INPUT_FILE, 'utf8');
    const items = JSON.parse(rawData);

    if (!Array.isArray(items) || items.length === 0) {
        console.error("No items found in questions_v2.json.");
        return;
    }

    console.log("Fetching database mappings and existing questions...");
    const { data: exams } = await supabase.from('exams').select('id, exam_name');
    const { data: subjects } = await supabase.from('subjects').select('id, subject_name');
    
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

    const syllabus = JSON.parse(fs.readFileSync('syllabus.json', 'utf8'));

    console.log(`Loaded ${items.length} items (groups/standalone). Starting optimized import...`);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        let groupId = null;
        
        // Ensure 1st question dictates metadata for the group
        if (!item.questions || item.questions.length === 0) continue;
        const metaQ = item.questions[0];
        
        const exam_type = metaQ.exam_type || metaQ.exam;
        const examId = examMap[exam_type];
        const subjectId = subjectMap[metaQ.subject];

        if (!examId || !subjectId) {
            console.warn(`⚠️ Skipping item: Missing database mapping for ${exam_type} or ${metaQ.subject}`);
            continue;
        }
        
        // 1. Insert Question Group if applicable
        if (item.is_group && item.group_content) {
             const { data: groupData, error: groupErr } = await withRetry(() => 
                 supabase.from('question_groups').insert({
                     content: item.group_content,
                     type: item.group_type || 'passage',
                     subject: metaQ.subject,
                     exam_type: exam_type
                 }).select()
             );
             
             if (groupErr) {
                 console.error(`❌ Failed to insert question group:`, groupErr.message);
                 errorCount++;
                 continue; // Skip inserting questions if group fails
             }
             if (groupData && groupData.length > 0) {
                 groupId = groupData[0].id;
             }
        }
        
        // 2. Prepare questions for insertion
        const questionsToInsert = [];
        const originalQuestions = [];
        
        for (const q of item.questions) {
            if (existingQuestions.has(q.question)) {
                skippedCount++;
                continue;
            }

            let difficulty = (q.difficulty || 'Medium').toLowerCase();
            difficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
            
            const optA = q.option_a || q.options?.A;
            const optB = q.option_b || q.options?.B;
            const optC = q.option_c || q.options?.C;
            const optD = q.option_d || q.options?.D;

            if (!optA || !optB || !optC || !optD) {
                console.warn(`❌ Validation Failed: Question missing options. Text: ${q.question.substring(0, 30)}...`);
                continue;
            }

            questionsToInsert.push({
                exam_id: examId,
                subject_id: subjectId,
                subject: q.subject,
                topic: q.topic,
                subtopic: q.subtopic,
                exam_type: exam_type,
                question_text: q.question,
                diagram_url: q.diagram_url || null,
                difficulty: difficulty,
                group_id: groupId, // Link to group if it exists
                tags: q.tags || [],
                explanation: null
            });
            originalQuestions.push(q);
        }
        
        if (questionsToInsert.length === 0) continue;

        // 3. Insert Questions
        const { data: inserted, error: qError } = await withRetry(() => 
            supabase.from('questions').insert(questionsToInsert).select()
        );

        if (qError) {
            console.error(`❌ Question Insert Error:`, qError.message);
            errorCount++;
            continue;
        }

        // 4. Prepare Answer Data
        const answerInserts = inserted.map((insQ, index) => {
            const original = originalQuestions[index];
            if (!original) return null;

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

        // 5. Insert Question Answers
        if (answerInserts.length > 0) {
            const { error: aError } = await withRetry(() => 
                supabase.from('question_answers').upsert(answerInserts, { onConflict: 'question_id' })
            );

            if (aError) {
                console.error(`❌ Answer Insert Error:`, aError.message);
            } else {
                successCount += inserted.length;
            }
        }
        
        process.stdout.write(`+${inserted.length} `);
    }

    console.log(`\n\nImport completed!`);
    console.log(`Successfully added: ${successCount} NEW questions`);
    console.log(`Skipped: ${skippedCount} (Already existed in DB)`);
    console.log(`Failed: ${errorCount} (Actual errors/blocks)`);
}

importQuestionsV2().catch(console.error);
