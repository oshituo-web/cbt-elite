require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function debugQuery() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    console.log("Testing DataService.getQuestions full query...");
    const { data, error, count } = await supabase
      .from('questions')
      .select(`
        *,
        question_groups (*),
        question_answers (*),
        question_explanations (explanation),
        answers (*),
        theory_details (*)
      `, { count: 'exact' })
      .eq('is_active', true)
      .limit(1);

    if (error) {
        console.error("❌ QUERY FAILED:", error.message);
        console.error("Detail:", error.details);
        console.error("Hint:", error.hint);
    } else {
        console.log("✅ QUERY SUCCEEDED!");
        console.log("Result sample:", JSON.stringify(data[0], null, 2));
    }
}

debugQuery().catch(console.error);
