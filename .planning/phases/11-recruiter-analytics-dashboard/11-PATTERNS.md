# Phase 11: Recruiter Analytics Dashboard — Pattern Map

**Mapped:** 2026-08-01
**Files analyzed:** 12 new / to-modify
**Analogs found:** 12 / 12 (all have close prior art)

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `backend/Code.gs` — new `handleAdminAnalytics(token)` | controller (GAS handler) | request-response, multi-sheet read | `handleGetAttemptTranscript` (`Code.gs:476-500`) + `handleAdminListCandidates` (`Code.gs:715-739`) | exact |
| `backend/Code.gs` — `doGet` router branch | route | request-response | Existing `else if (action === "getAttemptTranscript")` chain (`Code.gs:139-147`) | exact |
| `backend/AsyncGrading.gs` (or new `backend/Analytics.gs`) — cross-attempt reducers (`buildScoreTrend`, `buildQuestionStats`, `buildViolationCorrelation`, `buildBiasSignals`) | service (pure aggregation) | batch / transform | `computeAggregatesForAttempt` (`AsyncGrading.gs:92-174`) | role-match (per-attempt → cross-attempt) |
| `assessment-app/src/app/admin/analytics/page.tsx` | client component / route | request-response | `assessment-app/src/app/admin/page.tsx:23-207` | exact |
| `assessment-app/src/components/analytics/ScoreTrendChart.tsx` | component (chart) | render | No analog (recharts not yet installed) | no analog — use RESEARCH.md pattern |
| `assessment-app/src/components/analytics/QuestionStatsTable.tsx` | component (table) | render | Table pattern in `admin/page.tsx:423-534` | role-match |
| `assessment-app/src/components/analytics/ViolationScatter.tsx` | component (chart) | render | No analog | no analog |
| `assessment-app/src/components/analytics/BiasSignalsPanel.tsx` | component | render | Tier-color pill in `admin/page.tsx:440-444` | partial |
| `assessment-app/src/components/analytics/LowNFallback.tsx` | component | render | Amber notice in `ReportScreen.tsx:184-200` | exact |
| `assessment-app/src/components/analytics/UngradedCaveat.tsx` | component | render | Amber notice in `ReportScreen.tsx:184-200` | exact |
| `assessment-app/src/types/index.ts` — extend with `AnalyticsPayload` | type | — | Existing `Report`, `TranscriptEntry` shapes | exact |
| `tests/analytics/analytics-reducers.ts` + `tests/analytics/test_analytics.ts` | test (mirror + spec) | — | `tests/grading/rubric-grader.ts` + `tests/grading/test_rubric_grader.ts` (excluded via `vitest.config.ts:8`) | exact |
| `scripts/sync-check.ts` — new numbered sections 16+ | script | — | Existing sections 1–15 (`scripts/sync-check.ts:45-158`) | exact |

---

## Pattern Assignments

### 1. `handleAdminAnalytics(token)` — `backend/Code.gs`

**Analog A (closest shape):** `handleGetAttemptTranscript` — `backend/Code.gs:476-500`
**Analog B (auth + multi-column projection):** `handleAdminListCandidates` — `backend/Code.gs:715-739`

**Auth + early-return + sheet read pattern to copy verbatim** (`Code.gs:476-484`):

```javascript
function handleGetAttemptTranscript(attemptId, token) {
  if (!attemptId) return { success: false, error: "Missing attempt ID" };
  if (!checkAdminAuth(token)) return { success: false, error: "Unauthorized" };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const transcriptsSheet = ss.getSheetByName("GradingTranscripts");
  if (!transcriptsSheet) return { success: true, transcript: [] };

  const data = transcriptsSheet.getDataRange().getValues();
```

**Multi-column allowlist projection to copy** (`Code.gs:723-736`):

```javascript
for (let i = 1; i < data.length; i++) {
  list.push({
    attemptId: data[i][0],
    name: data[i][1],
    // ... explicitly named columns only — never spread the row
  });
}
```

**Differences to add for `handleAdminAnalytics`:**
1. Drop `attemptId` param — analytics is aggregate, not per-attempt.
2. Read THREE sheets in one pass each: `Attempts`, `Responses`, `GradingTranscripts` (skip `IntegrityLogs` per RESEARCH.md — `ViolationCount` col 11 already summed).
3. Slice header row once (`.slice(1)`) then filter to `READY_STATUSES` (see analog `Code.gs:443,55`).
4. Delegate the four reducer calls (`buildScoreTrend`, `buildQuestionStats`, `buildViolationCorrelation`, `buildBiasSignals`) to helpers — keep handler body under 50 lines.
5. Wrap body in `const t0 = Date.now(); ... meta.aggregationMs = Date.now() - t0` (Pitfall 1 instrumentation).
6. NEVER include `Name` / `Email` (col 1, 2) in aggregations — PII invariant (RESEARCH.md § Security Domain).

---

### 2. doGet router wiring — `backend/Code.gs:134-153`

**Exact line to extend:** `Code.gs:145-147` (existing `else if (action === "getAttemptTranscript")`).

**Pattern:**

```javascript
} else if (action === "getAttemptTranscript") {
  return jsonResponse(handleGetAttemptTranscript(params.attemptId, params.token));
}
// ADD IMMEDIATELY BELOW:
else if (action === "adminAnalytics") {
  return jsonResponse(handleAdminAnalytics(params.token));
}
```

**Notes:**
- Do NOT touch `doPost` (`Code.gs:155-187`) — analytics is read-only.
- The `try/catch` at `Code.gs:138,150-152` wraps the whole router; new branch inherits it automatically.
- `jsonResponse` (`Code.gs:189-196`) is the standard return wrapper.

---

### 3. Aggregate reducers — `backend/AsyncGrading.gs` (or new `backend/Analytics.gs`)

**Analog:** `computeAggregatesForAttempt` — `backend/AsyncGrading.gs:92-174`

**Shape to keep:**
- Build lookup maps keyed by `attemptId` / `questionId` in ONE pass (`AsyncGrading.gs:108-125`) — Pitfall 1 O(N) invariant.
- Iterate frozenIds once, resolve via `effectiveVerdict` (`AsyncGrading.gs:142`), branch on `verdict !== "ungraded"` (A2 policy at `AsyncGrading.gs:127,144`).
- Return a plain object (`AsyncGrading.gs:165-173`) — no class, no closure.

**Differences to add:**
1. Aggregate ACROSS attempts, not within one — outer loop over `attemptsByStatus`, not `frozenIds`.
2. Per-question stats reducer keys on `qId`, not `category` (RESEARCH.md § Aggregation Recipes → Question stats).
3. Return `enough_data: bool` per signal (Low-N gating, RESEARCH.md Pattern 4).
4. Emit `sampleSize` alongside every rate — never a naked percentage.

**Placement decision for planner:** RESEARCH.md § Wave 0 Gaps says the analytics helpers do NOT need a client mirror (server-only). So the reducers can live in `AsyncGrading.gs` — but that file is already 761 lines; a new `backend/Analytics.gs` sibling (Apps Script has flat file scope, so cross-file function calls work with zero import ceremony) keeps files under the 500-line project rule (`CLAUDE.md § Rules`). Planner should confirm in discuss-phase.

---

### 4. `effectiveVerdict` reuse — HARD CONSTRAINT

**Source:** `backend/AsyncGrading.gs:38-45`

```javascript
function effectiveVerdict(transcriptRow, responsesRow) {
  if (transcriptRow && transcriptRow.OverrideVerdict) return transcriptRow.OverrideVerdict;
  if (transcriptRow && transcriptRow.Verdict) return transcriptRow.Verdict;
  if (!responsesRow) return "ungraded";
  const raw = responsesRow.IsCorrect;
  if (raw === "ungraded") return "ungraded";
  return (raw === 1 || raw === "1") ? "correct" : "incorrect";
}
```

**Constraint:** Analytics reducers MUST call this function directly (Apps Script global scope makes it callable from any `.gs` file — see `AsyncGrading.gs:5-6` re: "shared global scope"). Do NOT re-derive the resolver inline. Divergence here = Pitfall 2 (report/dashboard denominator drift; recruiter trust bug). Mirror in `tests/analytics/analytics-reducers.ts` must `import { effectiveVerdict } from '../grading/rubric-grader'` (`tests/grading/rubric-grader.ts:20-27`) — do NOT re-implement in the mirror either.

---

### 5. A2 denominator-excludes-ungraded — HARD CONSTRAINT

**Source block to mirror:** `backend/AsyncGrading.gs:135-157` (specifically 144-157):

```javascript
frozenIds.forEach(function(qId) {
  // ...
  const verdict = effectiveVerdict(transcriptsByQId[qId] || null, responsesByQId[qId] || null);

  if (verdict !== "ungraded") {
    bankTotal[category]++;
    if (verdict === "correct") {
      correctCount++;
      bankCorrect[category]++;
    }
    // ...
  } else {
    ungradedCount++;
  }
});
```

**Analytics adaptation** (RESEARCH.md § Aggregation Recipes → Question stats):

```javascript
if (!perQ[qId]) perQ[qId] = { correct: 0, incorrect: 0, ungraded: 0 };
perQ[qId][effective] += 1;
// project:
const graded = c.correct + c.incorrect;              // <-- denominator excludes ungraded
const passRate = graded >= MIN ? Math.round(100 * c.correct / graded) : null;
```

**Test:** `tests/analytics/test_analytics.ts` MUST include a parity assertion — run one fixture attempt through both `computeAggregatesForAttempt` (via mirror) and `buildQuestionStats`, assert identical pass-rate for every question. This is the Pitfall 2 gate.

---

### 6. Admin route pattern — `assessment-app/src/app/admin/analytics/page.tsx`

**Analog:** `assessment-app/src/app/admin/page.tsx`

**Auth pattern to copy** (`admin/page.tsx:45-55`):

```typescript
useEffect(() => {
  const savedUrl = localStorage.getItem('fs_gas_url') || process.env.NEXT_PUBLIC_GAS_URL || '';
  setGasUrl(savedUrl);
  const savedAuth = sessionStorage.getItem('fs_admin_authenticated');
  const savedToken = sessionStorage.getItem('fs_admin_token');
  if (savedAuth === 'true' && savedToken) {
    setIsAuthenticated(true);
    setPasscode(savedToken);
  }
}, []);
```

**Fetch pattern to copy** (`admin/page.tsx:64-80`):

```typescript
const token = sessionStorage.getItem('fs_admin_token') || passcode;
const fetchUrl = `${urlToUse}${urlToUse.includes('?') ? '&' : '?'}action=adminListCandidates&token=${encodeURIComponent(token)}`;
const res = await fetch(fetchUrl);
const data = await res.json();
if (data.success) { setCandidates(data.list || []); }
else { setError(data.error || 'Failed to retrieve candidates list.'); }
```

**Differences to add:**
1. Swap `action=adminListCandidates` → `action=adminAnalytics`.
2. Add a debounce to the Refresh button (RESEARCH.md Open Q5, min 3s) — new pattern, not in analog.
3. Reuse the login form JSX from `admin/page.tsx:288-352` verbatim if the route is standalone; otherwise, guard by reading `sessionStorage.fs_admin_token` and redirecting to `/admin` if absent.
4. Add a nav link from `admin/page.tsx` header (`admin/page.tsx:358-381`) to `/admin/analytics` — small edit, not a rewrite.

**Guardrail:** `assessment-app/AGENTS.md` warns "This is NOT the Next.js you know." Before writing the new route, planner must consult `node_modules/next/dist/docs/` for the current App Router conventions in Next.js 16.2.12.

---

### 7. Amber caveat notice — `LowNFallback.tsx` + `UngradedCaveat.tsx`

**Analog:** `assessment-app/src/components/ReportScreen.tsx:184-200`

**Exact block to copy palette + framer-motion pattern from:**

```tsx
<motion.div
  variants={fadeUp}
  initial="hidden"
  animate="visible"
  className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 flex items-start gap-3"
>
  <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
  <div className="flex flex-col gap-1">
    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
      Pending Review
    </span>
    <p className="text-slate-300 text-xs leading-relaxed">
      {report.ungradedCount} open-text {…} pending review.
    </p>
  </div>
</motion.div>
```

**Differences to add:**
- `LowNFallback`: change label to `Not Enough Data Yet`, body to `Need ≥{threshold} samples — currently {samples}.`
- `UngradedCaveat`: change label to `Data Quality Note`, body to `{ungradedCount} answer(s) pending recruiter review — excluded from pass-rate.`
- Both components take props `{ threshold, samples }` or `{ ungradedCount }`; keep the exact class strings for visual consistency.

---

### 8. Sync-check drift assertions — `scripts/sync-check.ts`

**Analog:** `scripts/sync-check.ts:45-158` (sections 1-15).

**Numbered-section convention to follow** (`sync-check.ts:45-47`):

```typescript
// ─── 16. [assertion description] ─────────────────────────────────────────
has("...", ASYNC_GS, /.../);
```

**Available helpers** (`sync-check.ts:25-43`):
- `check(label, mirrorVal, gsVal)` — string equality
- `has(label, text, pattern)` — regex presence

**Additions Phase 11 needs (planner discretion — RESEARCH.md § Sync-check note says analytics may need NONE if pure server-side):**
- Section 16: assert new endpoint action name registered in `doGet` (`has("adminAnalytics action registered in doGet", CODE_GS, /action === "adminAnalytics"/)`).
- Section 17: assert `handleAdminAnalytics` first-lines `checkAdminAuth` (`has("handleAdminAnalytics has auth gate", CODE_GS, /handleAdminAnalytics[\s\S]{0,200}checkAdminAuth/)`).
- Section 18: assert reducers reuse `effectiveVerdict` (`has("Analytics reducers reuse effectiveVerdict", ASYNC_GS, /buildQuestionStats[\s\S]*effectiveVerdict/)`) — only if reducers land in `AsyncGrading.gs`; adjust file source if they go to `Analytics.gs`.
- Section 19 (optional): assert `meta.aggregationMs` instrumented (Pitfall 1 gate).

If reducers live in a new `backend/Analytics.gs`, the planner must also add `const ANALYTICS_GS = readFileSync(...)` at the top of `sync-check.ts` (analog to `ASYNC_GS` load at `sync-check.ts:21`).

---

### 9. Test mirror pattern — `tests/analytics/analytics-reducers.ts` + `tests/analytics/test_analytics.ts`

**Analog mirror:** `tests/grading/rubric-grader.ts` (43 lines, exports pure functions, no vitest imports).
**Analog spec:** `tests/grading/test_rubric_grader.ts` (imports the mirror + writes vitest tests).

**Vitest exclusion** (`vitest.config.ts:8`) — the mirror file MUST be added to the exclude list so vitest doesn't try to run it as a spec:

```typescript
exclude: [
  'tests/**/*.js',
  'assessment-app/**/*',
  'tests/**/grading-engine.ts',
  'tests/**/admin-auth.ts',
  'tests/**/queue-logic.ts',
  'tests/**/email-content.ts',
  'tests/**/rubric-grader.ts',
  // ADD:
  'tests/**/analytics-reducers.ts',
],
```

**Mirror shape to copy** (`tests/grading/rubric-grader.ts:1-27`): export named constants + typed pure functions; re-export `effectiveVerdict` so downstream tests import the SAME resolver used by the GAS side.

**Spec shape** — planner should model on the (untouched) `tests/grading/test_rubric_grader.ts` for describe/it structure. RESEARCH.md § Wave 0 Gaps lists the required test files (score_trend, question_stats parity, correlation, discrimination, ungraded_caveat, auth) — one describe block per signal is enough.

---

### 10. Types extension — `assessment-app/src/types/index.ts`

**Analog:** existing `Report`, `TranscriptEntry` interfaces in the same file. Match their shape:
- flat interfaces, no generics unless needed
- optional fields with `?:` (matches `ungradedCount?: number` in admin `CandidateRow`, `admin/page.tsx:20`)
- string unions for enums (`Verdict = 'correct' | 'incorrect' | 'ungraded'`)

**Suggested shape** (from RESEARCH.md § payload sketch):

```typescript
export interface AnalyticsPayload {
  success: boolean;
  generatedAt: string;
  meta: { totalAttempts: number; ungradedTotal: number; aggregationMs: number };
  scoreTrend: { enough_data: boolean; threshold_note: string; points: Array<{ date: string; avgScore: number; n: number }> };
  questionStats: { threshold: number; rows: Array<{ qId: string; correct: number; incorrect: number; ungraded: number; sampleSize: number; passRate: number | null; enough_data: boolean }> };
  violationCorrelation: { enough_data: boolean; samples: number; points: Array<{ v: number; s: number }>; r: number | null; interpretation?: 'weak' | 'moderate' | 'strong' };
  biasSignals: { enough_data: boolean; tierDistribution: Array<{ tier: string; pct: number; n: number; window: 'last20' | 'allTime' }> };
}
```

---

## Shared Patterns

### Auth gate (all handlers)
**Source:** `backend/Code.gs:50-52`
**Apply to:** every new admin handler
```javascript
function checkAdminAuth(token) { return token === ADMIN_TOKEN; }
// First-line invocation:
if (!checkAdminAuth(token)) return { success: false, error: "Unauthorized" };
```

### Error handling (backend)
**Source:** `backend/Code.gs:150-152`
**Apply to:** covered automatically by the `doGet` try/catch — new branches inherit it.

### JSON response
**Source:** `backend/Code.gs:189-196`
**Apply to:** every doGet branch return.

### Frontend error/loading state
**Source:** `admin/page.tsx:75-80` (`try/catch/finally` around fetch, `setError('Connection failed. Verify...')`)
**Apply to:** analytics page.tsx.

### Amber palette + framer-motion notice
**Source:** `ReportScreen.tsx:184-200`
**Apply to:** `LowNFallback.tsx`, `UngradedCaveat.tsx`.

### Tier color map
**Source:** `admin/page.tsx:440-444`
```typescript
const tierColorMap: Record<string, string> = {
  'Strong Fit': 'text-emerald-400 bg-emerald-400/5 border border-emerald-400/20',
  'Consider': 'text-amber-400 bg-amber-400/5 border border-amber-400/20',
  'Not Recommended': 'text-red-400 bg-red-400/5 border border-red-400/20',
};
```
**Apply to:** `BiasSignalsPanel.tsx` (tier distribution needs the same three-color mapping).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `ScoreTrendChart.tsx` | chart | render | No chart lib installed — see `assessment-app/package.json` (verified: only `@phosphor-icons/react`, `framer-motion`, `next`, `react`, `react-dom`). Planner adds `recharts@3.10.1` per RESEARCH.md § Standard Stack. |
| `ViolationScatter.tsx` | chart | render | Same — no scatter-plot precedent. |
| `BiasSignalsPanel.tsx` | component | render | Concept is new to the codebase (RESEARCH.md § Open Q1); reuse tier color map from admin/page.tsx but overall shape is greenfield. |

For chart components, planner should follow RESEARCH.md § Pitfall 4 import discipline (`import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ScatterChart, Scatter, BarChart, Bar, Cell } from 'recharts'`) to keep the `/admin/analytics` chunk under 200 KB gzipped.

---

## Also Flagged

### Files planner should NOT touch
- `.claude-flow/` — infra, unrelated to phase.
- `backend/AsyncGrading.gs` lines `38-174` (`effectiveVerdict`, `computeRecommendationTier`, `computeNarrativeInsight`, `computeAggregatesForAttempt`) — these are the resolver + reducers analytics DEPENDS ON. Only ADD to the file; do not modify these blocks. Deferred plan 10-07 Task 2 (11-step live verify) is still open (RESEARCH.md A4) — modifying these blocks would conflict with that verify.
- `backend/Code.gs` lines `433-712` (Phase 10 handlers) — read-only for analytics; extending `doGet` at line 147 is the only Code.gs edit expected outside adding the new handler.
- `assessment-app/src/components/ReportScreen.tsx` — copy the amber pattern (`:184-200`); do not modify.
- `tests/grading/rubric-grader.ts` — mirror source-of-truth for `effectiveVerdict`; do not modify.

### Assumptions from research that have NOT drifted
- `computeAggregatesForAttempt` shape (`AsyncGrading.gs:92-174`) matches RESEARCH.md description — verified.
- `Attempts` sheet has 15 columns; `UngradedCount` is col 15 (idx 14) — verified at `Code.gs:207` and `AsyncGrading.gs:368`.
- `GradingTranscripts` has 9 columns — verified at `sync-check.ts:126-131` (`TRANSCRIPT_COLUMN_COUNT = 9`).
- Existing doGet router has exactly 4 branches; new one is the 5th (`Code.gs:139-147`) — verified.
- `checkAdminAuth` uses direct string compare with hardcoded `ADMIN_TOKEN` (`Code.gs:48-52`) — verified.

### Assumption drift risk
- RESEARCH.md § Runtime State says `initSheets()` at `Code.gs:200-242` — verified 200-209; full range not re-read (irrelevant to Phase 11 since no new sheet is created).
- RESEARCH.md cites `QUESTIONS[]` at `Code.gs:849+` — not re-verified; planner should confirm line before code-gen.

### Framework/version constraints
- `assessment-app/package.json` (verified):
  - `next: 16.2.12`, `react: 19.2.4`, `react-dom: 19.2.4`
  - `framer-motion: ^12.43.0` (already installed — safe to reuse for `LowNFallback` / `UngradedCaveat`)
  - `@phosphor-icons/react: ^2.1.10` (already installed — safe for section headers)
  - NO chart library installed; `recharts@3.10.1` is a NEW dep.
- `assessment-app/AGENTS.md` warns: "This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code." → planner MUST consult those local docs before authoring `analytics/page.tsx`, especially for App Router / client-component / metadata conventions in 16.2.12.
- `.claude/settings.json` attribution — commits must NOT include `Co-Authored-By` unless enabled (root `CLAUDE.md § Rules`).
- File-size rule: keep files under 500 lines (root `CLAUDE.md § Rules`) — if reducers land in `AsyncGrading.gs` they push it past 500; recommend new `backend/Analytics.gs`.

---

## Metadata

**Analog search scope:** `backend/`, `assessment-app/src/app/admin/`, `assessment-app/src/components/`, `scripts/`, `tests/`, `vitest.config.ts`, `assessment-app/package.json`
**Files scanned:** 8 read in full, 2 grep-targeted (Code.gs, ReportScreen.tsx)
**Pattern extraction date:** 2026-08-01
