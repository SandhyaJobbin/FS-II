# Phase 9: Async Grading & Report Delivery Pipeline - Pattern Map

**Mapped:** 2026-07-31
**Files analyzed:** 10
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `backend/AsyncGrading.gs` (NEW) | service (background worker) | event-driven / batch | `backend/Code.gs` `handleSubmitAnswers` + `initSheets` | role-match (extracted-service pattern, same file/global-scope convention) |
| `backend/Code.gs` `doPost` `submitAnswers` branch (MODIFIED) | controller (request-response, fast-path) | request-response | `backend/Code.gs` `doPost` itself (lines 202-230) | exact (editing the file's own dispatch pattern) |
| `backend/Code.gs` `initSheets` (MODIFIED — add `PendingGrading` block) | config/migration (lazy schema init) | CRUD (sheet init) | `backend/Code.gs` `initSheets` Attempts/Responses/IntegrityLogs blocks (lines 243-269) | exact |
| `backend/Code.gs` `handleGetAttemptReport` (MODIFIED — `READY_STATUSES` gate) | controller (request-response, read) | request-response | Same function, existing `!== "submitted"` gate (line 636) | exact |
| `assessment-app/src/app/admin/page.tsx` (MODIFIED — status-badge/gate call sites) | component (admin table) | CRUD (read/display) | Same file's existing `isSubmitted`/status-badge/View-Report logic (lines 330, 355-360, 366, 385) | exact |
| `assessment-app/src/components/ThankYouScreen.tsx` (NEW) | component | request-response (static confirmation) | `assessment-app/src/components/ReportScreen.tsx` | role-match (sibling post-test screen, same styling/animation conventions) |
| `assessment-app/src/app/page.tsx` (MODIFIED — screen union, `handleTestSubmit`) | provider/controller (screen-state orchestration) | request-response | Same file's `handleTestSubmit`/screen-union logic (lines 11, 115-159, 195-197) | exact |
| `tests/async/queue-logic.ts` (NEW) | utility (pure mirror) | transform | `tests/grading/grading-engine.ts` | exact (identical "pure TS mirror of a Code.gs concern" pattern) |
| `tests/async/email-content.ts` (NEW) | utility (pure mirror) | transform | `tests/grading/grading-engine.ts` (secondary: `tests/admin/admin-auth.ts` for smaller single-purpose mirror) | role-match |
| `tests/async/test_queue.ts`, `tests/async/test_email.ts` (NEW) | test | transform (assertions) | `tests/grading/` test suite pattern (vitest, mirrors `grading-engine.ts`) | role-match |
| `scripts/sync-check.ts` (MODIFIED — extend with async divergence checks) | utility (CI drift checker) | batch | Same file's existing `check()`/`has()` scoring-formula/tier-threshold checks (lines 20-60) | exact |

## Pattern Assignments

### `backend/AsyncGrading.gs` (NEW — service, event-driven/batch)

**Analog:** `backend/Code.gs` (whole-file conventions: `initSheets`, `handleSubmitAnswers`, `PropertiesService` usage)

**Global-scope/no-import convention** — Apps Script shares one global namespace across `.gs` files in a project, so `AsyncGrading.gs` calls functions/consts defined in `Code.gs` (e.g. `evaluateOpenTextBatch`, `normalizeEmail`, `QUESTIONS`) with no import statement, exactly as `Code.gs`'s own functions call each other today.

**Script Property pattern to copy** (`backend/Code.gs` lines 57-58):
```javascript
const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY") || "";
const FALLBACK_API_KEY = PropertiesService.getScriptProperties().getProperty("FALLBACK_API_KEY") || "";
```
Apply identically for `RECRUITER_EMAILS`:
```javascript
const RECRUITER_EMAILS_RAW = PropertiesService.getScriptProperties().getProperty("RECRUITER_EMAILS") || "";
```

**Lazy sheet-creation pattern to copy** (`backend/Code.gs` lines 243-269, e.g. the Responses block):
```javascript
let responsesSheet = ss.getSheetByName("Responses");
if (!responsesSheet) {
  responsesSheet = ss.insertSheet("Responses");
  responsesSheet.appendRow(["AttemptID", "QuestionID", "SubmittedAnswer", "IsCorrect", "Timestamp"]);
  responsesSheet.getRange("A1:E1").setFontWeight("bold").setBackground("#e2e8f0");
}
```
Apply identically for `PendingGrading` inside `initSheets()` in `Code.gs` (not a new function — extend the existing one, per RESEARCH.md's Code Example).

**Atomic multi-column batch-write pattern to copy** (`backend/Code.gs` lines 596-601):
```javascript
// Sheet columns: E=5(EndTime), F=6(Status), H=8(Overall), ...
attemptsSheet.getRange(attemptRowIdx, 5, 1, 2).setValues([[timestamp, "submitted"]]); // E:F
attemptsSheet.getRange(attemptRowIdx, 8, 1, 4).setValues([[overallPercentage, englishPct, researchPct, criticalPct]]); // H:K
attemptsSheet.getRange(attemptRowIdx, 13, 1, 2).setValues([[recommendationTier, narrativeInsight]]); // M:N
```
`gradeAndFinalizeAttempt` should write `Attempts.Status` and score columns with this same single-`getRange`-per-contiguous-block style (not per-cell `setValue` calls), and `processQueueItem`/queue-stage transitions on `PendingGrading` should follow the same batched-range convention.

**Row-scan-by-ID pattern to copy** (`backend/Code.gs` lines 423-429, `handleSubmitAnswers`):
```javascript
let attemptRowIdx = -1;
let attemptRow = null;
for (let i = 1; i < attemptsData.length; i++) {
  if (attemptsData[i][0] === attemptId) {
    attemptRowIdx = i + 1;
    attemptRow = attemptsData[i];
    break;
  }
}
```
Use this same linear-scan-with-1-based-row-index style for reading `PendingGrading` rows in `processGradingQueue`.

**Extracted grading-logic reuse:** `gradeAndFinalizeAttempt` is the moved body of `handleSubmitAnswers` lines 439-623 (scoring loop, LLM batch call, tier/narrative computation, final `getRange` writes) — copy that logic verbatim into `AsyncGrading.gs`, replacing the synchronous return with a write of `Attempts.Status = "graded"` and continuing to the email steps. Do not reimplement scoring from scratch.

**Error handling pattern:** `Code.gs` has no per-item try/catch precedent (all handlers process one request at a time) — for the batch-processing loop in `processGradingQueue`, follow RESEARCH.md Pattern 2/6 (per-row `try/catch`, record failure via `LastError` column + `AttemptsCount` increment) since no existing analog covers batch fault-isolation.

---

### `backend/Code.gs` `doPost` submitAnswers branch (MODIFIED)

**Analog:** `backend/Code.gs` `doPost` (lines 202-230) and `jsonResponse` (lines 232-239)

**Dispatch + response-wrapping pattern to keep unchanged:**
```javascript
} else if (action === "submitAnswers") {
  return jsonResponse(handleSubmitAnswers(data.attemptId, data.answers));
}
```
`handleSubmitAnswers` becomes a thin fast-enqueue: validate → check `attemptRow[5] !== "active"` (existing idempotency guard at line 435, reused as the double-submit guard per RESEARCH.md Pitfall 3) → `PendingGrading.appendRow(...)` → set `Attempts.Status = "pending_grading"` → `return { success: true, status: "pending_grading" }`, still passed through `jsonResponse` exactly as today.

---

### `backend/Code.gs` `handleGetAttemptReport` (MODIFIED)

**Analog:** same function, existing gate (line 636)

**Current pattern:**
```javascript
if (data[i][5] !== "submitted") {
  return { success: false, error: "Report is not available yet" };
}
```
**New pattern (backward-compatible, per RESEARCH.md Pattern 4):**
```javascript
const READY_STATUSES = ['submitted', 'graded', 'emailed'];
if (!READY_STATUSES.includes(data[i][5])) {
  return { success: false, error: "Report is not available yet" };
}
```
Define `READY_STATUSES` once near the top of `Code.gs` (same scope level as `GEMINI_API_KEY` etc.) so both this gate and any other status-comparison call sites share one source of truth.

---

### `assessment-app/src/app/admin/page.tsx` (MODIFIED — 3 call sites)

**Analog:** same file's existing logic (lines 330, 355-360, 366, 385)

**Current pattern:**
```tsx
const isSubmitted = row.status === 'submitted';
...
row.status === 'active'
  ? 'text-sky-400 bg-sky-400/5 border-sky-400/20'
  : 'text-emerald-400 bg-emerald-400/5 border-emerald-400/20'
```
**New pattern:**
```tsx
const READY_STATUSES = ['submitted', 'graded', 'emailed'];
const isSubmitted = READY_STATUSES.includes(row.status);
```
Keep the ternary's `active`/else split as-is (it already treats "anything not active" as the emerald/complete style) — only the `isSubmitted` boolean at line 330 needs the multi-status check; the badge coloring ternary at 355-357 does not need to enumerate every new status individually. Optionally add a distinct color for `grading_failed` (e.g. red) if the admin table should visually flag it, consistent with `ReportScreen.tsx`'s `tierStyles` record-lookup pattern (lines 51-56) for adding a new named-status color bucket.

---

### `assessment-app/src/components/ThankYouScreen.tsx` (NEW — component)

**Analog:** `assessment-app/src/components/ReportScreen.tsx`

**Imports pattern** (lines 1-5):
```tsx
'use client';

import React from 'react';
import { motion, Variants } from 'framer-motion';
import { Report } from '../types';
```
`ThankYouScreen.tsx` needs no `Report` import (D-15: no score teaser) — copy the `'use client'` + `React` + `motion, Variants` import shape only, plus `@phosphor-icons/react` for a confirmation icon per RESEARCH.md's Standard Stack.

**Animation variant pattern to copy** (lines 12-19):
```tsx
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
  }),
};
```
Reuse verbatim for staggered entrance of the confirmation icon / heading / turnaround copy.

**Component shell / container pattern** (lines 47, 68-70):
```tsx
export default function ReportScreen({ report, onExit }: ReportScreenProps) {
  ...
  return (
    <div className="w-full max-w-[580px] mx-auto animate-fade-in">
      <div className="bg-card backdrop-blur-md border border-[var(--card-border)] rounded-2xl shadow-2xl overflow-hidden">
```
`ThankYouScreen` should take a simpler prop shape (`{ onExit: () => void }` or no props at all — D-16 says no back-nav blocking needed) and reuse the same `max-w-[580px] mx-auto` + `bg-card` card-shell classes to keep the gamified visual continuity (D-14).

---

### `assessment-app/src/app/page.tsx` (MODIFIED)

**Analog:** same file, `screen` union + `handleTestSubmit` (lines 11, 115-159, 186-197)

**Current screen-union pattern:**
```tsx
const [screen, setScreen] = useState<'welcome' | 'assembly' | 'test' | 'report'>('welcome');
```
**New pattern:** replace `'report'` with `'thankyou'` in the union; `reportData`/`setReportData` state (line 18) can be removed since ThankYouScreen takes no report prop (D-15).

**Current submit-handler pattern to modify** (lines 115-158):
```tsx
const handleTestSubmit = async (answers: AnswersMap) => {
  setScreen('welcome');
  setLoading(true);
  try {
    const res = await fetch(gasUrl, { method: 'POST', headers: {...}, body: JSON.stringify({ action: 'submitAnswers', attemptId, answers }) });
    const result = await res.json();
    if (!result.success) { alert(result.error || 'Submission failed.'); setScreen('test'); setLoading(false); return; }
    setReportData(result.report);
    setScreen('report');
    // Clear session keys...
  } catch (err) { ... } finally { setLoading(false); }
};
```
New pattern: keep the fetch/error-handling structure identical (same `gasUrl`/`action: 'submitAnswers'` POST, same error-alert/`setScreen('test')` failure path, same `localStorage.removeItem(...)` session-clear block) — only replace `setReportData(result.report); setScreen('report');` with `setScreen('thankyou');` (no `reportData` to set, since the response no longer carries a `report` field per RESEARCH.md's State of the Art table).

**Current render-branch pattern** (lines 195-197):
```tsx
{screen === 'report' && reportData && (
  <ReportScreen report={reportData} onExit={handleResetSession} />
)}
```
New pattern:
```tsx
{screen === 'thankyou' && (
  <ThankYouScreen onExit={handleResetSession} />
)}
```

---

### `tests/async/queue-logic.ts` and `tests/async/email-content.ts` (NEW — pure mirrors)

**Analog:** `tests/grading/grading-engine.ts`

**File header / purpose-comment pattern to copy** (lines 1-9):
```typescript
/**
 * grading-engine.ts
 *
 * Pure TypeScript extraction of the Phase 3 grading logic from backend/Code.gs.
 * This module has NO SpreadsheetApp dependencies — it operates solely on plain
 * data structures so it can be imported and tested under Vitest (Node.js).
 *
 * Any change to the scoring rules in Code.gs MUST be mirrored here.
 */
```
Copy this exact header shape for both new files, substituting "grading logic" → "async queue stage/retry logic" and "email content-builder logic" respectively, and "Phase 3" → "Phase 9". The "no SpreadsheetApp/MailApp/LockService dependencies, pure functions on plain data" constraint is the load-bearing pattern — `queue-logic.ts` mirrors only the stage-transition/retry-cap/batch-selection math (no I/O), `email-content.ts` mirrors only `buildCandidateEmail`/`buildRecruiterEmail`/`parseRecruiterEmails` as pure string-building functions.

**Type-then-function-export structure** (lines 11-47): declare `interface`/`type` exports first (e.g. `PendingGradingRow`, `EmailStatus`, `Stage`), then exported pure functions — same ordering convention as `grading-engine.ts`'s `GasQuestion`/`AnswersMap`/`GradeResult` types followed by `gradeAttempt`.

**Deterministic, no-I/O function signature convention** (line 47): `gradeAttempt(frozenQuestions, candidateAnswers, llmResults?)` takes only plain data and returns plain data, no globals/side effects — `selectBatch(rows, cap)`, `computeNextStage(row)`, `parseRecruiterEmails(raw)` etc. should follow the same "accepts data, returns data" shape so they're directly unit-testable.

---

### `tests/async/test_queue.ts`, `tests/async/test_email.ts` (NEW — vitest suites)

**Analog:** `tests/grading/` suite pattern (vitest importing `grading-engine.ts`) and `tests/admin/test_admin.ts` importing `admin-auth.ts`

Import the mirror module directly (`import { selectBatch, computeNextStage } from './queue-logic'`), assert pure-function outputs with vitest `describe`/`it`/`expect` — same structure already used for the grading-engine and admin-auth suites (no new test-framework conventions needed).

---

### `scripts/sync-check.ts` (MODIFIED — extend)

**Analog:** same file, existing `check()`/`has()` helpers and Section 1/2 checks (lines 20-60)

**Pattern to copy for new divergence checks** (lines 42-59):
```typescript
has(
  "Scoring formula uses Math.round (mirror)",
  MIRROR,
  /Math\.round\(\(?correctCount\s*\/\s*total\w*\)?\s*\*\s*100\)/
);
has("Consider: overall >= 60 (mirror)", MIRROR, /overall\w*\s*>=\s*60/);
```
Add a second `readFileSync` pair (`AsyncGrading.gs` + `tests/async/queue-logic.ts`) alongside the existing `MIRROR`/`CODE_GS` constants (lines 14-16), then add `has(...)`/`check(...)` calls verifying: retry cap literal `3` (D-11) appears in both; batch cap literal `5` (D-10) appears in both; trigger interval `everyMinutes(5)` (D-09) appears in `AsyncGrading.gs`. Follow the exact `has(label, text, pattern)` regex-presence-check style already established — do not introduce a different divergence-detection mechanism.

---

## Shared Patterns

### PropertiesService Script Property config
**Source:** `backend/Code.gs` lines 57-58
**Apply to:** `AsyncGrading.gs`'s `RECRUITER_EMAILS` constant
```javascript
const RECRUITER_EMAILS_RAW = PropertiesService.getScriptProperties().getProperty("RECRUITER_EMAILS") || "";
```

### Lazy sheet initialization inside `initSheets()`
**Source:** `backend/Code.gs` lines 243-269
**Apply to:** New `PendingGrading` sheet block — added to the *existing* `initSheets()` function in `Code.gs`, not a separate init function, so it stays covered by the same "runs at top of every `doPost`/`doGet`" convention (line 214) without adding new per-request overhead beyond one more `getSheetByName` check.

### `jsonResponse()` response wrapping
**Source:** `backend/Code.gs` lines 232-239
**Apply to:** The fast-enqueue `submitAnswers` response — must continue flowing through `jsonResponse(handleSubmitAnswers(...))` in `doPost`, unchanged.

### Admin auth gate (`checkAdminAuth`)
**Source:** `backend/Code.gs` `handleGetAttemptReport`/`handleAdminListCandidates`/`handleAdminResetAttempt` (line 628 pattern: `if (!checkAdminAuth(token)) return { success: false, error: "Unauthorized" };`); mirror at `tests/admin/admin-auth.ts`
**Apply to:** No new admin endpoints are introduced by this phase (per RESEARCH.md ASVS V2 note — unchanged), but if planning adds an admin-gated manual `installGradingTrigger` HTTP action (mentioned as an option in RESEARCH.md Pitfall 1), it MUST use this exact gate pattern, not a new auth mechanism.

### Backward-compatible status-readiness check (`READY_STATUSES`)
**Source:** New pattern (RESEARCH.md Pattern 4), applied identically in two places
**Apply to:** `backend/Code.gs` `handleGetAttemptReport` (line 636) AND `assessment-app/src/app/admin/page.tsx` (line 330) — both must use the same `['submitted', 'graded', 'emailed']` list so read-side and display-side never drift on which statuses count as "report ready."

### Pure-mirror-of-.gs-logic convention
**Source:** `tests/grading/grading-engine.ts` (whole-file pattern), `tests/admin/admin-auth.ts`
**Apply to:** `tests/async/queue-logic.ts`, `tests/async/email-content.ts` — every new pure-logic file in `tests/async/` must follow the "no SpreadsheetApp/MailApp deps, header comment stating what it mirrors and the must-stay-in-sync warning" convention, and be covered by an extension to `scripts/sync-check.ts`.

## No Analog Found

None — all files identified from CONTEXT.md/RESEARCH.md have a clear closest-analog in the existing codebase.

## Metadata

**Analog search scope:** `backend/Code.gs`, `assessment-app/src/app/page.tsx`, `assessment-app/src/app/admin/page.tsx`, `assessment-app/src/components/ReportScreen.tsx`, `tests/grading/grading-engine.ts`, `tests/admin/admin-auth.ts`, `scripts/sync-check.ts`
**Files scanned:** 7 read directly (targeted ranges, no re-reads) + repo Glob/Grep over `backend/`, `assessment-app/src/`, `tests/`, `scripts/`
**Pattern extraction date:** 2026-07-31
