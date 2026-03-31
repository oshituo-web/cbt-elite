require('dotenv/config')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function runMigration() {
  console.log('🔄 Creating news_updates table...')

  const { error: sqlError } = await supabase.rpc('run_sql', {
    sql_query: `
      CREATE TABLE IF NOT EXISTS public.news_updates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          summary TEXT,
          content TEXT,
          category TEXT CHECK (category IN ('JAMB', 'WAEC', 'NECO', 'Admission', 'General')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      ALTER TABLE public.news_updates ENABLE ROW LEVEL SECURITY;
      
      -- Drop if exists just in case we re-run
      DROP POLICY IF EXISTS "Anyone can view news" ON public.news_updates;
      
      CREATE POLICY "Anyone can view news" ON public.news_updates
          FOR SELECT
          USING (true);
    `
  })

  if (sqlError && sqlError.message.includes('run_sql')) {
      console.log('⚠️ run_sql RPC not found. Asking user to run the manual SQL script on Supabase Dashboard.')
  } else if (sqlError) {
      console.error('❌ SQL Execution failed:', sqlError)
  } else {
      console.log('✅ Table created successfully!')
  }

  // Seed sample data
  console.log('🌱 Seeding sample news list...')
  const { error: insertError } = await supabase
    .from('news_updates')
    .upsert([
        {
            title: 'JAMB 2026 Registration Guidelines Announced',
            summary: 'Ensure your NIN has been updated and verified before heading to the accredited centers.',
            content: 'The Joint Admissions and Matriculation Board (JAMB) has officially announced the registration dates and guidelines for the 2026 Unified Tertiary Matriculation Examination (UTME).\\n\\nCandidates are strongly advised to secure their National Identification Number (NIN) early as it is a mandatory requirement for profile creation. The registration portal will open on January 15th, 2026, and close exactly four weeks later. No extensions will be granted.\\n\\nPlease ensure you prepare your CBT Elite profile properly to maximize your performance on the actual exam day.',
            category: 'JAMB'
        },
        {
            title: 'WAEC Timetable Released Internally',
            summary: 'Schools are preparing their candidates for the early April kickoff of practical exams.',
            content: 'The West African Examinations Council (WAEC) has released the provisional 2026 timetable to secondary school administrators. Practical examinations for science subjects (Physics, Chemistry, and Biology) are scheduled to begin in the first week of April.\\n\\nCBT Elite has updated its database to reflect the latest syllabus requirements to ensure every candidate is fully prepared for both objective and theory sections of the examination.',
            category: 'WAEC'
        }
    ], { onConflict: 'title' })

  if (insertError) {
      console.error('❌ Database insertion failed:', insertError)
  } else {
      console.log('✅ Success! Seed data ingested.')
  }
}

runMigration()
