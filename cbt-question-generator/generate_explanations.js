require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

// 1. Initialize Clients
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function generateExplanations(limit = 10) {
    console.log(`\uD83D\uDCDC Starting AI Explanation Generator (Batch Size: ${limit})...`);

    // 2. Fetch questions missing explanations
    const { data: questions, error } = await supabase
        .from('questions')
        .select(`
            id,
            question_text,
            subject,
            topic,
            question_answers (option_a, option_b, option_c, option_d, correct_option),
            answers (option_letter, option_text, is_correct)
        `)
        .is('explanation', null)
        .limit(limit);

    if (error) {
        console.error("Error fetching questions:", error);
        return;
    }

    if (!questions || questions.length === 0) {
        console.log("\u2705 All questions have explanations!");
        return;
    }

    console.log(`\uD83D\uDCD9 Found ${questions.length} questions to process.`);

    for (const q of questions) {
        try {
            let context = null;

            if (q.question_answers && q.question_answers.length > 0) {
                const qa = q.question_answers[0];
                const correctLetter = qa.correct_option;
                context = {
                    correct_text: qa[`option_${correctLetter.toLowerCase()}`],
                    options: `A: ${qa.option_a}\nB: ${qa.option_b}\nC: ${qa.option_c}\nD: ${qa.option_d}`
                };
            } else if (q.answers && q.answers.length > 0) {
                const correct = q.answers.find(a => a.is_correct);
                if (correct) {
                    const optionsList = q.answers
                        .sort((a, b) => a.option_letter.localeCompare(b.option_letter))
                        .map(a => `${a.option_letter}: ${a.option_text}`)
                        .join('\n');
                    
                    context = {
                        correct_text: correct.option_text,
                        options: optionsList
                    };
                }
            }

            if (!context) {
                console.log(`\u26A0 Skipping Question ${q.id}: No answer data found.`);
                continue;
            }

            const prompt = `
                You are an expert academic tutor.
                Provide a pedagogical and concise explanation for this CBT question.
                
                Question: ${q.question_text}
                Subject: ${q.subject}
                Topic: ${q.topic}
                Correct Answer: ${context.correct_text}
                
                Options:
                ${context.options}
                
                Guidelines:
                1. Explain the logic clearly.
                2. Keep it concise (under 100 words).
                3. Do NOT mention "Here is an explanation".
                4. Tone: Encouraging and professional.
            `;

            console.log(`\u231B Generating for: ${q.id} (${q.topic})...`);
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash', // Using Gemini 2.0 Flash as standard for fast processing
                contents: prompt,
                config: {
                    temperature: 0.7,
                }
            });

            const explanation = response.text;

            if (explanation && explanation.trim().length > 5) {
                const { error: updateError } = await supabase
                    .from('questions')
                    .update({ explanation: explanation.trim() })
                    .eq('id', q.id);

                if (updateError) throw updateError;
                console.log(`\u2705 Updated Question: ${q.id}`);
            }
        } catch (err) {
            console.error(`\u274C Error processing ${q.id}:`, err.message);
        }
    }
    console.log("\u2705 Batch finished.");
}

const batchSize = process.argv[2] ? parseInt(process.argv[2]) : 5;
generateExplanations(batchSize);
