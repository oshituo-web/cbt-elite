require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyMock(examName, subjectName) {
    console.log(`\n--- Verification for ${examName} ${subjectName} ---`);
    
    // 1. Get Exam/Subject IDs
    const { data: exam } = await supabase.from('exams').select('id').eq('exam_name', examName).single();
    const { data: subject } = await supabase.from('subjects').select('id').eq('subject_name', subjectName).single();
    
    if (!exam || !subject) {
        console.log("Exam/Subject not found.");
        return;
    }

    // 2. Get Syllabus Topics
    const { data: topicsData } = await supabase
        .from('syllabus_topics')
        .select('topic')
        .eq('exam_id', exam.id)
        .eq('subject_id', subject.id);
    
    const topics = [...new Set(topicsData.map(t => t.topic))];
    console.log(`Total topics in syllabus: ${topics.length}`);

    if (topics.length === 0) return;

    // 3. Simulating Distribution Algorithm
    const targetTotal = 40;
    const perTopic = Math.floor(targetTotal / topics.length);
    const remainder = targetTotal % topics.length;

    console.log(`Target: ${targetTotal} Questions. Base per topic: ${perTopic}`);

    let totalSelected = 0;
    for (let i = 0; i < topics.length; i++) {
        const limit = perTopic + (i < remainder ? 1 : 0);
        const { count } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('exam_id', exam.id)
            .eq('subject_id', subject.id)
            .eq('topic', topics[i]);
            
        console.log(`- Topic: [${topics[i]}] | Available: ${count} | Target for Mock: ${limit}`);
        totalSelected += Math.min(count, limit);
    }
    
    console.log(`Final Mock Coverage: ${totalSelected}/${targetTotal} questions available from current database.`);
}

async function run() {
    await verifyMock('WAEC', 'Mathematics');
    await verifyMock('JAMB', 'English');
    await verifyMock('WAEC', 'Civic');
}

run();
