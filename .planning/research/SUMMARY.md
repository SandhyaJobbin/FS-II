# Project Research Summary

**Project:** Fraud Support Gamified Assessment Platform
**Domain:** Self-serve, gamified, auto-graded pre-employment assessment web app (server-authoritative test assembly + deterministic MCQ/multi-select grading + client-side integrity monitoring, no paid proctoring)
**Researched:** 2026-07-29
**Confidence:** MEDIUM (stack version data is HIGH — verified live against npm/PyPI/official docs; feature, architecture, and pitfall synthesis is MEDIUM — grounded in well-established patterns but live web search/product research was unavailable this session, see individual file Sources)

## Executive Summary

This is, architecturally, an e-assessment/exam-engine system, not a generic CRUD app: the entire design center of gravity is the trust boundary between a candidate-controlled browser and a server that must never leak its 375-item answer key. Experts building this class of system converge on a small set of non-negotiable patterns — server-authoritative, frozen-per-attempt test assembly; deterministic grading as a pure server-side function; and client-side integrity signals treated strictly as advisory telemetry, never as the gate itself. The recommended stack (Next.js 16 / React 19 / TypeScript 7 / Prisma 7 / Postgres) is chosen specifically because Server Components and the `server-only` package turn "answer key reached the client" from a runtime risk into a compile-time-blockable error — the single highest-leverage control available for this project's core constraint.

The recommended approach is to build in strict dependency order: ingest and validate the already-authored, already-answer-keyed content first, then build and fixture-test the test-assembly and grading engines entirely server-side before any UI exists, then layer the gamified candidate UI, then integrity monitoring (additive, non-blocking, can ship later without touching the scoring pipeline), then the shared reporting layer, and finally the recruiter admin panel (a thin, logic-free wrapper over the same report). This build order front-loads the highest-risk, highest-rewrite-cost work — the security boundary and scoring correctness — before any UI investment is sunk into assumptions that could later prove wrong.

The key risks are not really "will it work" but "will it quietly overclaim." Six pitfalls dominate: (1) sending the full question+answer payload to the client — the textbook home-grown-quiz-app failure; (2) weak randomization letting a finite, fixed 375-item bank be reconstructed by collusion over enough attempts; (3) "one attempt per email" being trivially bypassed via Gmail dot/plus-addressing or simple re-submission with no verification; (4) quota-sampling math that silently produces inconsistent test lengths or unbalanced difficulty across candidates; (5) client-side integrity signals (tab-blur, devtools-detection, webcam face-count) being structurally unreliable and getting over-trusted by recruiters if presented as a clean single number; and (6) the deeper governance risk that naming outputs "trait scores" and a "recommendation tier" from an unvalidated, hand-authored MCQ bank presents false psychometric authority and carries real EEOC/adverse-impact-style legal exposure if the tier is ever treated as an automated decision rather than advisory input. None of these are showstoppers, but all six must be designed for from the first phase, not patched in later.

## Key Findings

### Recommended Stack

Next.js 16.2.12 + React 19.2.8 + TypeScript 7.0.2 form the core, chosen because Server Components/Server Actions create exactly the client/server security boundary this project needs, and TS 7's native compiler keeps typechecking fast as the schema grows. Prisma 7.9.1 over Postgres 16+ (managed serverless — Neon/Supabase/Railway) handles the relational content/attempt/results/events model without old Rust-binary serverless cold-start problems. Zustand handles transient client quiz UI state since actual score/correctness must never live client-side.

**Core technologies:**
- Next.js 16 (App Router, Server Components) — server-only grading/answer-key logic structurally enforceable via `server-only`
- Prisma 7 + Postgres — relational integrity for question→options→category/level and attempt→assigned-questions→answers
- `iron-session` + `jose` — encrypted stateless session cookie for candidate/admin identification, no OAuth needed
- `@mediapipe/tasks-vision` — free, actively-maintained, on-device webcam face-presence detection (aggregate signals only)
- `zod` — runtime validation at every boundary
- `python-docx` + `openpyxl` (offline, one-time ingestion) — parse existing `.docx`/`.xlsx` banks, kept out of production runtime

Avoid: `face-api.js` (stale), any client-side grading, paid cloud vision/proctoring APIs (out of scope).

### Expected Features

**Must have:** pre-test instructions, visible progress + countdown timer, auto-submit on timeout, end-of-test confirmation, one-way linear navigation per section, candidate name+email capture, overall score + per-trait breakdown, recommendation tier, recruiter candidate list + detail view, authenticated admin panel, silent non-interrupting integrity logging.

**Should have (differentiators):** multi-tab candidate-dashboard case simulation (strongest differentiator — genuine job-sample simulation); narrative "out-of-the-box thinking" insight (needs difficulty/ambiguity tags at ingestion); identical candidate/recruiter report; free on-device webcam check; stratified/difficulty-balanced sampling.

**Defer (v2+):** true percentile/norm-group benchmarking, candidate pipeline/status tracking, role-based multi-recruiter access, PDF export, demographic-segmented adverse-impact monitoring (needs legal sign-off). Anti-features to avoid: live per-question correctness feedback, real-time leaderboards, uncapped speed-rewarding points, fully-automated hire/reject action.

### Architecture Approach

The system separates into an offline content-ingestion pipeline (docx/xlsx → validated, answer-keyed rows, never in the request path) and a runtime application built around five server-owned components: Test Assembly Engine (quota-sampling, frozen per attempt), Grading & Scoring Engine (pure, deterministic, idempotent function), Integrity Event Aggregator (decoupled from answer-submission), Reporting Service (one immutable `results` row, read-only for both candidate and recruiter), and a thin Recruiter Admin Panel with no scoring logic of its own.

**Major components:**
1. Content Ingestion Pipeline — one-time transform of `.docx`/`.xlsx` into validated, answer-keyed content store
2. Test Assembly Engine — server-side quota-based random sampler, frozen per attempt
3. Grading & Scoring Engine — pure, stateless, server-only, fixture-testable
4. Integrity Monitor (client) + Aggregator (server) — passive listeners + on-device face detection, non-blocking
5. Reporting Service — one shared read-projection for both candidate and recruiter UI

### Critical Pitfalls

1. **Full question+answer payload sent to the client** — strip answer-key fields exactly once at the API boundary; CI test scans every candidate-facing response.
2. **Weak randomization enabling bank reconstruction** — quota-correct unbiased sampling, item-exposure-frequency logging, periodic content refresh plan.
3. **"One attempt per email" trivially bypassed** — normalize email (dot/plus/case), add soft fingerprint/IP "possible duplicate" flag from the first attempt (can't retrofit later).
4. **Quota-sampling math bugs** — integer quotas from `FS QB Pattern.xlsx`, case-level sampling for case-based banks, batch-simulation CI test.
5. **Client-side integrity signals over-trusted** — per-signal breakdown, never a collapsed integer, add server-side JS-independent timing floor check.
6. **Overclaiming psychometric validity / legal exposure** — non-clinical report language, tier stays advisory with human click required, retain attempt-level data for future adverse-impact review.

## Implications for Roadmap

### Phase 1: Content Ingestion Pipeline & Question Bank Schema
**Rationale:** Everything downstream depends on structured, validated, answer-keyed data existing.
**Delivers:** Postgres schema, Python ingestion script → `questions.json`, `prisma db seed`, post-ingestion validation (marker-count invariants, tags present).
**Addresses:** tagged 375-item content store; difficulty/ambiguity tags for later phases.
**Avoids:** docx marker inconsistency silently producing wrong/missing answer keys.

### Phase 2: Test Assembly Engine & Attempt Lifecycle
**Rationale:** Must be built/tested against the real bank before UI exists — this is where "never leak the key" and "one attempt per email" boundaries are enforced first.
**Delivers:** quota-based sampler + frozen manifest, email normalization + fingerprint/IP capture, server-side timing, batch-simulation test suite.
**Uses:** Phase 1 schema, `iron-session`/`jose`.
**Implements:** Test Assembly Engine + Attempt/Identity Guard.

### Phase 3: Deterministic Grading & Scoring Engine
**Rationale:** Highest-rewrite-risk component; build/unit-test against fixtures before any UI.
**Delivers:** `gradeAttempt()` pure function, category→trait-score mapping, tier thresholds, narrative insight derivation.
**Uses:** `vitest`, `server-only` guards.
**Implements:** Grading & Scoring Engine; establishes API sanitization pattern for Phase 4.

### Phase 4: Candidate-Facing Gamified Test UI
**Rationale:** Consumes a stable, tested API; first human-facing UI phase.
**Delivers:** instructions screen, level/progress-bar framing, server-timestamped countdown, per-case-fetched dashboards, restrained progress indicator, auto-submit, submit flow.
**Uses:** Next.js Server/Client split, Zustand, `framer-motion`, `react-hook-form`+`zod`.
**Avoids:** implying adaptive difficulty across randomly-drawn "levels"; live correctness feedback; speed-rewarding points.

### Phase 5: Integrity Monitoring (Client Events + On-Device Webcam)
**Rationale:** Additive, non-blocking — layered onto an already-working flow without touching assembly/grading.
**Delivers:** passive listeners, `@mediapipe/tasks-vision` face-presence detection (aggregate only), decoupled ingest endpoint, per-signal violation storage, server-side timing floor check.
**Avoids:** collapsed-integer violation counts; treating any client signal as a hard verdict.

### Phase 6: Shared Reporting & Recruiter Admin Panel
**Rationale:** Both are thin, logic-free consumers of already-stable data; building last guarantees no duplicated scoring/narrative logic between views.
**Delivers:** shared `build-report.ts`/view (score, 3 trait scores, narrative, advisory tier, violation summary); recruiter admin list (authenticated, non-guessable tokens) with violation flags.
**Avoids:** overclaiming psychometric validity — add disclaimer language, confirm tier is advisory; lock down report-URL non-enumerability.

### Phase Ordering Rationale
- Dependency order (ingestion → assembly/attempt → grading → UI → integrity → reporting/admin) mirrors Architecture's independently-derived build order and matches where Pitfalls research says each failure mode is cheapest to prevent.
- Security-critical server logic (Phases 2-3) precedes UI investment (Phase 4) so the answer-key boundary and quota-math correctness are proven with automated tests first.
- Integrity monitoring (Phase 5) is deliberately non-gating for the core scoring pipeline.
- Reporting/Admin (Phase 6) is last to structurally guarantee candidate/recruiter report parity.

### Research Flags

Needs deeper research during planning:
- **Phase 2:** exact quota-to-case-sampling logic against real `FS QB Pattern.xlsx` numbers needs confirmation, not assumption.
- **Phase 5:** on-device face-detection library specifics (bundle size, WASM/WebGL requirements, low-resolution accuracy) need a targeted spike.
- **Phase 6:** legal/compliance language for trait-score framing and tier disclaimers needs a lightweight stakeholder/legal review pass.

Standard patterns (research-phase likely unnecessary):
- **Phase 1:** `python-docx`/`openpyxl` parsing and Prisma seeding are conventional.
- **Phase 3:** deterministic MCQ/multi-select grading is a low-ambiguity pattern with no external dependencies.
- **Phase 4:** standard Next.js/React Server/Client Component patterns for a timed quiz UI.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions/compatibility verified live against npm/PyPI/official Next.js docs |
| Features | MEDIUM | No live web search this session; trained-knowledge competitor patterns, not freshly verified |
| Architecture | MEDIUM-HIGH | Browser-API claims verified live via MDN = HIGH; system synthesis is MEDIUM |
| Pitfalls | MEDIUM | Page Visibility API limits verified via MDN = HIGH; EEOC/legal claims are directional, need counsel review |

**Overall confidence:** MEDIUM-HIGH.

### Gaps to Address
- Competitor feature claims — re-verify with live web research before external use.
- On-device face-detection library — spike bundle size/accuracy during Phase 5.
- Legal/EEOC compliance claims — consult counsel before real hiring-decision use at scale.
- Exact quota values — confirm against actual `FS QB Pattern.xlsx` during Phase 1/2.

## Sources

### Primary (HIGH confidence)
- npm registry, PyPI, Next.js official docs, MDN Web Docs (Page Visibility, Fullscreen, Clipboard APIs) — all live-fetched/queried this session.

### Secondary (MEDIUM confidence)
- Trained knowledge of e-assessment/LMS/quiz-engine architecture patterns and competitor assessment platforms.

### Tertiary (LOW confidence, flagged for validation)
- US EEOC / NYC Local Law 144-style automated-employment-decision-tool framing — general domain knowledge, not live-verified; requires counsel review.

---
*Research completed: 2026-07-29*
*Ready for roadmap: yes*
