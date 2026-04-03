
const { createClient } = require('@supabase/supabase-client');
const path = require('path');
const fs = require('fs');

// Try multiple possible .env locations
const envPaths = [
    path.join(__dirname, '../cbt-client/.env'),
    path.join(__dirname, '../../.env'),
    'C:\\Users\\Precious\\CBT app\\cbt-client\\.env'
];

let envFound = false;
for (const p of envPaths) {
    if (fs.existsSync(p)) {
        require('dotenv').config({ path: p });
        envFound = true;
        break;
    }
}

if (!envFound) {
    console.error('Error: Could not find .env file in expected locations.');
    process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkProgress() {
    console.log('--- CBT ELITE Generation Progress Report ---');

    // 1. Overall Counts
    const examTypes = ['JAMB', 'WAEC', 'NECO'];
    const summary = {};

    for (const type of examTypes) {
        const { count } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('exam_type', type);
        summary[type] = count || 0;
    }

    const { count: totalCount } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true });

    console.log(`\nTotal Questions in Database: ${totalCount}`);
    Object.entries(summary).forEach(([type, count]) => {
        console.log(`- ${type}: ${count} questions`);
    });

    // 2. Performance Tracking
    console.log('\n--- Recent Activity (Last 10 mins) ---');
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', tenMinsAgo);
    
    console.log(`Generated in last 10 minutes: ${recentCount} questions`);
    
    if (recentCount > 0) {
        console.log('Status: \x1b[32mACTIVE\x1b[0m (Generating at ~' + (recentCount/10).toFixed(1) + ' Qs/min)');
    } else {
        console.log('Status: \x1b[31mIDLE\x1b[0m (Generator may have stopped or is rate-limited)');
    }

    // 3. Subject Coverage
    console.log('\n--- Top Subject Breakdown ---');
    const { data: subjectData } = await supabase
        .from('questions')
        .select('subject');
    
    const subjectMap = {};
    if (subjectData) {
        subjectData.forEach(q => {
            subjectMap[q.subject] = (subjectMap[q.subject] || 0) + 1;
        });
    }

    Object.entries(subjectMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .forEach(([sub, count]) => console.log(`- ${sub}: ${count}`));

    // 4. Latest Queue
    console.log('\n--- Latest 3 Questions ---');
    const { data: latest } = await supabase
        .from('questions')
        .select('question_text, exam_type, subject, topic, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

    if (latest && latest.length > 0) {
        latest.forEach((q, i) => {
            console.log(`${i+1}. [${q.exam_type}] ${q.subject} - ${q.topic}`);
            console.log(`   Text: ${q.question_text.substring(0, 80)}...`);
            console.log(`   Time: ${new Date(q.created_at).toLocaleTimeString()}`);
        });
    } else {
        console.log('No questions found in latest fetch.');
    }
}

checkProgress().catch(err => {
    console.error('Fatal error during report generation:', err);
});
