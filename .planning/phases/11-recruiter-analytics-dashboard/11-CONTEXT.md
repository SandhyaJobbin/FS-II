# Phase 11: Recruiter Analytics Dashboard - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

A single new admin read-only endpoint `handleAdminAnalytics(token)` that reads `Attempts` / `Responses` / `GradingTranscripts` on demand (no cache, no precompute) inside Google Apps Script, plus a new `/admin/analytics` route in the Next.js admin app rendering four charts — score trend, per-question pass-rate, violation-vs-score correlation, and a distribution/fairness signal — each with an explicit low-N data fallback and an ungraded-count caveat. No new sheets, no new triggers, no demographic data collection, no answer-key leakage.

The four roadmap success-criteria signals map to ADMIN-06 (score trend), ADMIN-07 (question pass-rate), ADMIN-08 (violation-vs-score correlation), ADMIN-09 (bottom-N discriminating questions), and ADMIN-11 (low-N fallback). ADMIN-10 (LLM narrative digest) is deferred out of v1 — see D-05.

</domain>

<decisions>
## Implementation Decisions

### Bias-direction indicator — label and what v1 shows
- **D-01 (one-way):** The fourth signal is shipped as **two paired views**, NOT a single bias metric, and the recruiter-facing UI label MUST be **"Distribution Monitor"** (never "bias-direction indicator", "bias", or "adverse-impact"). Header carries a persistent info tooltip stating verbatim: *"This chart shows how the mix of Strong Fit / Consider / Not Recommended has shifted between the last 20 attempts and all-time. It does NOT measure bias against any protected class — this system does not collect demographic data. See v2 ADMIN2-04 for adverse-impact monitoring."* — **Reversibility:** one-way — the label is compliance-sensitive recruiter-facing copy; reversing it after launch risks an adverse-impact misread entering a hiring dispute, so downstream reviewers should treat any relabel as a checkpoint.
- **D-02:** Pair the tier-distribution view with the ADMIN-09 **discrimination index** (top-quartile vs bottom-quartile pass-rate per question surfacing anti-discriminating questions) under the same "Distribution Monitor" / "Fairness" panel. This is a content-fairness measure requiring no demographic data. True demographic adverse-impact monitoring stays in v2 `ADMIN2-04` (REQUIREMENTS.md OOS row) — explicitly NOT in scope here.

### Low-N thresholds (per signal, not uniform)
- **D-03 (costly):** Each signal returns `{ enough_data: boolean, threshold: number, samples: number }`. The thresholds are **per-signal**, not a single global MIN, and the planner MUST align the four reducers to:
  - `scoreTrend`: ≥ 5 ready attempts across ≥ 3 distinct calendar days
  - `questionStats`: ≥ 5 graded responses per question for that question's row to show a pass-rate
  - `violationCorrelation`: ≥ 10 attempts with violationCount > 0 OR ≥ 20 ready attempts total (correlation over near-zero variance is meaningless)
  - `biasSignals` (recommendation-tier distribution): ≥ 15 ready attempts
  - `discriminationIndex` (ADMIN-09): same MIN as questionStats (≥ 5 graded per question) AND requires enough attempts to form top/bottom quartiles (≥ 8 ready attempts minimum)
  When `enough_data` is false the card STILL renders, showing `<LowNFallback threshold={N} samples={n} />` — never hide an empty section.
  — **Reversibility:** costly — thresholds are read by both the backend reducers and the frontend fallback cards; changing them after deploy touches both sides and the parity test fixtures.
  **Note for planner:** existing plan 11-02 appears to use a uniform threshold of 5 across all signals. Align to the per-signal values above during replan; update `tests/analytics/test_correlation.ts` and the discrimination-index fixture to assert the ≥10/≥20 and quartile thresholds, not just 5.

### ADMIN-10 LLM narrative digest scope
- **D-04 (reversible):** ADMIN-10 (LLM-generated narrative digest of the dashboard) is **deferred out of Phase 11 v1**. Rationale: roadmap goal and success criteria do not mention it; every extra v1 signal tightens the Apps Script 6-minute execution cap (Pitfall 1); adds an OpenRouter call, latency budget, a new failure mode (`digest failed to generate`), and its own fallback UI. File a `Backlog 999.4`-style entry (or REQUIREMENTS.md ADMIN-10 row annotation "Phase 11.5 or backlog") so it is not lost. — **Reversibility:** reversible — adding it later is one new endpoint field + one new client panel; no schema migration.

### Date-range filter in v1
- **D-05 (reversible):** **No date-range filter in v1.** Ship aggregations over all ready attempts. A "Last 30 / 90 / all" toggle is a deferred v1.1 enhancement, implementable later via one extra `?range=` query param without schema change. — **Reversibility:** reversible — one additive query param + client toggle.

### Refresh behavior
- **D-06:** Refresh button is manual, client-debounced to a 3-second minimum between clicks. No server-side rate limit, no auto-refresh/polling (Pitfall — unbounded polling burns quota and the dashboard is admin-only, read-only).

### Carrying forward from prior phases (re-affirmed, not re-decided)
- **D-07 (costly):** Every "pass rate" denominator MUST reuse Phase 10's `computeAggregatesForAttempt` A2 policy — ungraded counted separately, NEVER merged into the denominator — via `effectiveVerdict()` from `AsyncGrading.gs` (override || verdict). A unit parity test against `AsyncGrading.gs:127,144` fixture assertion is non-optional. — **Reversibility:** costly — diverging creates a report-vs-dashboard mismatch breaking recruiter trust.
- **D-08:** Admin auth pattern reuses `?token=` GET + `checkAdminAuth(token)` + `sessionStorage.fs_admin_token` exactly as Phases 6/10. Do NOT introduce a divergent Bearer-header pattern for this one endpoint; the broader `/admin/*` Bearer refactor is a separate backlog item.
- **D-09:** Ungraded caveat reuses the amber-notice pattern from `ReportScreen.tsx:181-200` (`border-amber-400/30 bg-amber-400/10`, framer-motion fadeUp, exact SVG icon + label + body layout). Every aggregation card whose denominator excluded ungraded answers shows the count pill; never zero-default ungraded away.
- **D-10:** Chart lib is `recharts@3.10.1`, exact-primitive imports (`LineChart, Line, ScatterChart, Scatter, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer`). If the `/admin/analytics` chunk exceeds ~200 KB gzipped, split via dynamic `import()` per chart.
- **D-11:** Pearson r is a hand-rolled 8-line two-pass reducer (no `simple-statistics`/`mathjs` dep); r is always shown together with `samples: n` and the scatter tuples. Backend computes r so low-N gating lives in one place.
- **D-12:** `meta.aggregationMs` is present on every response from the first commit (Pitfall 1 instrumentation: Apps Script 6-min cap). If live `aggregationMs > 2000`, file a CacheService upgrade-path backlog line — do NOT add CacheService in v1 (success criterion 2: on-demand, no precompute).

### Claude's Discretion
- Exact aggregator module split inside `backend/Analytics.gs` (5 reducers + orchestrator vs fewer functions).
- Specific recharts dark-theme color tokens to reuse from `assessment-app/src/app/admin/page.tsx` tier color map.
- Whether discrimination-index requires its own reducer or folds into `questionStats` (decided at plan time; both produce the per-qId data).
- Vitest fixture framing (`tests/analytics/` directory + `fixtures/attempts_20.json`) — exactly which edge statuses the 20-row fixture must contain, as long as it exercises mixed statuses, ungraded, and at least one override.

### Folded Todos
None — no todos matched this phase in `cross_reference_todos`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase research (primary)
- `.planning/phases/11-recruiter-analytics-dashboard/11-RESEARCH.md` — full aggregator recipes, data-shape reference (15-col Attempts, 5-col Responses, 9-col GradingTranscripts), architectural responsibility map, 7 pitfalls, 5 open questions, assumptions log, validation architecture + wave-0 test map.

### Roadmap + requirements
- `.planning/ROADMAP.md` § Phase 11 — goal, success criteria, plan waves. (ADMIN-10 / date-range notes updated by plan 11-04 Task 4 are authoritative.)
- `.planning/REQUIREMENTS.md` — ADMIN-06..11 + ADMIN-10 (LLM digest, deferred per D-04) + ADMIN2-04 (v2 demographic adverse-impact, intentionally out of scope).

### Backend invariants (must be reused, not re-implemented)
- `backend/AsyncGrading.gs:92-174` — `computeAggregatesForAttempt` and the A2 denominator policy (D-07 source of truth).
- `backend/AsyncGrading.gs:1-45` — `effectiveVerdict()` signature (override || verdict resolver) reused verbatim.
- `backend/Code.gs:50,134-153,200-242,435,478,524,587,716` — `checkAdminAuth`, `doGet` router pattern (add the 5th `else if` admin branch), `initSheets` schema (do not change), existing admin handler first-line auth pattern.
- `backend/Code.gs:306,302,428,376-378` — `EndTime`/`OverallScore`/`ViolationCount` write sites / types that the reducers must defensively coerce (Pitfalls 6 + 7).

### Frontend patterns (reuse)
- `assessment-app/src/app/admin/page.tsx:50,65,105,358-444` — session storage + query-string auth + tier color map for BiasSignalsPanel.
- `assessment-app/src/app/admin/page.tsx:77` — existing "Connection failed" error path (analytics should reuse, not introduce a new error UI).
- `assessment-app/src/components/ReportScreen.tsx:181-200` — amber ungraded-notice pattern for the caveat pill (D-09).
- `assessment-app/src/types/index.ts` — `Report` / `TranscriptEntry` shape to extend with `AnalyticsPayload` types.

### Adjacent phase dependency
- `.planning/phases/10-rubric-based-llm-grading-recruiter-transcript-override/10-07-PLAN.md` Task 2 — Phase 10's deferred 11-step live-verify. Analytics depends on `GradingTranscripts` being populated; plan 11-04 already gates execution on Phase 10 verify (Condition A) or a documented defensive `Number(row[14]) || 0` fallback for legacy attempts (Condition B). Read this before replanning 11-04.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `effectiveVerdict()` in `AsyncGrading.gs` — single resolver for override-then-verdict; imported by the analytics reducers (no second resolver).
- `checkAdminAuth(token)` in `Code.gs` — first-line auth gate reused on `handleAdminAnalytics`.
- `jsonResponse()` helper in `Code.gs:151` — response wrapper reused (and the 500 error path that does not leak sheet contents).
- Amber-notice visual block in `ReportScreen.tsx:181-200` — copy the exact Tailwind classes + fadeUp motion for the ungraded caveat pill.
- Tier color map in `admin/page.tsx:358-444` — reuse `Strong Fit`/`Consider`/`Not Recommended` colors in BiasSignalsPanel.
- Vitest + `vitest.config.ts` at repo root — the Phase 11 test home; `tests/analytics/` and `tests/admin/test_analytics_ui.ts` are new.

### Established Patterns
- One `else if` branch in `doGet` for new GET actions; `doPost` untouched (analytics is read-only).
- `getDataRange().getValues().slice(1)` strip-header pattern; O(N) reducers with single-pass hash-map builds keyed by `attemptId`/`questionId`, never nested cross-sheet loops (6-min cap guard).
- `READY_STATUSES = ['submitted','graded','emailed']` allowlist reused (not a deny-list) so all reducers operate on ready attempts.

### Integration Points
- `doGet` router gains `action === 'adminAnalytics'` branch → `jsonResponse(handleAdminAnalytics(params.token))`.
- `/admin/analytics` Next.js route added under `assessment-app/src/app/admin/analytics/page.tsx`; a nav entry / tab added to `admin/page.tsx`.
- `AnalyticsPayload` type extended in `assessment-app/src/types/index.ts`.

</code_context>

<specifics>
## Specific Ideas

User chose "decide for me" across all four gray areas — every decision above follows the 11-RESEARCH.md recommendations verbatim (Pitfall 3 bias-label language, Open Questions Q1–Q4 recommendations). The only non-automatic tightening: **D-03** records the research's *draft per-signal* thresholds (5 / 5 / 10-or-20 / 15) as LOCKED, whereas the current 11-02 plan appears to use a uniform threshold of 5 — replan must align plans and tests to the per-signal values.

No other specific references, examples, or "like X" moments came from the user.

</specifics>

<deferred>
## Deferred Ideas

- **ADMIN-10 LLM narrative digest** (D-04) — Phase 11.5 or `999.4`-style backlog; add a REQUIREMENTS.md ADMIN-10 row annotation ("Phase 11.5 or backlog") during plan 11-04 Task 4.
- **Date-range filter** ("Last 30 / 90 / all" toggle) (D-05) — v1.1, one additive `?range=` param.
- **CacheService TTL materialized-view upgrade** (D-12) — triggers only if live `aggregationMs > 2000` observed; file as backlog line in the 11-04 SUMMARY if hit.
- **Broad `?token=` → `Authorization: Bearer` header refactor** for all `/admin/*` endpoints (Pitfall 5) — separate backlog item; intentionally NOT addressed in Phase 11 for endpoint consistency.
- **True demographic adverse-impact monitoring** (ADMIN2-04) — v2; explicitly out of scope, never reintroduced without demographic data collection (which is itself OOS).

### Reviewed Todos (not folded)
None.

</deferred>

---

*Phase: 11-Recruiter Analytics Dashboard*
*Context gathered: 2026-08-03*