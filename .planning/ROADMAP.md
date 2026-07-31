# Roadmap: Fraud Support Gamified Assessment Platform

## Overview

This roadmap builds outward from the trust boundary at the center of the product: a candidate-controlled browser that must never learn the answer key. Phase 1 turns the 375 already-authored, already-answer-keyed questions into a validated, tagged, queryable content store. Phase 2 proves — server-side and API-first, before the gamified UI exists — that a candidate can start exactly one official attempt (via a simple name+email entry form) and receive a random, quota-correct, server-frozen question set. Phase 3 proves the grading, trait-scoring, narrative-insight, and advisory-tier logic deterministically, entirely server-side, against fixtures. Only once both engines are solid does Phase 4 wrap them in the actual gamified, timed, multi-tab candidate experience. Phase 5 layers non-blocking integrity telemetry (browser signals + on-device webcam) onto the now-working flow without touching scoring. Phase 6 closes the loop with the shared candidate/recruiter report and a thin, authenticated recruiter admin panel — built last so it structurally cannot duplicate scoring or narrative logic that already exists elsewhere.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Content Ingestion & Question Bank** - Parse the 375-item authored question banks into a validated, tagged, queryable content store with server-only answer keys
- [x] **Phase 2: Candidate Entry & Test Assembly** - Candidates start one official attempt via name+email and receive a random, quota-correct, server-frozen question set
- [x] **Phase 3: Grading & Scoring Engine** - Every submitted attempt is graded deterministically into trait scores, a narrative insight, and an advisory recommendation tier
- [x] **Phase 4: Candidate-Facing Gamified Test UI** - Candidates take the full test in a gamified, timed, multi-tab candidate experience with no correctness/speed leakage
- [x] **Phase 5: Integrity Monitoring** - Every attempt silently accumulates a per-signal integrity trail without ever interrupting or gating the candidate
- [x] **Phase 6: Shared Reporting & Recruiter Admin Panel** - Recruiters log in to a candidate list and open the identical detailed report the candidate sees, with violations flagged
- [ ] **Phase 7: Live Interview / Final Verification** - Review and wrap up the entire application end-to-end

**v1.1 Milestone — Async Reporting, Trust Repairs & Evaluation Quality**

- [x] **Phase 8: Cleanup & Test-Safety Net (F-06, F-03, F-04)** - Frontend dead-code removal, grading-mirror divergence fixture set, real-auth admin tests, CI workflow gating PRs
- [ ] **Phase 9: Async Grading & Report Delivery Pipeline** - Fast doPost enqueue to PendingGrading queue, single recurring trigger under LockService, MailApp candidate+recruiter emails, ThankYouScreen
- [ ] **Phase 10: Rubric-Based LLM Grading + Recruiter Transcript & Override** - Gemini responseSchema rubric grading, persisted rationale/transcript, override audit trail, distinct ungraded state, updated candidate copy
- [ ] **Phase 11: Recruiter Analytics Dashboard** - On-demand uncached aggregation: score trend, question pass-rate, violation-vs-score correlation, bias-direction indicator, low-N fallback
- [ ] **Phase 12: Proctoring Upgrade (Fullscreen Detect-and-Escalate + MediaPipe Migration)** - Blocking re-entry modal on fullscreen exit, MediaPipe tasks-vision FaceDetector replacing BlazeFace/TF.js CDN
- [ ] **Phase 13: Accessibility (F-05) & Remaining Polish** - ARIA landmarks/roles on ReportScreen.tsx

## Phase Details

### Phase 1: Content Ingestion & Question Bank

**Goal**: The full 375-item authored question bank (English Proficiency, Attention to Detail, Critical Thinking) exists as structured, validated, answer-keyed, tagged data ready for querying — the data foundation everything downstream depends on.
**Depends on**: Nothing (first phase)
**Requirements**: INGEST-01, INGEST-02, INGEST-03, INGEST-04
**Success Criteria** (what must be TRUE):

  1. All ~375 questions from the three authored docs exist in the content store with their options and correct-answer keys intact, spot-checkable against the source documents
  2. Every question carries category, level/case-grouping, and a difficulty/ambiguity tier (straightforward/moderate/complex) tag
  3. Re-running ingestion against a deliberately malformed item (missing option, unmarked or inconsistent answer marker) fails loudly instead of silently importing bad data
  4. Per-category "questions to be given" quotas loaded from `FS QB Pattern.xlsx` are queryable and match the settled spreadsheet values

**Plans:** 6 plans

Plans:

- [ ] 01-01-PLAN.md — Wave 0 foundation: pinned toolchain, Docker Postgres 16, pytest/vitest skeleton + docx fixture builders
- [ ] 01-02-PLAN.md — TRACER: English Grammar slice end-to-end (parse → validate → artifact → schema push → seed → query) + slice tests
- [ ] 01-03-PLAN.md — English remainder: open_text/hybrid parts (105 items) + e2e tests (A-OQ3 recorded)
- [ ] 01-04-PLAN.md — Attention parser: 40 cases, verbatim tabs, table binding, ☑/☐ polarity (160 items) + e2e tests
- [ ] 01-05-PLAN.md — Critical Thinking parser (120 items) + Sheet2 quota loader with unit annotation (A-OQ2 recorded)
- [ ] 01-06-PLAN.md — Difficulty tiers (A-OQ1 heuristic, provisional), full 385-item run, atomic DB load, final gates

### Phase 2: Candidate Entry & Test Assembly

**Goal**: A candidate can start exactly one official attempt — entering name+email through a simple entry form, with no invite link — and receive a randomly assembled, quota-correct, server-frozen question set, with the assembly and identity logic proven server-side before the gamified UI exists.
**Depends on**: Phase 1
**Requirements**: ENTRY-01, ENTRY-02, ENTRY-03, ASSM-01, ASSM-02, ASSM-03
**Success Criteria** (what must be TRUE):

  1. A candidate can start the assessment by submitting name + email through a simple entry form, with no invite link or token required
  2. Submitting a second attempt from a normalized-duplicate email (Gmail dot/plus variants, case differences) is blocked with a clear message
  3. Each new attempt is assigned a random ~50-item set honoring per-category/level quotas, with case-based questions (Attention to Detail, Critical Thinking) drawn as whole 4-question cases rather than individually
  4. The assigned question set is frozen at attempt start — re-fetching the same attempt always returns the identical set used for serving, validation, and grading

**Plans**: 3 (complete)
**UI hint**: yes

### Phase 3: Grading & Scoring Engine

**Goal**: Every submitted attempt is scored deterministically into trait scores, a narrative insight, and an advisory recommendation tier — entirely server-side, with zero answer-key leakage, provable via fixtures before any UI consumes it.
**Depends on**: Phase 2
**Requirements**: GRADE-01, GRADE-02, GRADE-03, GRADE-04, GRADE-05
**Success Criteria** (what must be TRUE):

  1. Submitting the same fixture set of answers always produces the same score — grading is a pure, deterministic server-side function with no LLM or human step
  2. Raw per-category performance rolls up into the three named trait scores: Language Expertise, Attention to Detail & Research, Logical/Critical Thinking
  3. A narrative "out-of-the-box thinking" insight is generated specifically from the candidate's performance on complex/ambiguous-tagged items
  4. A recommendation tier (Strong Fit / Consider / Not Recommended) is computed from trait scores and presented as advisory input — it never auto-executes a hire/reject decision
  5. Inspecting any client-facing response for an attempt shows zero answer-key fields or grading logic — both live server-only

**Plans**: TBD

### Phase 4: Candidate-Facing Gamified Test UI

**Goal**: A candidate can take the full test end-to-end in a browser, experiencing it as a leveled, timed, gamified flow with no correctness/speed leakage and no easy tampering via right-click, built on top of the already-tested assembly and grading engines.
**Depends on**: Phase 2, Phase 3
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05
**Success Criteria** (what must be TRUE):

  1. Candidate sees a level-based progress bar reflecting movement through the 3 question banks as they proceed
  2. Each question shows a visible countdown timer; letting it expire auto-advances/auto-submits without requiring candidate action
  3. The points/score display shown during the test is cosmetic only and never reveals correctness or rewards speed
  4. Case-based questions render a multi-tab dashboard (Customer Report, Booking Details, Review Information, Property Listing Information, Account Information) the candidate can cross-reference
  5. Right-clicking anywhere during the test is disabled

**Plans**: 1 (complete)
**UI hint**: yes

### Phase 5: Integrity Monitoring

**Goal**: Every attempt silently accumulates a per-signal integrity trail (behavioral + on-device webcam) layered onto the already-working test flow, without ever interrupting or gating the candidate's progress.
**Depends on**: Phase 4
**Requirements**: INTEG-01, INTEG-02, INTEG-03, INTEG-04, INTEG-05, INTEG-06
**Success Criteria** (what must be TRUE):

  1. Tab-switch/window-blur events are captured with count and duration, invisibly to the candidate
  2. Copy-paste attempts, dev-tools-open, and fullscreen-exit are each detected and logged silently, without interrupting the test
  3. On-device webcam face-presence/count checks send only aggregate signals to the server — no video or frame is ever uploaded or stored
  4. Viewing an attempt's stored integrity data shows distinct per-signal entries (not one collapsed trust score), and no signal has ever blocked or gated the candidate's progression

**Plans**: TBD

### Phase 6: Shared Reporting & Recruiter Admin Panel

**Goal**: Recruiters can log in, see every candidate at a glance with violations flagged, and open the exact same report the candidate sees — with the ability to clear a documented technical-failure lockout — built last so it cannot duplicate scoring/narrative logic that already exists.
**Depends on**: Phase 2, Phase 3, Phase 5
**Requirements**: REPORT-01, REPORT-02, ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05, ENTRY-04
**Success Criteria** (what must be TRUE):

  1. Candidate and recruiter viewing the same completed attempt see byte-identical report content: overall score, 3 trait scores, narrative insight, recommendation tier, integrity/violation summary
  2. A completed attempt's report is generated once at grading time and stored immutably — re-viewing it later never recomputes or drifts
  3. An authenticated-only admin panel lists every candidate (name, email, date, overall score, violation count), with multi-violation candidates visibly flagged
  4. Clicking a candidate in the list opens their full detail report using the same shared report component the candidate sees
  5. Admin can reset a candidate's one-attempt lock for a documented technical-failure case, clearing them to attempt again

**Plans**: TBD
**UI hint**: yes

### Phase 8: Cleanup & Test-Safety Net (F-06, F-03, F-04)

**Goal**: Frontend legacy dead code removed; grading-engine.ts mirror fixed with divergence-test fixtures; test_admin.ts rewritten to exercise real extracted auth-check; new .github/workflows/test.yml running npm test + sync-check on every PR — table-stakes reliability foundation before async/grading refactor.
**Depends on**: Nothing (v1.1 first phase)
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-05
**Success Criteria** (what must be TRUE):

  1. frontend/ legacy dead code removed with no behavior loss
  2. grading-engine.ts mirror passes a divergence-test fixture set vs Code.gs (drift detectable in CI, not just by convention)
  3. test_admin.ts exercises the real extracted auth-check function, not a local reimplementation
  4. New test.yml workflow runs npm test + sync-check on every PR

**Plans:** 4 plans

Plans:

- [x] 08-01-PLAN.md — Auth extraction: checkAdminAuth in Code.gs + admin-auth.ts mirror + test_admin.ts rewrite
- [x] 08-02-PLAN.md — Grading mirror fix: llmResults param for open_text/hybrid + divergence test fixtures
- [x] 08-03-PLAN.md — Frontend dead code removal: delete frontend/ + clean stale doc references
- [x] 08-04-PLAN.md — CI workflow: test.yml + scripts/sync-check.ts divergence detector

### Phase 9: Async Grading & Report Delivery Pipeline

**Goal**: doPost(submitAnswers) returns fast (~100-300ms) after enqueueing to a new PendingGrading queue sheet; a single recurring time-driven trigger drains the queue under LockService, calls extracted gradeAndFinalizeAttempt, sends candidate-report + recruiter-notification emails via MailApp with distinct email_status tracking; ThankYouScreen.tsx added (email-only delivery, no polling).
**Depends on**: Phase 8
**Requirements**: ASYNC-01, ASYNC-02, ASYNC-03, ASYNC-04, ASYNC-05
**Success Criteria** (what must be TRUE):

  1. PendingGrading sheet exists as durable queue, separate from Attempts (no breaking of 6 numeric-indexed call sites)
  2. doPost validates + one appendRow + status write, returns under ~300ms
  3. Exactly one recurring processGradingQueue trigger installed at setup (never per-attempt) under LockService with retry/batch-cap
  4. MailApp candidate-report + recruiter-notification emails sent with distinct email_status (pending/sent/failed/retried); Attempts.Status enum extended pending_grading/graded/emailed/grading_failed
  5. ThankYouScreen.tsx shows confirmation + honest turnaround copy; no default polling (avoids reopening F-01 unauthenticated-report-read class)

**Plans**: 1/6 plans executed
Plans:
**Wave 1**

- [x] 09-01-PLAN.md — Fast-enqueue doPost + PendingGrading schema + backward-compatible report gate (backend/Code.gs)
- [ ] 09-02-PLAN.md — Extracted grading + email builders + queue-drain trigger worker (backend/AsyncGrading.gs, new)
- [ ] 09-03-PLAN.md — Pure test mirrors for queue stage/retry logic and email content (tests/async/*)
- [ ] 09-04-PLAN.md — ThankYouScreen.tsx + page.tsx rewire + admin panel backward-compat status check

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 09-05-PLAN.md — sync-check.ts drift detection extension + test:async npm script

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 09-06-PLAN.md — Manual deployment checkpoint + live end-to-end verification

### Phase 10: Rubric-Based LLM Grading + Recruiter Transcript & Override

**Goal**: Gemini responseSchema-constrained rubric grading replaces ad hoc evaluateOpenTextBatch; persisted rationale/transcript per open-text answer; recruiter-visible transcript + verdict + logged attributable override UI; distinct "ungraded" state never merged into "correct"; updated candidate-facing copy removing stale "fully automated, no human review" claims — ships together with compliance/trust safeguards.
**Depends on**: Phase 9
**Requirements**: TBD (rubric grading, transcript+verdict+override, bias-direction indicator)
**Success Criteria** (what must be TRUE):

  1. Gemini grading via responseSchema yields structured {verdict, criteriaMet[], rationale}; no more try/catch → "FAILED" sentinel fragility
  2. Per-question rubric versioned; rationale persisted per open-text answer (not just boolean)
  3. Recruiter transcript + verdict UI with logged, attributable override audit trail
  4. API failure produces distinct "ungraded" state, never merged into "correct"; ungraded counts surfaced in report + dashboard
  5. Candidate-facing copy updated to remove now-false "zero human grading" claims

**Plans**: TBD

### Phase 11: Recruiter Analytics Dashboard

**Goal**: handleAdminAnalytics on-demand (uncached) aggregation over Attempts/Responses/IntegrityLogs: score trend, question-level difficulty/pass-rate, violation-vs-score correlation, bias-direction indicator; explicit "not enough data yet" low-N fallback; ungraded-question counts surfaced, not hidden.
**Depends on**: Phase 9, Phase 10
**Requirements**: TBD (core analytics dashboard, bias-direction indicator)
**Success Criteria** (what must be TRUE):

  1. Dashboard renders score trend, question-level pass-rate, violation-vs-score correlation, bias-direction indicator
  2. On-demand aggregation, no precompute (documented CacheService upgrade path if volume requires)
  3. Low-N fallback state shown when "not enough data yet"
  4. Ungraded-question counts surfaced as data-quality caveat, not hidden

**Plans**: TBD
**UI hint**: yes

### Phase 12: Proctoring Upgrade (Fullscreen Detect-and-Escalate + MediaPipe Migration)

**Goal**: Fullscreen-exit handling upgraded from silent logging to blocking re-entry modal with escalating violation severity; @mediapipe/tasks-vision FaceDetector (short_range) replaces BlazeFace/TF.js CDN dependency as a proper npm-managed package. Fully client-side, parallelizable with Phases 9-11.
**Depends on**: Nothing (client-only, parallelizable)
**Requirements**: TBD (proctoring upgrade)
**Success Criteria** (what must be TRUE):

  1. Fullscreen-exit triggers blocking re-entry modal (not silent log); requires fresh user gesture to re-enter
  2. Escalating violation severity on repeated exits
  3. @mediapipe/tasks-vision FaceDetector wired as npm package; existing BlazeFace/TF.js CDN dependency removed (fixes documented load-order bug)
  4. No literal "block fullscreen exit" promise (verified against MDN — impossible in any browser)

**Plans**: TBD

### Phase 13: Accessibility (F-05) & Remaining Polish

**Goal**: ARIA landmarks/roles added to ReportScreen.tsx; small independent a11y remediation, no ordering constraint on rest of milestone.
**Depends on**: Nothing
**Requirements**: TBD (F-05)
**Success Criteria** (what must be TRUE):

  1. ReportScreen.tsx has ARIA landmarks + roles; passes axe-core baseline
  2. Touches only in-browser report render, separate from Phase 9 email template

**Plans**: TBD

## Progress

**Execution Order:**
v1 phases executed in numeric order: 1 → 2 → 3 → 4 → 5 → 6 (complete).
v1.1 phases execute: 8 → 9 → 10 → 11, with 12 and 13 parallelizable alongside 9-11.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Content Ingestion & Question Bank | 6/6 | Complete | 2026-07-29 |
| 2. Candidate Entry & Test Assembly | 3/3 | Complete | 2026-07-29 |
| 3. Grading & Scoring Engine | 2/2 | Complete | 2026-07-29 |
| 4. Candidate-Facing Gamified Test UI | 1/1 | Complete | 2026-07-29 |
| 5. Integrity Monitoring | 1/1 | Complete | 2026-07-29 |
| 6. Shared Reporting & Recruiter Admin Panel | 1/1 | Complete | 2026-07-29 |
| 7. Live Interview / Final Verification | 0/0 | Pending | — |
| 8. Cleanup & Test-Safety Net | 4/4 | Complete | 2026-07-31 |
| 9. Async Grading & Report Delivery Pipeline | 1/6 | In Progress|  |
| 10. Rubric-Based LLM Grading + Override | 0/0 | Not started | — |
| 11. Recruiter Analytics Dashboard | 0/0 | Not started | — |
| 12. Proctoring Upgrade (MediaPipe + Fullscreen) | 0/0 | Not started | — |
| 13. Accessibility (F-05) & Polish | 0/0 | Not started | — |

---
*Roadmap created: 2026-07-29*
*Granularity: standard (6 phases)*
*Coverage: 34/34 v1 requirements mapped; v1.1 phases derived from research SUMMARY.md (F-03/F-04/F-05/F-06 + async/rubric/analytics/proctoring capabilities)*
