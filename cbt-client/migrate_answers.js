import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
const envData = fs.readFileSync(envPath, 'utf-8');
let url = '';
let key = '';

envData.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/"/g, '');
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim().replace(/"/g, '');
});

const supabase = createClient(url, key);

async function migrateAnswers() {
    console.log("Fetching stranded answers...");
    // Fetch all questions that have no answers in question_answers
    // Since we can't do complex joins easily via PostgREST, let's fetch all question_answers 
    // and then fetch from answers and filter.
    const { data: qAnswers, error: qaErr } = await supabase.from('question_answers').select('question_id');
    const existingQIds = new Set(qAnswers.map(qa => qa.question_id));
    
    // Fetch all answers
    const { data: allAnswers, error: aErr } = await supabase.from('answers').select('*');
    if (aErr) throw aErr;
    
    // Group answers by question_id
    const grouped = {};
    for (const a of allAnswers) {
        if (existingQIds.has(a.question_id)) continue; // Already migrated
        
        if (!grouped[a.question_id]) grouped[a.question_id] = { question_id: a.question_id, option_a: '', option_b: '', option_c: '', option_d: '', correct_option: '', explanation: '' };
        
        const letter = a.option_letter.toLowerCase();
        if (letter === 'a') grouped[a.question_id].option_a = a.option_text;
        if (letter === 'b') grouped[a.question_id].option_b = a.option_text;
        if (letter === 'c') grouped[a.question_id].option_c = a.option_text;
        if (letter === 'd') grouped[a.question_id].option_d = a.option_text;
        if (a.is_correct) grouped[a.question_id].correct_option = a.option_letter.toUpperCase();
    }
    
    const inserts = Object.values(grouped);
    console.log(`Found ${inserts.length} questions to migrate.`);
    
    // Insert in batches
    for (let i = 0; i < inserts.length; i += 50) {
        const batch = inserts.slice(i, i + 50);
        const { error } = await supabase.from('question_answers').insert(batch);
        if (error) {
            console.error("Batch insert error:", error);
        } else {
            console.log(`Migrated batch ${i / 50 + 1}`);
        }
    }
    console.log("Migration complete.");
    process.exit(0);
}

migrateAnswers();
