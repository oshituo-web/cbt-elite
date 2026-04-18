require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Bypass TLS verification for local environment
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function exportQuestions() {
    console.log("🚀 Starting Full Database Export to JSON...");
    
    let allQuestions = [];
    let from = 0;
    const batchSize = 200;
    let hasMore = true;

    while (hasMore) {
        console.log(`Fetching batch: ${from} - ${from + batchSize}...`);
        
        const { data, error } = await supabase
            .from('questions')
            .select(`
                *,
                question_answers (*),
                question_explanations (explanation),
                theory_details (*)
            `)
            .range(from, from + batchSize - 1)
            .order('created_at', { ascending: true });

        if (error) {
            console.error("Fetch Error:", error.message);
            break;
        }

        if (!data || data.length === 0) {
            hasMore = false;
            break;
        }

        // Format to match the expected questions.json structure
        const formatted = data.map(q => {
            const qa = Array.isArray(q.question_answers) ? q.question_answers[0] : q.question_answers;
            const qe = Array.isArray(q.question_explanations) ? q.question_explanations[0] : q.question_explanations;
            const theory = Array.isArray(q.theory_details) ? q.theory_details[0] : q.theory_details;

            const base = {
                id: q.id,
                subject: q.subject,
                topic: q.topic,
                subtopic: q.subtopic,
                exam_type: q.exam_type,
                exam_year: q.exam_year,
                question_text: q.question_text,
                question: q.question_text, // Compatibility
                explanation: q.explanation || qe?.explanation || qa?.explanation,
                diagram_url: q.diagram_url,
                diagram_type: q.diagram_type,
                diagram_svg: q.diagram_svg,
                difficulty: q.difficulty,
                tags: q.tags,
                question_type: q.question_type || 'objective',
                created_at: q.created_at
            };

            if (base.question_type === 'theory' && theory) {
                base.model_answer = theory.model_answer;
                base.key_points = theory.key_points;
                base.marking_scheme = theory.marking_scheme;
            } else if (qa) {
                base.option_a = qa.option_a;
                base.option_b = qa.option_b;
                base.option_c = qa.option_c;
                base.option_d = qa.option_d;
                base.correct_option = qa.correct_option;
            }

            return base;
        });

        allQuestions = allQuestions.concat(formatted);
        console.log(`Accumulated ${allQuestions.length} questions...`);

        from += batchSize;
        if (data.length < batchSize) hasMore = false;
    }

    console.log(`\nWriting ${allQuestions.length} questions to questions.json...`);
    fs.writeFileSync('questions.json', JSON.stringify(allQuestions, null, 2));
    
    console.log("✅ Export Complete!");
    process.exit(0);
}

exportQuestions();
