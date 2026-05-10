import { supabase } from '../utils/supabase'
import { DataService } from './data'

/**
 * MultiplayerService
 * Handles creating, joining, and real-time synchronization of Challenge Rooms.
 */
export const MultiplayerService = {

    _realtimeChannel: null,

    /**
     * Creates a new challenge room and returns the room code.
     */
    async createRoom(hostProfile, subject, examType = 'JAMB', questionCount = 20) {
        // 1. Fetch questions for the room
        let { data: questions } = await DataService.getPracticeQuestions(
            subject, '', questionCount, examType, 'past'
        );
        questions = questions || [];

        if (questions.length < 5) {
            const { data: aiQuestions } = await DataService.getPracticeQuestions(
                subject, '', questionCount, examType, 'ai'
            );
            if (aiQuestions && aiQuestions.length > 0) {
                questions.push(...aiQuestions);
            }
            if (questions.length < 5) throw new Error("Not enough questions found for this subject.");
        }

        // 2. Generate a unique room code
        const { data: codeRow } = await supabase.rpc('generate_room_code');
        const roomCode = codeRow || Math.random().toString(36).substring(2, 8).toUpperCase();

        // 3. Create the room
        const { data: room, error } = await supabase.from('challenge_rooms').insert({
            room_code: roomCode,
            host_id: hostProfile.id,
            subject,
            exam_type: examType,
            question_count: questions.length,
            question_ids: questions.map(q => q.id),
            status: 'waiting'
        }).select().single();

        if (error) throw new Error(`Room creation failed: ${error.message}`);

        // 4. Join the host as the first participant
        await supabase.from('challenge_participants').insert({
            room_id: room.id,
            user_id: hostProfile.id,
            display_name: hostProfile.display_name || hostProfile.email,
            avatar_url: hostProfile.avatar_url || null,
            score: 0,
            answers_submitted: 0
        });

        return room;
    },

    /**
     * Joins an existing room by room code. Returns the room + its questions.
     */
    async joinRoom(roomCode, userProfile) {
        const { data: room, error } = await supabase
            .from('challenge_rooms')
            .select('*')
            .eq('room_code', roomCode.toUpperCase().trim())
            .single();

        if (error || !room) throw new Error("Room not found. Check the code and try again.");
        if (room.status === 'finished') throw new Error("This challenge has already ended.");

        // Add participant (ignore conflict if already joined)
        await supabase.from('challenge_participants').upsert({
            room_id: room.id,
            user_id: userProfile.id,
            display_name: userProfile.display_name || userProfile.email,
            avatar_url: userProfile.avatar_url || null
        }, { onConflict: 'room_id,user_id' });

        // Fetch the actual question objects
        const questionIds = room.question_ids || [];
        const { data: questions } = await supabase
            .from('questions')
            .select('*, question_answers(*)')
            .in('id', questionIds);

        return { room, questions: questions || [] };
    },

    /**
     * Starts the challenge (host only). Sets status to 'active'.
     */
    async startChallenge(roomId, hostId) {
        const { error } = await supabase
            .from('challenge_rooms')
            .update({ status: 'active', started_at: new Date().toISOString() })
            .eq('id', roomId)
            .eq('host_id', hostId);

        if (error) throw new Error(`Could not start challenge: ${error.message}`);
    },

    /**
     * Submits a score update for the current user in real-time.
     */
    async submitScore(roomId, userId, score, answersSubmitted, isFinished = false) {
        const { error } = await supabase
            .from('challenge_participants')
            .update({ score, answers_submitted: answersSubmitted, is_finished: isFinished })
            .eq('room_id', roomId)
            .eq('user_id', userId);

        if (error) console.error("Score submission error:", error);
    },

    /**
     * Subscribes to real-time participant score updates for a room.
     * @param {string} roomId - The room UUID.
     * @param {Function} onUpdate - Callback with updated participants array.
     */
    subscribeToRoom(roomId, onUpdate) {
        // Clean up any existing subscription first
        this.unsubscribe();

        this._realtimeChannel = supabase
            .channel(`challenge_room_${roomId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'challenge_participants',
                filter: `room_id=eq.${roomId}`
            }, async () => {
                // Re-fetch full participant list on any change
                const { data: participants } = await supabase
                    .from('challenge_participants')
                    .select('*')
                    .eq('room_id', roomId)
                    .order('score', { ascending: false });
                
                if (onUpdate) onUpdate(participants || []);
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'challenge_rooms',
                filter: `id=eq.${roomId}`
            }, (payload) => {
                if (onUpdate) onUpdate(null, payload.new); // room status update
            })
            .subscribe();
    },

    /**
     * Unsubscribes from the current Realtime channel.
     */
    unsubscribe() {
        if (this._realtimeChannel) {
            supabase.removeChannel(this._realtimeChannel);
            this._realtimeChannel = null;
        }
    },

    /**
     * Fetches all participants in a room, sorted by score.
     */
    async getLeaderboard(roomId) {
        const { data, error } = await supabase
            .from('challenge_participants')
            .select('*')
            .eq('room_id', roomId)
            .order('score', { ascending: false });

        if (error) return [];
        return data;
    }
};
