require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkDiversity(subjectId, limit = 20) {
    console.log(`\n🔍 Auditing Topic Diversity for Subject ID: ${subjectId}`);
    
    // 1. Get total count
    const { count: totalCount } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('subject_id', subjectId)
        .eq('is_active', true);
    
    console.log(`📈 Total Questions for this subject: ${totalCount}`);
    
    // 2. Simulate current randomization logic (Buffer and Shuffle)
    const bufferSize = Math.min(totalCount, limit * 4);
    const maxOffset = Math.floor(Math.random() * (totalCount - bufferSize));
    
    console.log(`🎲 Using Random Offset: ${maxOffset} (Buffer: ${bufferSize})`);
    
    const { data: questions, error } = await supabase
        .from('questions')
        .select('topic')
        .eq('subject_id', subjectId)
        .eq('is_active', true)
        .range(maxOffset, maxOffset + bufferSize - 1);
        
    if (error) {
        console.error("Fetch Error:", error);
        return;
    }

    // Shuffle and pick 'limit' items
    const shuffled = questions.sort(() => Math.random() - 0.5);
    const result = shuffled.slice(0, limit);

    // 3. Analyze topics
    const topics = result.map(q => q.topic || 'Unknown');
    const topicCounts = {};
    topics.forEach(t => topicCounts[t] = (topicCounts[t] || 0) + 1);
    
    console.log("📊 Resulting Topic Distribution:");
    console.table(topicCounts);
    
    const uniqueTopics = Object.keys(topicCounts).length;
    console.log(`✨ Unique Topics: ${uniqueTopics} out of ${limit} questions.`);
    
    if (uniqueTopics < 3 && limit >= 10) {
        console.warn("⚠️  DIVERSITY ALERT: Too many questions from the same topic clusters!");
        return false;
    } else {
        console.log("✅ DIVERSITY OK: Questions are spread across topics.");
        return true;
    }
}

async function runAudit() {
    // Get a subject with many questions
    const { data: qSample } = await supabase.from('questions').select('subject_id').limit(1);
    const subId = qSample[0]?.subject_id;
    
    if (!subId) {
        console.log("No questions found to audit.");
        return;
    }

    let allOk = true;
    for (let i = 0; i < 3; i++) {
        const ok = await checkDiversity(subId);
        if (!ok) allOk = false;
    }
    
    if (!allOk) {
        console.log("\n❌ RE-ENGINEERING REQUIRED: Randomization strategy is still too clustered.");
    } else {
        console.log("\n🏆 SUCCESS: Randomization strategy provides sufficient diversity.");
    }
}

runAudit().catch(console.error);
