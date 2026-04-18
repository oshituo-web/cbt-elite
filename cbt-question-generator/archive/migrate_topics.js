require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function migrateTopics() {
    console.log("🚀 Starting Topic Migration...");
    
    // 1. Get unique subject/exam/topic trios from questions
    const { data: questions, error } = await supabase
        .from('questions')
        .select('subject_id, exam_id, topic')
        .not('topic', 'is', null)
        .order('topic');

    if (error) {
        console.error("Error fetching questions:", error);
        return;
    }

    // 2. Filter unique items in JS to avoid expensive distinct inside SQL if not indexed
    const uniqueMap = new Map();
    questions.forEach(q => {
        const key = `${q.subject_id}-${q.exam_id}-${q.topic}`;
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, { 
                subject_id: q.subject_id, 
                exam_id: q.exam_id, 
                topic: q.topic 
            });
        }
    });

    const itemsToInsert = Array.from(uniqueMap.values());
    console.log(`📊 Found ${itemsToInsert.length} unique topics to sync.`);

    // 3. Insert into syllabus_topics using upsert to avoid duplicates
    // Note: This requires a unique constraint on (subject_id, exam_id, topic)
    // If it fails, I'll do it batch by batch.
    const BATCH_SIZE = 100;
    for (let i = 0; i < itemsToInsert.length; i += BATCH_SIZE) {
        const batch = itemsToInsert.slice(i, i + BATCH_SIZE);
        const { error: insErr } = await supabase
            .from('syllabus_topics')
            .upsert(batch, { onConflict: 'subject_id,exam_id,topic' });
            
        if (insErr) {
            console.warn(`[Batch ${i/BATCH_SIZE}] Upsert warning (likely missing constraint, falling back to manual check):`, insErr.message);
            // Manual check fallback for each item in batch
            for (const item of batch) {
                const { data: existing } = await supabase
                    .from('syllabus_topics')
                    .select('id')
                    .match(item)
                    .maybeSingle();
                
                if (!existing) {
                    await supabase.from('syllabus_topics').insert(item);
                }
            }
        }
    }

    console.log("✅ Topic Migration Complete!");
}

migrateTopics().catch(console.error);
