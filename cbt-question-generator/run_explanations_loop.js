require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BATCH_SIZE = 5;          // Questions per batch
const DELAY_MS = 2000;          // 2 second delay between each question (safe for free tier)
const BATCH_PAUSE_MS = 10000;   // 10 second pause between batches

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getCount() {
  const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).is('explanation', null);
  return count;
}

async function runBatch() {
  const { data: questions, error } = await supabase
    .from('questions')
    .select(`id, question_text, subject, topic, question_answers (option_a, option_b, option_c, option_d, correct_option), answers (option_letter, option_text, is_correct)`)
    .is('explanation', null)
    .limit(BATCH_SIZE);

  if (error) { console.error('Fetch error:', error.message); return 0; }
  if (!questions || questions.length === 0) return 0;

  let successCount = 0;

  for (const q of questions) {
    let context = null;

    if (q.question_answers && q.question_answers.length > 0) {
      const qa = q.question_answers[0];
      const letter = qa.correct_option;
      context = {
        correct: qa[`option_${letter.toLowerCase()}`],
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
      console.log(`  ⚠ Skip ${q.id}: no answer data`);
      continue;
    }

    try {
      const prompt = `You are an expert tutor for Nigerian JAMB/WAEC/NECO students.
Subject: ${q.subject} | Topic: ${q.topic}
Question: ${q.question_text}
Options:\n${context.options}
Correct Answer: ${context.correct}

Write a concise explanation (max 80 words) of WHY the correct answer is right. Be clear and educational. No preamble like "Here is an explanation".`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: { temperature: 0.5 }
      });

      const explanation = response.text?.trim();
      if (explanation && explanation.length > 5) {
        const { error: upErr } = await supabase.from('questions').update({ explanation }).eq('id', q.id);
        if (upErr) throw upErr;
        successCount++;
        process.stdout.write(`  ✅ ${q.subject} / ${q.topic}\n`);
      }
    } catch (err) {
      console.error(`  ❌ ${q.id}: ${err.message}`);
    }

    await sleep(DELAY_MS); // Rate limit protection
  }

  return successCount;
}

async function main() {
  console.log('🚀 Starting Continuous Explanation Generator...');
  console.log(`   Batch size: ${BATCH_SIZE} | Delay: ${DELAY_MS}ms/question | Pause: ${BATCH_PAUSE_MS}ms/batch\n`);

  let totalDone = 0;
  let batchNum = 0;

  while (true) {
    const remaining = await getCount();
    if (remaining === 0) {
      console.log('\n🎉 ALL DONE! Every question now has an explanation.');
      break;
    }

    batchNum++;
    console.log(`\n📦 Batch #${batchNum} | Remaining: ${remaining.toLocaleString()} questions`);

    const done = await runBatch();
    totalDone += done;

    console.log(`   ✓ Batch complete. ${done} updated. Total so far: ${totalDone}`);

    if (done === 0) {
      console.log('⚠ No progress in last batch. Stopping to prevent loop.');
      break;
    }

    await sleep(BATCH_PAUSE_MS);
  }
}

main().catch(console.error);
