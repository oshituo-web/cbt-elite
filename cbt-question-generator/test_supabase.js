
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY.trim());

async function testSupabase() {
    console.log("Testing Supabase connection...");
    const { data, count, error } = await supabase.from('exams').select('*', { count: 'exact' });
    if (error) {
        console.error("Supabase Error:", error.message);
    } else {
        console.log("Exams found:", data ? data.length : 0);
        console.log("Count:", count);
    }
}

testSupabase();
