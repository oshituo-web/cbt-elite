-- DATABASE PERFORMANCE OPTIMIZATION
-- AIM: Speed up random question fetching and session history lookups.

-- 1. Optimized indexes for get_random_question_ids RPC
-- These allow the database to quickly filter by subject/exam before applying randomization.
CREATE INDEX IF NOT EXISTS idx_questions_query_active 
ON questions (subject_id, exam_id, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_questions_exam_type 
ON questions (exam_type) 
WHERE is_active = true;

-- 2. Indexes for faster Analytics & Results saving
CREATE INDEX IF NOT EXISTS idx_user_responses_lookup 
ON user_responses (user_id, question_id, is_correct);

CREATE INDEX IF NOT EXISTS idx_exam_sessions_user_recent 
ON exam_sessions (user_id, completed_at DESC);

-- 3. Schema consistency check: Ensure total_questions and answered_questions exist
-- (Adding them only if missing to prevent 400 errors found in logs)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exam_sessions' AND column_name='answered_questions') THEN
        ALTER TABLE exam_sessions ADD COLUMN answered_questions INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exam_sessions' AND column_name='time_taken_seconds') THEN
        ALTER TABLE exam_sessions ADD COLUMN time_taken_seconds INTEGER DEFAULT 0;
    END IF;
END $$;
