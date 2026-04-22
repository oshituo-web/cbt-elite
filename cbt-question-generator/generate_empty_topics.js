require('dotenv').config();
const fs = require('fs');
const { GoogleGenAI, Type } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const TOTAL_QUESTIONS_TO_GENERATE = 100; // Large unattended run
const BATCH_SIZE = 15;
const CONCURRENCY_LIMIT = 1; // Strict 1 to respect 15 Requests-Per-Minute Free Tier

// TARGET FOCUS (Set to null for full run)
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
            console.error(`[DB Retry Error] Attempt ${attempt}:`, err.message, err.cause ? `| Cause: ${err.cause.message}` : '');
            if (attempt === maxRetries) return { data: null, error: err };
            await delay(Math.pow(2, attempt) * 500);
        }
    }
}

async function loadKnowledgeBase() {
    console.log("Fetching database mappings and existing questions...");
    try {
        const { data: exams, error: eErr } = await supabase.from('exams').select('id, exam_name');
        if (eErr) throw eErr;
        const { data: subjects, error: sErr } = await supabase.from('subjects').select('id, subject_name');
        if (sErr) throw sErr;
        
        exams.forEach(e => examMap[e.exam_name.trim().toUpperCase()] = e.id);
        subjects.forEach(s => subjectMap[s.subject_name.trim().toUpperCase()] = s.id);
        subjects.forEach(s => subjectMap[s.subject_name.trim()] = s.id);

        // OPTIMIZATION: Only load the most recent 2,000 questions to speed up startup.
        // Checking against 2k recent questions is usually enough to catch duplicates in a session.
        const { data: recentQs, error: pErr } = await supabase.from('questions')
            .select('question_text')
            .order('created_at', { ascending: false })
            .limit(2000);
            
        if (pErr) throw pErr;
        if (recentQs) {
            recentQs.forEach(q => knowledgeBase.add(q.question_text.toLowerCase().trim()));
        }
        console.log(`Knowledge Base ready: ${knowledgeBase.size} existing questions.`);
    } catch (err) {
        console.error(`[Knowledge Base Error]:`, err.message, err.cause ? `| Cause: ${err.cause.message}` : '');
        process.exit(1);
    }
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
                diagram_type: q.diagram_type || 'none',
                diagram_svg: q.diagram_svg || null,
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
        
        if (qErr) {
            // Handle Postgres error code 23505 (Unique Violation)
            if (qErr.code === '23505') {
                console.warn(`[DB Status] Batch contains duplicate(s) - Switching to safe per-question insert...`);
                for (let i = 0; i < qsToInsert.length; i++) {
                   const { data: singleQ, error: sErr } = await supabase.from('questions').insert(qsToInsert[i]).select();
                   if (!sErr && singleQ && singleQ.length > 0) {
                       // Successfully inserted unique question
                       try {
                           const orig = originals[i];
                           const qId = singleQ[0].id;
                           
                           // Insert into answers table
                           const ansRows = ['A', 'B', 'C', 'D'].map(letter => ({
                               question_id: qId,
                               option_letter: letter,
                               option_text: orig[`option_${letter.toLowerCase()}`],
                               is_correct: orig.correct_option === letter
                           }));
                           await supabase.from('answers').insert(ansRows);

                           // Insert into gated explanations table
                           if (orig.explanation) {
                               await supabase.from('question_explanations').upsert({
                                   question_id: qId,
                                   explanation: orig.explanation
                               }, { onConflict: 'question_id' });
                           }
                           successCount++;
                       } catch (e) { 
                           console.error(`[DB Error] Single row recovery failed:`, e.message);
                       }
                   }
                }
            } else {
                console.error(`[DB Error] Questions Insert Failed:`, qErr?.message);
            }
            continue;
        }

        if (!insertedQs) continue;

        const ansInserts = [];
        const expInserts = [];

        insertedQs.forEach((insQ, idx) => {
            const orig = originals[idx];
            ['A', 'B', 'C', 'D'].forEach(letter => {
                ansInserts.push({
                    question_id: insQ.id,
                    option_letter: letter,
                    option_text: orig[`option_${letter.toLowerCase()}`],
                    is_correct: orig.correct_option === letter
                });
            });

            if (orig.explanation) {
                expInserts.push({
                    question_id: insQ.id,
                    explanation: orig.explanation
                });
            }
        });

        const { error: aErr } = await withDBRetry(() => 
            supabase.from('answers').insert(ansInserts)
        );

        if (expInserts.length > 0) {
            await withDBRetry(() => 
                supabase.from('question_explanations').upsert(expInserts, { onConflict: 'question_id' })
            );
        }

        // Also ensure this topic exists in syllabus_topics for the frontend selector
        const uniqueTopicsInBatch = [...new Set(qsToInsert.map(q => q.topic))];
        for (const topic of uniqueTopicsInBatch) {
            try {
                // We use a manual check since we might not have a unique constraint yet
                const { data: existing } = await withDBRetry(() => 
                    supabase.from('syllabus_topics').select('id').match({ subject_id: subjectId, exam_id: examId, topic }).maybeSingle()
                );
                if (!existing) {
                    await withDBRetry(() => 
                        supabase.from('syllabus_topics').insert({ subject_id: subjectId, exam_id: examId, topic })
                    );
                }
            } catch (e) {
                console.warn(`[Syllabus Sync] Failed to register topic: ${topic}`);
            }
        }

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
    
    // Visual Integration Logic
    instruction += `
VISUAL CONTENT REQUIREMENT:
For Mathematics, Physics, Chemistry, and Economics:
- If a question requires a graph (e.g. Supply/Demand, Velocity-Time, Waveforms), set diagram_type='graph' and construct a valid QuickChart.io URL in diagram_url. 
  Example: https://quickchart.io/chart?c={type:'line',data:{labels:[0,1,2,3],datasets:[{label:'Velocity',data:[0,10,20,30]}]}}
- If a question requires a geometry or circuit diagram, set diagram_type='svg' and provide valid, minified SVG XML code in diagram_svg. 
- IMPORTANT: Use viewBox='0 0 400 300' for SVGs and ensure stroke='black' or similar dark colors for visibility.
- Ensure diagrams are mentioned in the question text (e.g. "From the diagram above...").`;

    if (topic === 'Comprehension') instruction = `CRITICAL: Generate ONE complete comprehension passage (approx 200-300 words). Set is_group=true, place passage in group_content, exactly 5 varying inference/vocabulary questions linked to it.`;
    if (topic === 'The Lekki Headmaster') instruction = `CRITICAL: Generate 5 questions testing exact plot details, character motives, and thematic inferences from the official 2025 JAMB novel "The Lekki Headmaster".`;
    if (isScience) instruction += ` Occasionally generate a 'data_set' group block with experimental data mapped to 3 questions. Use clear 'diagram_url' placeholders where visually required for biological illustrations.`;

    const prompt = `You are an elite, highly-paid Examination Setter for ${exam} ${subject}.
Topic: ${topic}
Subtopic: ${subtopic}
Command: ${instruction}

${fewShotExample}

Deliver purely factual, perfectly formatted psychometric evaluations following the schema explicitly. Use diagram_type and diagram_svg/diagram_url whenever a visual aid improves the educational quality.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: generationSchema,
                temperature: 0.8,
            }
        }, { timeout: 30000 }); // Explicit 30s timeout for stability
        
        const text = response.text;
        try {
            const items = JSON.parse(text);
            if (Array.isArray(items)) return items;
            return [];
        } catch (jsonError) {
            console.error(`[AI Parser Error]: JSON parsing failed. Attempting cleanup...`);
            // Attempt to extract JSON from markdown blocks if they exist
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                try {
                    const extracted = JSON.parse(jsonMatch[0]);
                    return Array.isArray(extracted) ? extracted : [];
                } catch (e) {
                    console.error("[AI Parser Error]: Manual cleanup failed.");
                }
            }
            console.error(`[AI Parser Error Detail]:`, jsonError.message, "\nRaw Text Preview:", text.slice(0, 100) + "...");
            return [];
        }
    } catch (error) {
        if (error.status === 429 || (error.message && error.message.includes('429'))) {
            return { rateLimit: true };
        }
        console.error(`[AI Parser Error]:`, error.message, error.cause ? `| Cause: ${error.cause.message}` : '');
        return [];
    }
}

async function turboCharge() {
    console.log(`\n\x1b[36m=== 🚀 STARTING v3 TURBO AI QUESTION GENERATOR ===\x1b[0m\n`);
    await loadKnowledgeBase();

    const syllabus = JSON.parse(fs.readFileSync('syllabus.json', 'utf8'));
    const topicsData = JSON.parse(fs.readFileSync('topics.json', 'utf8'));

    const combinations = [];
    const coverageReport = JSON.parse(fs.readFileSync('coverage_report.json', 'utf8'));
    const coverageMap = {};
    coverageReport.forEach(item => {
        coverageMap[`${item.exam}|${item.subject}|${item.topic}`] = item.count;
    });

    Object.keys(syllabus).forEach(exam => {
        if (exam === 'NECO') return; // Pause NECO as per user request
        if (TARGET_EXAM && exam !== TARGET_EXAM) return; // Targeted Filter
        
        Object.keys(syllabus[exam]).forEach(subject => {
            if (TARGET_SUBJECTS && TARGET_SUBJECTS.length > 0 && !TARGET_SUBJECTS.includes(subject)) return; // Targeted Filter
            
            syllabus[exam][subject].forEach(topic => {
                const currentCount = coverageMap[`${exam}|${subject}|${topic}`] || 0;
                // STRICT EMPTY TOPIC TARGETING
                if (currentCount === 0) {
                    combinations.push({ 
                        exam, 
                        subject, 
                        topic, 
                        currentCount 
                    });
                }
            });
        });
    });

    // Strategy: Prioritize Core Subjects first (Math, English, Sciences, etc.)
    const CORE_PRIORITY = ['Mathematics', 'English', 'Physics', 'Chemistry', 'Biology', 'Economics', 'Government', 'Civic'];
    
    combinations.sort((a, b) => {
        const aIsCore = CORE_PRIORITY.includes(a.subject);
        const bIsCore = CORE_PRIORITY.includes(b.subject);
        
        if (aIsCore && !bIsCore) return -1;
        if (!aIsCore && bIsCore) return 1;
        
        // Randomize within same priority group
        return Math.random() - 0.5;
    });

    if (combinations.length === 0) {
        console.log(`\n\x1b[32m=== 🎉 NO EMPTY TOPICS FOUND! EVERY TOPIC HAS >= 1 QUESTION! ===\x1b[0m`);
        return;
    }

    console.log(`\n\x1b[33mFound ${combinations.length} totally empty syllabus topics. Commencing aggressive targeting...\x1b[0m\n`);

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

            // Real-time Visual Preview
            items.forEach(item => {
                if (item.questions) {
                  item.questions.forEach((q, idx) => {
                    console.log(`  \x1b[35m↳ Q${idx + 1}:\x1b[0m ${q.question.slice(0, 120)}${q.question.length > 120 ? '...' : ''}`);
                    console.log(`    \x1b[34m(A)\x1b[0m ${q.option_a.slice(0, 40)} \x1b[34m(B)\x1b[0m ${q.option_b.slice(0, 40)} \x1b[34m(C)\x1b[0m ${q.option_c.slice(0, 40)} \x1b[34m(D)\x1b[0m ${q.option_d.slice(0, 40)} [\x1b[32mAns: ${q.correct_option}\x1b[0m]`);
                  });
                }
            });

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
            // 4.5s delay + ~4s AI processing time = ~8.5s per request (~7 RPM). Safe and Fast.
            await delay(4500); 
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
