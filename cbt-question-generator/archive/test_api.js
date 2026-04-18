require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

async function test() {
    console.log("Testing Supabase connectivity...");
    try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { data, error } = await supabase.from('exams').select('count', { head: true });
        if (error) throw error;
        console.log("✅ Supabase is connected!");
    } catch (e) {
        console.error("❌ Supabase connection failed:", e.message);
    }

    console.log("\nTesting Gemini connectivity...");
    try {
        const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Say 'Hello'");
        console.log("Gemini Response:", result.response.text());
        console.log("✅ Gemini is connected!");
    } catch (e) {
        console.error("❌ Gemini connection failed:", e.message);
    }
}

test();
