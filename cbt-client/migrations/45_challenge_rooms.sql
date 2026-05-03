-- Migration 45: Challenge Rooms (Multiplayer Mode)
-- Creates the tables needed for the live "Challenge a Friend" feature.

-- 1. Challenge Rooms table: stores the session metadata
CREATE TABLE IF NOT EXISTS public.challenge_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code TEXT NOT NULL UNIQUE,
    host_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    subject TEXT NOT NULL,
    exam_type TEXT NOT NULL DEFAULT 'JAMB',
    question_count INTEGER NOT NULL DEFAULT 20,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished')),
    question_ids JSONB NOT NULL DEFAULT '[]',
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Challenge Participants table: stores real-time scores per participant
CREATE TABLE IF NOT EXISTS public.challenge_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.challenge_rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    score INTEGER NOT NULL DEFAULT 0,
    answers_submitted INTEGER NOT NULL DEFAULT 0,
    is_finished BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

-- 3. Enable Realtime on participants table so scores broadcast live
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_rooms;

-- 4. RLS Policies: Users can only see rooms they are in or are waiting
ALTER TABLE public.challenge_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read waiting rooms" ON public.challenge_rooms
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create rooms" ON public.challenge_rooms
    FOR INSERT WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can update their room" ON public.challenge_rooms
    FOR UPDATE USING (auth.uid() = host_id);

CREATE POLICY "Anyone can read participants" ON public.challenge_participants
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can join rooms" ON public.challenge_participants
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participant record" ON public.challenge_participants
    FOR UPDATE USING (auth.uid() = user_id);

-- 5. Helper function to generate a short, unique 6-char room code
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..6 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 6. Performance indexes
CREATE INDEX IF NOT EXISTS idx_challenge_rooms_code ON public.challenge_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_room ON public.challenge_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user ON public.challenge_participants(user_id);
