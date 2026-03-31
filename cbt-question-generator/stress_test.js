require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CONCURRENCY = 10;
const SESSIONS_PER_USER = 5;
const QUESTIONS_PER_SESSION = 20;

async function simulateUser(userId, userIndex) {
    console.log(`[User ${userIndex}] 🚀 Starting stress simulation...`);
    const results = [];

    for (let s = 1; s <= SESSIONS_PER_USER; s++) {
        const startTime = Date.now();
        
        // 1. Fetch Random Questions (Simulate Practice Start)
        const { data: qPool, error: qErr } = await supabase
            .from('questions')
            .select('id, question_text, topic, subject')
            .eq('is_active', true)
            .limit(100); // Pool to sample from
            
        if (qErr) {
            console.error(`[User ${userIndex}] Q-Fetch Error:`, qErr.message);
            continue;
        }
        
        const sampled = qPool.sort(() => Math.random() - 0.5).slice(0, QUESTIONS_PER_SESSION);
        const fetchTime = Date.now() - startTime;
        
        // 2. Simulate "Taking the Exam" (wait 1s)
        await new Promise(r => setTimeout(r, 1000));
        
        // 3. Save Session (Simulate Submission)
        const saveStart = Date.now();
        const score = Math.floor(Math.random() * QUESTIONS_PER_SESSION);
        const percent = Math.round((score / QUESTIONS_PER_SESSION) * 100);
        
        const { data: session, error: sError } = await supabase
            .from('exam_sessions')
            .insert({ 
                user_id: userId,
                session_type: 'Stress Test',
                total_questions: QUESTIONS_PER_SESSION,
                correct_answers: score,
                score_percentage: percent,
                time_taken_seconds: 60,
                completed_at: new Date().toISOString()
            })
            .select()
            .single();

        if (sError) {
            console.error(`[User ${userIndex}] Session Save Error:`, sError.message);
            continue;
        }

        // 4. Heavy Response Batch (The real stressor)
        const responses = sampled.map((q, i) => ({
            session_id: session.id,
            user_id: userId,
            question_id: q.id,
            is_correct: i < score,
            time_spent_seconds: 3
        }));
        
        const { error: rError } = await supabase.from('user_responses').insert(responses);
        if (rError) console.error(`[User ${userIndex}] Responses Error:`, rError.message);
        
        const saveTime = Date.now() - saveStart;
        results.push({ fetchTime, saveTime });
        console.log(`[User ${userIndex}] ✅ Session ${s} complete (Fetch: ${fetchTime}ms, Save: ${saveTime}ms)`);
    }
    
    return results;
}

async function runStressTest() {
    console.log("\n--- 🏁 STARTING FINAL PLATFORM STRESS-TEST ---");
    
    // We'll use the 'tester' user account for all simulations if available, or just the provided one.
    const { data: user } = await supabase.from('users').select('id').eq('email', 'oshituo@gmail.com').single();
    if (!user) {
        console.error("Test user not found.");
        return;
    }

    const start = Date.now();
    const tasks = [];
    for (let i = 0; i < CONCURRENCY; i++) {
        tasks.push(simulateUser(user.id, i + 1));
    }

    const allResults = await Promise.all(tasks);
    const flatResults = allResults.flat();
    
    const totalTime = Date.now() - start;
    const avgFetch = flatResults.reduce((a, b) => a + b.fetchTime, 0) / flatResults.length;
    const avgSave = flatResults.reduce((a, b) => a + b.saveTime, 0) / flatResults.length;

    console.log("\n--- 📊 STRESS-TEST RESULTS ---");
    console.log(`Total Simulation Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`Total Sessions Processed: ${flatResults.length}`);
    console.log(`Average Q-Fetch Latency: ${avgFetch.toFixed(2)}ms`);
    console.log(`Average Session Save Latency: ${avgSave.toFixed(2)}ms`);
    console.log("-------------------------------\n");
}

runStressTest().catch(console.error);
