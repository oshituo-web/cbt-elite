require('dotenv').config();
const fs = require('fs');
const { GoogleGenAI, Type } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TOTAL_QUESTIONS_TO_GENERATE = 50000;
const BATCH_SIZE = 15; // Adjusted batch size for grouping complexity
const OUTPUT_FILE = 'questions_v2.json';

const delay = ms => new Promise(res => setTimeout(res, ms));
const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Enhanced Schema to support standalone questions OR grouped questions (passages/diagrams)
const generationSchema = {
    type: Type.ARRAY,
    description: "A list of question items. An item can either be a standalone question or a 'group' containing a shared passage/data-set and multiple questions.",
    items: {
        type: Type.OBJECT,
        properties: {
            is_group: { type: Type.BOOLEAN, description: "True if this is a group of questions sharing a passage, map, or data set." },
            group_content: { type: Type.STRING, nullable: true, description: "The reading passage, dataset, or diagram description if is_group is true." },
            group_type: { type: Type.STRING, enum: ['passage', 'map', 'graph', 'data_set', 'instruction'], nullable: true },
            questions: {
                type: Type.ARRAY,
                description: "Array of exactly 1 question if is_group is false. If is_group is true, 3 to 5 questions relating to the group_content.",
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
                        diagram_url: { type: Type.STRING, nullable: true, description: "If a specific image is needed for this question, provide a detailed description here using https://placehold.co/600x400?text=[Description]" }
                    },
                    required: ["exam_type", "subject", "topic", "subtopic", "difficulty", "question", "option_a", "option_b", "option_c", "option_d", "correct_option", "explanation"]
                }
            }
        },
        required: ["is_group", "questions"]
    }
};

const batchQaSchema = {
    type: Type.ARRAY,
    description: "An array of QA results for each item provided.",
    items: {
        type: Type.OBJECT,
        properties: {
            is_valid: { type: Type.BOOLEAN },
            reason: { type: Type.STRING }
        },
        required: ["is_valid", "reason"]
    }
};

async function verifyBatchQuality(items, retries = 3) {
    const prompt = `You are a strict Quality Assurance reviewer for high school exams (JAMB, WAEC, NECO). Review the following items.
For each item:
1. Verify each question has exactly 4 options and 1 correct answer matching 'correct_option'.
2. If is_group is true, ensure the 'group_content' is sufficiently detailed and the questions logically depend on it.
3. Ensure the explanation is accurate and educational.
4. Return an array of validation objects corresponding to the input items array index.

Items to Review:
${JSON.stringify(items, null, 2)}`;

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

            if (!Array.isArray(results)) return [];

            results.forEach((result, index) => {
                if (result.is_valid && items[index]) {
                    validated.push(items[index]);
                } else if (items[index]) {
                    console.log(`[QA FAILED] Item ${index + 1} Reason: ${result.reason}`);
                }
            });

            return validated;
        } catch (error) {
            if (error.status === 429 || (error.message && error.message.includes('429'))) {
                await delay(30000);
            } else {
                return [];
            }
        }
    }
    return [];
}

async function generateBatch(exam, subject, topic, subtopic, batchSize, retries = 3) {
    const isEnglishOrLit = subject === 'English' || subject === 'Literature';
    const isScience = ['Physics', 'Chemistry', 'Biology', 'Geography'].includes(subject);

    let specificInstructions = '';
    if (topic === 'Comprehension') {
        specificInstructions = `CRITICAL: Generate ONE complete comprehension passage (approx 200-300 words) suitable for ${exam} level. Set is_group to true, place the passage in group_content, and generate exactly 5 varying questions based on it.`;
    } else if (topic === 'The Lekki Headmaster') {
        specificInstructions = `CRITICAL: This is the official 2025 JAMB novel. Generate exactly 5 questions testing comprehension of character, plot, and themes from "The Lekki Headmaster" by Kabir Garba. Ensure high fidelity matching the actual plot details of the book.`;
    } else if (isScience) {
        specificInstructions = `For subjects like ${subject}, you may generate a data set, graph description, or experiment setup using is_group=true and generate 3 linked questions. Otherwise, generate standalone questions. If an anatomical or physical diagram is needed, use the diagram_url placeholder specifying exactly what to draw.`;
    } else {
        specificInstructions = `Generate a mix of standalone questions. Ensure high quality and strict curriculum alignment for ${exam} > ${subject} > ${topic} > ${subtopic}.`;
    }

    const prompt = `You are a senior AI systems architect and expert exam setter (JAMB/WAEC/NECO).
Generate roughly ${batchSize} high-quality questions for the subject: ${subject}.

Exam: ${exam}
Topic: ${topic}
Subtopic: ${subtopic}

${specificInstructions}

Requirements:
- Strict psychometric principles: Distractors must be plausible.
- 4 options (A-D).
- Detailed explanation for WHY the correct answer is right and others are wrong.
- Visual Placeholders: If a graph, map, or diagram is MANDATORY, put an explicit description in 'diagram_url'. Format: "https://placehold.co/600x400?text=[Explicit+Instruction+For+Human+Artist]"`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro', // Using pro model for higher reasoning on passages
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: generationSchema,
                    temperature: 0.7,
                }
            });
            return JSON.parse(response.text);
        } catch (error) {
            if (error.status === 429 || (error.message && error.message.includes('429'))) {
                console.warn(`[Rate Limit] Attempt ${attempt} failed. Retrying...`);
                await delay(60000);
            } else {
                console.error(`Generation Error: ${error.message}`);
                return [];
            }
        }
    }
    return [];
}

async function main() {
    console.log(`Starting Enhanced Question Generation Framework...`);
    
    let allItems = [];
    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            allItems = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
            console.log(`Loaded ${allItems.length} existing items.`);
        } catch (e) {
            console.warn(`Starting fresh. \${OUTPUT_FILE} not found.`);
        }
    }

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

    // Shuffle
    combinations.sort(() => Math.random() - 0.5);

    let generatedCount = allItems.reduce((acc, item) => acc + item.questions.length, 0);
    let comboIndex = 0;

    while (generatedCount < TOTAL_QUESTIONS_TO_GENERATE) {
        const combo = combinations[comboIndex % combinations.length];
        comboIndex++;
        
        let subtopic = "General";
        if (topicsData[combo.subject] && topicsData[combo.subject][combo.topic]) {
            subtopic = getRandomItem(topicsData[combo.subject][combo.topic]);
        }

        console.log(`Generating: ${combo.exam} > ${combo.subject} > ${combo.topic} > ${subtopic} (Current: ${generatedCount})`);
        
        const generatedItems = await generateBatch(combo.exam, combo.subject, combo.topic, subtopic, BATCH_SIZE);
        
        if (generatedItems && generatedItems.length > 0) {
            console.log(`QA Verifying...`);
            const validated = await verifyBatchQuality(generatedItems);
            
            if (validated.length > 0) {
                allItems = allItems.concat(validated);
                fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allItems, null, 2));
                const addedQuestions = validated.reduce((acc, item) => acc + item.questions.length, 0);
                generatedCount += addedQuestions;
                console.log(`\x1b[32mSuccess! Added ${addedQuestions} questions. Progress: ${generatedCount}/${TOTAL_QUESTIONS_TO_GENERATE}\x1b[0m`);
            }
        }
        await delay(5000);
    }
    console.log("Complete!");
}

main().catch(console.error);
