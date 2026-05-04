require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkCounts() {
    const { count: pastCount } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('is_past_question', true);
    const { count: aiCount } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('is_past_question', false);
    
    console.log(`Past Questions (true): ${pastCount}`);
    console.log(`AI Questions (false): ${aiCount}`);
}

checkCounts();
