require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanup() {
    try {
        console.log("Loading local syllabus...");
        const syllabus = JSON.parse(fs.readFileSync('syllabus.json', 'utf8'));

        console.log("Fetching database mappings...");
        const { data: exams, error: eErr } = await supabase.from('exams').select('id, exam_name');
        if (eErr) throw eErr;
        const { data: subjects, error: sErr } = await supabase.from('subjects').select('id, subject_name');
        if (sErr) throw sErr;

        const examMap = {};
        exams.forEach(e => examMap[e.exam_name.toUpperCase()] = e.id);

        const literatureSubject = subjects.find(s => s.subject_name.trim() === 'Literature');
        if (!literatureSubject) throw new Error("Literature subject not found in DB.");
        const sid = literatureSubject.id;

        // Build valid topics map: { exam_id: Set(valid_topics) }
        const validTopicsMap = {};
        for (const examName in syllabus) {
            const eid = examMap[examName];
            if (!eid) continue;
            validTopicsMap[eid] = new Set(syllabus[examName]['Literature'] || []);
        }

        console.log("Fetching existing Literature topics from DB...");
        const { data: existingTopics, error: tErr } = await supabase
            .from('syllabus_topics')
            .select('id, exam_id, topic')
            .eq('subject_id', sid);

        if (tErr) throw tErr;

        const topicsToDelete = [];
        existingTopics.forEach(row => {
            const validSet = validTopicsMap[row.exam_id];
            if (!validSet || !validSet.has(row.topic)) {
                topicsToDelete.push(row.id);
                console.log(`[Stale Topic Found] ID: ${row.id} - ${row.topic}`);
            }
        });

        console.log(`Found ${topicsToDelete.length} stale Literature topics to clean up.`);

        if (topicsToDelete.length > 0) {
            console.log("Deleting stale topics (and cascading any generated questions attached to them)...");
            // Batch delete
             for (let i = 0; i < topicsToDelete.length; i += 50) {
                 const batch = topicsToDelete.slice(i, i + 50);
                 const { error, count } = await supabase.from('syllabus_topics').delete().in('id', batch);
                 if (error) {
                     console.error(`[Error] Batch delete starting at ${i}:`, error.message);
                 } else {
                     console.log(`[Cleanup] Deleted batch of ${batch.length} stale topics.`);
                 }
             }
        }

        console.log("✅ Literature cleanup complete.");
    } catch (err) {
        console.error("❌ Cleanup Error:", err.message);
    }
}

cleanup();
