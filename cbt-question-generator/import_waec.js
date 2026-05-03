require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(process.env.SUPABASE_URL.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY.trim());

// ALOC API Constants
const ALOC_BASE_URL = 'https://questions.aloc.com.ng/api/v2';
const ALOC_TOKEN = 'YOUR_ALOC_TOKEN_HERE'; 

// SUBJECT MAPPING (Our DB Name -> ALOC key)
const SUBJECT_MAP = {
    'English': 'english',
    'Mathematics': 'mathematics',
    'Biology': 'biology',
    'Chemistry': 'chemistry',
    'Physics': 'physics',
    'Economics': 'economics',
    'Government': 'government',
    'Literature': 'literature',
    'CRS': 'crk',
    'Commerce': 'commerce',
    'Accounting': 'accounting',
    'Geography': 'geography',
    'Agriculture': 'agriculture'
};

async function importWAECArchive() {
    console.log("🌊 STARTING REFINED BULK WAEC IMPORT...");
    
    const { data: dbSubjects } = await supabase.from('subjects').select('id, subject_name');
    
    for (const subName in SUBJECT_MAP) {
        const alocKey = SUBJECT_MAP[subName];
        const dbSub = dbSubjects.find(s => s.subject_name === subName);
        
        if (!dbSub) {
            console.warn(`   ⚠️ Subject ${subName} not in our DB. Skipping.`);
            continue;
        }

        console.log(`\n📚 Processing ${subName} (ALOC: ${alocKey})...`);

        try {
            // ALOC Fetch (Try multiple years or batch)
            // Fetch for specific years to avoid 406 on large generic requests
            for (let year = 2010; year <= 2023; year++) {
                console.log(`   ⏳ Fetching ${subName} ${year}...`);
                const response = await axios.get(`${ALOC_BASE_URL}/q?subject=${alocKey}&year=${year}&type=wassce`, {
                    headers: { 
                        'Accept': 'application/json',
                        'AccessToken': ALOC_TOKEN,
                        'User-Agent': 'CBT-Elite-Production/1.1'
                    }
                });

                if (response.data && response.data.data) {
                    const questions = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
                    console.log(`   ✅ Received ${questions.length} questions.`);

                    for (const q of questions) {
                        // Metadata Extraction
                        const qText = q.question;
                        if (!qText || qText.length < 10) continue;

                        const { data: qData, error: qErr } = await supabase.from('questions').insert({
                            question_text: qText,
                            exam_type: 'WAEC',
                            subject_id: dbSub.id,
                            topic: q.section || 'General',
                            explanation: q.solution || 'Pedagogical explanation being processed...',
                            is_past_question: true,
                            exam_year: year,
                            is_active: true
                        }).select().single();

                        if (qErr) continue; // Duplicate

                        // Answers
                        const options = ['a', 'b', 'c', 'd'];
                        const answers = options.map(opt => ({
                            question_id: qData.id,
                            option_letter: opt.toUpperCase(),
                            option_text: q.option[opt] || 'N/A',
                            is_correct: String(q.answer).toLowerCase() === opt
                        }));
                        await supabase.from('question_answers').insert(answers);
                    }
                }
                // Delay to respect rate limits
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (err) {
            console.error(`   ❌ Error for ${subName}: ${err.message}`);
        }
    }
    console.log("\n🎉 IMPORT CYCLE FINISHED.");
}

importWAECArchive().catch(console.error);
