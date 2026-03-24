require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function repairAnswers() {
    console.log("Loading bad questions and local questions...");
    
    if (!fs.existsSync('bad_questions.json') || !fs.existsSync('questions.json')) {
        console.error("Missing necessary json files");
        return;
    }
    
    const badQuestionsRaw = fs.readFileSync('bad_questions.json', 'utf8');
    const badQuestions = JSON.parse(badQuestionsRaw);
    
    const allLocalRaw = fs.readFileSync('questions.json', 'utf8');
    const allLocal = JSON.parse(allLocalRaw);
    
    let repairedCount = 0;
    let notFoundCount = 0;
    
    // Create a map of local questions by text for fast lookup
    const localMap = new Map();
    allLocal.forEach(q => {
        localMap.set(q.question.trim(), q); // local text is 'question'
    });
    
    console.log(`Loaded ${badQuestions.length} bad questions and ${allLocal.length} local questions.`);
    
    const chunkSize = 50;
    for (let i = 0; i < badQuestions.length; i += chunkSize) {
        const chunk = badQuestions.slice(i, i + chunkSize);
        
        await Promise.all(chunk.map(async (badQ) => {
            const localQ = localMap.get(badQ.text.trim());
            if (!localQ) {
                notFoundCount++;
                return;
            }
            
            const optA = localQ.option_a || localQ.options?.A || localQ.options?.a;
            const optB = localQ.option_b || localQ.options?.B || localQ.options?.b;
            const optC = localQ.option_c || localQ.options?.C || localQ.options?.c;
            const optD = localQ.option_d || localQ.options?.D || localQ.options?.d;
            let correctOpt = localQ.correct_option || localQ.answer || 'A';
            correctOpt = correctOpt.trim().toUpperCase();
            if (correctOpt.length > 1 && correctOpt.startsWith('OPTION')) {
                correctOpt = correctOpt.replace('OPTION ', '').trim();
            }

            if (!optA || !optB || !optC || !optD) {
                notFoundCount++;
                return;
            }

            const answersData = [
                { question_id: badQ.id, option_letter: 'A', option_text: optA, is_correct: correctOpt === 'A' },
                { question_id: badQ.id, option_letter: 'B', option_text: optB, is_correct: correctOpt === 'B' },
                { question_id: badQ.id, option_letter: 'C', option_text: optC, is_correct: correctOpt === 'C' },
                { question_id: badQ.id, option_letter: 'D', option_text: optD, is_correct: correctOpt === 'D' }
            ];

            await supabase.from('answers').delete().eq('question_id', badQ.id);
            const { error: insertErr } = await supabase.from('answers').insert(answersData);
            
            if (!insertErr) {
                repairedCount++;
            }
        }));
        
        console.log(`Processed chunk up to ${i + chunk.length}... Repaired so far: ${repairedCount}`);
    }
    
    console.log(`\n--- Repair Summary ---`);
    console.log(`Successfully repaired answers for: ${repairedCount} questions`);
    console.log(`Could not find local data for: ${notFoundCount} questions`);
}

repairAnswers();
