# Phase 3 — Research

## Scope

Audit Phase 3 requirements (GRADE-01 through GRADE-05) against existing backend/Code.gs and assessment-app/ code.

## Findings

### Existing Grading Skeleton (Code.gs lines 280–425)

`handleSubmitAnswers` already:
- Iterates `frozenIds`, finds each question in `QUESTIONS` constant
- Grades `mcq_single` by letter comparison, `mcq_multi` by sorted-letter set equality
- Accumulates `bankCorrect`/`bankTotal` per category (english, attention, critical)
- Computes overall%, englishPct, researchPct, criticalPct
- Picks `recommendation` tier (Strong Fit / Consider / Not Recommended)
- Generates a single `insight` string
- Writes 8 individual `setValue` calls to the sheet row
- Returns a report object

### Gaps Found

| Gap | Code reference | GRADE criterion |
|-----|----------------|-----------------|
| Narrative uses `q.section === 'critical' \|\| q.level === 'L2/L3'` | Line 355 | GRADE-03 |
| Field `recommendation` in return (not `recommendationTier`) | Line 420 | Types alignment |
| Field `insight` in return (not `narrativeInsight`) | Line 421 | Types alignment |
| Same misalignment in `handleGetAttemptReport` | Lines 452-453 | Types alignment |
| 8 separate `setValue` calls instead of 2 batch writes | Lines 396-403 | GRADE-04 atomicity |
| No complex/total counters per bank | Lines 312-318 | GRADE-03 |
| No test coverage for any grading logic | N/A | GRADE-01, 03, 04, 05 |

### TypeScript types/index.ts

- `Report.recommendationTier` already correct field name ✅
- `Report.narrativeInsight` already correct field name ✅
- `Report` was missing `startTime?`/`endTime?`
- `Question` was missing `tables?: Record<string, string[][]>`
- `ReportScreen.tsx` used `(report as any).recommendation` fallback cast

### ReportScreen.tsx

- Displayed trait scores as static text only — no progress bars
- No dedicated narrative insight card
- Used `(report as any).recommendation` cast

## OQ Resolutions

- **OQ-1 — Narrative authoring**: Hardcoded in Code.gs (5 strings) is acceptable for Phase 3. Recruiter-editable is Phase 6 scope.
- **OQ-2 — Complex-tier availability**: Narrative degrades gracefully to overall-score proxy if no `difficulty_tier === 'complex'` items in assembled set.
