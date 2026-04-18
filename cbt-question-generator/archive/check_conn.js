require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = (process.env.SUPABASE_URL || "").trim().replace(/[\r\n]/g, "");
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim().replace(/[\r\n]/g, "");

console.log("Testing with URL:", url);

const supabase = createClient(url, key);

async function test() {
    try {
        const { data, error } = await supabase.from('exams').select('count', { head: true });
        if (error) throw error;
        console.log("✅ Supabase connection successful!");
    } catch (err) {
        console.error("❌ Connection failed:", err.message);
    }
}

test();
