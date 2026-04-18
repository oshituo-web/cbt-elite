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
    
    const batchUpdateSize = 100;
    let deactivated = 0;

    for (let i = 0; i < ids.length; i += batchUpdateSize) {
        const chunk = ids.slice(i, i + batchUpdateSize);
        const { error } = await supabase
            .from('questions')
            .update({ is_active: false })
            .in('id', chunk);
        
        if (error) {
            console.error(`Error deactivating chunk ${i}:`, error.message);
        } else {
            deactivated += chunk.length;
        }
        process.stdout.write(`\rDeactivated ${deactivated}/${ids.length}...`);
    }
    
    console.log(`\n✅ Successfully deactivated ${deactivated} questions.`);
}

deactivateIncomplete();
