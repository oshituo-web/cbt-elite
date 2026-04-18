const fs = require('fs');

function auditLocalQuestions() {
    try {
        const data = fs.readFileSync('questions.json', 'utf8');
        const questions = JSON.parse(data);
        
        let missingCount = 0;
        let marketingMissingCount = 0;
        const missingQuestions = [];

        questions.forEach((q, index) => {
            const optA = q.option_a || q.options?.A || q.options?.a;
            const optB = q.option_b || q.options?.B || q.options?.b;
            const optC = q.option_c || q.options?.C || q.options?.c;
            const optD = q.option_d || q.options?.D || q.options?.d;

            if (!optA || !optB || !optC || !optD) {
                missingCount++;
                missingQuestions.push({ index, subject: q.subject, topic: q.topic, exam: q.exam_type });
                if (q.subject && q.subject.toLowerCase() === 'marketing') {
                    marketingMissingCount++;
                }
            }
        });

        console.log(`Audited ${questions.length} questions in questions.json`);
        console.log(`Total missing options: ${missingCount}`);
        console.log(`Marketing missing options: ${marketingMissingCount}`);
        
        const bySubject = {};
        missingQuestions.forEach(q => {
            bySubject[q.subject] = (bySubject[q.subject] || 0) + 1;
        });
        console.log("Missing by subject:", bySubject);
        
    } catch (e) {
        console.error("Error reading questions.json:", e);
    }
}

auditLocalQuestions();
