# Phase 10: Rubric-Based LLM Grading + Recruiter Transcript & Override — Pattern Map

**Mapped:** 2026-07-31
**Files analyzed:** 10 new/modified artifacts
**Analogs found:** 10 / 10

## File Classification

| New / Modified Artifact | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| Rubric block on `QUESTIONS[]` entries (`backend/Code.gs`) | data / config | static bank | `Code.gs:1902-1922` (`eng-sentence-correction-q31` open_text entry) | exact |
| `evaluateWithRubric()` (`backend/AsyncGrading.gs`) | service (LLM grader) | request-response (parallel HTTP) | `Code.gs:70-182` (`evaluateOpenTextBatch`) | exact |
| `GradingTranscripts` sheet init + append (`Code.gs` + `AsyncGrading.gs`) | model / persistence | CRUD | `Code.gs:246-280` (`initSheets` PendingGrading block) + `AsyncGrading.gs:151-155` (batch setValues to Responses) | exact |
| `handleOverrideVerdict()` admin endpoint (`Code.gs`) | controller (admin action) | request-response | `Code.gs:470-505` (`handleGetAttemptReport`) + `AsyncGrading.gs:338-356` (LockService pattern) | role + concurrency composite |
| Recruiter transcript + override UI (`assessment-app/src/app/admin/page.tsx`) | component (modal panel) | request-response | `admin/page.tsx:413-430` (report modal) + `admin/page.tsx:153-173` (`handleViewReport` fetch pattern) | exact |
| Ungraded-state notice on candidate report (`ReportScreen.tsx`) | component (notice block) | render-only | `ReportScreen.tsx:161-179` (Advisory Recommendation motion block) | role-match |
| `grading-engine.ts` mirror update (`tests/grading/grading-engine.ts`) | test mirror | pure function | `tests/grading/grading-engine.ts:47-103` (`gradeAttempt` with existing `llmResults?: Record<string, boolean>` slot) | exact |
| `sync-check.ts` rubric drift checks | CI utility | batch compare | `scripts/sync-check.ts:96-105` (ADMIN_TOKEN extract-then-check) + `L107-124` (AsyncGrading retry/batch/cadence) | exact |
| Candidate copy update (`ThankYouScreen.tsx` L58-61, `ReportScreen.tsx` new ungraded block) | content edit | render-only | `ThankYouScreen.tsx:53-62` (existing "What Happens Next" block) | exact |
| `vitest.config.ts` exclude-list update | config | test discovery | `vitest.config.ts:8` (existing exclude array) | exact |

---

## Pattern Assignments

### 1. Rubric config in `QUESTIONS[]` (Code.gs)

**Analog:** `backend/Code.gs:1902-1922` — the `eng-sentence-correction-q31` open_text entry (representative of the 30 sentence-correction + 10 macro open_text entries and 10 closure hybrid entries).

**Excerpt (Code.gs:1902-1922):**
```javascript
{
  "id": "eng-sentence-correction-q31",
  "bank": "english",
  "section": "sentence_correction",
  "level": null,
  "case_id": null,
  "case_title": null,
  "tabs": null,
  "tables": null,
  "response_type": "open_text",
  "stem": "Customer didn't sent the screenshot so we can't verify nothing.",
  "options": [],
  "model_answer": "The customer did not send the screenshot, so we are unable to verify the information.",
  "position": 31,
  "source": { ... },
  "difficulty_tier": "straightforward"
}
```

**Deviations expected:** Append a `rubric: { version, criteria: [{ name, weight, description }] }` block **as a sibling of `model_answer`** (colocated with the other answer-key-adjacent field, per RESEARCH.md's trust-boundary argument). All 40 open_text + 10 hybrid entries receive rubrics; weights per question sum to ~1.0 (± 0.01).

**Risk:** `handleStartAttempt`'s client-question strip at `Code.gs:347-368` currently *does not* strip `model_answer` — it succeeds only because the mapping is an allowlist of public fields. `rubric` must **not** be added to that mapping, or grading logic leaks to the browser. Verify explicitly.

---

### 2. `evaluateWithRubric()` (AsyncGrading.gs)

**Analog:** `backend/Code.gs:70-182` — `evaluateOpenTextBatch`. Structurally identical HTTP-parallel pattern; Phase 10 replaces the free-text JSON parse + silent-true fallback with `responseSchema` + `verdict:"ungraded"`.

**Excerpt (Code.gs:82-119) — Gemini request build + parallel dispatch:**
```javascript
if (GEMINI_API_KEY) {
  const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + GEMINI_API_KEY;
  const fetchRequests = gradingRequests.map(req => {
    const payload = {
      "contents": [{
        "parts": [
          {"text": systemInstruction},
          {"text": "Question/Context:\\n" + req.prompt},
          {"text": "Candidate Answer:\\n" + req.answer}
        ]
      }],
      "generationConfig": { "temperature": 0.1, "responseMimeType": "application/json" }
    };
    return {
      "url": geminiUrl, "method": "post", "contentType": "application/json",
      "payload": JSON.stringify(payload), "muteHttpExceptions": true
    };
  });

  try {
    const responses = UrlFetchApp.fetchAll(fetchRequests);
    responses.forEach((res, index) => {
      const qId = gradingRequests[index].qId;
      if (res.getResponseCode() === 200) {
        try {
          const json = JSON.parse(res.getContentText());
          const textResponse = json.candidates[0].content.parts[0].text;
          const parsedScore = JSON.parse(textResponse);
          results[qId] = parsedScore.score === 1;
        } catch (e) { results[qId] = "FAILED"; }
      } else {
        results[qId] = "FAILED";
      }
    });
```

**Deviations expected:**
- Add `generationConfig.responseSchema` (enum `["correct","incorrect"]` only — see RESEARCH.md Pitfall 1).
- Delete the `"FAILED"` sentinel branch entirely; failures/parse errors set `results[qId] = { verdict: "ungraded", criteriaMet: [], rationale: "" }`.
- Delete the silent-true fallbacks at L166, L169, L173, L177 — they are the specific regression Phase 10 removes.
- Frame candidate answer between explicit delimiters (`<<<ANSWER_START>>>` / `<<<ANSWER_END>>>`) per Pitfall 4.
- Live in `AsyncGrading.gs` (not `Code.gs`) — belongs with the queue-drain worker that owns the 6-min budget.

**Risk:** Rubric prompts are longer than the current binary prompt, and batching still slices to 5 attempts per drain (`AsyncGrading.gs:345`). Do **not** raise that cap without measuring wall-clock per attempt (RESEARCH.md Pitfall 3).

---

### 3. `GradingTranscripts` sheet init + append

**Analog A (sheet init):** `backend/Code.gs:246-280` — `initSheets()`, specifically the PendingGrading block added in Phase 9.

**Excerpt (Code.gs:273-279):**
```javascript
// 4. PendingGrading Sheet (async grading queue -- drained by AsyncGrading.gs)
let pendingSheet = ss.getSheetByName("PendingGrading");
if (!pendingSheet) {
  pendingSheet = ss.insertSheet("PendingGrading");
  pendingSheet.appendRow(["AttemptID", "SubmittedAnswersJSON", "EnqueuedAt", "Stage", "AttemptsCount", "LastError", "LastAttemptAt", "CandidateEmailStatus", "RecruiterEmailStatus"]);
  pendingSheet.getRange("A1:I1").setFontWeight("bold").setBackground("#e2e8f0");
}
```

**Analog B (batch append):** `backend/AsyncGrading.gs:151-155` — the Responses batch-write.

**Excerpt (AsyncGrading.gs:151-155):**
```javascript
// Batch-write all responses (faster than individual appendRow calls)
if (responseRows.length > 0) {
  const lastRow = responsesSheet.getLastRow();
  responsesSheet.getRange(lastRow + 1, 1, responseRows.length, 5).setValues(responseRows);
}
```

**Deviations expected:**
- Add a **fifth** block to `initSheets`: `GradingTranscripts` with 9 columns `AttemptID | QuestionID | RubricVersion | Verdict | CriteriaMetJSON | Rationale | OverrideVerdict | OverrideAt | OverrideTokenHash`; header range `A1:I1`.
- Add `UngradedCount` as column 15 (O) to the existing `Attempts` header at `Code.gs:253` (currently 14 cols A:N).
- In `gradeAndFinalizeAttempt`, build a `transcriptRows` array parallel to `responseRows`, then perform the same `getLastRow() + setValues(rows.length, 9)` batch pattern into `GradingTranscripts`.

**Risk:** `initSheets` is called from every `doPost` (`Code.gs:217`) — the new block runs on every POST. Keep the `if (!sheet)` guard exactly like the four existing blocks. Also: `Attempts` column addition shifts nothing for existing readers because `buildReportFromAttemptsRow` (`AsyncGrading.gs:238-253`) and `handleGetAttemptReport` (`Code.gs:484-500`) both index by fixed offsets — new column at index 14 (`UngradedCount`) is safe to append, but any reader that pulls that column must coerce blank → 0 (RESEARCH.md Pitfall 5).

---

### 4. `handleOverrideVerdict()` admin endpoint

**Analog A (auth + sheet-scan controller shape):** `backend/Code.gs:470-505` — `handleGetAttemptReport`.

**Excerpt (Code.gs:470-483):**
```javascript
function handleGetAttemptReport(attemptId, token) {
  if (!attemptId) return { success: false, error: "Missing attempt ID" };
  if (!checkAdminAuth(token)) return { success: false, error: "Unauthorized" };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const attemptsSheet = ss.getSheetByName("Attempts");
  const data = attemptsSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === attemptId) {
      if (!READY_STATUSES.includes(data[i][5])) {
        return { success: false, error: "Report is not available yet" };
      }
      return { success: true, report: { ... } };
```

**Analog B (LockService envelope):** `backend/AsyncGrading.gs:338-356` — `processGradingQueue`.

**Excerpt (AsyncGrading.gs:338-356):**
```javascript
function processGradingQueue() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return;
  }

  try {
    const batch = readEligiblePendingRows().slice(0, 5);
    batch.forEach(function(row) { ... });
  } finally {
    lock.releaseLock();
  }
}
```

**Analog C (batch atomic write of scored columns):** `backend/AsyncGrading.gs:205-211`.

**Excerpt (AsyncGrading.gs:205-211):**
```javascript
// Sheet columns: H=8(Overall), I=9(Lang), J=10(Research), K=11(Critical), M=13(Tier), N=14(Narrative)
attemptsSheet.getRange(attemptRowIdx, 8, 1, 4).setValues([[overallPercentage, englishPct, researchPct, criticalPct]]); // H:K
attemptsSheet.getRange(attemptRowIdx, 13, 1, 2).setValues([[recommendationTier, narrativeInsight]]); // M:N
attemptsSheet.getRange(attemptRowIdx, 6).setValue("graded");
```

**Deviations expected:**
- New action string `"overrideVerdict"` routed from `doPost` (`Code.gs:213-232`); wire alongside `adminResetAttempt`.
- Validate `newVerdict ∈ {"correct","incorrect"}` before doing anything.
- Compute `tokenHash = Utilities.computeDigest(SHA_256, token, UTF_8).map(b => …hex…).join("")` — GAS built-in, never hand-roll.
- Wrap all sheet mutations in `LockService.getScriptLock().tryLock(10000)`; timeout > processGradingQueue's 5s to yield to a live drain.
- Re-aggregate by re-running the scoring loop off `Responses` + `GradingTranscripts` (via an `effectiveVerdict()` helper — see RESEARCH.md Pitfall 2), then reuse the same H:K + M:N + O(new) batch-write pattern.

**Risk:** `checkAdminAuth` (`Code.gs:50-52`) is plain string equality on the shared `ADMIN_TOKEN`. All recruiters share one hash. Document as known-limitation per RESEARCH.md A5. Also: the `for (let i = 1; i < data.length; i++)` linear scan pattern from `handleGetAttemptReport` is fine at current scale but re-executes on every override — acceptable, but avoid nesting a second linear scan of Responses without early-exit.

---

### 5. Recruiter transcript & override UI (assessment-app)

**Analog A (modal shell):** `assessment-app/src/app/admin/page.tsx:413-430` — the existing report modal.

**Excerpt (admin/page.tsx:413-430):**
```tsx
{selectedReport && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
    <div className="relative w-full max-w-[620px] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2 my-8">
      <button onClick={() => setSelectedReport(null)}
        className="absolute top-4 right-4 z-10 p-2 bg-slate-900/80 border border-slate-800 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div className="max-h-[85vh] overflow-y-auto px-4 py-6">
        <ReportScreen report={selectedReport} onExit={() => setSelectedReport(null)} />
      </div>
    </div>
  </div>
)}
```

**Analog B (fetch pattern):** `assessment-app/src/app/admin/page.tsx:153-173` — `handleViewReport`.

**Excerpt (admin/page.tsx:153-173):**
```tsx
const handleViewReport = async (attemptId: string) => {
  setLoadingReport(true);
  setError(null);
  try {
    const token = sessionStorage.getItem('fs_admin_token') || passcode;
    const fetchUrl = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=getAttemptReport&attemptId=${attemptId}&token=${encodeURIComponent(token)}`;
    const res = await fetch(fetchUrl);
    const data = await res.json();

    if (data.success && data.report) {
      setSelectedReport(data.report);
    } else {
      setError(data.error || 'Failed to fetch candidate report.');
    }
  } catch (err) { ... }
  finally { setLoadingReport(false); }
};
```

**Deviations expected:**
- Add sibling state `const [transcript, setTranscript] = useState<Transcript[] | null>(null);` and a `handleViewTranscript(attemptId)` that hits `action=getAttemptTranscript` using the identical URL-building recipe.
- Transcript panel renders **inside** the existing `selectedReport` modal (do not open a second overlay). Section below `ReportScreen`, styled with the same `bg-slate-950/40 border border-[var(--card-border)] rounded-lg` shell used throughout.
- Override button uses **POST** (like `handleResetAttempt` at `admin/page.tsx:116-151`) — not GET — because it mutates. Follow that function's `Content-Type: text/plain;charset=utf-8` + `JSON.stringify({ action, ... })` shape, which is the project convention for GAS POST.
- After success, re-fetch transcript (append-only "Overridden by …" row) and re-fetch report to reflect new scores.

**Risk:** Do NOT put the raw admin token in query strings for the mutation call (avoid `MD-LINK-TOKEN-IN-QUERY` — the same warning flagged on `page.tsx`). Use the body-borne POST shape from `handleResetAttempt`. Also: `ReportScreen` renders inside the modal — if you shove the transcript panel *inside* `ReportScreen`, you'd expose recruiter-only rationale to the candidate-facing screen. Keep the transcript panel as a **sibling** of `<ReportScreen />` under the modal `<div>`.

---

### 6. Ungraded-state notice on candidate report

**Analog:** `assessment-app/src/components/ReportScreen.tsx:161-179` — the Advisory Recommendation motion block.

**Excerpt (ReportScreen.tsx:161-179):**
```tsx
<motion.div
  custom={4}
  variants={fadeUp}
  initial="hidden"
  animate="visible"
  className="bg-slate-950/20 border border-[var(--card-border)] rounded-lg p-4 flex flex-col gap-2"
>
  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
    Advisory Recommendation
  </span>
  <span className={`self-start inline-block font-bold text-sm px-3.5 py-1.5 rounded-md border ${tierClass}`}>
    {tier}
  </span>
  <p className="text-slate-500 text-[10px] leading-relaxed">
    This recommendation is advisory input for the recruiting team only — it never automatically
    executes a hire or reject decision.
  </p>
</motion.div>
```

**Deviations expected:**
- Conditionally render only when `report.ungradedCount > 0`.
- Use amber accent (`text-amber-400 bg-amber-400/5 border border-amber-400/20`) — already the convention for cautionary notices in `admin/page.tsx:255-257` (Recruiter Workspace tag) and `admin/page.tsx:302` (error banner).
- Copy per RESEARCH.md § Candidate-Facing Copy Audit: `"Note: {ungradedCount} open-text answer(s) are pending review. Your score may be updated once a recruiter completes review."`
- **Do NOT** include the LLM rationale text (RESEARCH.md A6 — recruiter-only).

**Risk:** The `motion.div` uses `custom={4}` for staggered fade-in ordering. If inserted between existing blocks, renumber all downstream `custom` values or the animation timing goes out of order.

---

### 7. `grading-engine.ts` mirror update

**Analog:** `tests/grading/grading-engine.ts:47-103` — `gradeAttempt` already accepts an optional `llmResults?: Record<string, boolean>` parameter (extended in plan 08-02).

**Excerpt (grading-engine.ts:47, 84, 88):**
```typescript
export function gradeAttempt(frozenQuestions: GasQuestion[], candidateAnswers: AnswersMap, llmResults?: Record<string, boolean>): GradeResult {
  // ...
  const textCorrect = llmResults ? llmResults[q.id] === true : true;  // L84 (hybrid)
  // ...
  isCorrect = llmResults ? llmResults[q.id] === true : true;          // L88 (open_text — default true matches Code.gs no-API-key fallback)
```

**Deviations expected:**
- Widen the parameter type from `Record<string, boolean>` to `Record<string, "correct" | "incorrect" | "ungraded">` (or an `effectiveVerdict` map).
- Add `ungradedCount` to `GradeResult`, and treat `"ungraded"` as **excluded from denominator** (RESEARCH.md A2) — this changes L61's unconditional `bankTotal[category]++`.
- The comment on L88 ("default true matches Code.gs no-API-key fallback") becomes false — update it to reflect the new "default `ungraded`" semantics.
- New sibling file `tests/grading/rubric-grader.ts` covers only schema-parse + verdict-resolution logic; `grading-engine.ts` stays focused on the aggregation math (RESEARCH.md A10).

**Risk:** `grading-engine.ts` currently returns `overallScore: 0` when `total` is 0 (L107). If every question in a bank is `ungraded`, denominator becomes 0 for that bank too — mirror must return 0 (not NaN) at all three bank-percentage lines (L108-110). Cover with a property test.

---

### 8. `sync-check.ts` drift checks for rubric semantics

**Analog A (extract-then-compare with `check()`):** `scripts/sync-check.ts:96-105` — ADMIN_TOKEN block.

**Excerpt (sync-check.ts:96-105):**
```typescript
try {
  const adminAuth = readFileSync(resolve(ROOT, "tests/admin/admin-auth.ts"), "utf-8");
  const mirrorToken = adminAuth.match(/ADMIN_TOKEN\s*=\s*"([^"]+)"/)?.[1] ?? "";
  const gsToken = CODE_GS.match(/ADMIN_TOKEN\s*=\s*"([^"]+)"/)?.[1] ?? "";
  check("ADMIN_TOKEN matches between admin-auth.ts and Code.gs", mirrorToken, gsToken);
} catch {
  console.error("FAIL: Could not read tests/admin/admin-auth.ts");
  failures++;
}
```

**Analog B (constant extract):** `scripts/sync-check.ts:112-120` — AsyncGrading retry/batch cap.

**Excerpt (sync-check.ts:112-120):**
```typescript
const asyncGsRetryCap = ASYNC_GS.match(/newCount\w*\s*>=\s*(\d+)/)?.[1] ?? "";
const asyncMirrorRetryCap = ASYNC_MIRROR.match(/RETRY_CAP\s*=\s*(\d+)/)?.[1] ?? "";
check("AsyncGrading retry cap", asyncMirrorRetryCap, asyncGsRetryCap);

const asyncGsBatchCap = ASYNC_GS.match(/\.slice\(\s*0\s*,\s*(\d+)\s*\)/)?.[1] ?? "";
const asyncMirrorBatchCap = ASYNC_MIRROR.match(/BATCH_CAP\s*=\s*(\d+)/)?.[1] ?? "";
check("AsyncGrading batch cap", asyncMirrorBatchCap, asyncGsBatchCap);
```

**Analog C (has() pattern for existence-only):** `scripts/sync-check.ts:124`.

```typescript
has("AsyncGrading trigger cadence", ASYNC_GS, /\.everyMinutes\(\s*5\s*\)/);
```

**Deviations expected — add new checks:**
- `has("Rubric verdict enum restricted to correct/incorrect", ASYNC_GS, /enum:\s*\[\s*"correct"\s*,\s*"incorrect"\s*\]/)` — enforces Pitfall 1.
- `has("evaluateWithRubric uses responseSchema", ASYNC_GS, /responseSchema\s*:/)`.
- Extract the `GradingTranscripts` header column count from `Code.gs` (`appendRow(["AttemptID", ..., "OverrideTokenHash"])` — 9 items) and compare against a mirror constant `TRANSCRIPT_COLUMN_COUNT = 9` in `tests/grading/rubric-grader.ts`.
- `has("No silent-true LLM fallback in AsyncGrading", ASYNC_GS, /results\[req\.qId\]\s*=\s*true/)` — this one **must fail** if the anti-pattern reappears (invert the check).
- `has("Ungraded verdict propagated", ASYNC_GS, /"ungraded"/)`.

**Risk:** The `check()` helper uses strict `!==` string equality — regex-extracted values must normalize whitespace. The existing extract at L112 uses `\s*` in the regex, not in the compared value; follow that convention. Also: `sync-check.ts` reads `AsyncGrading.gs` as `ASYNC_GS` at L21 — rubric checks belong here, not against `CODE_GS`, because `evaluateWithRubric` lives in AsyncGrading (per plan and RESEARCH.md architecture map).

---

### 9. Candidate copy update

**Analog:** `assessment-app/src/components/ThankYouScreen.tsx:53-62` — existing "What Happens Next" motion block.

**Excerpt (ThankYouScreen.tsx:53-62):**
```tsx
<motion.div ... className="bg-slate-950/40 border border-[var(--card-border)] rounded-lg p-4 flex flex-col gap-2 text-sm">
  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
    What Happens Next
  </span>
  <p className="text-slate-300 leading-relaxed">
    Your responses have been securely recorded and are being reviewed. You&apos;ll receive
    your full results and recommendation by email within a few minutes.
  </p>
</motion.div>
```

Also referenced but **unchanged**: `ReportScreen.tsx:91-93` ("Thank you for completing…") and `WelcomeScreen.tsx:42-44` (both neutral per RESEARCH.md audit).

**Deviations expected:**
- Replace the L58-61 `<p>` copy with the RESEARCH.md § Candidate-Facing Copy Audit recommendation: `"Your responses have been securely recorded. Automated scoring runs first; open-text answers may be reviewed and adjusted by a recruiter. You'll receive your results by email within a few minutes."`
- Optional: append `"Some answers may be reviewed by a person before your final score is issued."` unconditionally (safer than gating on ungraded state, since candidates see this screen before grading completes).
- `ReportScreen.tsx` adds the new ungraded-notice block per Pattern 6 above.

**Risk:** RESEARCH.md verified via grep that **no** forbidden phrases (`"no human review"`, `"fully automated"`, etc.) currently exist. The ROADMAP language was preventive. Don't invent removals; only add the two edits.

---

### 10. Vitest exclude-list update

**Analog:** `vitest.config.ts:8` — the existing exclude array.

**Excerpt (vitest.config.ts:1-10, full file):**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.ts'],
    exclude: ['tests/**/*.js', 'assessment-app/**/*', 'tests/**/grading-engine.ts', 'tests/**/admin-auth.ts', 'tests/**/queue-logic.ts', 'tests/**/email-content.ts'],
  },
});
```

**Deviations expected:**
- Add `'tests/**/rubric-grader.ts'` to the exclude array so Vitest doesn't treat the new pure mirror as a test file (RESEARCH.md Pitfall 6).
- If a `tests/copy/candidate-copy.ts` mirror is added, exclude it too. Test files are `tests/**/test_*.ts` by convention; anything else in `tests/` that isn't a test needs an exclude.

**Risk:** Convention is explicit-exclude, not glob-derived. Missing this line yields `"No tests found in file"` CI failure exactly matching Pitfall 6. Add in the same PR as the mirror file — reviewers routinely miss this in a follow-up PR.

---

## Shared Patterns

### Authentication (all admin endpoints)
**Source:** `backend/Code.gs:50-52`
**Apply to:** `handleOverrideVerdict`, `handleGetAttemptTranscript` (any new admin action)
```javascript
const ADMIN_TOKEN = "FS_RECRUITER_SECRET_2026";
function checkAdminAuth(token) {
  return token === ADMIN_TOKEN;
}
```
Every new admin action's first non-trivial line is `if (!checkAdminAuth(token)) return { success: false, error: "Unauthorized" };` — matches `handleGetAttemptReport:472`, `handleAdminListCandidates:508`, `handleAdminResetAttempt:534`.

### Response Envelope
**Source:** repeated across all `handle*` functions in `Code.gs`.
Return shape: `{ success: boolean, error?: string, ...payload }`. Override endpoint returns `{ success, report, transcriptRow }` on success, `{ success: false, error }` on failure. No exception should escape the handler; router try/catch at `Code.gs:200-202` / `L230-232` returns HTTP 500 for anything that does.

### Concurrency
**Source:** `backend/AsyncGrading.gs:339` — `LockService.getScriptLock().tryLock(5000)`. Every write path that touches sheets which the grading queue also writes must acquire this lock. Override endpoint uses `tryLock(10000)` (slightly longer than the drain's 5s so overrides yield to an in-flight drain rather than colliding).

### Timestamp Format
**Source:** `backend/AsyncGrading.gs:51, 442` — `new Date().toISOString()`. Use for `OverrideAt` — never `Date.now().toString()`.

### Batch Sheet Write
**Source:** `backend/AsyncGrading.gs:151-155, 205-208` — always prefer `getRange(row, col, nRows, nCols).setValues(rows)` over `appendRow` in a loop.

## No Analog Found

None. Every artifact has a concrete precedent in-repo.

## Metadata

**Analog search scope:**
- `backend/Code.gs` (targeted reads at L40-240, L240-540, L1900-1960)
- `backend/AsyncGrading.gs` (full read, L1-484)
- `assessment-app/src/app/admin/page.tsx` (full read, L1-447)
- `assessment-app/src/components/ReportScreen.tsx` (targeted read, L80-200)
- `assessment-app/src/components/ThankYouScreen.tsx` (targeted read, L50-80)
- `scripts/sync-check.ts` (full read, L1-134)
- `tests/grading/grading-engine.ts` (full read, L1-184)
- `vitest.config.ts` (full read, L1-10)

**Files scanned:** 8
**Pattern extraction date:** 2026-07-31
