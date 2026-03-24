require('dotenv').config();
const fs = require('fs');
const { GoogleGenAI, Type } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Configuration
const BATCH_SIZE = 10;
const OUTPUT_FILE = 'theory_questions.json';

const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const delay = ms => new Promise(res => setTimeout(res, ms));

const theoryQuestionSchema = {
    type: Type.ARRAY,
    description: "A list of generated theory exam questions.",
    items: {
        type: Type.OBJECT,
        properties: {
            exam_type: { type: Type.STRING },
            subject: { type: Type.STRING },
            topic: { type: Type.STRING },
            subtopic: { type: Type.STRING },
            difficulty: { type: Type.STRING, enum: ['easy', 'medium', 'hard'] },
            question: { type: Type.STRING },
            model_answer: { type: Type.STRING },
            key_points: { 
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3-5 essential points required for a full score."
            },
            marking_scheme: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        point: { type: Type.STRING },
                        keywords: { 
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "Essential keywords or phrases to match for this point."
                        },
                        marks: { type: Type.NUMBER, description: "Marks awarded for this point." }
                    },
                    required: ["point", "keywords", "marks"]
                },
                description: "Detailed rubric for keyword-based grading."
            },
            max_score: { type: Type.NUMBER, description: "Maximum marks for this question (usually 5)." }
        },
        required: [
            "exam_type", "subject", "topic", "subtopic", "difficulty", 
            "question", "model_answer", "key_points", "marking_scheme", "max_score"
        ]
    }
};

async function generateTheoryBatch(exam, subject, topic, subtopic, batchSize, references = [], retries = 3) {
    // 1. Find a relevant style reference
    let referenceText = "";
    const relevantRef = references.find(r => r.subject === subject) || getRandomItem(references);
    if (relevantRef) {
        referenceText = `
--- REFERENCE EXAMPLE FROM REAL ${relevantRef.exam_type} EXAM ---
Subject: ${relevantRef.subject}
Question: ${relevantRef.question}
Model Answer: ${relevantRef.model_answer}
Marking Scheme: ${relevantRef.key_points.join(', ')}
--- END REFERENCE ---
`;
    }

    const prompt = `You are a senior examiner for WAEC and NECO exams in Nigeria.
Generate exactly ${batchSize} high-quality theory (essay-style) questions following the official exam format.
${referenceText}

Subject: ${subject}
Topic: ${topic}
Subtopic: ${subtopic}
Difficulty: Randomly vary within the batch.

Format Requirements:
1. Structure: Match the ${relevantRef ? 'style of the reference above' : 'official multipart style'} (e.g., "1(a) [2 marks]. (b) [3 marks]").
2. Marks: Always include point-allocation in square brackets like [2 marks] or [5 marks].
3. Command Verbs: Use standard WAEC/NECO verbs: "List", "Define", "Describe", "Differentiate", "Calculate".
4. Content: Must be curriculum-accurate and at the Senior Secondary (SS3) level.
5. Model Answer: Provide a structured response like the reference example.
6. Marking Scheme: Provide a structured rubric (array of objects). Each object must have:
   - 'point': The specific sub-task or concept being graded (e.g., "Definition of X").
   - 'keywords': A 2-4 word list of essential terms required to earn this point (e.g., ["kinetic", "motion", "temperature"]).
   - 'marks': The numeric value for this point (usually 1 or 2). Total marks must match 'max_score'.
7. Key Points: A legacy simple string list for summary display.

Ensure 'exam_type' matches "${exam}".`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: theoryQuestionSchema,
                    temperature: 0.8,
                }
            });

            return JSON.parse(response.text);
        } catch (error) {
            console.error(`Generation error (attempt ${attempt}):`, error.message);
            if (attempt < retries) await delay(5000);
            else return [];
        }
    }
    return [];
}

async function main() {
    const syllabus = JSON.parse(fs.readFileSync('syllabus.json', 'utf8'));
    const topicsData = JSON.parse(fs.readFileSync('topics.json', 'utf8'));
    const references = fs.existsSync('reference_questions.json') ? JSON.parse(fs.readFileSync('reference_questions.json', 'utf8')) : [];
    
    let allQuestions = [];
    if (fs.existsSync(OUTPUT_FILE)) {
        allQuestions = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    }

    // 1. Create a flat list of all theoretical combinations
    const theoryExams = ['WAEC', 'NECO'];
    const combinations = [];

    for (const exam of theoryExams) {
        const subjects = Object.keys(syllabus[exam] || {});
        for (const subject of subjects) {
            const topics = syllabus[exam][subject] || [];
            for (const topic of topics) {
                // Priority weighting: Add Math and English 3 times each
                const weight = (subject === 'Mathematics' || subject === 'English') ? 3 : 1;
                for (let w = 0; w < weight; w++) {
                    combinations.push({ exam, subject, topic });
                }
            }
        }
    }

    // 2. Shuffle combinations for variety
    for (let i = combinations.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combinations[i], combinations[j]] = [combinations[j], combinations[i]];
    }

    console.log(`Systematic Distribution: Found ${combinations.length} unique Exam-Subject-Topic combinations.`);
    
    let comboIndex = 0;
    const NUM_BATCHES = 500; // Increased to run much longer

    for (let i = 0; i < NUM_BATCHES; i++) {
        // 3. Get next combination in round-robin fashion
        const combo = combinations[comboIndex % combinations.length];
        comboIndex++;

        const { exam, subject, topic } = combo;
        const subtopic = (topicsData[subject] && topicsData[subject][topic]) ? getRandomItem(topicsData[subject][topic]) : "General";

        console.log(`[Batch ${i+1}/${NUM_BATCHES}] Target: ${exam} > ${subject} > ${topic}`);
        const batch = await generateTheoryBatch(exam, subject, topic, subtopic, BATCH_SIZE, references);
        
        if (batch.length > 0) {
            allQuestions = allQuestions.concat(batch);
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allQuestions, null, 2));
            console.log(`Saved ${batch.length} new theory questions.`);
        }
        await delay(3000);
    }
}

main().catch(console.error);
