require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function salvage() {
    console.log("🛠️ Attempting to salvage corrupted questions.json...");
    
    let rawText = fs.readFileSync('questions.json', 'utf8');
    
    // Find the last valid closing brace for an object in the array
    const lastValidIndex = rawText.lastIndexOf('}');
    
    if (lastValidIndex === -1) {
        console.error("Could not find any valid JSON objects.");
        return;
    }
    
    // Truncate the string and close the JSON array
    const fixedText = rawText.substring(0, lastValidIndex + 1) + '\n]';
    
    fs.writeFileSync('questions_fixed.json', fixedText);
    console.log("✅ Fixed JSON saved to questions_fixed.json");
    
    let questions = [];
    try {
        questions = JSON.parse(fixedText);
        console.log(`✅ Successfully parsed ${questions.length} salvaged questions!`);
    } catch (err) {
        console.error("❌ Still failed to parse after truncation:", err.message);
        return;
    }

    // Optional: We can just let the user re-run their import script using the fixed file,
    // or we can natively insert them here if needed. But to be safe and respect their
    // terminal workflow, we just repair the file and modify import_questions.js to use it.
}

salvage();
