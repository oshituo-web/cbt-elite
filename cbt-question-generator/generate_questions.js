require('dotenv').config();
const fs = require('fs');
const { GoogleGenAI, Type } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Configuration
const TOTAL_QUESTIONS_TO_GENERATE = 50000;
const BATCH_SIZE = 20;
const OUTPUT_FILE = 'questions.json';

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to get random item from array
const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomYear = (min = 2010, max = 2024) => Math.floor(Math.random() * (max - min + 1)) + min;

const delay = ms => new Promise(res => setTimeout(res, ms));

const questionSchema = {
    type: Type.ARRAY,
    description: "A list of generated exam questions.",
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
        required: [
            "exam_type", "subject", "topic", "subtopic", "difficulty", 
            "question", "option_a", "option_b", "option_c", "option_d", 
            "correct_option", "explanation"
        ]
    }
};

const batchQaSchema = {
    type: Type.ARRAY,
    description: "An array of QA results for each question provided.",
    items: {
        type: Type.OBJECT,
        properties: {
            is_valid: { type: Type.BOOLEAN },
            reason: { type: Type.STRING }
        },
        required: ["is_valid", "reason"]
    }
};

async function verifyBatchQuality(questions, retries = 3) {
    const prompt = `You are a strict Quality Assurance reviewer for high school exams. Review the following ${questions.length} questions.
For each question:
1. It must have exactly one correct answer matching the 'correct_option'. 
2. The explanation must be accurate. 
3. There must be no ambiguity.
4. If the question is solid, return is_valid: true. If it is confusing, factually wrong, or has multiple correct answers, return is_valid: false.

You must return an array containing exactly ${questions.length} objects. Each object corresponds to the question at the same index in the input list.

Questions to Review:
${JSON.stringify(questions, null, 2)}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-lite',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: batchQaSchema,
                    temperature: 0.1,
                }
            });

            const results = JSON.parse(response.text);
            const validated = [];

            if (!Array.isArray(results)) {
                console.error("[QA Error] AI did not return an array.");
                return [];
            }

            results.forEach((result, index) => {
                if (result.is_valid && questions[index]) {
                    validated.push(questions[index]);
                } else if (questions[index]) {
                    console.log(`[QA FAILED] Question ${index + 1} Reason: ${result.reason}`);
                }
            });

            return validated;
        } catch (error) {
            if (error.status === 429 || (error.message && (error.message.includes('429') || error.message.includes('Quota exceeded')))) {
                if (error.message && (error.message.toLowerCase().includes('perday') || error.message.toLowerCase().includes('per day') || error.message.toLowerCase().includes('limit: 1500'))) {
                    console.error(`\n[CRITICAL ERROR] You have exhausted your FREE DAILY QUOTA for Gemini! You cannot generate any more questions until tomorrow.\n`);
                    throw new Error('Daily Quota Exhausted');
                }
                console.warn(`[Rate Limit] Batch QA attempt ${attempt} failed. Retrying in 60s...`);
                await delay(60000);
            } else {
                console.error(`QA Error:`, error?.message || error);
                return [];
            }
        }
    }
    return [];
}

async function generateBatch(exam, subject, topic, subtopic, batchSize, retries = 3) {
    // Training Data: Load real exam references for "Few-Shot" prompting
    let trainingData = "";
    try {
        const refs = JSON.parse(fs.readFileSync('reference_questions.json', 'utf8'));
        const subjectRefs = refs.filter(r => r.subject === subject).slice(0, 2);
        if (subjectRefs.length > 0) {
            trainingData = "\nREFERENCE EXAMPLES (Training Data):\n" + subjectRefs.map(r => 
                `Question: ${r.question_text}\nModel Answer: ${r.model_answer}\n`
            ).join("\n---\n");
        }
    } catch (e) { /* ignore */ }

    const prompt = `You are a senior AI systems architect and expert exam setter for Nigerian secondary school students.
Generate exactly ${batchSize} high-quality, realistic multiple-choice questions for the ${exam} exam.

${trainingData}

Subject: ${subject}
Topic: ${topic}
Subtopic: ${subtopic}
Difficulty: Randomly vary between easy, medium, and hard.

Requirements:
* 4 options (A–D) provided as flat fields: option_a, option_b, option_c, option_d.
* Correct option must be exactly "A", "B", "C", or "D".
* Detailed explanation explaining the logic.
* Exam-style wording consistent with ${exam} standards.
* If a visual aid (diagram, map, graph, table, or chemical structure) would enhance the question or is required to solve it, provide a DESCRIPTIVE placeholder in 'diagram_url' using this format: https://placehold.co/600x400?text=[Detailed+Description+of+Visual+Needed+to+Solve+Question].
* If a diagram is provided, ensure the 'question' text explicitly refers to it (e.g., "Referring to the diagram below...", "In the figure shown...").
* If no visual is needed, set 'diagram_url' to null.`;




    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: questionSchema,
                    temperature: 0.7,
                }
            });

            // Parse the generated text into JSON
            const responseText = response.text;
            const questions = JSON.parse(responseText);
            return questions;
        } catch (error) {
            if (error.status === 429 || (error.message && (error.message.includes('429') || error.message.includes('Quota exceeded')))) {
                // Check if it's a daily limit
                if (error.message && (error.message.toLowerCase().includes('perday') || error.message.toLowerCase().includes('per day') || error.message.toLowerCase().includes('limit: 1500'))) {
                   console.error(`\n[CRITICAL ERROR] You have exhausted your FREE DAILY QUOTA for Gemini! You cannot generate any more questions until tomorrow.\n`);
                   throw new Error('Daily Quota Exhausted');
                }

                console.warn(`[Rate Limit] Batch generation attempt ${attempt} failed. Retrying in 60s...`);
                await delay(60000);
            } else {
                console.error(`Error generating batch for ${subject} - ${topic}:`, error?.message || error);
                return [];
            }
        }
    }
    return [];
}

async function main() {
    console.log(`Starting generation of ${TOTAL_QUESTIONS_TO_GENERATE} questions...`);
    
    // Load existing questions if the file exists to allow resuming
    let allQuestions = [];
    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            allQuestions = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
            console.log(`Loaded ${allQuestions.length} existing questions from ${OUTPUT_FILE}.`);
        } catch (e) {
            console.warn(`Could not parse ${OUTPUT_FILE}, starting fresh.`);
        }
    }

    // Load syllabus configuration files
    console.log("Loading syllabus files...");
    const syllabus = JSON.parse(fs.readFileSync('syllabus.json', 'utf8'));
    const topicsData = JSON.parse(fs.readFileSync('topics.json', 'utf8'));

    // 1. Create a flat list of all theoretical combinations for even distribution
    const combinations = [];
    Object.keys(syllabus).forEach(exam => {
        Object.keys(syllabus[exam]).forEach(subject => {
            syllabus[exam][subject].forEach(topic => {
                // Priority weighting: Add Math and English 3 times each
                const weight = (subject === 'Mathematics' || subject === 'English') ? 3 : 1;
                for (let w = 0; w < weight; w++) {
                    combinations.push({ exam, subject, topic });
                }
            });
        });
    });

    // 2. Shuffle combinations for variety
    for (let i = combinations.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combinations[i], combinations[j]] = [combinations[j], combinations[i]];
    }

    console.log(`Systematic Distribution: Found ${combinations.length} unique combinations. Starting even coverage...`);

    let generatedCount = allQuestions.length;
    const initialCount = allQuestions.length;
    let retryDelay = 2000;
    let comboIndex = 0;
    
    // Global Set to track duplicates
    const existingTexts = new Set();
    allQuestions.forEach(q => {
        if (q.question) existingTexts.add(q.question.trim().toLowerCase());
    });

    try {
        while (generatedCount < TOTAL_QUESTIONS_TO_GENERATE) {
        // 3. Get next combination in round-robin fashion
        const combo = combinations[comboIndex % combinations.length];
        comboIndex++;

        const { exam, subject, topic } = combo;
        
        // Get subtopic from topics.json
        let subtopic = "General";
        if (topicsData[subject] && topicsData[subject][topic]) {
            subtopic = getRandomItem(topicsData[subject][topic]);
        }
        
        // Calculate how many to generate in this batch (cap at BATCH_SIZE)
        const remaining = TOTAL_QUESTIONS_TO_GENERATE - generatedCount;
        const currentBatchSize = Math.min(BATCH_SIZE, remaining);

        console.log(`Generating batch of ${currentBatchSize} questions for ${exam} > ${subject} > ${topic} > ${subtopic}...`);
        
        const newQuestions = await generateBatch(exam, subject, topic, subtopic, currentBatchSize);
        
        if (newQuestions && newQuestions.length > 0) {
            console.log(`Running Automated QA on batch of ${newQuestions.length} questions...`);
            const validatedQuestions = await verifyBatchQuality(newQuestions);

            if (validatedQuestions.length > 0) {
                // strict check for completeness
                const completeQuestions = validatedQuestions.filter(q => 
                    q.question && q.question.trim().length > 10 &&
                    q.option_a && q.option_a.trim() !== '' &&
                    q.option_b && q.option_b.trim() !== '' &&
                    q.option_c && q.option_c.trim() !== '' &&
                    q.option_d && q.option_d.trim() !== '' &&
                    q.correct_option && ['A','B','C','D'].includes(q.correct_option.trim().toUpperCase())
                );
                
                // strict check for duplicates
                const uniqueQuestions = completeQuestions.filter(q => {
                    const textDesc = q.question.trim().toLowerCase();
                    if (existingTexts.has(textDesc)) return false;
                    existingTexts.add(textDesc);
                    return true;
                });
                
                const discarded = validatedQuestions.length - uniqueQuestions.length;
                if (discarded > 0) {
                    console.log(`[Validation Firewall] Discarded ${discarded} questions (Duplicates or Incomplete).`);
                }

                if (uniqueQuestions.length > 0) {
                    allQuestions = allQuestions.concat(uniqueQuestions);
                    generatedCount += uniqueQuestions.length;
                    
                    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allQuestions, null, 2));
                    console.log(`Successfully passed QA and saved ${uniqueQuestions.length} unique questions. Progress: ${generatedCount}/${TOTAL_QUESTIONS_TO_GENERATE}`);
                } else {
                     console.log(`All questions in this batch failed strict validation (duplicates/incomplete). Skipping...`);
                }
            } else {
                console.log(`All questions in this batch failed QA validation. Skipping...`);
            }
            
            // Output succeeded, reset retry delay
            retryDelay = 2000;
        } else {
            console.log(`Batch generation failed (Likely Rate Limit 429). Retrying in ${retryDelay/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            // Exponential backoff, max out at 60 seconds
            retryDelay = Math.min(retryDelay * 2, 60000);
            continue; 
        }
        
        // Add a delay between batches to stay within rate limits 
        await delay(6000);
    }
    } catch (error) {
        if (error.message === 'Daily Quota Exhausted') {
            console.error(`\n[STOPPED] API Limit Hit: ${error.message}`);
        } else {
            throw error; // Let the outer catch handle unexpected errors
        }
    } finally {
        const sessionCount = generatedCount - initialCount;
        console.log(`\n==================================================`);
        console.log(`STATION STATUS: ${generatedCount >= TOTAL_QUESTIONS_TO_GENERATE ? 'COMPLETED' : 'STOPPED'}`);
        console.log(`Questions generated this session: ${sessionCount}`);
        console.log(`Total questions in ${OUTPUT_FILE}: ${generatedCount}/${TOTAL_QUESTIONS_TO_GENERATE}`);
        console.log(`==================================================\n`);
    }
}

main().catch(console.error);
