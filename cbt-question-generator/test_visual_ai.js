require('dotenv').config();
const { GoogleGenAI, Type } = require('@google/genai');
const fs = require('fs');

const ai = new GoogleGenAI({ apiKey: (process.env.GEMINI_API_KEY || "").trim() });

const generationSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            questions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        exam_type: { type: Type.STRING },
                        subject: { type: Type.STRING },
                        topic: { type: Type.STRING },
                        subtopic: { type: Type.STRING },
                        question: { type: Type.STRING },
                        option_a: { type: Type.STRING },
                        option_b: { type: Type.STRING },
                        option_c: { type: Type.STRING },
                        option_d: { type: Type.STRING },
                        correct_option: { type: Type.STRING },
                        explanation: { type: Type.STRING },
                        diagram_type: { type: Type.STRING, nullable: true },
                        diagram_svg: { type: Type.STRING, nullable: true }
                    },
                    required: ["exam_type", "subject", "topic", "question", "option_a", "option_b", "option_c", "option_d", "correct_option"]
                }
            }
        }
    }
};

async function testAI() {
    console.log("Sending...");
    let instruction = `Generate 1 geometry question. Set diagram_type='svg' and diagram_svg='<svg></svg>'.`;
    const prompt = `Command: ${instruction}`;

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
        
        fs.writeFileSync('result_test.txt', response.text || 'text property empty', 'utf8');
        console.log("Done.");
    } catch (err) {
        fs.writeFileSync('result_test.txt', JSON.stringify({message: err.message, status: err.status}), 'utf8');
    }
}

testAI();
