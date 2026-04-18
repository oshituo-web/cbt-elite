require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRecentQuestions() {
    console.log("Fetching the 5 most recent JAMB Math questions...");
    const { data, error } = await supabase
        .from('questions')
        .select('id, question_text, diagram_type, diagram_url, diagram_svg, created_at')
        .eq('exam_type', 'JAMB')
        .eq('subject', 'Mathematics')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("DB Error:", error.message);
        return;
    }

    console.log(`Found ${data.length} recent questions:`);
    data.forEach(q => {
        console.log(`\n[Type: ${q.diagram_type || 'null'}] Q: ${q.question_text.slice(0, 80)}...`);
        if (q.diagram_svg) console.log(`  SVG: ${q.diagram_svg.slice(0, 100)}...`);
        if (q.diagram_url) console.log(`  URL: ${q.diagram_url}`);
    });
}

checkRecentQuestions();
