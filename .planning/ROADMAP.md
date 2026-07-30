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

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Content Ingestion & Question Bank | 6/6 | Complete | 2026-07-29 |
| 2. Candidate Entry & Test Assembly | 3/3 | Complete | 2026-07-29 |
| 3. Grading & Scoring Engine | 2/2 | Complete | 2026-07-29 |
| 4. Candidate-Facing Gamified Test UI | 1/1 | Complete | 2026-07-29 |
| 5. Integrity Monitoring | 1/1 | Complete | 2026-07-29 |
| 6. Shared Reporting & Recruiter Admin Panel | 1/1 | Complete | 2026-07-29 |

---
*Roadmap created: 2026-07-29*
*Granularity: standard (6 phases)*
*Coverage: 34/34 v1 requirements mapped*
