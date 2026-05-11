-- Fix orphaned answers from generate_empty_topics.js
BEGIN;

INSERT INTO public.question_answers (
    question_id, 
    option_a, option_b, option_c, option_d, 
    correct_option, explanation
)
SELECT 
    q.id as question_id,
    MAX(CASE WHEN a.option_letter = 'A' THEN a.option_text END) as option_a,
    MAX(CASE WHEN a.option_letter = 'B' THEN a.option_text END) as option_b,
    MAX(CASE WHEN a.option_letter = 'C' THEN a.option_text END) as option_c,
    MAX(CASE WHEN a.option_letter = 'D' THEN a.option_text END) as option_d,
    MAX(CASE WHEN a.is_correct THEN a.option_letter END) as correct_option,
    MAX(qe.explanation) as explanation
FROM public.questions q
JOIN public.answers a ON a.question_id = q.id
LEFT JOIN public.question_explanations qe ON qe.question_id = q.id
WHERE q.id NOT IN (SELECT question_id FROM public.question_answers)
GROUP BY q.id;

COMMIT;
