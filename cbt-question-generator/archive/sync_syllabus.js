require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function syncSyllabus() {
    console.log("🚀 Starting Syllabus Sync to Database...");

    // 1. Load JSON files
    if (!fs.existsSync('syllabus.json') || !fs.existsSync('topics.json')) {
        console.error("Missing syllabus.json or topics.json. Please create them first.");
        return;
    }
    const syllabus = JSON.parse(fs.readFileSync('syllabus.json', 'utf8'));
    const topicsData = JSON.parse(fs.readFileSync('topics.json', 'utf8'));

    // 2. Sync Exams
    console.log("Syncing Exams...");
    const examNames = Object.keys(syllabus);
    for (const name of examNames) {
        await supabase.from('exams').upsert({ exam_name: name }, { onConflict: 'exam_name' });
    }
    const { data: exams } = await supabase.from('exams').select('*');
    const examMap = {}; exams.forEach(e => examMap[e.exam_name] = e.id);

    // 3. Sync Subjects
    console.log("Syncing Subjects...");
    const subjectNames = new Set();
    Object.values(syllabus).forEach(obj => {
        Object.keys(obj).forEach(s => subjectNames.add(s));
    });

    for (const name of Array.from(subjectNames)) {
        await supabase.from('subjects').upsert({ subject_name: name }, { onConflict: 'subject_name' });
    }
    const { data: subjects } = await supabase.from('subjects').select('*');
    const subjectMap = {}; subjects.forEach(s => subjectMap[s.subject_name] = s.id);

    // 4. Sync Syllabus Topics
    console.log("Syncing Topics and Subtopics...");
    const syllabusInserts = [];
    
    for (const [examName, subjectsObj] of Object.entries(syllabus)) {
        for (const [subjectName, topicsArr] of Object.entries(subjectsObj)) {
            for (const topic of topicsArr) {
                // Get subtopics from topics.json
                const subtopics = (topicsData[subjectName] && topicsData[subjectName][topic]) || ["General"];
                
                for (const subtopic of subtopics) {
                    syllabusInserts.push({
                        exam_id: examMap[examName],
                        subject_id: subjectMap[subjectName],
                        topic: topic,
                        subtopic: subtopic
                    });
                }
            }
        }
    }

    console.log(`Prepared ${syllabusInserts.length} syllabus targets. Inserting in batches...`);
    
    // Batch upsert to avoid request limits
    const BATCH_SIZE = 50;
    for (let i = 0; i < syllabusInserts.length; i += BATCH_SIZE) {
        const batch = syllabusInserts.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('syllabus_topics').upsert(batch, { 
            onConflict: 'exam_id,subject_id,topic,subtopic' 
        });
        if (error) {
            console.error(`Error syncing batch ${i}:`, error.message);
        }
    }

    console.log("✅ Syllabus successfully synced to Supabase!");
}

syncSyllabus().catch(console.error);
