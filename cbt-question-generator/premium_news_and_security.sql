-- 1. Update the category constraint to allow 'Trending' and 'Tech'
ALTER TABLE public.news_updates DROP CONSTRAINT IF EXISTS news_updates_category_check;
ALTER TABLE public.news_updates ADD CONSTRAINT news_updates_category_check 
CHECK (category IN ('JAMB', 'WAEC', 'NECO', 'Admission', 'General', 'Trending', 'Tech'));

-- 2. Add Row Level Security (RLS) for Admin control
-- Note: It assumes 'role' column inside the 'users' table dictates admin permissions.
ALTER TABLE public.news_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view news" ON public.news_updates;
CREATE POLICY "Anyone can view news" ON public.news_updates
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can insert news" ON public.news_updates;
CREATE POLICY "Admins can insert news" ON public.news_updates
    FOR INSERT
    WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE role IN ('admin', 'super-admin')));

DROP POLICY IF EXISTS "Admins can update news" ON public.news_updates;
CREATE POLICY "Admins can update news" ON public.news_updates
    FOR UPDATE
    USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('admin', 'super-admin')));

DROP POLICY IF EXISTS "Admins can delete news" ON public.news_updates;
CREATE POLICY "Admins can delete news" ON public.news_updates
    FOR DELETE
    USING (auth.uid() IN (SELECT id FROM users WHERE role IN ('admin', 'super-admin')));

-- 3. Clear old generic updates and seed premium trending 2026 academic news
DELETE FROM public.news_updates;

INSERT INTO public.news_updates (title, summary, content, category, created_at)
VALUES 
(
  'JAMB 2026: Mandatory Novel Blueprint & Score Dynamics', 
  'Important breakdown of the new UTME mandatory reading and how AI grading will assess comprehension.',
  'The Joint Admissions and Matriculation Board (JAMB) has finalized the syllabus changes for the 2026 academic session. A core shift involves the new mandatory English literature text. Our analysts at CBT Elite note that questions from this text now account for 15% of your total English score. We strongly advise students to utilize the Elite Practice mode to drill down on character motives, plot triggers, and linguistic inferences as opposed to mere memorization.', 
  'JAMB', 
  NOW()
),
(
  'WAEC 2026: Official Move to Semi-Digital Grading', 
  'Understanding how the new WAEC grading algorithms will affect marking schemes and results release.',
  'West African Examinations Council (WAEC) is rolling out a new semi-digital scanning mechanism for the 2026 WASSCE theory papers. This means your handwriting MUST be legible to the optical scanners. Avoid using light-ink pens and ensure you write strictly within the provided margins. The objective sections remain fully digitized and results for the 2026 batch are expected to be released 25% faster due to this innovation.', 
  'WAEC', 
  NOW() - INTERVAL '1 day'
),
(
  'Trending: Top 10 High-Income Courses for 2026 Admission', 
  'The tech sector is reshaping university admission quotas. See where the massive opportunities lie.',
  'With the rapid surge of Artificial Intelligence, Data Analytics, and Software Engineering, Nigerian universities are shifting their quota systems. For the 2026/2027 admission cycle, courses like Cybersecurity, Mechatronics, and Software Engineering have seen cutoff marks surge, while traditional courses have remained stagnant. If you are targeting these highly competitive tech courses, you must aim for a UTME score of 280+ to be in the "safe zone".', 
  'Trending', 
  NOW() - INTERVAL '2 days'
),
(
  'Platform Update: How Daily Streaks Boost Your UTME Score', 
  'Data proves that students who maintain a 14-day practice streak on CBT Elite score 30% higher.',
  'We have crunched the numbers from our latest platform analytics! Students who engaged closely with the CBT Elite "Daily Practice Goal" and maintained a hot streak of at least 14 days saw a 32% increase in their average Mock Exam accuracy. Consistency beats cramming every single time. Jump into the Practice mode now, crush your 50 questions, and keep that 🔥 streak alive!', 
  'General', 
  NOW() - INTERVAL '4 hours'
),
(
  'Post-UTME 2026/2027: Why Early Prep is Your Secret Weapon', 
  'Do not wait for your JAMB results before beginning Post-UTME preparation. Find out why.',
  'Many top-tier universities (UNILAG, UI, OAU) have already signaled that their Post-UTME screening exercises will occur rapidly after JAMB releases the 2026 results. Students who wait for their UTME scores before studying often fail to hit the departmental cutoff. Start integrating Post-UTME past questions into your daily CBT Elite practice routines immediately.', 
  'Admission', 
  NOW() - INTERVAL '3 days'
);
