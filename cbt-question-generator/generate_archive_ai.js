require('dotenv').config();
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // Correct Package
const { createClient } = require('@supabase/supabase-js');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY.trim());

const BATCH_SIZE = 10;
const MODELS = ['gemini-2.0-flash'];

async function log(message) {
    console.log(message);
    fs.appendFileSync('generation_log.txt', `${new Date().toISOString()}: ${message}\n`);
}

async function getSubjectId(subjectName) {
    const { data } = await supabase.from('subjects').select('id').ilike('subject_name', subjectName).single();
    return data?.id;
}

async function generatePastQuestions(exam, subject, year) {
    await log(`🎨 [AI ARCHIVE] Generating High-Fidelity WAEC ${year} ${subject} Archive...`);
    
    const subjectId = await getSubjectId(subject);
    if (!subjectId) {
        await log(`❌ Subject ${subject} not found in DB.`);
        return;
    }

    const prompt = `Act as an expert WAEC (WASSCE) examiner. Generate ${BATCH_SIZE} REALISTIC past questions for ${subject} from the year ${year}.
Requirements:
1. The questions MUST mimic the style, difficulty, and curriculum of WAEC.
2. Use LaTeX for any math/science formulas.
3. Provide high-quality pedagogical explanations.
4. Output MUST be valid JSON matching this schema:
[{
  "question_text": "string",
  "explanation": "string",
  "topic": "string",
  "options": [{"letter": "A", "text": "string", "is_correct": boolean}]
}]`;

    for (const modelName of MODELS) {
        try {
            await log(`[Model] Using ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            // Clean JSON string
            const jsonStr = text.replace(/```json|```/g, '').trim();
            const questions = JSON.parse(jsonStr);

            await log(`[AI] Received ${questions.length} questions. Archiving to DB...`);

            for (const q of questions) {
                const { data: qData, error: qErr } = await supabase.from('questions').insert({
                    exam_type: exam,
                    subject_id: subjectId,
                    topic: q.topic || 'General',
                    question_text: q.question_text,
                    explanation: q.explanation,
                    is_past_question: true,
                    exam_year: year,
                    is_active: true
                }).select().single();

                if (qErr) continue;

                await supabase.from('question_answers').insert(q.options.map(opt => ({
                    question_id: qData.id,
                    option_letter: opt.letter.toUpperCase(),
                    option_text: opt.text,
                    is_correct: opt.is_correct
                })));
            }
            await log(`✅ [Success] WAEC ${year} ${subject} Archive populated.`);
            return; // Finished for this year/subject
        } catch (error) {
            await log(`⚠️ [Error] Model ${modelName} failed: ${error.message}`);
        }
    }
}

async function main() {
    const subjects = ['English', 'Mathematics', 'Biology', 'Physics', 'Chemistry'];
    for (const sub of subjects) {
        for (let year = 2010; year <= 2023; year++) {
            await generatePastQuestions('WAEC', sub, year);
            await new Promise(r => setTimeout(r, 5000)); // Rate limit safety
        }
    }
}

main().catch(console.error);
