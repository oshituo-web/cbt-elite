require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function normalize() {
    const mapping = JSON.parse(fs.readFileSync('proposed_mapping.json', 'utf8'));
    
    console.log("Starting normalization...");
    let updatedCount = 0;
    
    for (const [key, target] of Object.entries(mapping)) {
        const [exam, subject, topic] = key.split('|');
        const [,, newTopic] = target.split('|');
        
        const { error } = await supabase
            .from('questions')
            .update({ topic: newTopic })
            .eq('exam_type', exam)
            .eq('subject', subject)
            .eq('topic', topic);
            
        if (error) {
            console.error(`Error updating ${key}:`, error.message);
        } else {
            updatedCount++;
            process.stdout.write(`\rUpdated ${updatedCount} groups...`);
        }
    }
    console.log("\nNormalization complete.");
}

normalize();
