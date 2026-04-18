require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function investigateGhost() {
    console.log("Looking up: 'Groups that have a direct influence and to which a person belongs are called:'");
    
    const { data: q, error } = await supabase
        .from('questions')
        .select(`
            id,
            question_text,
            is_active,
            answers (
                id,
                option_letter,
                option_text
            )
        `)
        .ilike('question_text', '%Groups that have a direct influence%');

    if (error) {
        console.error("DB Error:", error.message);
        return;
    }
    
    if (q && q.length > 0) {
        console.log("FOUND IT IN DB!");
        console.log(JSON.stringify(q, null, 2));
    } else {
        console.log("NOT FOUND in DB. The database is clean.");
        console.log("This means the frontend is definitely caching the old data!");
    }
}

investigateGhost();
