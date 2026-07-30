# Phase 01-03 Summary: English Parser Expansion

The English proficiency question bank parser has been successfully expanded to ingest all 105 items across the 5 relevant sections.

## Accomplishments
- **Ingestion Coverage**: Extracted all 105 items from the source docx:
  - 30 Grammar questions (`mcq_single`)
  - 30 Sentence Correction questions (`open_text`)
  - 10 Macro Editing questions (`open_text` with template placeholders like `{{ticket.requester.first_name}}` preserved verbatim)
  - 25 Reading Comprehension questions (`mcq_single` or `mcq_multi` based on trailing checkmarks) grouped under 5 unique passages
  - 10 Case Closure questions (`hybrid` combining 3 status MCQ options and open-ended case closure notes model answers)
- **Manifest Synchronization**: Aligned the `"reading_questions"` section key in `ingestion/manifest.py` with `"reading"` to match parser conventions.
- **Robust Verification**:
  - Implemented automated E2E tests in `tests/ingestion/test_english_e2e.py` covering counts, golden anchors, placeholders, census numbers, and malformed inputs.
  - Resolved old test count expectations in `tests/ingestion/test_extractors.py`.
- **All tests pass successfully**: `python -m pytest` executes with zero errors.

## User Choice Deferrals
- **A-OQ3 (Open-Ended Grading)**: We have ingested the open-ended answers (`open_text` and `hybrid` model answers) into the question database. The client-side grading strategy (exact match, exclude from automated scoring, or alternative grading logic) is deferred to Phase 2/3 as planned.
