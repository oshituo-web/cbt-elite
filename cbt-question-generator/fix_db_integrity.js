require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixOrphanedQuestions() {
    console.log("🚀 Starting to fix orphaned questions (optimized)...");

    // 1. Fetch all question_ids that have associated answers
    const { data: answeredQuestionIds, error: fetchError } = await supabase
        .from('question_answers')
        .select('question_id');

    if (fetchError) {
        console.error("Error fetching answered question IDs:", fetchError.message);
        return;
    }

    const existingQuestionIds = new Set(answeredQuestionIds.map(a => a.question_id));

    // 2. Fetch all questions and identify orphans
    let offset = 0;
    const batchSize = 1000;
    const orphansToDelete = [];

    while (true) {
        const { data: questions, error } = await supabase
            .from('questions')
            .select('id')
            .range(offset, offset + batchSize - 1);

        if (error) {
            console.error("Error fetching questions:", error);
            break;
        }
        if (!questions || questions.length === 0) break;

        for (const q of questions) {
            if (!existingQuestionIds.has(q.id)) {
                orphansToDelete.push(q.id);
            }
        }

        offset += questions.length;
        process.stdout.write(`\rScanned ${offset} questions, found ${orphansToDelete.length} orphans...`);
        if (questions.length < batchSize) break;
    }

    console.log(`\nFound ${orphansToDelete.length} orphaned questions to delete.`);

    if (orphansToDelete.length > 0) {
        console.log("Deleting related flashcards...");
        const deleteFlashcardsChunkSize = 100;
        for (let i = 0; i < orphansToDelete.length; i += deleteFlashcardsChunkSize) {
            const chunk = orphansToDelete.slice(i, i + deleteFlashcardsChunkSize);
            const { error: deleteFlashcardsError } = await supabase.from('flashcards').delete().in('question_id', chunk);
            if (deleteFlashcardsError) {
                console.error(`Error deleting flashcards for chunk ${i}-${i + chunk.length}:`, deleteFlashcardsError.message);
            }
            process.stdout.write(`\rDeleted flashcards for ${Math.min(i + deleteFlashcardsChunkSize, orphansToDelete.length)}/${orphansToDelete.length} orphans...`);
        }
        console.log("\n✅ Successfully deleted related flashcards.");

        console.log("Deleting orphaned questions...");
        const deleteQuestionsChunkSize = 100;
        for (let i = 0; i < orphansToDelete.length; i += deleteQuestionsChunkSize) {
            const chunk = orphansToDelete.slice(i, i + deleteQuestionsChunkSize);
            const { error: deleteError } = await supabase.from('questions').delete().in('id', chunk);
            if (deleteError) {
                console.error(`Error deleting chunk ${i}-${i + chunk.length}:`, deleteError.message);
            }
            process.stdout.write(`\rDeleted ${Math.min(i + deleteQuestionsChunkSize, orphansToDelete.length)}/${orphansToDelete.length} orphans...`);
        }
        console.log(`\n✅ Successfully deleted all orphaned questions.`);
    } else {
        console.log("No orphaned questions found. Nothing to delete.");
    }

    console.log("\n--- Fixing Duplicate Options ---");
    let duplicateOptionsFixedCount = 0;
    offset = 0; // Reset offset for new loop

    while (true) {
        const { data: questions, error } = await supabase
            .from('questions')
            .select(`
                id,
                answers (
                    id,
                    option_text
                )
            `)
            .range(offset, offset + batchSize - 1);

        if (error) {
            console.error("Error fetching questions for duplicate option check:", error.message);
            break;
        }
        if (!questions || questions.length === 0) break;

        for (const q of questions) {
            const answers = q.answers || [];
            const seenOptionTexts = new Set();
            const idsToDelete = [];

            for (const answer of answers) {
                const trimmedText = answer.option_text.trim().toLowerCase();
                if (seenOptionTexts.has(trimmedText)) {
                    idsToDelete.push(answer.id);
                } else {
                    seenOptionTexts.add(trimmedText);
                }
            }

            if (idsToDelete.length > 0) {
                console.log(`Fixing duplicates for Question ${q.id}: Deleting ${idsToDelete.length} duplicate options.`);
                const { error: deleteError } = await supabase.from('question_answers').delete().in('id', idsToDelete);
                if (deleteError) {
                    console.error(`Error deleting duplicate options for ${q.id}:`, deleteError.message);
                } else {
                    duplicateOptionsFixedCount += idsToDelete.length;
                }
            }
        }

        offset += questions.length;
        process.stdout.write(`\rScanned ${offset} questions for duplicate options...`);
        if (questions.length < batchSize) break;
    }

    console.log(`\n\n✅ Fixed ${duplicateOptionsFixedCount} duplicate option entries.`);
    console.log("\nFix orphaned questions finished.");
}


fixOrphanedQuestions().catch(console.error);
