# Phase 11: Recruiter Analytics Dashboard - Research

**Researched:** 2026-08-01
**Domain:** Google Apps Script server-side aggregation + Next.js/React admin analytics UI + fair-hiring bias signaling
**Confidence:** HIGH for backend/data-shape and chart-lib choice; MEDIUM for bias-direction indicator (concept under-specified in roadmap); MEDIUM for Phase 10 dependency (schema live but 11-step verify deferred)

## Summary

Phase 11 adds a single new admin endpoint `handleAdminAnalytics(token)` that reads `Attempts` / `Responses` / `IntegrityLogs` / `GradingTranscripts` on demand (no cache, no precompute), aggregates in pure JavaScript inside Apps Script, and returns a JSON envelope for a new `/admin/analytics` route in the Next.js app. The four success-criteria signals — score trend, question pass-rate, violation-vs-score correlation, bias-direction indicator — map cleanly to four independent aggregations over the existing 15-column `Attempts` sheet and the 5-column `Responses` sheet, with the ungraded state (Phase 10) surfaced as a first-class data-quality caveat everywhere it affects a denominator.

The riskiest part is not the aggregation shape (`getRange().getValues()` + `reduce` will finish in well under 1 second at N≤500 attempts) but two conceptual choices: (1) **what "bias-direction indicator" means** in a schema that collects zero demographic data, and (2) **how to keep the analytics "A2 policy" (ungraded excluded from denominator)** identical to the existing `computeAggregatesForAttempt` policy so recruiters don't see two different definitions of "pass rate" across the report and the dashboard.

**Primary recommendation:** Ship a single on-demand endpoint returning one flat payload (`{ scoreTrend, questionStats, violationCorrelation, biasSignals, meta }`). Use `recharts@3.10.1` in the frontend (React-19 compatible, ~90 KB gzipped, tree-shakeable). For the bias-direction indicator, ship a **defensible minimal v1**: recommendation-tier distribution over rolling windows, flagged as "distribution shift" (not a demographic-fairness metric); explicitly document what the v1 does NOT do and route "true adverse-impact monitoring" to the existing v2 requirement `ADMIN2-04` in REQUIREMENTS.md. Requirements ADMIN-06 through ADMIN-11 already exist in REQUIREMENTS.md — Phase 11 should be tagged to those IDs, not new ones.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADMIN-06 | Dashboard shows score trend over time | § Aggregation Recipes → Score trend; time-bucketed reducer over Attempts.EndTime + OverallScore |
| ADMIN-07 | Dashboard shows per-question difficulty/pass-rate | § Aggregation Recipes → Question stats; reducer over Responses grouped by QuestionID, joined to `QUESTIONS[]` for stem/tier |
| ADMIN-08 | Dashboard shows violation-count vs. score correlation | § Aggregation Recipes → Violation correlation; Pearson r + scatter tuples over Attempts (ViolationCount, OverallScore) |
| ADMIN-09 | Dashboard flags bottom-N discriminating questions for review | § Aggregation Recipes → Discrimination index; per-question point-biserial or top/bottom-quartile split |
| ADMIN-10 | Dashboard includes an LLM-generated narrative digest | § Open Questions → Q4; deferred candidate — see recommendation to move to Phase 11.5 or backlog |
| ADMIN-11 | Dashboard shows a "not enough data yet" fallback state at low attempt volume | § Aggregation Recipes → Low-N gating; per-signal `enough_data` boolean with documented thresholds |

**Note on the roadmap's "bias-direction indicator" wording:** This maps to **no existing REQUIREMENTS.md ID**. The roadmap phrasing was written before REQUIREMENTS.md v1.1 was formalized. Two viable interpretations exist — see § Open Questions Q1. RECOMMEND either (a) folding it into ADMIN-09 (bottom-N discriminating questions is a *content-fairness* signal, no demographics needed), or (b) explicitly deferring it to `ADMIN2-04` (demographic-segmented adverse-impact) already in v2.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Analytics aggregation (all four signals) | API / Backend (`Code.gs`) | — | Answer keys, rubric verdicts, per-recruiter identity, and the A2 denominator policy all live server-side; the client must never receive raw `Responses.IsCorrect` or `GradingTranscripts` rows for questions it didn't take. [VERIFIED: security invariant enforced by `checkAdminAuth` + `handleGetAttemptReport` allowlist projection at `Code.gs:311`] |
| Aggregation endpoint dispatch | API / Backend (`doGet`) | — | Matches existing `adminListCandidates` / `getAttemptTranscript` router pattern [VERIFIED: `Code.gs:143-147`]. |
| Auth gate | API / Backend (`checkAdminAuth`) | — | Every admin handler in `Code.gs` first-lines `checkAdminAuth(token)` [VERIFIED: `Code.gs:50,435,478,524,587,716`]. |
| Chart rendering | Browser / Client (Next.js `/admin/analytics`) | — | SVG DOM work belongs client-side. Server sends numbers, never chart JSX. |
| Auth token storage | Browser / Client (`sessionStorage.fs_admin_token`) | — | Existing admin panel pattern [VERIFIED: `assessment-app/src/app/admin/page.tsx:50,65,105`]. |
| Low-N gating decision | API / Backend | Browser / Client | Backend decides thresholds and returns `enough_data: false` flags per signal; client renders fallback text. Frontend must not silently drop empty arrays. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `recharts` | 3.10.1 | React chart primitives — LineChart, ScatterChart, BarChart | React 19 compatible; 90 KB gzipped tree-shaken; declarative Composed/Responsive pattern; already the de facto React chart library in 2026. [VERIFIED: npm registry — published 2026-07-25T15:23Z] AND [CITED: recharts.org docs] |
| Google Apps Script `SpreadsheetApp` | built-in | Sheet reads | Already the sole data-access primitive across `Code.gs` and `AsyncGrading.gs` [VERIFIED]. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Next.js 16.2.12 (already installed) | 16.2.12 | New client route `/admin/analytics` | Existing framework — no new install |
| `framer-motion` 12.43.0 (already installed) | 12.43.0 | Chart entry animation (optional) | Only if UX bar is set high; can ship without |
| `@phosphor-icons/react` (already installed) | 2.1.10 | Icons for section headers | Consistent with existing admin panel |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `recharts` | Hand-rolled SVG (no dep) | Zero bundle cost, but 4 chart types × dark-theme styling × responsive resize handlers = 300-500 LOC of throwaway code; recharts owns edge cases (axis label collision, tooltip positioning, empty-data state). |
| `recharts` | `chart.js` + `react-chartjs-2` | Larger imperative canvas API; less idiomatic for React 19 concurrent rendering; heavier gzipped (~200 KB). |
| `recharts` | `visx` (Airbnb) | Lower-level D3 primitives; more flexible but more code to write for 4 basic charts; overkill for v1. |
| Backend Pearson r | Client-side Pearson | Keeps API dumb (returns scatter tuples only) — but adds JS math to the client and forces the client to reason about "enough data." Backend calculation keeps the low-N gating decision in one place. |
| On-demand aggregation | Precomputed daily materialized view in a new `AnalyticsCache` sheet | Explicitly OUT for v1 per roadmap Success Criterion 2 ("On-demand aggregation, no precompute"); documented as CacheService upgrade path if N grows. |

**Installation:**
```bash
cd assessment-app
npm install recharts@3.10.1
```

**Version verification:** `npm view recharts version` → `3.10.1` (published 2026-07-25); satisfies React 19 peer via 3.x line. No install of any Apps Script library needed — everything is built-in.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `recharts` | npm | 10+ yrs | ~5M/wk | github.com/recharts/recharts | OK | Approved [CITED: recharts.org, github.com/recharts/recharts] |

No new backend dependencies. All Apps Script services (`SpreadsheetApp`, `UrlFetchApp`, `LockService`, `CacheService`, `Utilities`, `PropertiesService`, `MailApp`) are Google-built-in — not a package audit surface.

## Architecture Patterns

### System Architecture Diagram

```
                             ┌──────────────────────────────────────────┐
                             │  Recruiter browses to /admin/analytics    │
                             │  (Next.js client route, existing session) │
                             └──────────────────┬───────────────────────┘
                                                │  GET action=adminAnalytics&token=…
                                                ▼
                             ┌──────────────────────────────────────────┐
                             │  doGet(e) router in Code.gs               │
                             │  → checkAdminAuth(token)                  │
                             │  → handleAdminAnalytics(token)            │
                             └──────────────────┬───────────────────────┘
                                                │  reads (single pass each)
                          ┌─────────────────────┼──────────────────────┐
                          ▼                     ▼                      ▼
                  ┌───────────────┐    ┌───────────────┐     ┌─────────────────────┐
                  │ Attempts      │    │ Responses     │     │ IntegrityLogs        │
                  │ (15 cols)     │    │ (5 cols)      │     │ (4 cols)             │
                  │  EndTime,     │    │  QuestionID,  │     │  LogType, AttemptID  │
                  │  OverallScore,│    │  IsCorrect    │     │  (already summed in  │
                  │  ViolationCt, │    │               │     │   Attempts.Violation │
                  │  RecTier,     │    │               │     │   Count col 12)      │
                  │  UngradedCt   │    │               │     │                      │
                  └───────┬───────┘    └───────┬───────┘     └──────────┬──────────┘
                          │                    │                        │
                          └────────────┬───────┴────────────────────────┘
                                       ▼
                          ┌──────────────────────────────────┐
                          │ GradingTranscripts (9 cols)       │
                          │  Verdict, OverrideVerdict         │
                          │  → resolve via effectiveVerdict() │
                          │  (identical policy to             │
                          │   computeAggregatesForAttempt)    │
                          └──────────────┬───────────────────┘
                                         ▼
                          ┌──────────────────────────────────┐
                          │ In-memory aggregation (pure JS)   │
                          │  scoreTrend   (bucket by day)     │
                          │  questionStats(reduce by qId)     │
                          │  violationCorrelation(Pearson r)  │
                          │  biasSignals  (see § Open Q1)     │
                          │  meta.lowN flags per signal       │
                          └──────────────┬───────────────────┘
                                         ▼
                          ┌──────────────────────────────────┐
                          │ jsonResponse — single flat payload│
                          │  ContentService JSON              │
                          └──────────────┬───────────────────┘
                                         ▼
                          ┌──────────────────────────────────┐
                          │ Client renders 4 recharts + card  │
                          │ per-signal low-N fallback         │
                          │ per-signal ungraded caveat pill   │
                          └──────────────────────────────────┘
```

### Recommended Project Structure
```
backend/
├── Code.gs                       # add handleAdminAnalytics + adminAnalytics doGet route
└── AsyncGrading.gs               # unchanged; reuse effectiveVerdict() helper

assessment-app/src/
├── app/admin/
│   ├── page.tsx                  # add "Analytics" tab/link (no new route required)
│   └── analytics/
│       └── page.tsx              # NEW — analytics dashboard client component
├── components/analytics/
│   ├── ScoreTrendChart.tsx       # LineChart wrapper
│   ├── QuestionStatsTable.tsx    # sortable table + bar sparklines
│   ├── ViolationScatter.tsx      # ScatterChart wrapper
│   ├── BiasSignalsPanel.tsx      # recommendation-tier distribution + interpretation copy
│   ├── LowNFallback.tsx          # reusable "not enough data yet" component
│   └── UngradedCaveat.tsx        # reusable amber pill matching ReportScreen precedent
└── types/index.ts                # extend with AnalyticsPayload types
```

### Pattern 1: On-demand sheet-scan aggregation
**What:** One `getDataRange().getValues()` per sheet, then pure-JS reducers. No CacheService in v1.
**When to use:** Reads that must reflect the current sheet state and don't have to be sub-100ms.
**Example:**
```javascript
// Source: adapts existing computeAggregatesForAttempt pattern [VERIFIED: AsyncGrading.gs:92-174]
function handleAdminAnalytics(token) {
  if (!checkAdminAuth(token)) return { success: false, error: "Unauthorized" };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const attemptsData    = ss.getSheetByName("Attempts").getDataRange().getValues();
  const responsesData   = ss.getSheetByName("Responses").getDataRange().getValues();
  const transcriptsData = ss.getSheetByName("GradingTranscripts").getDataRange().getValues();

  // Strip header row once.
  const attempts = attemptsData.slice(1);
  const responses = responsesData.slice(1);
  const transcripts = transcriptsData.slice(1);

  // Build per-attempt indexes we'll reuse across all four signals.
  const attemptsByStatus = attempts.filter(function(r) {
    return ['submitted', 'graded', 'emailed'].indexOf(r[5]) !== -1;
  });
  // ... aggregators below ...
  return {
    success: true,
    generatedAt: new Date().toISOString(),
    meta: { totalAttempts: attemptsByStatus.length, ungradedTotal: /* … */ },
    scoreTrend: buildScoreTrend(attemptsByStatus),
    questionStats: buildQuestionStats(responses, transcripts),
    violationCorrelation: buildViolationCorrelation(attemptsByStatus),
    biasSignals: buildBiasSignals(attemptsByStatus)
  };
}
```

### Pattern 2: doGet route registration (existing pattern)
**What:** Add exactly one `else if` branch in `doGet`. Do not touch `doPost` — analytics is read-only.
**Example:**
```javascript
// Source: existing router at Code.gs:134-153 [VERIFIED]
if (action === "checkAttempt") { … }
else if (action === "getAttemptReport") { … }
else if (action === "adminListCandidates") { … }
else if (action === "getAttemptTranscript") { … }
else if (action === "adminAnalytics") {                        // <── NEW
  return jsonResponse(handleAdminAnalytics(params.token));
}
```

### Pattern 3: A2-policy denominator reuse
**What:** Any "pass rate" number MUST use the same "ungraded excluded from denominator" policy as `computeAggregatesForAttempt` [VERIFIED: `AsyncGrading.gs:127,144`]. Diverging here creates a report/dashboard mismatch that will break recruiter trust.
**Example:**
```javascript
// For per-question pass rate over the Responses + GradingTranscripts join:
//   denominator = count of answers where effectiveVerdict !== 'ungraded'
//   numerator   = count of answers where effectiveVerdict === 'correct'
// Reuse effectiveVerdict() as-is; do not re-implement the resolver.
```

### Pattern 4: Low-N per-signal gating
**What:** Each of the four signals returns `{ enough_data: bool, threshold: N, samples: n, ...payload }`. The frontend renders a per-card fallback rather than hiding the section, so recruiters see "not enough data yet" and understand the dashboard is working.
**Suggested thresholds (draft — flag for discuss-phase):**
- `scoreTrend`: ≥ 5 attempts across ≥ 3 distinct calendar days
- `questionStats`: ≥ 5 responses per question for that question's row to show a pass-rate; questions below threshold render "insufficient data"
- `violationCorrelation`: ≥ 10 attempts with `violationCount > 0` OR ≥ 20 attempts total (a correlation over near-zero variance is meaningless)
- `biasSignals` (recommendation-tier distribution): ≥ 15 attempts

### Pattern 5: Ungraded caveat as reusable component
**What:** Mirror the amber-notice pattern from `ReportScreen.tsx:181-200` [VERIFIED]. Each aggregation card whose denominator excluded ungraded answers must show a small caveat pill: e.g., "`23 answers pending recruiter review — excluded from pass-rate.`" Never hide the count.

### Anti-Patterns to Avoid
- **Precomputing to a new AnalyticsCache sheet.** Explicitly OUT for v1 per roadmap Success Criterion 2. Document only as an upgrade path.
- **Merging correct+ungraded into a single "answered" bucket.** Breaks Phase 10 GRADE-07 invariant.
- **Sending raw `Responses` rows to the client.** Question-level pass-rate can be aggregated server-side and sent as `{ qId, passRate, sampleSize, tier }` — no per-candidate correctness ever leaves the server.
- **Rendering a Pearson r without the sample size and scatter plot.** A single r number without n is statistically illiterate; both must be shown together.
- **Auto-refreshing the dashboard.** Explicit "Refresh" button; unbounded polling burns UrlFetch quota.
- **Adding demographic data collection to make bias-direction meaningful.** OUT OF SCOPE — REQUIREMENTS.md OOS row: "adverse-impact monitoring" is v2 `ADMIN2-04`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart rendering (line/scatter/bar) | Custom SVG components + resize observers | `recharts` `LineChart` / `ScatterChart` / `BarChart` in a `ResponsiveContainer` | Recharts handles axis-label collision, tooltip positioning, empty-array state, resize, and dark-mode theming for free. |
| Pearson correlation | New helper file | 8-line inline reducer in `handleAdminAnalytics` | Pearson r is a textbook two-pass reduce (`Σx`, `Σy`, `Σxy`, `Σx²`, `Σy²`) — pulling in `simple-statistics` or `mathjs` (~180 KB) for one formula is disproportionate. Verify with `tests/analytics/test_correlation.ts`. |
| Time-bucketing | New date lib | Existing `Date.toISOString().slice(0,10)` day-key reducer | The bucket unit is "day" — a substring is fine. Pulling `date-fns` for one call is overkill and adds a bundle-size fight. |
| Concurrency for reads | Nothing | Nothing (read-only endpoint — no `LockService` needed) | Reads are safe against concurrent grading writes; readers see a stale-by-a-few-seconds view of `Attempts`, which is acceptable for an analytics screen. |

**Key insight:** Every domain here (charts, correlation, time bucketing, aggregation) has a small, focused correct answer. Resist the urge to add analytics infra — the CacheService upgrade path is documented but explicitly deferred.

## Runtime State Inventory

**Not applicable** — Phase 11 is greenfield (adds one new endpoint + one new client route). No rename, refactor, migration, or string replacement.

Explicit non-findings verified:
- **Stored data:** No new sheet is created. No existing sheet schema is changed. `initSheets()` is untouched. [VERIFIED: `Code.gs:200-242`]
- **Live service config:** No new triggers. No `ScriptApp.newTrigger()` calls. Analytics is fully synchronous on demand.
- **OS-registered state:** None — no clasp deploy hook changes required beyond re-pushing `Code.gs`.
- **Secrets / env vars:** No new secrets. Reuses `ADMIN_TOKEN` script property + `OPENROUTER_API_KEY` if optional LLM digest is deferred.
- **Build artifacts:** `recharts` will be added to `assessment-app/package-lock.json` and `node_modules/`. `next build` picks it up automatically.

## Common Pitfalls

### Pitfall 1: 6-minute Apps Script execution cap on the analytics endpoint
**What goes wrong:** Analytics runs synchronously in `doGet`. At N=200 attempts × ~50 responses = 10,000 rows across `Responses`, aggregation is well under 1 second [ASSUMED — needs measurement]. But if attempt volume grows unexpectedly (a marketing push, a bulk import), the endpoint could approach the [6-minute cap](https://developers.google.com/apps-script/guides/services/quotas).
**Why it happens:** `getDataRange().getValues()` loads all rows; naïve nested loops (O(N × M)) balloon at scale.
**How to avoid:**
- All reducers must be O(N) — build hash maps keyed by `attemptId` / `questionId` once, then join by key. Never nest `for` loops over two sheets.
- Instrument: log `Utilities.formatDate(...)` timestamps at endpoint entry and exit; add `meta.aggregationMs` to the payload so it's visible to recruiters and to any future perf review.
- Document CacheService upgrade path (Success Criterion 2): switch to `CacheService.getScriptCache().put('analytics_v1', JSON, 300)` with a 5-minute TTL when `meta.aggregationMs > 2000`.
**Warning signs:** `handleAdminAnalytics` errors with `"Exceeded maximum execution time"` in Apps Script Executions log; UI shows generic "Connection failed" (matches existing error path at `admin/page.tsx:77`).

### Pitfall 2: Denominator-policy drift from Phase 10
**What goes wrong:** New reducers compute pass-rate as `correct / (correct + incorrect + ungraded)` while the report card at `handleGetAttemptReport` uses `correct / (correct + incorrect)` [VERIFIED: A2 policy at `AsyncGrading.gs:127,144`]. Recruiter opens candidate report → 85% score. Same candidate on dashboard → 71% pass rate on the same questions. They report a bug.
**Why it happens:** Copy-pasting old grading code that predates GRADE-07.
**How to avoid:** Import and reuse `effectiveVerdict()` from `AsyncGrading.gs` as the single resolver. Add a test in `tests/analytics/` that asserts the two paths produce identical numbers on a fixture attempt.
**Warning signs:** Unit test divergence; recruiter question in Slack.

### Pitfall 3: Bias-direction indicator overreach
**What goes wrong:** A recruiter reads "bias-direction indicator" and expects EEOC-grade adverse-impact analysis. The v1 ships a recommendation-tier distribution and gets used as-if it were adverse-impact analysis in an actual hiring dispute.
**Why it happens:** Product label doesn't match statistical capability; no demographic data is collected (by explicit design — REQUIREMENTS.md OOS row: no PII beyond name/email).
**How to avoid:**
- Rename in-UI to "Distribution Monitor" or "Recommendation-Tier Drift" — words that describe what the number is, not what it isn't.
- Add a persistent tooltip: "This chart shows how the mix of Strong Fit / Consider / Not Recommended has shifted over rolling windows. It does NOT measure bias against any protected class — this system does not collect demographic data. See docs for the v2 ADMIN2-04 roadmap item."
- Add a discuss-phase question routing this decision to the user before build.
**Warning signs:** Recruiter uses the number in a candidate-impact conversation. This is a compliance-hardening pitfall — flag for legal review before v1 GA if the product ever serves external customers.

### Pitfall 4: Chart bundle-size regression on `/admin/analytics` route
**What goes wrong:** `recharts` at ~90 KB gzipped is fine, but naïve `import { LineChart, BarChart, ScatterChart, ... } from 'recharts'` may not tree-shake correctly if the code path also imports rarely-used sub-modules. If the whole recharts bundle hits ~300 KB it degrades admin panel first-paint.
**How to avoid:**
- Import only the exact primitives used: `LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ScatterChart, Scatter, BarChart, Bar, Cell`.
- Confirm bundle impact with `next build` output; if `/admin/analytics` chunk > 200 KB gzipped, split the analytics route with a dynamic `import()` per chart.
- Because analytics is admin-only and the `admin/` route is already behind a passcode, the extra weight only hits recruiters, not candidates.

### Pitfall 5: Auth token appears in query string (URL logging risk)
**What goes wrong:** Existing pattern passes `token` via `?token=<value>` on GET requests [VERIFIED: `admin/page.tsx:66,98,166,190`]. GET query strings are logged in server access logs and browser history. Apps Script web-app request logs contain them.
**Why it happens:** This is the existing project convention across all four admin GETs — not a Phase 11 regression.
**How to avoid:** Match the existing pattern for consistency (do NOT introduce a divergent auth pattern for one endpoint). Flag the underlying issue as a follow-up backlog item — a broader `/admin/*` refactor to `Authorization: Bearer` headers is out of Phase 11 scope. This is intentionally called out here so the plan-checker doesn't flag it as a Phase 11 bug.

### Pitfall 6: `Attempts.EndTime` is a string, not a Date
**What goes wrong:** `EndTime` is written as an ISO-8601 string (`Code.gs:302,428`). Naïvely doing arithmetic like `new Date(endTime)` inside a reducer works but is O(N) `Date` constructor calls; more importantly, empty-string EndTime (active or `pending_grading` attempts) throws `Invalid Date`.
**How to avoid:** Filter to `READY_STATUSES` first (`['submitted', 'graded', 'emailed']`) so every row has a valid EndTime. Use `endTime.slice(0, 10)` for day-bucketing — no Date object needed.

### Pitfall 7: OverallScore column type ambiguity
**What goes wrong:** `Attempts.OverallScore` (col 8, zero-indexed 7) is written as a numeric percentage by `computeAggregatesForAttempt` [VERIFIED: `AsyncGrading.gs:160`] but the initial `handleStartAttempt` writes an empty string for pending attempts [VERIFIED: `Code.gs:306`]. Reducer must coerce with `Number(row[7]) || 0` AND filter unready attempts, not just coerce.
**How to avoid:** All reducers operate on `attemptsByStatus` (already status-filtered). Belt-and-braces: `const score = Number(row[7]); if (!Number.isFinite(score)) return;` inside reducers.

## Data-Shape Reference for Aggregation Queries

### `Attempts` (15 cols, 0-indexed)
| Idx | Column | Type | Populated Live | Used By | Notes |
|-----|--------|------|----------------|---------|-------|
| 0 | AttemptID | string | ✓ | all | e.g., `ATT-A1B2C3D4` |
| 1 | Name | string | ✓ | — (PII — do not aggregate) | |
| 2 | Email | string | ✓ | — (PII — do not aggregate) | |
| 3 | StartTime | ISO string | ✓ | — | |
| 4 | EndTime | ISO string | after submit | scoreTrend day-bucketing | empty for `active` |
| 5 | Status | string | ✓ | filter | must be in READY_STATUSES |
| 6 | FrozenQuestionIDs | JSON array string | ✓ | (not needed by Phase 11) | |
| 7 | OverallScore | number (0-100) | after grading | scoreTrend, violationCorrelation | coerce, filter finite |
| 8 | LanguageScore | number | after grading | (optional per-trait trends) | |
| 9 | ResearchScore | number | after grading | (optional per-trait trends) | |
| 10 | CriticalScore | number | after grading | (optional per-trait trends) | |
| 11 | ViolationCount | number | live (incremented on log) | violationCorrelation | |
| 12 | RecommendationTier | 'Strong Fit'/'Consider'/'Not Recommended' | after grading | biasSignals | tier distribution |
| 13 | NarrativeInsight | string | after grading | — | |
| 14 | UngradedCount | number | after grading (Phase 10) | meta.ungradedTotal, per-attempt caveat | may still shift — see Assumption A5 |

### `Responses` (5 cols, 0-indexed)
| Idx | Column | Type | Notes |
|-----|--------|------|-------|
| 0 | AttemptID | string | join key |
| 1 | QuestionID | string | join key to `QUESTIONS[]` |
| 2 | SubmittedAnswer | JSON string | do not send to client |
| 3 | IsCorrect | bool OR 'ungraded' (Phase 10 extended domain) | for MCQ this is the sole verdict; for open-text see GradingTranscripts |
| 4 | Timestamp | ISO string | |

### `IntegrityLogs` (4 cols)
Already summed into `Attempts.ViolationCount` (col 11) on write [VERIFIED: `Code.gs:376-378`]. Phase 11 does **not** need to read `IntegrityLogs` directly — reading `Attempts.ViolationCount` is sufficient and O(N) cheaper.

### `GradingTranscripts` (9 cols, Phase 10)
| Idx | Column | Type | Notes |
|-----|--------|------|-------|
| 0 | AttemptID | string | join |
| 1 | QuestionID | string | join |
| 2 | RubricVersion | string | (metadata; not needed by Phase 11) |
| 3 | Verdict | 'correct'/'incorrect'/'ungraded' | join to Responses for effectiveVerdict |
| 4 | CriteriaMetJSON | JSON string | (metadata) |
| 5 | Rationale | string | (metadata) |
| 6 | OverrideVerdict | 'correct'/'incorrect'/'' | if non-empty, overrides col 3 |
| 7 | OverrideAt | ISO string | (metadata) |
| 8 | OverrideTokenHash | string | (never leaves server) |

**Effective verdict resolver:** `overrideVerdict || verdict` — reuse `effectiveVerdict()` from `AsyncGrading.gs` verbatim.

### `QUESTIONS[]` (in-memory constant, `Code.gs:849+`)
Per-question metadata (bank, section, difficulty_tier, stem) is a plain JS array constant. Build a `Map` keyed by `id` once per request:
```javascript
const qById = {};
for (let i = 0; i < QUESTIONS.length; i++) qById[QUESTIONS[i].id] = QUESTIONS[i];
```

## Aggregation Recipes

### Score trend (ADMIN-06)
```javascript
// Bucket by ISO date (day). Return sorted array for the chart.
function buildScoreTrend(attemptsByStatus) {
  const buckets = {};
  attemptsByStatus.forEach(function(r) {
    const end = r[4];
    if (!end || typeof end !== 'string') return;
    const day = end.slice(0, 10);          // YYYY-MM-DD
    const score = Number(r[7]);
    if (!Number.isFinite(score)) return;
    if (!buckets[day]) buckets[day] = { sum: 0, n: 0 };
    buckets[day].sum += score;
    buckets[day].n += 1;
  });
  const days = Object.keys(buckets).sort();
  const points = days.map(function(d) {
    return { date: d, avgScore: Math.round(buckets[d].sum / buckets[d].n), n: buckets[d].n };
  });
  return {
    enough_data: points.length >= 3 && attemptsByStatus.length >= 5,
    threshold_note: 'Need >=5 attempts across >=3 days',
    points: points
  };
}
```

### Question stats (ADMIN-07)
```javascript
// Per-qId: sampleSize (excluding ungraded), passRate, ungradedCount, difficulty_tier, stem preview.
function buildQuestionStats(responses, transcripts) {
  // 1. Build transcript index for effectiveVerdict resolution.
  const txByKey = {};
  transcripts.forEach(function(t) { txByKey[t[0] + '|' + t[1]] = { verdict: t[3], override: t[6] }; });
  // 2. Fold responses.
  const perQ = {};
  responses.forEach(function(r) {
    const qId = r[1];
    const tx = txByKey[r[0] + '|' + qId];
    let effective;
    if (tx) {
      effective = (tx.override && tx.override.length > 0) ? tx.override : tx.verdict;
    } else {
      // MCQ path: IsCorrect col 3 is the only source
      const ic = r[3];
      effective = (ic === true || ic === 'TRUE' || ic === 'true') ? 'correct'
                : (ic === false || ic === 'FALSE' || ic === 'false') ? 'incorrect'
                : 'ungraded';
    }
    if (!perQ[qId]) perQ[qId] = { correct: 0, incorrect: 0, ungraded: 0 };
    perQ[qId][effective] += 1;
  });
  // 3. Project.
  const MIN = 5;
  const rows = Object.keys(perQ).map(function(qId) {
    const c = perQ[qId];
    const graded = c.correct + c.incorrect;
    return {
      qId: qId,
      correct: c.correct,
      incorrect: c.incorrect,
      ungraded: c.ungraded,
      sampleSize: graded,
      passRate: graded >= MIN ? Math.round(100 * c.correct / graded) : null,
      enough_data: graded >= MIN
    };
  });
  return { threshold: MIN, rows: rows };
}
```

### Violation-vs-score correlation (ADMIN-08)
```javascript
function buildViolationCorrelation(attemptsByStatus) {
  const pts = attemptsByStatus
    .map(function(r) { return { v: Number(r[11]) || 0, s: Number(r[7]) }; })
    .filter(function(p) { return Number.isFinite(p.s); });
  const n = pts.length;
  if (n < 10) {
    return { enough_data: false, threshold: 10, samples: n, points: pts, r: null };
  }
  let sumV = 0, sumS = 0, sumVS = 0, sumV2 = 0, sumS2 = 0;
  pts.forEach(function(p) {
    sumV += p.v; sumS += p.s;
    sumVS += p.v * p.s; sumV2 += p.v * p.v; sumS2 += p.s * p.s;
  });
  const num = n * sumVS - sumV * sumS;
  const den = Math.sqrt((n * sumV2 - sumV * sumV) * (n * sumS2 - sumS * sumS));
  const r = den === 0 ? 0 : num / den;
  return {
    enough_data: true, samples: n, points: pts,
    r: Math.round(r * 1000) / 1000,
    interpretation: Math.abs(r) < 0.2 ? 'weak' : Math.abs(r) < 0.5 ? 'moderate' : 'strong'
  };
}
```

### Discrimination index (ADMIN-09) — RECOMMENDED interpretation of "bias-direction indicator"
```javascript
// Point-biserial-like: for each question with >=MIN samples, compare pass-rate in
// the top-quartile-scoring attempts vs the bottom-quartile-scoring attempts.
// A question where TOP < BOTTOM is anti-discriminating (candidates who did well
// on everything else got THIS one wrong — probably a bad or biased question).
// Surface the bottom-N such questions for recruiter review.
// This measures CONTENT quality — no demographic data required.
```

### Bias signals (roadmap "bias-direction indicator" — MINIMAL v1)
```javascript
// Recommendation-tier distribution over rolling windows:
//   last 20 attempts vs. all-time.
// Report shift in % Strong Fit / Consider / Not Recommended.
// This is a "distribution monitor" not an adverse-impact analysis.
// Label the chart accordingly. See Pitfall 3.
```

### Low-N gating (ADMIN-11)
Every signal above returns `enough_data: bool`. The frontend renders `<LowNFallback threshold={N} samples={n} />` when false. Do NOT hide the card.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Precomputed aggregation to a materialized view | On-demand aggregation with optional CacheService TTL | roadmap decision, 2026-07-30 | Simpler v1; upgrade path documented |
| Chart.js / D3 imperative | React declarative chart libs (recharts, visx) | industry shift 2019-2023 | Component reuse, dark-mode theming for free |
| Adverse-impact monitoring tied to bias score | Content-fairness (discrimination index) + demographic monitoring split into separate v2 feature | HR-tech standard practice | Avoids false-precision claims |
| Query string tokens | `Authorization: Bearer` headers | industry default | **Not adopted in this project** — see Pitfall 5 for consistency reasoning |

**Deprecated / outdated:** BlazeFace + TF.js CDN pattern (unrelated — Phase 12). `evaluateOpenTextBatch` (unrelated — replaced Phase 10).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | On-demand aggregation at N ≤ 500 attempts × ~50 responses each completes well under 1 second inside Apps Script `doGet` | Common Pitfalls #1 | Endpoint times out or approaches 6-min cap; must migrate to CacheService sooner. Mitigation: instrument `meta.aggregationMs` from day 1. |
| A2 | Recruiter interpretation of "bias-direction indicator" is content-fairness (discrimination index) + tier-distribution shift — NOT demographic adverse-impact | Requirements table, Open Questions Q1 | v1 ships wrong feature. Mitigation: discuss-phase must confirm before build; UI copy must not overclaim. |
| A3 | `recharts@3.10.1` tree-shakes correctly under Next.js 16 + React 19 with the primitives listed in Pitfall 4 | Chart bundle size | Bundle bloat on `/admin/analytics`. Mitigation: verify with `next build` output; fall back to dynamic import. |
| A4 | Phase 10 GradingTranscripts + Attempts.UngradedCount are live and populated for all NEW attempts, even though plan 10-07 Task 2 (11-step live verify) is deferred | Data-shape reference; Runtime State | If Phase 10 verify surfaces a schema-write bug, analytics denominators will be wrong. Mitigation: gate Phase 11 execution on Phase 10 verify completion, OR add a defensive `col 14 || 0` fallback and test against a legacy attempt with no UngradedCount column value. |
| A5 | Existing admin auth pattern (`?token=…` on GET) is acceptable to reuse for Phase 11 | Pitfall 5 | Recruiter tokens exposed in logs. Mitigation: consistency > divergence for one endpoint; audit-fix separately. |
| A6 | `Responses.IsCorrect` column stores booleans OR the literal string `'ungraded'` (Phase 10 extended domain), not the mixed sheet-type values Google Sheets sometimes casts | Aggregation recipes → question stats | Off-domain values silently drop into `ungraded` bucket. Mitigation: defensive coercion in the reducer as shown; write a test fixture that exercises boolean-string ambiguity. |
| A7 | The four success-criteria signals + low-N fallback + ungraded caveat are the ONLY user stories for Phase 11 (i.e., ADMIN-10 LLM narrative digest is deferrable) | Requirements table, Open Questions Q4 | If ADMIN-10 is in scope, Phase 11 gains an OpenRouter call + latency budget + prompt design. Mitigation: discuss-phase must confirm. |

## Open Questions

1. **What is the intended semantics of "bias-direction indicator"?**
   - What we know: no demographic data is collected (REQUIREMENTS.md OOS); v2 `ADMIN2-04` explicitly covers demographic adverse-impact.
   - What's unclear: whether the roadmap author intended (a) content-fairness discrimination index (ADMIN-09), (b) recommendation-tier distribution shift over time, or (c) something else.
   - **Recommendation:** Ship (a) + (b) together as "Fairness & Distribution" section; label clearly; route (c) — true adverse-impact — to `ADMIN2-04`.

2. **Low-N thresholds — are the defaults (5 / 5 / 10 / 15) recruiter-appropriate?**
   - Draft based on statistical rules of thumb, not domain input.
   - **Recommendation:** Show the draft table in discuss-phase; recruiter can adjust.

3. **Does the dashboard need a date-range filter in v1?**
   - Success criteria don't mention one; roadmap says "on-demand aggregation."
   - **Recommendation:** Ship without; add "Last 30 / 90 / all" toggle in v1.1 if used. Deferrable via one extra query param.

4. **Is ADMIN-10 (LLM-generated narrative digest) in Phase 11 scope, or a follow-up?**
   - Roadmap goal wording does NOT include narrative digest; success criteria don't mention it.
   - REQUIREMENTS.md lists ADMIN-10.
   - **Recommendation:** Defer to Phase 11.5 or backlog. Every additional signal shipped in v1 tightens the 6-min cap risk (Pitfall 1). The LLM call also adds a new failure mode ("digest failed to generate" — need its own fallback UI).

5. **Should the analytics endpoint be rate-limited?**
   - Recruiter clicking Refresh in a loop could burn UrlFetch quota via the AsyncGrading path (though analytics itself makes no UrlFetch calls).
   - **Recommendation:** Debounce Refresh client-side (min 3s between clicks); no server-side rate limit needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 20+ | assessment-app build | ✓ | package.json specifies `@types/node ^20` | — |
| Next.js 16.2.12 | admin/analytics route | ✓ | installed | — |
| React 19.2.4 | recharts peer | ✓ | installed | — |
| `recharts` 3.x | 4 charts | ✗ (not installed) | — | Hand-rolled SVG per-chart (adds ~400 LOC across 4 components) |
| Google Apps Script | backend endpoint | ✓ | Code.gs / AsyncGrading.gs already deployed | — |
| `ADMIN_TOKEN` Script Property | auth | ✓ (from Phase 6+) | — | — |
| Phase 10 `GradingTranscripts` sheet | ungraded caveat, effectiveVerdict resolver | ✓ (created by initSheets, populated by recent commits) | 9-col schema | Defensive `col 14 \|\| 0` fallback for legacy attempts |

**Missing dependencies with fallback:** `recharts` — install via npm. **Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (present per `vitest.config.ts` at repo root) [VERIFIED] |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- tests/analytics/` (path pending; establish in Wave 0) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMIN-06 | Score trend builds day-bucketed points from ≥N attempts | unit | `npm test -- tests/analytics/test_score_trend.ts -x` | ❌ Wave 0 |
| ADMIN-06 | Score trend returns `enough_data: false` at N<threshold | unit | same file | ❌ Wave 0 |
| ADMIN-07 | Question stats denominator matches `computeAggregatesForAttempt` A2 policy on fixture attempt | unit (parity test) | `npm test -- tests/analytics/test_question_stats.ts -x` | ❌ Wave 0 |
| ADMIN-07 | Question stats returns `passRate: null` for questions below MIN sample size | unit | same file | ❌ Wave 0 |
| ADMIN-08 | Pearson r matches `simple-statistics` reference on 20-point fixture (within 0.001) | unit | `npm test -- tests/analytics/test_correlation.ts -x` | ❌ Wave 0 |
| ADMIN-08 | Correlation returns `enough_data: false` below sample threshold | unit | same file | ❌ Wave 0 |
| ADMIN-09 | Discrimination index flags anti-discriminating question in curated fixture | unit | `npm test -- tests/analytics/test_discrimination.ts -x` | ❌ Wave 0 |
| ADMIN-11 | Low-N fallback renders on each card when its signal is below threshold | component/UI | `npm test -- tests/admin/test_analytics_ui.ts -x` | ❌ Wave 0 |
| Auth invariant | Endpoint returns 401-shape when token missing/wrong | unit | `npm test -- tests/analytics/test_analytics_auth.ts -x` | ❌ Wave 0 |
| Data-quality invariant | Ungraded count is surfaced (not zero-defaulted) in payload | unit | `npm test -- tests/analytics/test_ungraded_caveat.ts -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- tests/analytics/`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/analytics/` directory + shared fixture (`fixtures/attempts_20.json` with mixed statuses, ungraded, overrides)
- [ ] `tests/analytics/test_score_trend.ts`
- [ ] `tests/analytics/test_question_stats.ts` (must import an `effectiveVerdict` mirror or shared helper for parity check)
- [ ] `tests/analytics/test_correlation.ts` (may need `simple-statistics` as devDep-only reference for parity — install ONLY as devDep or skip and use hand-computed reference values)
- [ ] `tests/analytics/test_discrimination.ts`
- [ ] `tests/analytics/test_ungraded_caveat.ts`
- [ ] `tests/analytics/test_analytics_auth.ts`
- [ ] `tests/admin/test_analytics_ui.ts` (React Testing Library — check if already used elsewhere)
- [ ] Extend `scripts/sync-check.ts` if the analytics backend introduces any new shared helper between Code.gs and a JS mirror (probably not needed — pure aggregation belongs server-side)

**Sync-check note:** Unlike Phase 10, Phase 11's backend has no client-mirrored logic (grading engine is not touched). No new sync-check divergence assertions required.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Reuse `checkAdminAuth(token)` — shared admin token, matches Phase 6+ pattern [VERIFIED] |
| V3 Session Management | yes | `sessionStorage.fs_admin_token` — existing pattern [VERIFIED] |
| V4 Access Control | yes | Every handler first-lines `checkAdminAuth`. New `handleAdminAnalytics` MUST too. |
| V5 Input Validation | yes | `token` is the only user input. No injection surface. |
| V6 Cryptography | no | No new crypto. Token comparison is direct — matches `Code.gs:50-52`. |
| V7 Error Handling / Logging | yes | Error path must not leak sheet contents in the 500 response — reuse `jsonResponse({ error: err.toString() }, 500)` pattern [VERIFIED: `Code.gs:151`] |
| V8 Data Protection | yes | PII (Name, Email) must NOT appear in any Phase 11 payload. Aggregations key on AttemptID or QuestionID, never Email. |
| V13 API and Web Service | yes | Public sheet URL structure is unchanged; single new GET action. |

### Known Threat Patterns for Google Apps Script + Next.js admin
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated analytics access | Information Disclosure | `checkAdminAuth(token)` first line of handler |
| PII in analytics payload | Information Disclosure | Aggregate on `attemptId` / `questionId`; never include Name or Email in returned rows |
| Answer-key leak via question stats | Information Disclosure | Send `{ qId, passRate, sampleSize }` — never `options.is_correct`, never `model_answer`, never `rubric` [VERIFIED invariant: `Code.gs:310` allowlist projection comment] |
| Token in URL query string logged server-side | Information Disclosure | Existing project pattern — DO NOT diverge for one endpoint; audit-fix broadly (see Pitfall 5) |
| Time-based information leak (auth timing) | Information Disclosure | Direct string equality is fine here (single shared secret, low value asymmetry); no need for constant-time compare |
| Concurrent write races (grading queue vs analytics read) | Consistency | None needed — analytics is read-only; sees eventually-consistent view, acceptable |

**Compliance note:** The "bias-direction indicator" carries adverse-impact-analysis expectations. See Pitfall 3. Recommend the plan include explicit UI copy language reviewed against fair-hiring practice (EEOC UGESP — Uniform Guidelines on Employee Selection Procedures — the 4/5 rule applies only when demographic data is available, which is intentionally not the case here).

## Sources

### Primary (HIGH confidence — VERIFIED in repo)
- `backend/Code.gs` — sheet schema, doGet router, checkAdminAuth, existing admin handlers (grep-verified lines cited inline)
- `backend/AsyncGrading.gs:92-174` — `computeAggregatesForAttempt` and A2 denominator policy
- `assessment-app/src/app/admin/page.tsx` — session storage + query-string auth pattern
- `assessment-app/src/components/ReportScreen.tsx:181-200` — amber-notice pattern for ungraded caveat
- `assessment-app/src/types/index.ts` — `Report`, `TranscriptEntry` shape
- `assessment-app/package.json` — Next.js 16.2.12, React 19.2.4, framer-motion 12.43.0 installed
- `.planning/REQUIREMENTS.md` — ADMIN-06..11 already exist; ADMIN2-04 covers demographic monitoring for v2
- `.planning/phases/10-rubric-based-llm-grading-recruiter-transcript-override/10-RESEARCH.md` — 6-min cap pattern, LockService pattern, effectiveVerdict resolver

### Secondary (MEDIUM confidence — CITED)
- `recharts` v3.10.1 verified via `npm view recharts version` on 2026-08-01 [VERIFIED: npm registry] AND [CITED: recharts.org]
- Apps Script quotas: 6-min script runtime cap [CITED: developers.google.com/apps-script/guides/services/quotas — via Phase 10 RESEARCH.md]

### Tertiary (LOW confidence — ASSUMED / needs discuss-phase)
- Bias-direction indicator semantics — see Open Questions Q1
- Low-N threshold defaults — see Open Questions Q2

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — recharts is the React-standard, no new backend deps
- Architecture: HIGH — pattern is a direct extension of the existing `doGet` router and mirrors `computeAggregatesForAttempt` shape
- Data shapes: HIGH — schemas grep-verified against `initSheets` and observed writes
- Pitfalls #1 (6-min cap): MEDIUM — verified as risk pattern in Phase 10 RESEARCH; not measured for Phase 11's specific workload
- Pitfalls #2-#7: HIGH — verified against code
- Bias-direction indicator interpretation: MEDIUM — recommended interpretation is defensible but requires user confirmation
- Phase 10 dependency: MEDIUM — schema is live in git but 11-step live verify (plan 10-07 Task 2) is deferred; risk of schema shift is real but low

**Research date:** 2026-08-01
**Valid until:** 2026-09-01 (stable domain; Google Apps Script quotas rarely change; recharts stable at 3.x)
