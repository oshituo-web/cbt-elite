-- 34_spaced_repetition.sql
-- Spaced Repetition Flashcards Implementation

-- 1. Create flashcards table
CREATE TABLE IF NOT EXISTS public.flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    question_id UUID REFERENCES public.questions(id) NOT NULL,
    interval_level INTEGER DEFAULT 0, -- 0 (new), 1 (1 day), 2 (3 days), 3 (7 days), 4 (30 days)
    next_review_at TIMESTAMPTZ DEFAULT NOW(),
    last_reviewed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active', -- active, mastered
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, question_id)
);

-- 2. Security & RLS
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own flashcards"
ON public.flashcards FOR ALL
USING (auth.uid() = user_id);

-- 3. Trigger to automatically generate a flashcard on wrong answer
-- This ensures the "Improve" loop is fully automated.
CREATE OR REPLACE FUNCTION trigger_create_mistake_flashcard()
RETURNS TRIGGER AS $$
BEGIN
  -- Only for wrong answers (assuming correct=false)
  IF NEW.is_correct = FALSE THEN
    INSERT INTO public.flashcards (user_id, question_id, next_review_at)
    VALUES (NEW.user_id, NEW.question_id, NOW())
    ON CONFLICT (user_id, question_id) 
    DO UPDATE SET 
      status = 'active', 
      interval_level = 0, 
      next_review_at = NOW(); -- Reset if they got it wrong again
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_wrong_answer_create_flashcard
AFTER INSERT ON public.user_responses
FOR EACH ROW
EXECUTE FUNCTION trigger_create_mistake_flashcard();

-- 4. RPC to update flashcard after review
CREATE OR REPLACE FUNCTION public.update_flashcard_review(p_card_id UUID, p_was_correct BOOLEAN)
RETURNS JSON AS $$
DECLARE
    v_new_level INTEGER;
    v_next_review TIMESTAMPTZ;
    v_intervals INTEGER[] := ARRAY[1, 3, 7, 30]; -- Intervals in days
BEGIN
    -- Verify ownership
    IF NOT EXISTS (SELECT 1 FROM public.flashcards WHERE id = p_card_id AND user_id = auth.uid()) THEN
        RETURN json_build_object('error', 'Unauthorized');
    END IF;

    IF p_was_correct THEN
        -- Move to next level
        SELECT interval_level + 1 INTO v_new_level FROM public.flashcards WHERE id = p_card_id;
        
        IF v_new_level > 4 THEN
            -- Mastered
            UPDATE public.flashcards SET status = 'mastered', last_reviewed_at = NOW() WHERE id = p_card_id;
            RETURN json_build_object('success', true, 'status', 'mastered');
        ELSE
            v_next_review := NOW() + (v_intervals[v_new_level] || ' days')::INTERVAL;
            UPDATE public.flashcards 
            SET interval_level = v_new_level, 
                next_review_at = v_next_review, 
                last_reviewed_at = NOW() 
            WHERE id = p_card_id;
            RETURN json_build_object('success', true, 'next_review', v_next_review);
        END IF;
    ELSE
        -- Reset level but don't delete
        UPDATE public.flashcards 
        SET interval_level = 0, 
            next_review_at = NOW() + INTERVAL '1 hour', 
            last_reviewed_at = NOW() 
        WHERE id = p_card_id;
        RETURN json_build_object('success', true, 'status', 'reset');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
