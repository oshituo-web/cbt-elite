-- 1. Add Streak Tracking to Users Table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Seed News & Updates Content
DELETE FROM public.news_updates; -- Clear old/empty entries

INSERT INTO public.news_updates (title, summary, content, category, created_at)
VALUES 
('JAMB 2026 Registration Guidelines', 'Official registration for the 2026 UTME has commenced. Ensure you have your NIN ready.', 'The Joint Admissions and Matriculation Board (JAMB) has announced that registration for the 2026 Unified Tertiary Matriculation Examination (UTME) will run from January to February. Candidates are advised to create their profiles using their National Identification Number (NIN).', 'JAMB', NOW()),

('WAEC 2026 Timetable Released', 'The West African Examinations Council has published the official May/June timetable.', 'WAEC has officially released the timetable for the 2026 West African Senior School Certificate Examination (WASSCE) for school candidates. The exams are scheduled to begin in early May. Students are encouraged to download the PDF from the official portal.', 'WAEC', NOW() - INTERVAL '2 days'),

('CBT Elite AI Tutor Upgrade', 'Unlock new step-by-step solutions for Mathematics and Physics with our latest AI model.', 'We have upgraded our AI Tutor to provide even more granular explanations for complex calculations. This feature is now available for all Premium users in the Mock Exam and Practice modes.', 'General', NOW() - INTERVAL '5 hours'),

('Post-UTME Admission Screening Dates', 'Several universities have announced dates for their 2026/2027 screening exercises.', 'University of Lagos (UNILAG), UI, and OAU have updated their admission portals with screening dates for the upcoming academic session. Candidates who scored above 200 in JAMB are eligible to apply.', 'Admission', NOW() - INTERVAL '1 day');
