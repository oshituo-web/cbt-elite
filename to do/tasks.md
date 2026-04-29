# TO-DO List for CBT App Quality Assurance

## 1. High Priority (AI-Powered) - REQUIRES API QUOTA
- [ ] **Run Calibration:** Execute `validate_answers_calibrator.js` to verify validator accuracy against known-good/known-bad samples.
- [ ] **Run Full Semantic Audit:** Use `validate_answers.js` (to be created) to check all 19,000+ questions for logical mismatches between `question_text` and `correct_option`.
- [ ] **Flag & Regenerate:** Flag high-risk questions for manual review or automatic re-generation using `generate_explanations.js` or `generate_empty_topics.js`.

## 2. Maintenance & Infrastructure
- [ ] **Targeted Generation:** Continue backfilling missing WAEC/NECO topics using `generate_empty_topics.js` once quotas allow.
- [ ] **Database Integrity:** Periodically run orphaned-record and duplicate-option checks (similar to the cleanup just performed).
- [ ] **Repair Script:** Continue monitoring the progress of `repair_database_integrity.js` as more source JSON data becomes available.

## 3. Notes
- **API Limitation:** Daily free-tier quota is currently 20 requests per day. Do not initiate AI tasks until the quota resets.
- **Last Cleanup:** 16 duplicate option sets and 92 orphaned records were removed on 2026-04-29.
