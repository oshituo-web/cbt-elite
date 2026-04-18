require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function countQuestions() {
    const { count, error } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true });
    
    if (error) {
        console.error("Error fetching count:", error.message);
    } else {
        console.log(`Total questions in database: ${count}`);
    }
}

countQuestions();
