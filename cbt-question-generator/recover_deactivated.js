require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const repairSchema = {
  description: "A list of restored complete options and explanations",
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      id: { type: SchemaType.STRING, description: "The original question ID" },
      option_a: { type: SchemaType.STRING },
      option_b: { type: SchemaType.STRING },
      option_c: { type: SchemaType.STRING },
      option_d: { type: SchemaType.STRING },
      correct_option: { type: SchemaType.STRING, description: "A, B, C, or D" },
      explanation: { type: SchemaType.STRING }
    },
    required: ["id", "option_a", "option_b", "option_c", "option_d", "correct_option", "explanation"],
  },
};

async function recover() {
    console.log("🚀 Starting Recovery of Deactivated Questions...");

    // 1. Fetch deactivated questions
    let processed = 0;
    const deactivated = [];
    while(true) {
        const { data, error } = await supabase
            .from('questions')
            .select('id, question_text, subject, topic, exam_type')
            .eq('is_active', false)
            .range(processed, processed + 999);
        
        if (error) break;
        if (!data || data.length === 0) break;
        deactivated.push(...data);
        processed += 1000;
    }

    console.log(`Found ${deactivated.length} questions to recover.`);

    const batchSize = 5; // Smaller batches
    for (let i = 0; i < deactivated.length; i += batchSize) {
        const batch = deactivated.slice(i, i + batchSize);
        console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(deactivated.length / batchSize)}...`);

        let retryDelay = 2000;
        let success = false;
        let attempts = 0;

        while (!success && attempts < 5) {
            try {
                const prompt = `You are an expert examiner. For the following ${batch.length} multiple-choice questions (Nigerian syllabus), generate 4 plausible options (A-D), identify the correct option, and provide a detailed explanation.
                
                Questions:
                ${batch.map((q, idx) => `${idx + 1}. [ID: ${q.id}] Subject: ${q.subject}, Topic: ${q.topic}, Exam: ${q.exam_type}\nText: ${q.question_text}`).join('\n\n')}
                
                Return the results in the specified JSON format. Ensure explanations are educational.`;

                const result = await model.generateContent({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseMimeType: "application/json",
                        responseSchema: repairSchema,
                    },
                });

                const restored = JSON.parse(result.response.text());

                for (const r of restored) {
                    const qId = r.id;
                    await supabase.from('questions').update({
                        explanation: r.explanation,
                        is_active: true
                    }).eq('id', qId);

                    const answerInserts = [
                        { question_id: qId, option_letter: 'A', option_text: r.option_a, is_correct: r.correct_option === 'A' },
                        { question_id: qId, option_letter: 'B', option_text: r.option_b, is_correct: r.correct_option === 'B' },
                        { question_id: qId, option_letter: 'C', option_text: r.option_c, is_correct: r.correct_option === 'C' },
                        { question_id: qId, option_letter: 'D', option_text: r.option_d, is_correct: r.correct_option === 'D' }
                    ];
                    await supabase.from('question_answers').insert(answerInserts);
// Skipping insert to view 'question_answers' - handled by database logic.
                        explanation: r.explanation
                    });
                }
                process.stdout.write(`✅ Batch complete. Recovered so far: ${i + batch.length}`);
                success = true;
            } catch (err) {
                if (err.message?.includes('429')) {
                    attempts++;
                    console.warn(`⚠️ Rate limit hit. Retrying in ${retryDelay / 1000}s... (Attempt ${attempts})`);
                    await new Promise(res => setTimeout(res, retryDelay));
                    retryDelay *= 2;
                } else {
                    console.error(`❌ Batch failed:`, err.message);
                    break;
                }
            }
        }

        // Base delay
        await new Promise(res => setTimeout(res, 5000));
    }

    console.log("\n\n✅ Recovery Finished!");
}

recover().catch(console.error);
