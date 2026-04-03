# Implementation Plan - Fix Session Preparation Error

## Problem
When a user clicks "Start Practice" or "Begin Mock Exam", an alert says "an error occured while preparing the session". This is likely due to a failing database query in `DataService.getQuestions`.

## Proposed Fix
1. **Optimize Question Fetching**: The current randomization logic fetches all question IDs for a subject/exam combination. For large datasets (14k+ questions), this can exceed Supabase row limits (default 1000) or cause timeouts.
2. **Standardize Joins**: The query joins `answers`, `question_answers`, `question_explanations`, `theory_details`, and `question_groups`. We will verify if all these relationships are correctly defined in Supabase.
3. **Fix RLS Policies**: Ensure `authenticated` users have `SELECT` access to all joined tables.

## Proposed Changes

### [MODIFY] [data.js](file:///c:/Users/Precious/CBT%20app/cbt-client/src/services/data.js)
- Update `getQuestions` to handle large `idPool` safely.
- Add error handling to the `idQuery` fetch.
- Refactor joins to be more efficient and consistent.

### [NEW] [fix_session_query.sql](file:///c:/Users/Precious/CBT%20app/supabase/migrations/fix_session_query.sql)
- Ensure all necessary RLS policies are in place for the `authenticated` role.

## Verification Plan
1. Run `node simulate_student.js` with realistic filters (e.g., JAMB Mathematics).
2. Manually test session start in the app dashboard.
