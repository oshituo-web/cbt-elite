require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function deactivateIncomplete() {
    console.log("🚀 Deactivating incomplete questions...");
    
    if (!fs.existsSync('incomplete.json')) {
        console.error("Missing incomplete.json. Please run extract_incomplete.js first.");
        return;
    }
    
    const incomplete = JSON.parse(fs.readFileSync('incomplete.json', 'utf8'));
    console.log(`Targeting ${incomplete.length} questions for deactivation.`);
    
    const ids = incomplete.map(q => q.id);
    
    // Batch update is_active = false
    const { error } = await supabase
        .from('questions')
        .update({ is_active: false })
        .in('id', ids);
    
    if (error) {
        console.error("Error deactivating questions:", error.message);
    } else {
        console.log(`✅ Successfully deactivated ${ids.length} questions.`);
    }
}

deactivateIncomplete();
