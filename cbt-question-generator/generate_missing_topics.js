require('dotenv').config();
const fs = require('fs');
const { GoogleGenAI, Type } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY.trim());

const BATCH_SIZE = 10; // Increased for faster population
const MODELS = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp', 'gemini-1.5-flash-8b'];
const delay = ms => new Promise(res => setTimeout(res, ms));

const questionSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            question_text: { type: Type.STRING },
            explanation: { type: Type.STRING },
            options: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        letter: { type: Type.STRING },
                        text: { type: Type.STRING },
                        is_correct: { type: Type.BOOLEAN }
                    }
                }
            }
        },
        required: ["question_text", "explanation", "options"]
    }
};

const logStream = fs.createWriteStream('generation_log.txt', { flags: 'a' });

async function log(message) {
    console.log(message);
    logStream.write(`${new Date().toISOString()}: ${message}\n`);
}

async function generateQuestions(exam, subject, topic) {
    await log(`[AI] Starting generation for ${exam} > ${subject} > ${topic}...`);
    
    const prompt = `Generate ${BATCH_SIZE} high-quality ${exam} multiple-choice questions for ${subject}, topic: ${topic}.
Include clear explanation and 4 options (A, B, C, D) with one correct answer. Use LaTeX for any mathematical formulas.`;

    let success = false;
    for (const modelName of MODELS) {
        if (success) break;
        try {
            await log(`[Model] Trying ${modelName}...`);
            const response = await ai.models.generateContent({
                model: modelName,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: questionSchema,
                    temperature: 0.7,
                }
            });

            const questions = JSON.parse(response.text);
            await log(`[AI] Received ${questions.length} questions from ${modelName}. Inserting to DB...`);
            
            for (const q of questions) {
                const { data: qData, error: qErr } = await supabase
                    .from('questions')
                    .insert({
                        exam_type: exam,
                        subject: subject,
                        topic: topic,
                        question_text: q.question_text,
                        explanation: q.explanation,
                        difficulty: 'Medium'
                    })
                    .select()
                    .single();
                
                if (qErr) {
                    await log(`[Error] DB Insert Failed: ${qErr.message}`);
                    continue;
                }

                const { error: aErr } = await supabase.from('question_answers').insert({
                    question_id: qData.id,
                    option_a: q.options.find(o => o.letter === 'A')?.text || '',
                    option_b: q.options.find(o => o.letter === 'B')?.text || '',
                    option_c: q.options.find(o => o.letter === 'C')?.text || '',
                    option_d: q.options.find(o => o.letter === 'D')?.text || '',
                    correct_option: q.options.find(o => o.is_correct)?.letter || 'A',
                    explanation: q.explanation
                });
                
                if (aErr) await log(`[Error] Answers Insert Failed: ${aErr.message}`);
            }
            await log(`[Success] Completed ${topic} using ${modelName}.`);
            success = true;
        } catch (error) {
            if (error.message.includes('429') || error.message.includes('Quota')) {
                await log(`[Quota] ${modelName} exhausted. Falling back...`);
                continue;
            }
            await log(`[Critical] Error with ${modelName}: ${error.message}`);
        }
    }
    
    if (!success) {
        await log(`[Failed] All models exhausted for topic: ${topic}.`);
    }
}

async function main() {
    const missingTopics = JSON.parse(fs.readFileSync('missing_topics.json', 'utf8'));
    await log(`[Start] Processing ${missingTopics.length} missing topics.`);
    
    for (let i = 0; i < missingTopics.length; i++) {
        const { exam, subject, topic } = missingTopics[i];
        await log(`[Progress] ${i + 1}/${missingTopics.length}`);
        await generateQuestions(exam, subject, topic);
        await delay(5000); // Guard against spam blocks
    }
    await log(`[End] Finished generation run.`);
}

main().catch(console.error);
