import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function renameCivic() {
  console.log("Renaming Civic to Citizenship and Heritage Study...");

  // Update Subjects Table
  const { data: sData, error: sErr } = await supabase
    .from('subjects')
    .update({ subject_name: 'Citizenship and Heritage Study' })
    .ilike('subject_name', '%civic%');
    
  if (sErr) console.error("Subject error:", sErr);
  else console.log("Subjects updated successfully.");

  // Update Questions Table
  const { data: qData, error: qErr } = await supabase
    .from('questions')
    .update({ subject: 'Citizenship and Heritage Study' })
    .ilike('subject', '%civic%');
    
  if (qErr) console.error("Questions error:", qErr);
  else console.log("Questions updated successfully.");
}

renameCivic();
