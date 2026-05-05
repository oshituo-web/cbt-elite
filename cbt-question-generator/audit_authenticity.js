const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient('https://hwmbmbxblftpkqikbiff.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3bWJtYnhibGZ0cGtxaWtiaWZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzA0NDgzNSwiZXhwIjoyMDc4NjIwODM1fQ.-SnZJbpqsm39Akdv-bV_IiJwbhjtzD2wkHG52ExFLa4');

async function auditQuestions() {
  console.log('Starting batch question authenticity audit...');
  
  const { data: questions, error: qError } = await supabase
    .from('questions')
    .select('id, question_text');

  if (qError) {
    console.error('Error fetching questions:', qError);
    return;
  }

  const flagged = [];
  const batchSize = 100;
  
  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);
    const questionIds = batch.map(q => q.id);

    const { data: answers, error: aError } = await supabase
      .from('question_answers')
      .select('question_id, option_letter, option_text, is_correct')
      .in('question_id', questionIds);

    if (aError) {
      console.error(`Error fetching answers for batch ${i}:`, aError);
      continue;
    }

    for (const q of batch) {
      const qAnswers = answers.filter(a => a.question_id === q.id);
      
      const hasCorrect = qAnswers.some(a => a.is_correct === true);
      const emptyOptions = qAnswers.filter(a => !a.option_text || a.option_text.trim() === '');

      if (!hasCorrect || emptyOptions.length > 0) {
        flagged.push({
          id: q.id,
          text: q.question_text.substring(0, 50) + '...',
          issues: [
            !hasCorrect ? 'No correct answer marked.' : null,
            emptyOptions.length > 0 ? `${emptyOptions.length} empty option(s).` : null
          ].filter(Boolean).join(' ')
        });
      }
    }
    console.log(`Processed ${i + batch.length}/${questions.length}...`);
  }

  fs.writeFileSync('audit_results.json', JSON.stringify(flagged, null, 2));
  console.log(`Audit complete. Found ${flagged.length} issues. Results saved to audit_results.json.`);
}

auditQuestions();
