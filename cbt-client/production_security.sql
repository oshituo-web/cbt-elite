--------------------------------------------------------------------------------
-- 0. CREATE TABLES (IF NOT EXISTS)
--------------------------------------------------------------------------------

-- Admin Audit Logs
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    admin_email TEXT NOT NULL,
    action TEXT NOT NULL,
    target_id TEXT,
    details TEXT
);

-- Promo Codes
CREATE TABLE IF NOT EXISTS promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    code TEXT UNIQUE NOT NULL,
    percent INTEGER NOT NULL,
    expiry_date DATE
);

-- System Config
CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    key TEXT UNIQUE NOT NULL,
    value TEXT
);

--------------------------------------------------------------------------------
-- 1. ENABLE ROW LEVEL SECURITY (RLS)
--------------------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE theory_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

--------------------------------------------------------------------------------
-- 2. GLOBAL CONTENT POLICIES (Read-Only for students)
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read access on subjects" ON subjects;
CREATE POLICY "Allow public read access on subjects" ON subjects FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access on syllabus_topics" ON syllabus_topics;
CREATE POLICY "Allow public read access on syllabus_topics" ON syllabus_topics FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access on questions" ON questions;
CREATE POLICY "Allow public read access on questions" ON questions FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Allow public read access on answers" ON answers;
CREATE POLICY "Allow public read access on answers" ON answers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read on promo_codes" ON promo_codes;
CREATE POLICY "Allow public read on promo_codes" ON promo_codes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read on config" ON system_config;
CREATE POLICY "Allow public read on config" ON system_config FOR SELECT USING (true);

--------------------------------------------------------------------------------
-- 3. USER DATA POLICIES (Strict Isolation)
--------------------------------------------------------------------------------
-- Exam Sessions
DROP POLICY IF EXISTS "Users can insert their own sessions" ON exam_sessions;
CREATE POLICY "Users can insert their own sessions" ON exam_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view their own sessions" ON exam_sessions;
CREATE POLICY "Users can view their own sessions" ON exam_sessions FOR SELECT USING (auth.uid() = user_id);

-- User Responses
DROP POLICY IF EXISTS "Users can insert their own responses" ON user_responses;
CREATE POLICY "Users can insert their own responses" ON user_responses FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view their own responses" ON user_responses;
CREATE POLICY "Users can view their own responses" ON user_responses FOR SELECT USING (auth.uid() = user_id);

-- Bookmarks
DROP POLICY IF EXISTS "Users can manage their own bookmarks" ON bookmarks;
CREATE POLICY "Users can manage their own bookmarks" ON bookmarks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Progress & Mastery
DROP POLICY IF EXISTS "Users can manage their topic mastery" ON topic_mastery;
CREATE POLICY "Users can manage their topic mastery" ON topic_mastery FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their weekly summaries" ON weekly_summaries;
CREATE POLICY "Users can manage their weekly summaries" ON weekly_summaries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Theory Submissions
DROP POLICY IF EXISTS "Users can insert theory submissions" ON theory_submissions;
CREATE POLICY "Users can insert theory submissions" ON theory_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view their own theory submissions" ON theory_submissions;
CREATE POLICY "Users can view their own theory submissions" ON theory_submissions FOR SELECT USING (auth.uid() = user_id);

--------------------------------------------------------------------------------
-- 4. STAFF & ADMIN POLICIES
--------------------------------------------------------------------------------
-- Admin Audit Logs
DROP POLICY IF EXISTS "Only staff can view audit logs" ON admin_audit_logs;
CREATE POLICY "Only staff can view audit logs" ON admin_audit_logs 
  FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role = 'admin' OR email = 'oshituo@gmail.com')));

-- Manage Promo Codes
DROP POLICY IF EXISTS "Only staff can manage promo_codes" ON promo_codes;
CREATE POLICY "Only staff can manage promo_codes" ON promo_codes 
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role = 'admin' OR role = 'moderator' OR email = 'oshituo@gmail.com')));

-- Manage System Config
DROP POLICY IF EXISTS "Only staff can manage config" ON system_config;
CREATE POLICY "Only staff can manage config" ON system_config 
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role = 'admin' OR email = 'oshituo@gmail.com')));

--------------------------------------------------------------------------------
-- 5. PERFORMANCE INDEXES
--------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_questions_exam_subject ON questions(exam_id, subject_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_audit_email ON admin_audit_logs(admin_email);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON exam_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_responses_session_id ON user_responses(session_id);
