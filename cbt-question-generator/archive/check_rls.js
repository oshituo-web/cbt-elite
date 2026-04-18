require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY); // Use anon key to test if RLS is on

async function checkRLS() {
    console.log("🚀 Checking RLS on 'questions'...");
    
    // If RLS is ON and there is no policy, a SELECT with anon key should return an empty array (or just follow the policy).
    // Let's see if we can read everything.
    const { data, error } = await supabase.from('questions').select('id').limit(1);
    if (error) {
        console.error("❌ RLS might be on and blocking access:", error.message);
    } else {
        console.log(`✅ Questions found (${data.length}). If this is non-zero, either RLS is OFF or an 'Allow Public Read' policy is active.`);
    }
}

checkRLS();
