-- Create the user_seen_questions table
CREATE TABLE IF NOT EXISTS user_seen_questions (
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
    seen_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id, question_id)
);

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_seen_questions_user_id ON user_seen_questions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_seen_questions_question_id ON user_seen_questions (question_id);
CREATE INDEX IF NOT EXISTS idx_user_seen_questions_user_question ON user_seen_questions (user_id, question_id);


-- Ensure system_config table exists (if not already created by another migration)
CREATE TABLE IF NOT EXISTS system_config (
    key text PRIMARY KEY,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Add premium_globally_enabled to system_config if it doesn't exist
INSERT INTO system_config (key, value)
VALUES ('premium_globally_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- Optionally, add a function to update `updated_at` automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_system_config_updated_at ON system_config;
CREATE TRIGGER set_system_config_updated_at
BEFORE UPDATE ON system_config
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
