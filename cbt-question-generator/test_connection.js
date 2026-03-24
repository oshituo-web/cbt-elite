require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log("Testing connection...");
    console.log("URL:", supabaseUrl);
    // console.log("Key Prefix:", supabaseKey?.substring(0, 10)); // Careful with keys
    
    const timeout = setTimeout(() => {
        console.error("Timeout reached after 10s");
        process.exit(1);
    }, 10000);

    try {
        const { data, error } = await supabase.from('exams').select('*').limit(1);
        clearTimeout(timeout);
        if (error) {
            console.error("Supabase Error:", error.message);
        } else {
            console.log("Success! Data received:", JSON.stringify(data));
        }
    } catch (e) {
        console.error("Catch Exception:", e.stack);
    }
}

test();
