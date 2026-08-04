# Requirements: Fraud Support Gamified Assessment Platform

**Defined:** 2026-07-29
**Milestone v1.1 added:** 2026-07-30
**Core Value:** Every candidate gets a fair, consistent, fully automated read on their language ability, attention-to-detail/research skill, and critical thinking under ambiguous fraud scenarios — without requiring a human to grade or score a single answer.

## v1.0 Requirements (Validated — Phases 1-6, shipped)

### Candidate Entry & Identity

- [x] **ENTRY-01**: Candidate can start the assessment by entering name + email, no invite link required
- [x] **ENTRY-02**: System normalizes email (case, Gmail dot/plus variants) to detect duplicate attempts
- [x] **ENTRY-03**: A second attempt from a normalized-duplicate email is blocked with a clear message
- [x] **ENTRY-04**: Admin can override/reset a candidate's attempt lock from the admin panel for documented technical-failure cases (e.g. browser crash)

### Content Ingestion

- [x] **INGEST-01**: All ~375 questions from the 3 authored docx banks (English Proficiency, Attention to Detail, Critical Thinking) are parsed into a structured, queryable content store with embedded answer keys
- [x] **INGEST-02**: Each question is tagged with category, level/case grouping, and a difficulty/ambiguity tier (straightforward / moderate / complex)
- [x] **INGEST-03**: Ingestion validates completeness (every question has options + a marked correct answer) and fails loudly on malformed items
- [x] **INGEST-04**: Per-category "questions to be given" quotas are loaded from the settled `FS QB Pattern.xlsx`

### Test Assembly

- [x] **ASSM-01**: Each attempt draws a random ~50-item subset from the full bank, honoring per-category/level quotas
- [x] **ASSM-02**: The assembled question set is frozen server-side at attempt start and reused consistently for serving, validation, and grading
- [x] **ASSM-03**: Case-based questions (Attention to Detail, Critical Thinking) are sampled at the case level (all 4 questions together), not individually

### Gamified Test UI

- [x] **UI-01**: Candidate sees a level-based progress bar reflecting progression through the 3 question banks
- [x] **UI-02**: Each question has a visible countdown timer; timeout auto-advances/auto-submits
- [x] **UI-03**: Points/score display is cosmetic only — never reveals correctness or rewards speed
- [x] **UI-04**: Case-based questions render a multi-tab dashboard (Customer Report, Booking Details, Review Information, Property Listing Information, Account Information) for cross-referencing
- [x] **UI-05**: Right-click/context-menu is disabled during the test

### Grading & Scoring

- [x] **GRADE-01**: MCQ and multi-select answers are graded deterministically against server-held answer keys — no LLM, no human grading
- [x] **GRADE-02**: Raw per-category scores map to 3 trait scores: Language Expertise, Attention to Detail & Research, Logical/Critical Thinking
- [x] **GRADE-03**: A narrative "out-of-the-box thinking" insight is derived specifically from performance on the hardest/most-ambiguous (complex-tagged) items
- [x] **GRADE-04**: A recommendation tier (Strong Fit / Consider / Not Recommended) is computed from trait scores and presented as advisory input — a recruiter must take an explicit action, it never auto-executes a hire/reject decision
- [x] **GRADE-05**: Answer keys and grading logic never leave the server / are never included in any client-facing payload

### Integrity Monitoring

- [x] **INTEG-01**: Tab-switch/window-blur events are logged silently with count and duration, without interrupting the candidate
- [x] **INTEG-02**: Copy-paste attempts are logged silently
- [x] **INTEG-03**: Dev-tools-open is heuristically detected and logged silently
- [x] **INTEG-04**: Fullscreen-exit events are logged silently
- [x] **INTEG-05**: On-device (client-side) webcam face-presence/face-count checks run without recording or uploading video/frames — only aggregate signals are sent to the server
- [x] **INTEG-06**: Integrity signals are stored per-signal (not collapsed into a single trust score) and never block or gate candidate progression

### Reporting

- [x] **REPORT-01**: Candidate and recruiter see an identical results report: overall score, 3 trait scores, narrative insight, recommendation tier, integrity/violation summary
- [x] **REPORT-02**: Report is built once at grading time as an immutable record, not recomputed per view

### Admin Panel

- [x] **ADMIN-01**: Recruiter/admin panel lists all candidates: name, email, date, overall score, violation count
- [x] **ADMIN-02**: Candidates with multiple integrity violations are visibly flagged in the list
- [x] **ADMIN-03**: Clicking a candidate opens their full detail report (same shared component as the candidate-facing report)
- [x] **ADMIN-04**: Admin can reset a candidate's one-attempt lock for documented technical-failure cases (see ENTRY-04)
- [x] **ADMIN-05**: Admin panel requires authentication and is not publicly accessible

## v1.1 Requirements (Async Reporting, Trust Repairs & Evaluation Quality)

### Async Reporting

- [x] **ASYNC-01**: Candidate sees a "Thank You" screen immediately on submit — no instant on-screen score/report
- [x] **ASYNC-02**: Grading/report computation continues server-side even if the candidate closes the tab (Apps Script queue + time-driven trigger, not tied to an open connection)
- [x] **ASYNC-03**: Candidate receives an emailed report (overall score, 3 trait scores, narrative insight, recommendation tier) once grading completes
- [x] **ASYNC-04**: Recruiter team receives an email per completed attempt summarizing concerns, positives, and results
- [x] **ASYNC-05**: Email delivery failures are tracked as a distinct status (not silently dropped) and are retryable

### Grading Trust & Quality

- [ ] **GRADE-06**: Open-text answers are graded via LLM against an explicit, versioned rubric with structured output (verdict, criteria met, rationale) instead of the current fragile JSON-parse-or-"FAILED" pattern
- [ ] **GRADE-07**: LLM API failure/timeout produces a distinct "ungraded" state that is never merged into "correct"
- [ ] **GRADE-08**: Recruiter can view the transcript, LLM verdict, and rationale for every open-text answer
- [ ] **GRADE-09**: Recruiter can override an LLM verdict; the override is logged with a timestamp (shared admin token in v1.1 — no per-recruiter identity required)
- [ ] **GRADE-10**: Candidate- and recruiter-facing copy no longer claims "zero human grading" / fully automated where LLM grading + override now applies
- [ ] **GRADE-11**: Case content includes an "escalate / insufficient information" valid-answer option for cases matching real fraud-analyst ambiguity
- [ ] **GRADE-12**: Share of LLM-graded open-text questions in the assembled test is increased from the current baseline

### Recruiter Admin Analytics

- [ ] **ADMIN-06**: Dashboard shows score trend over time
- [ ] **ADMIN-07**: Dashboard shows per-question difficulty/pass-rate
- [ ] **ADMIN-08**: Dashboard shows violation-count vs. score correlation
- [ ] **ADMIN-09**: Dashboard flags bottom-N discriminating questions for review
- [ ] **ADMIN-10**: Dashboard includes an LLM-generated narrative digest summarizing the above analytics
- [ ] **ADMIN-11**: Dashboard shows a "not enough data yet" fallback state at low attempt volume

### Proctoring Upgrade

- [ ] **PROCTOR-01**: Fullscreen-exit shows a blocking re-entry modal instead of silent-only logging (detect-and-escalate — true fullscreen lock is not technically possible in any browser)
- [ ] **PROCTOR-02**: Repeated fullscreen-exit escalates violation severity
- [ ] **PROCTOR-03**: On-device face-detection is migrated from BlazeFace/TensorFlow.js to MediaPipe Tasks Vision

### Bug Fixes & Technical Debt

- [ ] **BUG-01**: `tests/grading/grading-engine.ts` mirror is synced with the real `Code.gs` LLM grading path, with divergence-test fixtures (F-03)
- [ ] **BUG-02**: Tests added for admin auth (exercising the real `Code.gs` function, not a reimplementation) and Code.gs↔mirror sync (F-04)
- [ ] **BUG-03**: CI actually runs `npm test` on every push/PR — currently `deploy.yml` only builds and deploys
- [ ] **BUG-04**: ARIA landmarks added to `ReportScreen.tsx` (F-05)
- [ ] **BUG-05**: Dead legacy `frontend/` code (app.js/index.html/style.css) removed (F-06)

### UI Quality

- [ ] **UI-06**: Full visual-quality pass across candidate, report, and admin screens (critique-driven)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Sampling & Scoring Refinement

- **SAMP-01**: Difficulty-balanced/stratified sampling refinement beyond simple quota + tag matching
- **SAMP-02**: True percentile/norm-group benchmarking against a broader candidate population
- **GRADE-13**: Confidence-calibration scoring (candidate rates own certainty per answer) — needs new test-taking UI, deferred out of v1.1

### Admin & Process

- **ADMIN2-01**: Candidate pipeline/status tracking (interview stage progression) beyond the initial screen
- **ADMIN2-02**: Role-based multi-recruiter access / permission levels / per-recruiter login identity
- **ADMIN2-03**: PDF export of candidate reports
- **ADMIN2-04**: Demographic-segmented adverse-impact monitoring dashboard

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full video-based or third-party proctoring service | Too costly/complex for this build; browser-behavior signals + free on-device webcam checks give meaningful integrity signal at zero marginal cost |
| Invite-link or token-gated access | Open self-serve entry (name + email) was chosen instead, to simplify distribution |
| General retakes / cooldown-based re-testing | One official attempt per email only; only a documented-technical-failure admin override (ENTRY-04/ADMIN-04) exists, not general retakes |
| A separate, dedicated "research skill" question category | Existing Attention to Detail (dashboard cross-referencing) and Critical Thinking (evidence evaluation) cases already exercise the research/investigation skill |
| Live per-question correctness feedback / speed-rewarding points | Biggest validity risk — rewards speed over the careful, unhurried investigation the actual role requires; points are cosmetic only (UI-03) |
| Fully-automated hire/reject action from the recommendation tier | Content is internally authored and not psychometrically validated; keeping the tier advisory (GRADE-04) manages legal/adverse-impact exposure |
| Paid cloud vision APIs or continuous webcam video recording/storage | Explicit cost and privacy constraint; on-device aggregate-only face checks (INTEG-05) meet the integrity-signal need at zero marginal cost |
| True fullscreen-exit prevention (hard lock) | Not technically possible in any browser — Esc/F11 always work as a user security guarantee; reframed as detect-and-escalate (PROCTOR-01/02) |
| Per-recruiter individual login/identity for v1.1 overrides | Shared admin token is sufficient for this milestone; only timestamp is logged, not a person. Deferred to ADMIN2-02 |
| New paid email service | Apps Script MailApp/GmailApp only — no new paid infra for v1.1 |

## Traceability

Finalized during roadmap creation. See `.planning/ROADMAP.md` for full phase goals, dependencies, and success criteria.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENTRY-01 | Phase 2: Candidate Entry & Test Assembly | Complete |
| ENTRY-02 | Phase 2: Candidate Entry & Test Assembly | Complete |
| ENTRY-03 | Phase 2: Candidate Entry & Test Assembly | Complete |
| ENTRY-04 | Phase 6: Shared Reporting & Recruiter Admin Panel | Complete |
| INGEST-01 | Phase 1: Content Ingestion & Question Bank | Complete |
| INGEST-02 | Phase 1: Content Ingestion & Question Bank | Complete |
| INGEST-03 | Phase 1: Content Ingestion & Question Bank | Complete |
| INGEST-04 | Phase 1: Content Ingestion & Question Bank | Complete |
| ASSM-01 | Phase 2: Candidate Entry & Test Assembly | Complete |
| ASSM-02 | Phase 2: Candidate Entry & Test Assembly | Complete |
| ASSM-03 | Phase 2: Candidate Entry & Test Assembly | Complete |
| UI-01 | Phase 4: Candidate-Facing Gamified Test UI | Complete |
| UI-02 | Phase 4: Candidate-Facing Gamified Test UI | Complete |
| UI-03 | Phase 4: Candidate-Facing Gamified Test UI | Complete |
| UI-04 | Phase 4: Candidate-Facing Gamified Test UI | Complete |
| UI-05 | Phase 4: Candidate-Facing Gamified Test UI | Complete |
| GRADE-01 | Phase 3: Grading & Scoring Engine | Complete |
| GRADE-02 | Phase 3: Grading & Scoring Engine | Complete |
| GRADE-03 | Phase 3: Grading & Scoring Engine | Complete |
| GRADE-04 | Phase 3: Grading & Scoring Engine | Complete |
| GRADE-05 | Phase 3: Grading & Scoring Engine | Complete |
| INTEG-01 | Phase 5: Integrity Monitoring | Complete |
| INTEG-02 | Phase 5: Integrity Monitoring | Complete |
| INTEG-03 | Phase 5: Integrity Monitoring | Complete |
| INTEG-04 | Phase 5: Integrity Monitoring | Complete |
| INTEG-05 | Phase 5: Integrity Monitoring | Complete |
| INTEG-06 | Phase 5: Integrity Monitoring | Complete |
| REPORT-01 | Phase 6: Shared Reporting & Recruiter Admin Panel | Complete |
| REPORT-02 | Phase 6: Shared Reporting & Recruiter Admin Panel | Complete |
| ADMIN-01 | Phase 6: Shared Reporting & Recruiter Admin Panel | Complete |
| ADMIN-02 | Phase 6: Shared Reporting & Recruiter Admin Panel | Complete |
| ADMIN-03 | Phase 6: Shared Reporting & Recruiter Admin Panel | Complete |
| ADMIN-04 | Phase 6: Shared Reporting & Recruiter Admin Panel | Complete |
| ADMIN-05 | Phase 6: Shared Reporting & Recruiter Admin Panel | Complete |
| ASYNC-01 | TBD (roadmap pending) | Complete |
| ASYNC-02 | TBD (roadmap pending) | Complete |
| ASYNC-03 | TBD (roadmap pending) | Complete |
| ASYNC-04 | TBD (roadmap pending) | Complete |
| ASYNC-05 | TBD (roadmap pending) | Complete |
| GRADE-06 | Phase 10: Rubric-Based LLM Grading + Recruiter Transcript & Override | Pending |
| GRADE-07 | Phase 10: Rubric-Based LLM Grading + Recruiter Transcript & Override | Pending |
| GRADE-08 | Phase 10: Rubric-Based LLM Grading + Recruiter Transcript & Override | Pending |
| GRADE-09 | Phase 10: Rubric-Based LLM Grading + Recruiter Transcript & Override | Pending |
| GRADE-10 | Phase 10: Rubric-Based LLM Grading + Recruiter Transcript & Override | Pending |
| GRADE-11 | TBD (roadmap pending) | Pending |
| GRADE-12 | TBD (roadmap pending) | Pending |
| ADMIN-06 | Phase 11: Recruiter Analytics Dashboard | Complete |
| ADMIN-07 | Phase 11: Recruiter Analytics Dashboard | Complete |
| ADMIN-08 | Phase 11: Recruiter Analytics Dashboard | Complete |
| ADMIN-09 | Phase 11: Recruiter Analytics Dashboard | Complete |
| ADMIN-10 | Backlog 999.4 (deferred out of Phase 11 v1 per RESEARCH.md Assumption A7) | Deferred |
| ADMIN-11 | Phase 11: Recruiter Analytics Dashboard | Complete |
| PROCTOR-01 | TBD (roadmap pending) | Pending |
| PROCTOR-02 | TBD (roadmap pending) | Pending |
| PROCTOR-03 | TBD (roadmap pending) | Pending |
| BUG-01 | TBD (roadmap pending) | Pending |
| BUG-02 | TBD (roadmap pending) | Pending |
| BUG-03 | TBD (roadmap pending) | Pending |
| BUG-04 | TBD (roadmap pending) | Pending |
| BUG-05 | TBD (roadmap pending) | Pending |
| UI-06 | TBD (roadmap pending) | Pending |

**Coverage:**

- v1.0 requirements: 34 total — all Complete
- v1.1 requirements: 29 total
- Mapped to phases: 34 (v1.0 only — v1.1 mapping pending roadmap)
- Unmapped: 29 (v1.1, awaiting roadmap) ⚠

**Phase note (v1.0):** ENTRY-01/02/03 (candidate identity/duplicate-detection) were kept together with ASSM-01/02/03 in Phase 2 rather than split into their own phase — "candidate starts an attempt" and "attempt receives a frozen question set" are one coherent, fixture-testable capability, both provable server-side before the gamified UI (Phase 4) exists. ENTRY-04 stayed paired with its duplicate ADMIN-04 in Phase 6, since the override action requires the admin panel to exist first.

---
*Requirements defined: 2026-07-29*
*Last updated: 2026-07-30 — milestone v1.1 requirements added (29 new, v1.0 marked Complete)*
