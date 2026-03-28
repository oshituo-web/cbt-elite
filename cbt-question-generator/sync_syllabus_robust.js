require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function sync() {
    try {
        console.log("Loading local syllabus...");
        const syllabus = JSON.parse(fs.readFileSync('syllabus.json', 'utf8'));

        console.log("Fetching database mappings...");
        const { data: exams, error: eErr } = await supabase.from('exams').select('id, exam_name');
        if (eErr) throw eErr;
        const { data: subjects, error: sErr } = await supabase.from('subjects').select('id, subject_name');
        if (sErr) throw sErr;
        const { data: existingTopics, error: tErr } = await supabase.from('syllabus_topics').select('exam_id, subject_id, topic');
        if (tErr) throw tErr;

        const topicSet = new Set((existingTopics || []).map(t => `${t.exam_id}-${t.subject_id}-${t.topic}`));
        const examMap = {};
        exams.forEach(e => examMap[e.exam_name.toUpperCase()] = e.id);

        const subjectMap = {};
        subjects.forEach(sub => {
            subjectMap[sub.subject_name.trim()] = sub.id;
            // Handle some common variations
            if (sub.subject_name.includes('Civic')) subjectMap['Citizenship and Heritage Study'] = sub.id;
        });

        const newTopics = [];
        for (const examName in syllabus) {
            const eid = examMap[examName];
            if (!eid) {
                console.warn(`[SKIP] Exam not in DB: ${examName}`);
                continue;
            }

            for (const subjectName in syllabus[examName]) {
                const sid = subjectMap[subjectName];
                if (!sid) {
                    console.warn(`[SKIP] Subject not in DB: ${subjectName} (for ${examName})`);
                    continue;
                }

                syllabus[examName][subjectName].forEach(topic => {
                    const key = `${eid}-${sid}-${topic}`;
                    if (!topicSet.has(key)) {
                        newTopics.push({ exam_id: eid, subject_id: sid, topic });
                        topicSet.add(key); // prevent duplicates in same run
                    }
                });
            }
        }

        console.log(`Found ${newTopics.length} new topics to sync.`);
        
        if (newTopics.length > 0) {
            for (let i = 0; i < newTopics.length; i += 50) {
                const batch = newTopics.slice(i, i + 50);
                const { error } = await supabase.from('syllabus_topics').insert(batch);
                if (error) {
                    console.error(`[Error] Batch starting at ${i}:`, error.message);
                } else {
                    console.log(`[Sync] Inserted ${batch.length} topics...`);
                }
            }
        }

        console.log("✅ Syllabus synchronization complete.");
    } catch (err) {
        console.error("❌ Sync Error:", err.message);
    }
}

sync();
