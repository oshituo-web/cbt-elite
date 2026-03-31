require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkVisuals() {
    console.log("Checking for questions with diagrams...");
    const { data, error } = await supabase
        .from('questions')
        .select('id, question_text, diagram_type, diagram_url, diagram_svg')
        .neq('diagram_type', 'none')
        .limit(5);

    if (error) {
        console.error("DB Error:", error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No visual questions found yet. Generator might still be running or rate-limited.");
        return;
    }

    console.log(`Found ${data.length} visual questions:`);
    data.forEach(q => {
        console.log(`- [${q.diagram_type}] ${q.question_text.slice(0, 50)}...`);
        if (q.diagram_svg) console.log(`  SVG: ${q.diagram_svg.slice(0, 100)}...`);
        if (q.diagram_url) console.log(`  URL: ${q.diagram_url}`);
    });
}

checkVisuals();
