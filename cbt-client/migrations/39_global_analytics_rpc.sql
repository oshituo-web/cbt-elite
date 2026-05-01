-- =======================================================================
-- MIGRATION: 39_global_analytics_rpc
-- DESCRIPTION: Replaces the client-side full-table fetch of all exam_sessions
-- rows (used to calculate average score in the Admin Analytics panel) with a
-- DB-side aggregate. Previously the client fetched EVERY session row ever
-- recorded just to compute a single AVG — this will cause timeouts at scale.
--
-- This RPC returns all required Admin Analytics stats in a single round-trip.
-- =======================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_global_analytics()
RETURNS JSONB AS $$
DECLARE
    v_user_count      BIGINT;
    v_question_count  BIGINT;
    v_session_count   BIGINT;
    v_avg_score       NUMERIC;
    v_score_dist      JSONB;
BEGIN
    -- SECURITY: Admin only
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required.';
    END IF;

    -- Aggregate counts (index-only scans — fast)
    SELECT COUNT(*) INTO v_user_count     FROM public.users;
    SELECT COUNT(*) INTO v_question_count FROM public.questions WHERE is_active = true;
    SELECT COUNT(*) INTO v_session_count  FROM public.exam_sessions;

    -- Aggregate average score (single pass, no row transfer to client)
    SELECT COALESCE(ROUND(AVG(score_percentage)), 0)
    INTO v_avg_score
    FROM public.exam_sessions;

    -- Score distribution buckets for the histogram chart (replaces raw row transfer)
    SELECT jsonb_agg(bucket ORDER BY bucket.range_label) INTO v_score_dist FROM (
        SELECT
            CASE
                WHEN score_percentage BETWEEN 0  AND 19  THEN '0-19'
                WHEN score_percentage BETWEEN 20 AND 39  THEN '20-39'
                WHEN score_percentage BETWEEN 40 AND 59  THEN '40-59'
                WHEN score_percentage BETWEEN 60 AND 79  THEN '60-79'
                WHEN score_percentage BETWEEN 80 AND 100 THEN '80-100'
            END AS range_label,
            COUNT(*) AS count
        FROM public.exam_sessions
        WHERE score_percentage IS NOT NULL
        GROUP BY range_label
    ) AS bucket;

    RETURN jsonb_build_object(
        'total_users',     v_user_count,
        'total_questions', v_question_count,
        'total_sessions',  v_session_count,
        'average_score',   v_avg_score,
        'score_dist',      COALESCE(v_score_dist, '[]'::JSONB)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_global_analytics() TO authenticated;

COMMIT;
