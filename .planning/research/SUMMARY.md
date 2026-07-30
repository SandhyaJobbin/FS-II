# Project Research Summary

**Project:** Fraud/Trust-and-Safety Analyst Gamified Assessment Platform — v1.1 Milestone
**Domain:** Hiring/candidate-assessment platform (Google Apps Script + Sheets backend, static-export Next.js frontend on GitHub Pages)
**Researched:** 2026-07-31
**Confidence:** MEDIUM-HIGH

## Executive Summary

This v1.1 milestone extends a working, already-shipped Google Apps Script + Google Sheets + static-export Next.js hiring assessment platform with five capabilities: async report delivery, a recruiter analytics dashboard, an upgraded on-device proctoring/fullscreen signal, rubric-based structured LLM grading with recruiter override, and a set of bug fixes (F-03 grading-mirror drift, F-04 CI/auth-test gaps, F-05 accessibility, F-06 dead-code removal). All research converges on one architectural core: split every synchronous, LLM-dependent operation out of the `doPost` request/response cycle and into a **single recurring time-driven Apps Script trigger** that polls a new `PendingGrading` queue sheet — this is the only viable background-execution primitive Apps Script offers, and it is the correct answer to four of the five research questions (async grading, email delivery, quota safety, and Sheets-locking) simultaneously.

The recommended approach is conservative and reuse-heavy: extract (don't rewrite) the existing `evaluateOpenTextBatch`/scoring logic into a `gradeAndFinalizeAttempt` function callable from the new trigger; add `responseSchema` (Gemini controlled generation) to get reliable structured `{verdict, rubricBreakdown, rationale}` output instead of the current fragile JSON-parse-or-"FAILED" pattern; replace the unmaintained BlazeFace/TF.js CDN dependency with `@mediapipe/tasks-vision`; and explicitly reframe "lock fullscreen exit" as "detect and escalate," since the literal ask is not achievable on any browser (verified against MDN — Esc/F11 can never be blocked by script). A new `PendingGrading` sheet, not new columns in `Attempts`, is the deliberate choice to avoid breaking the six call sites that read/write `Attempts` by hardcoded numeric column index.

Key risks cluster around three areas the research strongly agrees on: (1) Apps Script scarcity constraints — 6-minute execution ceiling, capped trigger counts, unlocked concurrent Sheets writes, and unverified daily email quotas — all addressed by the polling-trigger + `LockService` + distinct `email_status` pattern described below; (2) LLM grading integrity — the current fail-open-to-`true` default on API failure silently and inconsistently inflates scores across candidates once open-text grading becomes "a real hiring signal," and this must become a distinct "ungraded" state, never merged into "correct"; and (3) trust/compliance exposure — this is genuinely a regulated hiring-decision surface once an LLM affects outcomes and a human can override them, so a versioned rubric, persisted rationale, logged override trail, and updated candidate-facing copy (removing now-false "zero human grading" claims) are not optional polish, they are required mitigations.

## Key Findings

### Recommended Stack

The stack additions are all native-to-Apps-Script or lightweight client additions — no new paid backend infra, no new hosting target, consistent with the project's hard constraints. See `.planning/research/STACK.md` for full detail.

**Core technologies:**
- Apps Script installable time-driven trigger (`ScriptApp.newTrigger`) + Sheet `status` queue — async grading/report generation that survives tab close; the only background-execution primitive Apps Script has
- `MailApp.sendEmail` with `HtmlService` scriptlet templates — candidate report + recruiter-team notification emails; narrower auth scope than `GmailApp`, sufficient for one-way transactional send
- `@mediapipe/tasks-vision` `FaceDetector` (short_range model) — replaces `@tensorflow-models/blazeface`/TF.js CDN loading for on-device face-presence proctoring; Google's actively maintained successor, ships as a real npm package (fixes an existing documented script-load-order bug)
- Gemini `responseSchema` (controlled generation) in `generationConfig`, via existing `UrlFetchApp.fetchAll` — enforces a specific structured JSON shape for rubric grading (`{verdict, criteriaMet[], rationale}`), eliminating the current `try/catch → "FAILED"` sentinel fragility
- `LockService.getScriptLock()` around the queue-claim step, `PropertiesService` for `GEMINI_MODEL` config, `temperature: 0` for deterministic grading — supporting primitives for the async/queue and grading-reliability work

### Expected Features

See `.planning/research/FEATURES.md` for the full landscape, prioritization matrix, and anti-features list.

**Must have (table stakes, P1 for v1.1):**
- Immediate "Thank You" confirmation screen + honest turnaround-time copy + lightweight confirmation email + full report email (async foundation)
- Recruiter-team notification email on every completed attempt
- Rubric-based structured-output LLM grading replacing the current ad hoc `evaluateOpenTextBatch` path
- Recruiter-visible transcript + verdict + override for LLM-graded questions (explicitly required once "zero human grading" is reversed)
- Core analytics dashboard: score trend, question-level difficulty (pass rate), violation-vs-score correlation
- False-positive/false-negative bias-direction indicator (fraud-analyst-specific, low cost)

**Should have (P2, v1.2 — after P1 is validated):**
- LLM-generated dashboard narrative digest (diagnostic only, never a per-candidate hire recommendation)
- Confidence-calibration scoring, escalation/"insufficient information" valid-answer path, bottom-N discrimination review queue

**Defer (P3, v2+):**
- Two-pass/self-consistency LLM grading, few-shot calibration anchors, candidate-revisitable grading-status page, time-pressure degradation signal

**Explicit anti-features to avoid:** partial/instant score reveal before full report, polling the thank-you page for live status, fully autonomous LLM decisions with no transcript/override, LLM setting the pass/fail tier directly, publishing rubrics to candidates, re-grading fresh on every report view, LLM-generated per-candidate hire/no-hire recommendations, vanity dashboard metrics, and a hard AI-detection auto-fail signal.

### Architecture Approach

The core pattern is "split-phase submit — enqueue fast, grade slow": `doPost(submitAnswers)` does only validation + one `appendRow` to a new `PendingGrading` queue sheet + one status write, then returns in ~100-300ms; a single recurring trigger (`processGradingQueue`, ~5 min interval) drains the queue under `LockService`, calls the extracted `gradeAndFinalizeAttempt` (same logic as today's inline path, not rewritten), sends emails via `MailApp`, and advances `Attempts.Status` through `pending_grading → graded → emailed` (or `grading_failed` after N retries). See `.planning/research/ARCHITECTURE.md` for full component tables, data-flow diagram, and anti-patterns.

**Major components:**
1. `PendingGrading` sheet (new) — durable async job queue, deliberately separate from `Attempts` to avoid breaking six existing call sites that index `Attempts` columns numerically
2. `gradeAndFinalizeAttempt` (extracted, not rewritten) + `processGradingQueue` (new trigger entrypoint) — the grading/email pipeline, decoupled from `doPost`
3. `handleAdminAnalytics` (new) — on-demand, uncached aggregation over `Attempts`/`Responses`/`IntegrityLogs`; precompute/caching explicitly deferred until volume actually requires it
4. `ThankYouScreen.tsx` (new) + modified `page.tsx` state machine — email-only delivery, no default polling (avoids reopening the F-01 unauthenticated-report-read vulnerability class)
5. `tests/grading/grading-engine.ts` mirror + new CI sync-check script — closes F-03/F-09 (drift) with an enforced, not just conventional, contract with `Code.gs`

Recommended build order: F-06 dead-code removal first (zero risk) → F-03 mirror fix + fixtures → F-04 CI wiring → async grading/report flow (the largest structural change) → analytics dashboard → fullscreen-lock upgrade (parallelizable, client-only) → F-05 ARIA fixes. Rubric grading/transcript/override work is flagged as a follow-on phase after the async refactor, since it changes the LLM response contract both `Code.gs` and the fixed test mirror depend on.

### Critical Pitfalls

Full detail, warning signs, and recovery strategies in `.planning/research/PITFALLS.md` (10 pitfalls total). Top ones:

1. **Synchronous grading hits Apps Script's 6-minute execution ceiling as open-text volume grows** — avoid by moving all LLM calls out of `doPost` into a batch-capped, resumable trigger; never assume "async" is achieved just by deferring the email send while grading stays inline
2. **Naive per-attempt trigger creation exhausts Apps Script's trigger-count quota** — use exactly one recurring polling trigger installed once at setup, never `ScriptApp.newTrigger()` from inside a request handler
3. **Concurrent Sheets read-modify-write races with no locking** — wrap every `Attempts` row read-modify-write in `LockService.getScriptLock()`, keep locked sections short (claim under lock, do slow LLM work outside it)
4. **MailApp/GmailApp daily quota silently exhausted, emails just stop with no visible failure** — track a distinct `email_status` (not inferred from grading status), wrap sends in try/catch, track a daily-send counter, make failures retryable
5. **"Lock fullscreen exit" as literally stated is not technically possible in any browser** — reframe as detect-and-hard-flag (escalating violation severity + required user-gesture re-entry), verified directly against MDN; do not build or promise literal prevention
6. **Fail-open LLM grading (marks every open-text answer "correct" on API failure) creates inconsistent, silently inflated scores** once open-text becomes a real hiring signal — track "ungraded" as a distinct state, never merge into "correct"; surface ungraded counts in report and dashboard
7. **LLM hiring bias/defensibility and candidate-trust exposure** — once LLM grading + recruiter override reverses the platform's stated "zero human grading, fully automated" guarantee, this is a regulated-adjacent hiring-decision surface requiring a versioned rubric, persisted rationale (not just a boolean), a logged override audit trail, and updated candidate-facing copy — not just an engineering task

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Cleanup & Test-Safety Net (F-06, F-03, F-04)
**Rationale:** Zero-dependency, low-risk fixes that must land before the larger async/grading refactor so regressions in that refactor are catchable by tests that already reflect correct behavior; also closes the "tests exist but CI never runs them" gap that let F-03 happen in the first place.
**Delivers:** `frontend/` legacy dead code removed; `grading-engine.ts` mirror fixed with a divergence-test fixture set; `test_admin.ts` rewritten to exercise the real extracted auth-check function, not a local reimplementation; new `.github/workflows/test.yml` running `npm test` + sync-check on every PR.
**Addresses:** F-03, F-04, F-06 bug-fix items; table-stakes reliability foundation.
**Avoids:** Pitfall 9 (mirror can drift again post-fix without a CI gate), Pitfall 10 (admin-auth tests validate a reimplementation, not real code).

### Phase 2: Async Grading & Report Delivery Pipeline
**Rationale:** The architectural core of the milestone and the dependency every other candidate-facing v1.1 feature (rubric grading UI, analytics on the new Status enum) builds on top of; must follow Phase 1 so the extracted grading logic being reused (`gradeAndFinalizeAttempt`) is already verified.
**Delivers:** `PendingGrading` queue sheet; fast-return `doPost(submitAnswers)`; single recurring `processGradingQueue` trigger under `LockService` with retry/batch-cap; `MailApp` candidate-report and recruiter-team-notification emails with distinct `email_status` tracking; new `ThankYouScreen.tsx`; `Attempts.Status` enum extended to `pending_grading/graded/emailed/grading_failed`.
**Uses:** Apps Script time-driven trigger, `MailApp`+`HtmlService` templates, `LockService`, `PropertiesService` from STACK.md.
**Implements:** Split-phase submit pattern and email-only delivery pattern from ARCHITECTURE.md.
**Avoids:** Pitfalls 1-4 (execution ceiling, trigger-quota exhaustion, Sheets races, silent email-quota exhaustion).

### Phase 3: Rubric-Based LLM Grading + Recruiter Transcript & Override
**Rationale:** Sequenced after the async pipeline because it changes the LLM response contract (`{score:1|0}` → structured `{verdict, rubricBreakdown, rationale}`) that both `Code.gs` and the now-fixed test mirror depend on; this is also where the platform's "zero human grading" promise is genuinely reversed, so it must ship together with its compliance/trust safeguards, not as a pure backend change.
**Delivers:** `responseSchema`-constrained Gemini grading with versioned per-question rubrics; persisted rationale/transcript per open-text answer; recruiter-visible transcript + verdict + logged, attributable override UI; distinct "ungraded" state (never merged into "correct") surfaced in report and dashboard; updated candidate-facing copy removing stale "fully automated, no human review" claims.
**Addresses:** Rubric grading, transcript+verdict+override, and bias-direction indicator features from FEATURES.md (P1 items).
**Avoids:** Pitfalls 6, 7, 8 (LLM bias/defensibility exposure, silent trust-guarantee reversal, fail-open score inflation).

### Phase 4: Recruiter Analytics Dashboard
**Rationale:** Independently buildable but sequenced after Phase 2/3 so it can rely on the finalized `Status` enum and rubric-grading verdict data as dashboard inputs, rather than being built against the old two-state model and needing rework.
**Delivers:** `handleAdminAnalytics` on-demand aggregation (score trend, question-level difficulty/pass-rate, violation-vs-score correlation, bias-direction indicator); explicit "not enough data yet" low-N fallback state; data-quality caveats (ungraded-question counts) surfaced rather than hidden.
**Addresses:** Core analytics dashboard, bias-direction indicator (P1 features).
**Implements:** On-demand aggregation, no-precompute pattern from ARCHITECTURE.md (with a documented, cheap upgrade path to `CacheService` if volume later requires it).

### Phase 5: Proctoring Upgrade (Fullscreen Detect-and-Escalate + MediaPipe Migration)
**Rationale:** Fully client-side, no backend dependency on the async/grading work — can run in parallel with Phases 2-4 if resourcing allows, but is listed after them here because it is lower-risk and independently shippable.
**Delivers:** Fullscreen-exit handling upgraded from silent logging to a blocking re-entry modal with escalating violation severity; `@mediapipe/tasks-vision` `FaceDetector` replacing the BlazeFace/TF.js CDN dependency, as a proper npm-managed package.
**Uses:** MediaPipe Tasks Vision from STACK.md.
**Avoids:** Pitfall 5 (fullscreen exit cannot literally be blocked — must be detect-and-flag, verified against MDN).

### Phase 6: Accessibility (F-05) & Remaining Polish
**Rationale:** Small, independent, no ordering constraint on the rest of the milestone; sequenced last since it only touches the in-browser report render, separate from the new email template deliverable in Phase 2.
**Delivers:** ARIA landmarks/roles added to `ReportScreen.tsx`.
**Addresses:** F-05 bug-fix item.

### Phase Ordering Rationale

- Cleanup/test-safety-net first because every subsequent phase reuses or extends the grading logic Phase 1 protects with tests — building on an unverified mirror multiplies risk in every later phase.
- Async pipeline before rubric grading because rubric grading's structured-output contract is a breaking change to the exact code path the async refactor also touches; landing them together would make it hard to isolate regressions.
- Analytics after both async pipeline and rubric grading because the dashboard's most valuable inputs (finalized Status enum, verdict/rationale data) don't exist until those phases ship.
- Proctoring and accessibility are deliberately decoupled/parallelizable — they touch different code surfaces (client-only, no backend queue/grading dependency) and carry no shared risk with the async/grading work.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Async pipeline):** Google Apps Script trigger-count and `MailApp`/`GmailApp` daily-quota figures were not live-verified this session (fetch access to `developers.google.com` was restricted) — re-confirm exact current numbers (or check `MailApp.getRemainingDailyQuota()` at runtime) before finalizing trigger interval and batch size.
- **Phase 3 (Rubric grading + compliance):** Hiring-AI bias/legal-exposure landscape (e.g., automated-employment-decision-tool audit obligations) is MEDIUM confidence, jurisdiction-dependent, and explicitly not legal advice — flag for business-owner confirmation of applicable obligations before treating this milestone's safeguards as sufficient.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Cleanup/CI):** Standard CI/test-wiring patterns, HIGH confidence, directly grounded in repo inspection.
- **Phase 5 (Proctoring):** MediaPipe Tasks Vision integration and the fullscreen-API constraint are both well-documented/verified (MDN live-checked); standard client-side pattern.
- **Phase 6 (Accessibility):** Standard ARIA remediation, no novel research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core API shapes (Apps Script triggers, MailApp, MediaPipe, Gemini responseSchema) are stable and well-established, but live doc/quota verification was blocked this session — exact Apps Script quota numbers need a pre-implementation spot-check |
| Features | MEDIUM | Domain synthesis from established ATS/psychometric/LLM-as-judge practice; no live web search was available this session, so no vendor-specific claims were freshly verified — treat as directional, not benchmarked |
| Architecture | HIGH | Verified directly against the actual codebase (`Code.gs`, test mirror, frontend components, CI workflow) — code-grounded, not generic domain research |
| Pitfalls | MEDIUM-HIGH | Codebase findings (F-03, F-04, missing CI, no LockService, no MailApp usage) are HIGH confidence direct-read findings; Fullscreen API behavior HIGH (MDN-verified); Apps Script quota figures and hiring-AI legal landscape are MEDIUM, and directional only |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- Exact current Apps Script trigger-count and email-quota figures — verify against `developers.google.com/apps-script/guides/services/quotas` or `MailApp.getRemainingDailyQuota()` before finalizing Phase 2's polling interval and batch size.
- Current Gemini model id / deprecation timeline for `gemini-1.5-flash` — confirm the GA flash model id at implementation time and wire it through the already-planned `PropertiesService`-configurable `GEMINI_MODEL` key.
- Jurisdiction-specific hiring-AI compliance obligations (bias-audit requirements, EU AI Act high-risk classification) — flag to the business owner as a product/legal decision, not something to resolve unilaterally in engineering.
- Whether a single shared `ADMIN_TOKEN` remains adequate once recruiter-override actions need "who did this" attribution — flagged as a known limitation in PITFALLS.md; decide during Phase 3/4 planning whether per-recruiter identity is in scope for v1.1 or explicitly deferred.
- No live source verification was possible this session for FEATURES.md and portions of STACK.md/PITFALLS.md (search/fetch tools were restricted) — recommend a follow-up research pass with live search enabled before treating any competitor-specific or quota-specific claim as final.

## Sources

### Primary (HIGH confidence)
- Direct repo inspection: `backend/Code.gs`, `tests/grading/grading-engine.ts`, `tests/admin/test_admin.ts`, `assessment-app/src/app/page.tsx`, `assessment-app/src/app/admin/page.tsx`, `assessment-app/src/components/{TestScreen,AssemblyScreen,ReportScreen}.tsx`, `.github/workflows/deploy.yml`, root and `assessment-app/package.json`, `.planning/PROJECT.md`
- MDN Web Docs, Fullscreen API Guide — live-fetched this session; confirmed fullscreen exit cannot be blocked/canceled by script and requires a fresh user gesture to re-enter

### Secondary (MEDIUM confidence)
- Google Apps Script platform behavior (triggers, `MailApp`/`GmailApp`, `LockService`, `PropertiesService`, quotas) — training-knowledge based, stable/slow-moving APIs, live verification against `developers.google.com` was blocked this session
- Gemini API structured output (`responseSchema`/`responseMimeType`) and current model naming — training-knowledge based, same restriction
- `@mediapipe/tasks-vision` packaging/maintenance status vs. `face-api.js`/BlazeFace staleness — training-knowledge based, corroborated by existing repo code comments documenting CDN load-order bugs
- ATS/pre-employment-assessment UX patterns, psychometric item-analysis practice, LLM-as-judge/rubric-grading reliability practices — general established-practice domain synthesis, no live source this session
- Hiring-AI legal/fairness landscape (adverse-impact, automated-employment-decision-tool obligations, EU AI Act trend) — general, evolving regulatory knowledge, directional only, not legal advice

### Tertiary (LOW confidence)
- None flagged — all findings above are grounded in either direct repo inspection or established, if not live-verified, platform/domain knowledge.

---
*Research completed: 2026-07-31*
*Ready for roadmap: yes*
