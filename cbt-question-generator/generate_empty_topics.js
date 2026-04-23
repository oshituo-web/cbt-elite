require('dotenv').config();
const fs = require('fs');
const { GoogleGenAI, Type } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const TOTAL_QUESTIONS_TO_GENERATE = 100;
const BATCH_SIZE = 15;
const CONCURRENCY_LIMIT = 1;

// TARGET FOCUS
const TARGET_EXAM = null;
const TARGET_SUBJECTS = []; 

// Initialization
const ai = new GoogleGenAI({ apiKey: (process.env.GEMINI_API_KEY || "").trim() });
const supabase = createClient((process.env.SUPABASE_URL || "").trim(), (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim());

const delay = ms => new Promise(res => setTimeout(res, ms));
const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Ensure mappings are loaded before starting workers
let examMap = {};
let subjectMap = {};
let knowledgeBase = new Set(); 

const generationSchema = {
    type: Type.ARRAY,
    description: "List of exactly generated question groups or standalone items.",
    items: {
        type: Type.OBJECT,
        properties: {
            is_group: { type: Type.BOOLEAN },
            group_content: { type: Type.STRING, nullable: true },
            group_type: { type: Type.STRING, enum: ['passage', 'map', 'graph', 'data_set', 'instruction'], nullable: true },
            questions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        exam_type: { type: Type.STRING },
                        subject: { type: Type.STRING },
                        topic: { type: Type.STRING },
                        subtopic: { type: Type.STRING },
                        difficulty: { type: Type.STRING, enum: ['easy', 'medium', 'hard'] },
                        question: { type: Type.STRING },
                        option_a: { type: Type.STRING },
                        option_b: { type: Type.STRING },
                        option_c: { type: Type.STRING },
                        option_d: { type: Type.STRING },
                        correct_option: { type: Type.STRING, enum: ['A', 'B', 'C', 'D'] },
                        explanation: { type: Type.STRING },
                        diagram_url: { type: Type.STRING, nullable: true },
                        diagram_type: { type: Type.STRING, enum: ['none', 'graph', 'diagram', 'map', 'svg'], nullable: true },
                        diagram_svg: { type: Type.STRING, nullable: true }
                    },
                    required: ["exam_type", "subject", "topic", "subtopic", "difficulty", "question", "option_a", "option_b", "option_c", "option_d", "correct_option", "explanation"]
                }
            }
        },
        required: ["is_group", "questions"]
    }
};

async function withDBRetry(operation, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const { data, error } = await operation();
            if (error) throw error;
            return { data, error: null };
        } catch (err) {
            console.error(`[DB Retry Error] Attempt ${attempt}:`, err.message);
            if (attempt === maxRetries) return { data: null, error: err };
            await delay(Math.pow(2, attempt) * 500);
        }
    }
}

async function loadKnowledgeBase() {
    const { data: exams } = await supabase.from('exams').select('id, exam_name');
    const { data: subjects } = await supabase.from('subjects').select('id, subject_name');
    
    exams.forEach(e => examMap[e.exam_name.trim().toUpperCase()] = e.id);
    subjects.forEach(s => {
        subjectMap[s.subject_name.trim().toUpperCase()] = s.id;
        subjectMap[s.subject_name.trim()] = s.id;
    });

    const { data: recentQs } = await supabase.from('questions').select('question_text').order('created_at', { ascending: false }).limit(2000);
    if (recentQs) recentQs.forEach(q => knowledgeBase.add(q.question_text.toLowerCase().trim()));
}

async function saveToDatabase(items) {
    let successCount = 0;
    for (const item of items) {
        if (!item.questions || item.questions.length === 0) continue;
        const metaQ = item.questions[0];
        const examName = (metaQ.exam_type || metaQ.exam || "").trim().toUpperCase();
        const subName = (metaQ.subject || "").trim();
        const examId = examMap[examName] || examMap['JAMB'];
        const subjectId = subjectMap[subName];

        if (!examId || !subjectId) continue;

        let groupId = null;
        if (item.is_group && item.group_content) {
            const { data: gData } = await withDBRetry(() => supabase.from('question_groups').insert({ content: item.group_content, type: item.group_type || 'passage', subject: subName, exam_type: examName }).select());
            if (gData && gData.length > 0) groupId = gData[0].id;
        }

        const qsToInsert = [];
        const originals = [];
        for (const q of item.questions) {
            const cleanText = q.question.toLowerCase().trim();
            if (knowledgeBase.has(cleanText)) continue;
            qsToInsert.push({ exam_id: examId, subject_id: subjectId, subject: subName, topic: q.topic, subtopic: q.subtopic, exam_type: examName, question_text: q.question, diagram_url: q.diagram_url || null, diagram_type: q.diagram_type || 'none', diagram_svg: q.diagram_svg || null, difficulty: (q.difficulty || 'Medium').charAt(0).toUpperCase() + (q.difficulty || 'Medium').slice(1), group_id: groupId, explanation: null });
            originals.push(q);
            knowledgeBase.add(cleanText);
        }

        if (qsToInsert.length === 0) continue;

        const { data: insertedQs, error: qErr } = await withDBRetry(() => supabase.from('questions').insert(qsToInsert).select());
        if (qErr) continue;

        const ansInserts = [];
        insertedQs.forEach((insQ, idx) => {
            const orig = originals[idx];
            ['A', 'B', 'C', 'D'].forEach(letter => {
                ansInserts.push({ question_id: insQ.id, option_letter: letter, option_text: orig[`option_${letter.toLowerCase()}`], is_correct: orig.correct_option === letter });
            });
            if (orig.explanation) supabase.from('question_explanations').upsert({ question_id: insQ.id, explanation: orig.explanation }).then();
        });
        await withDBRetry(() => supabase.from('answers').insert(ansInserts));
        successCount += insertedQs.length;
    }
    return successCount;
}

async function requestAI(exam, subject, topic, subtopic) {
    const prompt = `You are an elite Examination Setter for ${exam} ${subject}. Generate ${BATCH_SIZE} questions for topic: ${topic}, subtopic: ${subtopic}. Return JSON list.`;
    try {
        const response = await ai.models.generateContent({ model: 'gemini-1.5-flash', contents: prompt, config: { responseMimeType: 'application/json', responseSchema: generationSchema } });
        return JSON.parse(response.text);
    } catch (e) { return { rateLimit: true }; }
}

async function turboCharge() {
    await loadKnowledgeBase();
    const syllabus = JSON.parse(fs.readFileSync('syllabus.json', 'utf8'));
    const combinations = [];
    const coverageReport = JSON.parse(fs.readFileSync('coverage_report.json', 'utf8'));
    const coverageMap = {};
    coverageReport.forEach(item => coverageMap[`${item.exam}|${item.subject}|${item.topic}`] = item.count);

    Object.keys(syllabus).forEach(exam => {
        if (exam === 'NECO') return;
        Object.keys(syllabus[exam]).forEach(subject => {
            syllabus[exam][subject].forEach(topic => {
                if ((coverageMap[`${exam}|${subject}|${topic}`] || 0) === 0) combinations.push({ exam, subject, topic });
            });
        });
    });

    for (const combo of combinations) {
        const items = await requestAI(combo.exam, combo.subject, combo.topic, "General");
        if (items.rateLimit) await delay(30000);
        else await saveToDatabase(items);
    }
}

turboCharge().catch(console.error);
