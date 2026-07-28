# Requirements: Fraud Support Gamified Assessment Platform

**Defined:** 2026-07-29
**Core Value:** Every candidate gets a fair, consistent, fully automated read on their language ability, attention-to-detail/research skill, and critical thinking under ambiguous fraud scenarios — without requiring a human to grade or score a single answer.

## v1 Requirements

### Candidate Entry & Identity

- [ ] **ENTRY-01**: Candidate can start the assessment by entering name + email, no invite link required
- [ ] **ENTRY-02**: System normalizes email (case, Gmail dot/plus variants) to detect duplicate attempts
- [ ] **ENTRY-03**: A second attempt from a normalized-duplicate email is blocked with a clear message
- [ ] **ENTRY-04**: Admin can override/reset a candidate's attempt lock from the admin panel for documented technical-failure cases (e.g. browser crash)

### Content Ingestion

- [ ] **INGEST-01**: All ~375 questions from the 3 authored docx banks (English Proficiency, Attention to Detail, Critical Thinking) are parsed into a structured, queryable content store with embedded answer keys
- [ ] **INGEST-02**: Each question is tagged with category, level/case grouping, and a difficulty/ambiguity tier (straightforward / moderate / complex)
- [ ] **INGEST-03**: Ingestion validates completeness (every question has options + a marked correct answer) and fails loudly on malformed items
- [ ] **INGEST-04**: Per-category "questions to be given" quotas are loaded from the settled `FS QB Pattern.xlsx`

### Test Assembly

- [ ] **ASSM-01**: Each attempt draws a random ~50-item subset from the full bank, honoring per-category/level quotas
- [ ] **ASSM-02**: The assembled question set is frozen server-side at attempt start and reused consistently for serving, validation, and grading
- [ ] **ASSM-03**: Case-based questions (Attention to Detail, Critical Thinking) are sampled at the case level (all 4 questions together), not individually

### Gamified Test UI

- [ ] **UI-01**: Candidate sees a level-based progress bar reflecting progression through the 3 question banks
- [ ] **UI-02**: Each question has a visible countdown timer; timeout auto-advances/auto-submits
- [ ] **UI-03**: Points/score display is cosmetic only — never reveals correctness or rewards speed
- [ ] **UI-04**: Case-based questions render a multi-tab dashboard (Customer Report, Booking Details, Review Information, Property Listing Information, Account Information) for cross-referencing
- [ ] **UI-05**: Right-click/context-menu is disabled during the test

### Grading & Scoring

- [ ] **GRADE-01**: MCQ and multi-select answers are graded deterministically against server-held answer keys — no LLM, no human grading
- [ ] **GRADE-02**: Raw per-category scores map to 3 trait scores: Language Expertise, Attention to Detail & Research, Logical/Critical Thinking
- [ ] **GRADE-03**: A narrative "out-of-the-box thinking" insight is derived specifically from performance on the hardest/most-ambiguous (complex-tagged) items
- [ ] **GRADE-04**: A recommendation tier (Strong Fit / Consider / Not Recommended) is computed from trait scores and presented as advisory input — a recruiter must take an explicit action, it never auto-executes a hire/reject decision
- [ ] **GRADE-05**: Answer keys and grading logic never leave the server / are never included in any client-facing payload

### Integrity Monitoring

- [ ] **INTEG-01**: Tab-switch/window-blur events are logged silently with count and duration, without interrupting the candidate
- [ ] **INTEG-02**: Copy-paste attempts are logged silently
- [ ] **INTEG-03**: Dev-tools-open is heuristically detected and logged silently
- [ ] **INTEG-04**: Fullscreen-exit events are logged silently
- [ ] **INTEG-05**: On-device (client-side) webcam face-presence/face-count checks run without recording or uploading video/frames — only aggregate signals are sent to the server
- [ ] **INTEG-06**: Integrity signals are stored per-signal (not collapsed into a single trust score) and never block or gate candidate progression

### Reporting

- [ ] **REPORT-01**: Candidate and recruiter see an identical results report: overall score, 3 trait scores, narrative insight, recommendation tier, integrity/violation summary
- [ ] **REPORT-02**: Report is built once at grading time as an immutable record, not recomputed per view

### Admin Panel

- [ ] **ADMIN-01**: Recruiter/admin panel lists all candidates: name, email, date, overall score, violation count
- [ ] **ADMIN-02**: Candidates with multiple integrity violations are visibly flagged in the list
- [ ] **ADMIN-03**: Clicking a candidate opens their full detail report (same shared component as the candidate-facing report)
- [ ] **ADMIN-04**: Admin can reset a candidate's one-attempt lock for documented technical-failure cases (see ENTRY-04)
- [ ] **ADMIN-05**: Admin panel requires authentication and is not publicly accessible

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Sampling & Scoring Refinement

- **SAMP-01**: Difficulty-balanced/stratified sampling refinement beyond simple quota + tag matching
- **SAMP-02**: True percentile/norm-group benchmarking against a broader candidate population

### Admin & Process

- **ADMIN2-01**: Candidate pipeline/status tracking (interview stage progression) beyond the initial screen
- **ADMIN2-02**: Role-based multi-recruiter access / permission levels
- **ADMIN2-03**: PDF export of candidate reports
- **ADMIN2-04**: Demographic-segmented adverse-impact monitoring dashboard

## Out of Scope

| Feature | Reason |
|---------|--------|
| Free-text/open-ended LLM-graded questions | All existing content is already MCQ/multi-select with baked-in answer keys; user chose 100% deterministic grading over the extra nuance AI grading could add |
| Full video-based or third-party proctoring service | Too costly/complex for this build; browser-behavior signals + free on-device webcam checks give meaningful integrity signal at zero marginal cost |
| Invite-link or token-gated access | Open self-serve entry (name + email) was chosen instead, to simplify distribution |
| General retakes / cooldown-based re-testing | One official attempt per email only; only a documented-technical-failure admin override (ENTRY-04/ADMIN-04) exists, not general retakes |
| A separate, dedicated "research skill" question category | Existing Attention to Detail (dashboard cross-referencing) and Critical Thinking (evidence evaluation) cases already exercise the research/investigation skill |
| Live per-question correctness feedback / speed-rewarding points | Research flagged this as the biggest validity risk — rewards speed over the careful, unhurried investigation the actual role requires; points are cosmetic only (UI-03) |
| Fully-automated hire/reject action from the recommendation tier | Content is internally authored and not psychometrically validated; keeping the tier advisory (GRADE-04) manages legal/adverse-impact exposure |
| Paid cloud vision APIs or continuous webcam video recording/storage | Explicit cost and privacy constraint; on-device aggregate-only face checks (INTEG-05) meet the integrity-signal need at zero marginal cost |

## Traceability

Finalized during roadmap creation. See `.planning/ROADMAP.md` for full phase goals, dependencies, and success criteria.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENTRY-01 | Phase 2: Candidate Entry & Test Assembly | Pending |
| ENTRY-02 | Phase 2: Candidate Entry & Test Assembly | Pending |
| ENTRY-03 | Phase 2: Candidate Entry & Test Assembly | Pending |
| ENTRY-04 | Phase 6: Shared Reporting & Recruiter Admin Panel | Pending |
| INGEST-01 | Phase 1: Content Ingestion & Question Bank | Pending |
| INGEST-02 | Phase 1: Content Ingestion & Question Bank | Pending |
| INGEST-03 | Phase 1: Content Ingestion & Question Bank | Pending |
| INGEST-04 | Phase 1: Content Ingestion & Question Bank | Pending |
| ASSM-01 | Phase 2: Candidate Entry & Test Assembly | Pending |
| ASSM-02 | Phase 2: Candidate Entry & Test Assembly | Pending |
| ASSM-03 | Phase 2: Candidate Entry & Test Assembly | Pending |
| UI-01 | Phase 4: Candidate-Facing Gamified Test UI | Pending |
| UI-02 | Phase 4: Candidate-Facing Gamified Test UI | Pending |
| UI-03 | Phase 4: Candidate-Facing Gamified Test UI | Pending |
| UI-04 | Phase 4: Candidate-Facing Gamified Test UI | Pending |
| UI-05 | Phase 4: Candidate-Facing Gamified Test UI | Pending |
| GRADE-01 | Phase 3: Grading & Scoring Engine | Pending |
| GRADE-02 | Phase 3: Grading & Scoring Engine | Pending |
| GRADE-03 | Phase 3: Grading & Scoring Engine | Pending |
| GRADE-04 | Phase 3: Grading & Scoring Engine | Pending |
| GRADE-05 | Phase 3: Grading & Scoring Engine | Pending |
| INTEG-01 | Phase 5: Integrity Monitoring | Pending |
| INTEG-02 | Phase 5: Integrity Monitoring | Pending |
| INTEG-03 | Phase 5: Integrity Monitoring | Pending |
| INTEG-04 | Phase 5: Integrity Monitoring | Pending |
| INTEG-05 | Phase 5: Integrity Monitoring | Pending |
| INTEG-06 | Phase 5: Integrity Monitoring | Pending |
| REPORT-01 | Phase 6: Shared Reporting & Recruiter Admin Panel | Pending |
| REPORT-02 | Phase 6: Shared Reporting & Recruiter Admin Panel | Pending |
| ADMIN-01 | Phase 6: Shared Reporting & Recruiter Admin Panel | Pending |
| ADMIN-02 | Phase 6: Shared Reporting & Recruiter Admin Panel | Pending |
| ADMIN-03 | Phase 6: Shared Reporting & Recruiter Admin Panel | Pending |
| ADMIN-04 | Phase 6: Shared Reporting & Recruiter Admin Panel | Pending |
| ADMIN-05 | Phase 6: Shared Reporting & Recruiter Admin Panel | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0 ✓

**Phase note:** ENTRY-01/02/03 (candidate identity/duplicate-detection) were kept together with ASSM-01/02/03 in Phase 2 rather than split into their own phase — "candidate starts an attempt" and "attempt receives a frozen question set" are one coherent, fixture-testable capability, both provable server-side before the gamified UI (Phase 4) exists. ENTRY-04 stayed paired with its duplicate ADMIN-04 in Phase 6, since the override action requires the admin panel to exist first.

---
*Requirements defined: 2026-07-29*
*Last updated: 2026-07-29 after roadmap creation — traceability finalized against ROADMAP.md*
