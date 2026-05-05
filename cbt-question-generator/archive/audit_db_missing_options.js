require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkEmptyOptions() {
    console.log("Checking DB for questions with missing or empty answer options...");
    
    // Fetch all answers with empty option_text
    const { data: emptyAnswers, error: err1 } = await supabase
        .from('question_answers')
        .select('question_id, option_text')
        .or('option_text.eq.,option_text.is.null'); // check for empty or null
        
    if (err1) {
        console.error("Error fetching answers:", err1);
        return;
    }
    
    // Some questions might not have 4 answers in the answers table. Let's group them or check answer count.
    
    const { data: questions, error } = await supabase
        .from('questions')
        .select(`
            id,
            subject,
            topic,
            question_text,
            answers (
                id,
                option_letter,
                option_text
            )
        `);

    if (error) {
        console.error(error);
        return;
    }

    let badQuestions = [];
    let marketingMissing = 0;

    questions.forEach(q => {
        if (!q.answers || q.answers.length < 4) {
            badQuestions.push({ id: q.id, reason: 'missing answers (<4)', subject: q.subject, text: q.question_text });
            if (q.subject.toLowerCase() === 'marketing') marketingMissing++;
            return;
        }
        
        const hasEmptyOption = q.answers.some(a => !a.option_text || a.option_text.trim() === '');
        if (hasEmptyOption) {
            badQuestions.push({ id: q.id, reason: 'empty option text', subject: q.subject, text: q.question_text });
            if (q.subject.toLowerCase() === 'marketing') marketingMissing++;
        }
    });

    console.log(`Total questions in DB: ${questions.length}`);
    console.log(`Questions with missing/empty options: ${badQuestions.length}`);
    console.log(`Of those, ${marketingMissing} are Marketing questions.`);
    
    // Save these IDs to a file so we can regenerate them
    const fs = require('fs');
    fs.writeFileSync('bad_questions.json', JSON.stringify(badQuestions, null, 2));
    console.log("Saved bad_questions.json");
    
    if (badQuestions.length > 0) {
        console.log("Samples:", badQuestions.slice(0, 3));
    }
}

checkEmptyOptions();
