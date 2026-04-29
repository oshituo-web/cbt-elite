require('dotenv').config();
const fs = require('fs');
const { GoogleGenAI, Type } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY.trim());

const BATCH_SIZE = 5; // Generate 5 questions per topic
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
    await log(`Generating for ${exam} > ${subject} > ${topic}...`);
    
    const prompt = `Generate ${BATCH_SIZE} high-quality ${exam} multiple-choice questions for ${subject}, topic: ${topic}.
Include clear explanation and 4 options (A, B, C, D) with one correct answer.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: questionSchema,
                temperature: 0.7,
            }
        });

        const questions = JSON.parse(response.text);
        
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
                await log(`Error inserting question for ${topic}: ${qErr.message}`);
                continue;
            }

            const { error: aErr } = await supabase.from('answers').insert(q.options.map(opt => ({
                question_id: qData.id,
                option_letter: opt.letter,
                option_text: opt.text,
                is_correct: opt.is_correct
            })));
            
            if (aErr) await log(`Error inserting answers for ${topic}: ${aErr.message}`);
        }
        await log(`Successfully added ${questions.length} questions for ${topic}.`);
    } catch (error) {
        await log(`Error generating for ${topic}: ${error.message}`);
    }
}

async function main() {
    const missingTopics = JSON.parse(fs.readFileSync('missing_topics.json', 'utf8'));
    for (const { exam, subject, topic } of missingTopics) {
        await generateQuestions(exam, subject, topic);
        await delay(5000); // Respect rate limits
    }
}

main().catch(console.error);
