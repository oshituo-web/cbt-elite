require('dotenv').config();
const { GoogleGenAI, Type } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

async function testGeneration() {
    console.log("Testing generation of a JAMB English Comprehension passage...");
    const prompt = `You are a senior AI systems architect and expert exam setter (JAMB).
Generate exactly 1 high-quality question group for the subject: English.

Exam: JAMB
Topic: Comprehension
Subtopic: Inference

CRITICAL: Generate ONE complete comprehension passage (approx 200-300 words) suitable for JAMB level. Set is_group to true, place the passage in group_content, and generate exactly 3 varying questions based on it.

Requirements:
- 4 options (A-D).
- Detailed explanation for WHY the correct answer is right and others are wrong.
- Visual Placeholders: If a graph, map, or diagram is MANDATORY, put an explicit description in 'diagram_url'. Format: "https://placehold.co/600x400?text=[Explicit+Instruction+For+Human+Artist]"`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: generationSchema,
                temperature: 0.7,
            }
        });
        
        console.log(JSON.stringify(JSON.parse(response.text), null, 2));
    } catch (e) {
        console.error("Error Message:", e.message);
        console.error("Error Object JSON:", JSON.stringify(e, null, 2));
    }
}

testGeneration();
