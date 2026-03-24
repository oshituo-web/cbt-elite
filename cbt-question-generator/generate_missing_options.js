require('dotenv').config();
const fs = require('fs');
const { GoogleGenAI, Type } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const INPUT_FILE = 'incomplete.json';

const repairSchema = {
    type: Type.ARRAY,
    description: "A list of restored complete options and explanations corresponding exactly to the provided questions.",
    items: {
        type: Type.OBJECT,
        properties: {
            question: { type: Type.STRING },
            option_a: { type: Type.STRING },
            option_b: { type: Type.STRING },
            option_c: { type: Type.STRING },
            option_d: { type: Type.STRING },
            correct_option: { type: Type.STRING, enum: ['A', 'B', 'C', 'D'] },
            explanation: { type: Type.STRING }
        },
        required: [
            "question", "option_a", "option_b", "option_c", "option_d", 
            "correct_option", "explanation"
        ]
    }
};

const delay = ms => new Promise(res => setTimeout(res, ms));

async function repairBatch(exam, subject, topic, qBatch, retries = 3) {
    const prompt = `You are a high school examiner for Nigerian students. 
Below is a list of exactly ${qBatch.length} multiple-choice questions for the ${exam} exam (${subject} > ${topic}) that are MISSING their options.

Your job is to generate 4 highly realistic and academically accurate options (A-D), pick the correct option, and write a detailed logic explanation for EACH question given below.

Questions to repair:
${qBatch.map((q, i) => `${i + 1}. ${q.question}`).join('\n')}

Requirements:
- You must return an array of exactly ${qBatch.length} objects.
- Each object must include the EXACT original "question" text so we can match it back.
- 4 options (A-D) as flat strings.
- correct_option must be EXACTLY "A", "B", "C", or "D".
- A comprehensive explanation.`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: repairSchema,
                    temperature: 0.7,
                }
            });

            const results = JSON.parse(response.text);
            return results;
        } catch (error) {
            if (error.status === 429 || (error.message && (error.message.includes('429') || error.message.includes('Quota exceeded')))) {
                if (error.message && (error.message.toLowerCase().includes('perday') || error.message.toLowerCase().includes('per day') || error.message.toLowerCase().includes('limit: 1500'))) {
                    console.error(`\n[CRITICAL ERROR] FREE DAILY QUOTA EXHAUSTED! Try again tomorrow.\n`);
                    throw new Error('Daily Quota Exhausted');
                }
                console.warn(`[Rate Limit] Repair attempt ${attempt} failed. Retrying in 60s...`);
                await delay(60000);
            } else {
                console.error(`Error repairing batch:`, error?.message || error);
                return [];
            }
        }
    }
    return [];
}

async function main() {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error("Missing incomplete.json!");
        return;
    }

    const grouped = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    let masterQuestions = JSON.parse(fs.readFileSync('questions.json', 'utf8'));
    
    // Build a Set of already repaired questions to skip them
    const alreadyRepaired = new Set(
        masterQuestions
            .filter(mq => mq.option_a || mq.correct_option)
            .map(mq => mq.question || mq.question_text)
    );
    
    console.log(`Knowledge Base: Skipping ${alreadyRepaired.size} questions that are already complete.`);
    let repairedCount = 0;

    try {
        for (const exam of Object.keys(grouped)) {
            for (const subject of Object.keys(grouped[exam])) {
                for (const topic of Object.keys(grouped[exam][subject])) {
                    const questions = grouped[exam][subject][topic].filter(q => !alreadyRepaired.has(q.question));
                    
                    if (questions.length === 0) continue;

                    // Process in chunks of 5 to not overwhelm AI
                    for (let i = 0; i < questions.length; i += 5) {
                        const chunk = questions.slice(i, i + 5);
                        console.log(`\nRepairing ${chunk.length} questions for ${exam} > ${subject} > ${topic}...`);
                        
                        const repaired = await repairBatch(exam, subject, topic, chunk);
                        
                        if (repaired && repaired.length > 0) {
                            // Merge into master list
                            repaired.forEach(rp => {
                                // Find original
                                const targetIdx = masterQuestions.findIndex(mq => 
                                    (mq.question || mq.question_text) === rp.question
                                );
                                
                                if (targetIdx !== -1) {
                                    // Inject fixed data
                                    masterQuestions[targetIdx].option_a = rp.option_a;
                                    masterQuestions[targetIdx].option_b = rp.option_b;
                                    masterQuestions[targetIdx].option_c = rp.option_c;
                                    masterQuestions[targetIdx].option_d = rp.option_d;
                                    masterQuestions[targetIdx].correct_option = rp.correct_option;
                                    masterQuestions[targetIdx].explanation = rp.explanation;
                                    // Delete old bad structures
                                    delete masterQuestions[targetIdx].options;
                                    delete masterQuestions[targetIdx].answers;
                                    repairedCount++;
                                }
                            });
                            
                            // Save periodically
                            fs.writeFileSync('questions.json', JSON.stringify(masterQuestions, null, 2));
                            console.log(`Saved ${repaired.length} restored questions. Total repaired so far: ${repairedCount}`);
                        }
                        
                        // rate limit buffer
                        await delay(5000);
                    }
                }
            }
        }
    } catch (e) {
        if (e.message !== 'Daily Quota Exhausted') console.error(e);
    }
    
    console.log(`\n==================================================`);
    console.log(`REPAIR JOB FINISHED. Total questions completely fixed: ${repairedCount}`);
    console.log(`You can now run 'node import_questions.js' to upload them!`);
    console.log(`==================================================\n`);
}

main();
