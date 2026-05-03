import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hwmbmbxblftpkqikbiff.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3bWJtYnhibGZ0cGtxaWtiaWZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzA0NDgzNSwiZXhwIjoyMDc4NjIwODM1fQ.-SnZJbpqsm39Akdv-bV_IiJwbhjtzD2wkHG52ExFLa4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkSchema() {
    const { data } = await supabase.from('questions').select('question_type').eq('is_past_question', false);
    const counts = {};
    data.forEach(q => counts[q.question_type] = (counts[q.question_type] || 0) + 1);
    console.log("AI Question Types:", counts);
}

checkSchema();
