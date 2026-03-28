-- Ensure syllabus_topics has a unique constraint for syncing
-- Run this in the Supabase SQL Editor
ALTER TABLE syllabus_topics ADD CONSTRAINT unique_exam_subject_topic UNIQUE (exam_id, subject_id, topic);
