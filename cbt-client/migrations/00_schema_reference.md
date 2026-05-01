# CBT Elite Schema Reference

This document serves as a reference for the final database schema resulting from the 39 migrations in this project. Do not execute this file; it is for developer reference to avoid manually reading all past migrations.

## Core Tables

### `users`
- `id` (UUID, Primary Key) references `auth.users`
- `email`, `username`, `full_name`, `avatar_url` (TEXT)
- `role` (TEXT) - e.g. 'user', 'admin', 'moderator'
- `tier` (TEXT) - e.g. 'free', 'medium', 'lifetime'
- `is_activated` (BOOLEAN)
- `ai_credits` (INTEGER)
- `streak_count` (INTEGER), `streak_last_active` (DATE)
- `elite_coins` (INTEGER)
- `total_questions_answered`, `total_score` (INTEGER)
- `league_tier`, `league_score` (INTEGER)
- `is_flagged` (BOOLEAN), `flag_reason` (TEXT)
- `current_session_token` (TEXT) - Single device enforcement

### `questions`
- `id` (INTEGER, Primary Key)
- `exam_type` (TEXT) - e.g. 'JAMB', 'WAEC'
- `subject` (TEXT)
- `topic` (TEXT)
- `question_text` (TEXT)
- `explanation` (TEXT)
- `difficulty` (TEXT)
- `is_active` (BOOLEAN)

### `question_answers`
- `id` (INTEGER, Primary Key)
- `question_id` (INTEGER) references `questions(id)`
- `option_a`, `option_b`, `option_c`, `option_d` (TEXT)
- `correct_option` (TEXT) - 'A', 'B', 'C', 'D'
- `explanation` (TEXT)

### `exam_sessions`
- `id` (UUID, Primary Key)
- `user_id` (UUID) references `users(id)`
- `session_type` (TEXT) - 'practice', 'exam', 'clash'
- `score_percentage` (INTEGER)
- `total_questions`, `correct_answers` (INTEGER)
- `completed_at` (TIMESTAMPTZ)
- `session_data` (JSONB)

### `system_config`
- `key` (TEXT, Primary Key)
- `value` (JSONB / TEXT)
- Manages global settings (e.g. `broadcast_message`, `daily_goal_target`)

### `scheduled_clashes`
- `id` (UUID, Primary Key)
- `department` (TEXT)
- `week_date` (DATE)
- `type` (TEXT) - 'Normal', 'Super'
- `status` (TEXT)

## Core Security (Row Level Security - RLS)
- Most tables restrict `INSERT`, `UPDATE`, `DELETE` to admin roles.
- `users` table uses a trigger `protect_user_fields` to prevent users from updating sensitive fields (`tier`, `ai_credits`, `role`, `elite_coins`).
- Core updates to streaks and coins are performed via atomic RPCs (e.g. `sync_user_performance`, `secure_deduct_credit`, `atomic_store_purchase`) running with `SECURITY DEFINER` privileges.
