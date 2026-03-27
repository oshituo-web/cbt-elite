require('dotenv').config();
const fs = require('fs');
const { GoogleGenAI, Type } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const TOTAL_QUESTIONS_TO_GENERATE = 50000;
const BATCH_SIZE = 15;
const CONCURRENCY_LIMIT = 1; // Strict 1 to respect 15 Requests-Per-Minute Free Tier

// Initialization
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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
                        diagram_url: { type: Type.STRING, nullable: true }
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
            if (attempt === maxRetries) return { data: null, error: err };
            await delay(Math.pow(2, attempt) * 500);
        }
    }
}

async function loadKnowledgeBase() {
    console.log("Fetching database mappings and existing questions...");
    const { data: exams } = await supabase.from('exams').select('id, exam_name');
    const { data: subjects } = await supabase.from('subjects').select('id, subject_name');
    
    exams.forEach(e => examMap[e.exam_name.trim().toUpperCase()] = e.id);
    subjects.forEach(s => subjectMap[s.subject_name.trim().toUpperCase()] = s.id);
    subjects.forEach(s => subjectMap[s.subject_name.trim()] = s.id);

    let hasMore = true;
    let offset = 0;
    while (hasMore) {
        const { data: page } = await supabase.from('questions').select('question_text').range(offset, offset + 999);
        if (page && page.length > 0) {
            page.forEach(q => knowledgeBase.add(q.question_text.toLowerCase().trim()));
            offset += page.length;
            if (page.length < 1000) hasMore = false;
        } else {
            hasMore = false;
        }
    }
    console.log(`Knowledge Base ready: ${knowledgeBase.size} existing questions.`);
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

        if (!examId || !subjectId) {
            console.warn(`[SKIP] Missing Mapping - Exam: ${examName}, Subject: ${subName}`);
            continue;
        }

        let groupId = null;
        if (item.is_group && item.group_content) {
            const { data: gData, error: gErr } = await withDBRetry(() => 
                supabase.from('question_groups').insert({
                    content: item.group_content,
                    type: item.group_type || 'passage',
                    subject: subName,
                    exam_type: examName
                }).select()
            );
            if (gErr) continue;
            if (gData && gData.length > 0) groupId = gData[0].id;
        }

        const qsToInsert = [];
        const originals = [];

        for (const q of item.questions) {
            const cleanText = q.question.toLowerCase().trim();
            if (knowledgeBase.has(cleanText)) continue;
            
            qsToInsert.push({
                exam_id: examId,
                subject_id: subjectId,
                subject: subName,
                topic: q.topic,
                subtopic: q.subtopic,
                exam_type: examName,
                question_text: q.question,
                diagram_url: q.diagram_url || null,
                difficulty: (q.difficulty || 'Medium').charAt(0).toUpperCase() + (q.difficulty || 'Medium').slice(1),
                group_id: groupId,
                tags: q.tags || [],
                explanation: null
            });
            originals.push(q);
            knowledgeBase.add(cleanText); // Add instantly to memory block duplicates in same concurrent run
        }

        if (qsToInsert.length === 0) continue;

        const { data: insertedQs, error: qErr } = await withDBRetry(() => 
            supabase.from('questions').insert(qsToInsert).select()
        );
        
        if (qErr || !insertedQs) {
            console.error(`[DB Error] Questions Insert Failed:`, qErr?.message);
            continue;
        }

        const ansInserts = insertedQs.map((insQ, idx) => {
            const orig = originals[idx];
            return {
                question_id: insQ.id,
                option_a: orig.option_a,
                option_b: orig.option_b,
                option_c: orig.option_c,
                option_d: orig.option_d,
                correct_option: orig.correct_option,
                explanation: orig.explanation
            };
        });

        const { error: aErr } = await withDBRetry(() => 
            supabase.from('question_answers').upsert(ansInserts, { onConflict: 'question_id' })
        );

        if (!aErr) successCount += insertedQs.length;
    }
    
    return successCount;
}

async function requestAI(exam, subject, topic, subtopic) {
    const isScience = ['Physics', 'Chemistry', 'Biology'].includes(subject);
    
    // Few-Shot Prompting Inject
    const fewShotExample = `
EXAMPLE OF EXCELLENT QUALITY:
{
  "is_group": false,
  "questions": [
    {
      "exam_type": "JAMB", "subject": "Physics", "topic": "Mechanics", "subtopic": "Motion", "difficulty": "hard",
      "question": "A stone of mass 2kg is projected vertically upward with a velocity of 20 m/s. Calculate the maximum height reached. (g = 10 m/s²)",
      "option_a": "10 m", "option_b": "20 m", "option_c": "40 m", "option_d": "50 m", "correct_option": "B",
      "explanation": "Using v² = u² - 2gh (since moving against gravity). At maximum height, v = 0. So, 0 = 20² - 2(10)h -> 0 = 400 - 20h -> 20h = 400 -> h = 20m. Option A is a distractor for users who forget to square u."
    }
  ]
}`;

    let instruction = `Generate exactly ${BATCH_SIZE} questions prioritizing strict standard curriculum validity. Make distractors scientifically/academically plausible.`;
    if (topic === 'Comprehension') instruction = `CRITICAL: Generate ONE complete comprehension passage (approx 200-300 words). Set is_group=true, place passage in group_content, exactly 5 varying inference/vocabulary questions linked to it.`;
    if (topic === 'The Lekki Headmaster') instruction = `CRITICAL: Generate 5 questions testing exact plot details, character motives, and thematic inferences from the official 2025 JAMB novel "The Lekki Headmaster".`;
    if (isScience) instruction += ` Occasionally generate a 'data_set' group block with experimental data mapped to 3 questions. Use clear 'diagram_url' placeholders where visually required.`;

    const prompt = `You are an elite, highly-paid Examination Setter for ${exam} ${subject}.
Topic: ${topic}
Subtopic: ${subtopic}
Command: ${instruction}

${fewShotExample}

Deliver purely factual, perfectly formatted psychometric evaluations following the schema explicitly.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: generationSchema,
                temperature: 0.8,
            }
        });
        const items = JSON.parse(response.text);
        if (Array.isArray(items)) return items;
        return [];
    } catch (error) {
        if (error.status === 429 || (error.message && error.message.includes('429'))) {
            // Rate Limit
            return { rateLimit: true };
        }
        console.error(`[AI Parser Error]:`, error.message.split('\n')[0]);
        return [];
    }
}

async function turboCharge() {
    console.log(`\n\x1b[36m=== 🚀 STARTING v3 TURBO AI QUESTION GENERATOR ===\x1b[0m\n`);
    await loadKnowledgeBase();

    const syllabus = JSON.parse(fs.readFileSync('syllabus.json', 'utf8'));
    const topicsData = JSON.parse(fs.readFileSync('topics.json', 'utf8'));

    const combinations = [];
    Object.keys(syllabus).forEach(exam => {
        Object.keys(syllabus[exam]).forEach(subject => {
            syllabus[exam][subject].forEach(topic => {
                combinations.push({ exam, subject, topic });
            });
        });
    });

    combinations.sort(() => Math.random() - 0.5);

    let generatedSessionCount = 0;
    let comboIndex = 0;

    // Concurrency Worker Function
    async function worker(workerId) {
        while (generatedSessionCount < TOTAL_QUESTIONS_TO_GENERATE) {
            const combo = combinations[comboIndex % combinations.length];
            comboIndex++;
            
            let subtopic = "General";
            if (topicsData[combo.subject] && topicsData[combo.subject][combo.topic]) {
                subtopic = getRandomItem(topicsData[combo.subject][combo.topic]);
            }

            console.log(`[Worker ${workerId}] Tasked: ${combo.exam} ${combo.subject} - ${subtopic.slice(0, 20)}...`);
            
            // 1. Generate
            const genStartTime = Date.now();
            const items = await requestAI(combo.exam, combo.subject, combo.topic, subtopic);
            
            if (items.rateLimit) {
                console.warn(`[Worker ${workerId}] 🚦 Rate Limit Hit. Backing off 30s...`);
                await delay(30000);
                continue; // retry loop inherently
            }

            if (!items || items.length === 0) {
                await delay(2000); // Small breath on fail
                continue;
            }

            const reqTime = ((Date.now() - genStartTime) / 1000).toFixed(1);

            // 2. Stream to Supabase
            const dbStartTime = Date.now();
            const added = await saveToDatabase(items);
            const dbTime = ((Date.now() - dbStartTime) / 1000).toFixed(1);

            if (added > 0) {
                generatedSessionCount += added;
                console.log(`\x1b[32m[Worker ${workerId}] ✔️ Inserted ${added} Qs. | AI: ${reqTime}s, DB: ${dbTime}s | Session Total: ${generatedSessionCount}\x1b[0m`);
            } else {
                console.log(`[Worker ${workerId}] ⚠️ Ignored batch (Total Duplicates).`);
            }

            // Stagger workers to prevent simultaneous burst calls
            await delay(4500); // Wait 4.5 seconds between batches to ensure we never cross 15 RPM
        }
    }

    console.log(`Starting Engine with Concurrency: ${CONCURRENCY_LIMIT}`);
    const workers = [];
    for (let i = 1; i <= CONCURRENCY_LIMIT; i++) {
        workers.push(worker(i));
        await delay(2000); // 2-second stagger between worker startups
    }

    await Promise.all(workers);
    console.log(`\n\x1b[36m=== 🏁 TURBO GENERATION COMPLETE ===\x1b[0m`);
}

turboCharge().catch(console.error);
