require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BATCH_SIZE = 10;          
const DELAY_MS = 3000;          
const BATCH_PAUSE_MS = 10000;   

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getCount() {
  const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).is('explanation', null);
  return count;
}

async function runBatch() {
  const { data: questions, error } = await supabase
    .from('questions')
    .select(`id, question_text, subject, topic, question_type, question_answers (option_a, option_b, option_c, option_d, correct_option), answers (option_letter, option_text, is_correct)`)
    .is('explanation', null)
    .limit(BATCH_SIZE);

  if (error) { console.error('Fetch error:', error.message); return 0; }
  if (!questions || questions.length === 0) return 0;

  let successCount = 0;

  for (const q of questions) {
    let context = null;
    let prompt = "";

    if (q.question_type === 'theory') {
        prompt = `You are an expert tutor for Nigerian JAMB/WAEC/NECO students.
Subject: ${q.subject} | Topic: ${q.topic}
Type: Theory Question
Question: ${q.question_text}

Provide a comprehensive "Suggested Solution" or "Marking Guide" for this theory question. 
Ensure it covers all parts of the question (e.g., definitions, lists, explanations).
Be concise but thorough enough for a student to understand full-mark requirements.
Max 150 words. No preamble.`;
    } else {
        if (q.question_answers && q.question_answers.length > 0) {
            const qa = q.question_answers[0];
            const letter = qa.correct_option;
            context = {
                correct: qa[`option_${letter?.toLowerCase()}`],
                options: `A: ${qa.option_a}\nB: ${qa.option_b}\nC: ${qa.option_c}\nD: ${qa.option_d}`
            };
        } else if (q.answers && q.answers.length > 0) {
            const correct = q.answers.find(a => a.is_correct);
            if (correct) {
                context = {
                    correct: correct.option_text,
                    options: q.answers.sort((a,b) => a.option_letter.localeCompare(b.option_letter)).map(a => `${a.option_letter}: ${a.option_text}`).join('\n')
                };
            }
        }

        if (!context) {
            console.log(`  ⚠ Skip ${q.id}: no answer data for objective question`);
            // To prevent getting stuck on orphans, mark them with a placeholder or skip
            await supabase.from('questions').update({ explanation: 'Explanation pending manual review (Missing Options Data)' }).eq('id', q.id);
            continue;
        }

        prompt = `You are an expert tutor for Nigerian JAMB/WAEC/NECO students.
Subject: ${q.subject} | Topic: ${q.topic}
Question: ${q.question_text}
Options:\n${context.options}
Correct Answer: ${context.correct}

Write a concise explanation (max 80 words) of WHY the correct answer is right. Be clear and educational. No preamble.`;
    }

    try {
      console.log(`  \u231B Generating for ${q.id} (${q.question_type})...`);
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: prompt,
        config: { temperature: 0.5 }
      });

      const explanation = response.text?.trim();
      if (explanation && explanation.length > 5) {
        const { error: upErr } = await supabase.from('questions').update({ explanation }).eq('id', q.id);
        if (upErr) throw upErr;
        successCount++;
        process.stdout.write(`  ✅ ${q.subject} / ${q.topic} (${q.question_type})\n`);
      }
    } catch (err) {
      if (err.message.includes('429')) {
          console.error(`  ⛔ Rate Limit Hit (429). Waiting for next batch...`);
          return successCount; // Exit batch early
      }
      console.error(`  ❌ ${q.id}: ${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  return successCount;
}

async function main() {
  console.log('🚀 Starting Universal Explanation Generator (Theory + Objective)...');
  
  let totalDone = 0;
  let batchNum = 0;

  while (true) {
    const remaining = await getCount();
    if (remaining === 0) {
      console.log('\n🎉 ALL DONE! Every question now has an explanation/solution.');
      break;
    }

    batchNum++;
    console.log(`\n📦 Batch #${batchNum} | Remaining: ${remaining.toLocaleString()} questions`);

    const done = await runBatch();
    totalDone += done;

    console.log(`   ✓ Batch complete. ${done} updated. Total so far: ${totalDone}`);

    if (done === 0) {
      // If we skipped everything in a batch (orphans), we should continue, 
      // but my code above marks orphans so remaining count WILL decrease.
      const stillRemaining = await getCount();
      if (stillRemaining === remaining) {
          console.log('⚠ No progress in last batch and remaining count unchanged. Stopping to prevent loop.');
          break;
      }
    }

    await sleep(BATCH_PAUSE_MS);
  }
}

main().catch(console.error);
