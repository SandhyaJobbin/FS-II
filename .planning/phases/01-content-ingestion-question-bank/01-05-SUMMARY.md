# Phase 1.5 Summary: Critical Thinking & Quotas Ingestion

**Completed:** 2026-07-29

We have successfully implemented and verified the "Critical Thinking" question bank parser, the "Quotas" xlsx loader, and integrated both into the atomic ingestion pipeline.

## Accomplishments
1. **Implemented Critical Thinking Parser (`ingestion/parsers/critical.py`)**:
   - Implemented a preamble guard that discards early LLM-authoring chatter before CASE 1.
   - Extracts verbatim Case titles (using en-dash headings) and scenario paragraphs under `Case File`.
   - Extracts questions and parses leading checkmarks (`✅`) to identify correct options (supporting both single and multi-select).
   - Ingests exactly 120 items across 30 cases.
2. **Implemented Quotas Loader (`ingestion/parsers/xlsx_quotas.py`)**:
   - Parses verbatim rows from `Sheet2` of `FS QB Pattern.xlsx`.
   - Enforces workbook sheet guards (rejects Sheet1-only workbooks and decoy filename `FS QB Pattern(1).xlsx`).
   - Cross-checks category pool volumes against `MANIFEST` expectations (raising loud failures on mismatch).
   - Annotates rows with units (`questions` for English proficiency categories, and `cases` for Attention and Critical Thinking).
3. **Atomic Pipeline Integration (`ingestion/run.py` & `ingestion/manifest.py`)**:
   - Registered new parsers and added quotas tracking.
   - Outputs both `content/questions.json` and `content/quotas.json` atomically.
   - Added a top-level `"unit_semantics": "unresolved — see A-OQ2"` marker to `quotas.json` as requested.
   - Expanded manifest to validate the critical thinking section count (120 questions).
4. **End-to-End Testing (`tests/ingestion/test_critical_e2e.py` & `tests/ingestion/test_quotas.py`)**:
   - Asserts correct parsing structure, counts, checkmark census, and lack of preamble leak.
   - Verifies correct handling of decoy files, Sheet2 missing, and manifest pool volume mismatch.
   - Asserts loud failures for malformed documents (missing correct options).

## Verification Details
- **Test execution**: All 34 tests in the test suite pass successfully (`python -m pytest`).
- **Ingestion run**: `python -m ingestion.run` successfully writes 385 items to `content/questions.json` and 8 quota rows to `content/quotas.json`.
