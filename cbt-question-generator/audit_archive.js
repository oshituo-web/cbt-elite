require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(process.env.SUPABASE_URL.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY.trim());

// ALOC API Constants
const ALOC_BASE_URL = 'https://questions.aloc.ng/api/v2';
const ALOC_TOKEN = 'YOUR_ALOC_TOKEN_HERE'; // This would normally be in .env

async function importFromALOC(subjectName, examType) {
    console.log(`🚀 Starting ALOC Import: ${subjectName} (${examType})`);
    
    // 1. Resolve Subject ID in our DB
    const { data: subData } = await supabase.from('subjects').select('id').ilike('subject_name', subjectName).single();
    if (!subData) {
        console.error(`❌ Subject not found: ${subjectName}`);
        return;
    }
    const subjectId = subData.id;

    try {
        // Fetch from ALOC (Sample Endpoint: /q?subject=english&type=jamb)
        // Note: This is a simulation of the booster logic as ALOC requires a unique token per dev
        const response = await axios.get(`${ALOC_BASE_URL}/q?subject=${subjectName.toLowerCase()}&type=${examType.toLowerCase()}`, {
            headers: { 'Accept': 'application/json', 'AccessToken': ALOC_TOKEN }
        });

        const questions = response.data.data; // Assuming ALOC response structure
        console.log(`✅ Fetched ${questions.length} questions from ALOC.`);

        for (const q of questions) {
            // Check if year/exam metadata exists
            const year = q.year || 2023; // Fallback
            
            // Insert Question
            const { data: qData, error: qErr } = await supabase.from('questions').insert({
                question_text: q.question,
                exam_type: examType.toUpperCase(),
                subject_id: subjectId,
                topic: q.section || 'General',
                explanation: q.solution || 'No explanation provided.',
                is_past_question: true,
                exam_year: parseInt(year),
                is_active: true
            }).select().single();

            if (qErr) {
                console.error(`❌ Insert failed: ${qErr.message}`);
                continue;
            }

            // Insert Answers
            const options = ['a', 'b', 'c', 'd'];
            const answers = options.map(opt => ({
                question_id: qData.id,
                option_letter: opt.toUpperCase(),
                option_text: q.option[opt],
                is_correct: q.answer.toLowerCase() === opt
            }));

            const { error: aErr } = await supabase.from('question_answers').insert(answers);
            if (aErr) console.error(`❌ Answers failed: ${aErr.message}`);
        }

        console.log(`🎉 Import complete for ${subjectName}.`);
    } catch (err) {
        console.error(`❌ ALOC Request failed: ${err.message}`);
    }
}

// For this audit, we will also check if any "AI" questions should be manually tagged as "Past"
async function tagExistingQuestions() {
    console.log("🛠️ Tagging existing questions based on patterns...");
    const { data: list } = await supabase.from('questions').select('id, question_text').ilike('question_text', '%20%');
    
    if (list) {
        for (const q of list) {
            const yearMatch = q.question_text.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
                const year = parseInt(yearMatch[0]);
                await supabase.from('questions').update({ 
                    is_past_question: true, 
                    exam_year: year 
                }).eq('id', q.id);
            }
        }
    }
}

// runAudit() from before to verify
async function runAudit() {
    console.log("🔍 RUNNING METADATA AUDIT...");
    const { count: totalPast } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('is_past_question', true);
    console.log(`✅ Total Archive Questions: ${totalPast || 0}`);
}

async function main() {
    // 1. Tag any existing ones first
    await tagExistingQuestions();
    // 2. Final Audit
    await runAudit();
}

main().catch(console.error);
