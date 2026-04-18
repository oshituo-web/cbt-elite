const fs = require('fs');

async function extractIncomplete() {
    console.log("Loading questions.json...");
    try {
        const raw = fs.readFileSync('questions.json', 'utf8');
        const questions = JSON.parse(raw);
        console.log(`Loaded ${questions.length} total questions.`);

        const incomplete = [];
        
        questions.forEach(q => {
            const optA = q.option_a || q.options?.A || q.options?.a;
            const optB = q.option_b || q.options?.B || q.options?.b;
            const optC = q.option_c || q.options?.C || q.options?.c;
            const optD = q.option_d || q.options?.D || q.options?.d;
            
            if (!optA || !optB || !optC || !optD || !q.correct_option) {
                incomplete.push(q);
            }
        });

        console.log(`Found ${incomplete.length} incomplete questions locally.`);

        // Grouping
        const grouped = {};
        let count = 0;

        incomplete.forEach(q => {
            const exam = q.exam_type || "General";
            const sub = q.subject || "General";
            const topic = q.topic || "Unknown Topic";

            if (!grouped[exam]) grouped[exam] = {};
            if (!grouped[exam][sub]) grouped[exam][sub] = {};
            if (!grouped[exam][sub][topic]) grouped[exam][sub][topic] = [];

            grouped[exam][sub][topic].push({
                question: q.question || q.question_text,
                difficulty: q.difficulty || 'medium',
                subtopic: q.subtopic || 'General'
            });
            count++;
        });

        fs.writeFileSync('incomplete.json', JSON.stringify(grouped, null, 2));
        console.log(`Successfully grouped and saved ${count} questions to incomplete.json!`);

    } catch(e) {
        console.error("Error:", e);
    }
}

extractIncomplete();
