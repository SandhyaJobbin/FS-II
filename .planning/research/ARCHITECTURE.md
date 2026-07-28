# Architecture Research

**Domain:** Auto-graded gamified hiring assessment platform (randomized test assembly, server-side answer-key security, browser-based integrity monitoring)
**Researched:** 2026-07-29
**Confidence:** MEDIUM (browser integrity APIs verified against official MDN docs = HIGH; overall system-architecture synthesis is based on well-established, stable software-engineering patterns for quiz/LMS/e-assessment systems rather than a freshly web-searched source set — live web search/product-research tooling was unavailable in this research session; see Sources)

## Standard Architecture

### System Overview

```
CLIENT (Candidate Browser)
- Entry/Auth (name+email)
- Gamified Test UI (levels, timer, dashboard tabs)
- Integrity Monitor (JS): tab/blur/copy/devtools + on-device face check
- Recruiter Admin Panel <-> Shared Report Component (read-only)

        |  HTTPS/JSON (sanitized payloads / events only)
        v

SERVER (API / Application Layer)
- Attempt/Identity Guard (1 attempt per email)
- Test Assembly Engine (quota sampling per category/level)
- Grading & Scoring Engine (server-only, never exposed)
- Integrity Event Aggregator (log only, no live blocking)
- Reporting Service (shared: candidate report == recruiter detail view)

        |
        v

DATA LAYER (server-side only)
- Question Bank (content, category, level)
- Answer Keys (never joined into any client response)
- Attempts (assigned item set, timing)
- Results (scores, tier, narrative insight)
- Events (violation log)

        ^
        | one-time / admin-triggered ingestion
        |
OFFLINE: Content Ingestion Pipeline (build-time/CLI)
.docx / .xlsx source -> parse -> normalize -> validate -> load
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| Content Ingestion Pipeline | One-time/rare transform of authored `.docx`/`.xlsx` question banks into structured, validated, answer-keyed rows in the content store | A CLI/admin script (Node/TS): `mammoth` or `docx4js` to extract docx text+structure, `exceljs`/`xlsx` to read the quota spreadsheet, a normalizer that maps checkmark/checkbox markers to `isCorrect` flags, and a validator that fails loudly on malformed items before they ever reach the DB |
| Question Bank (content store) | Canonical store of all ~375 authored items: text, options, category, level/case grouping, difficulty tier, and answer key | Relational DB (Postgres) with `questions`, `options` (with `is_correct`), `cases`/`dashboards` (for multi-tab Attention-to-Detail/Critical-Thinking scenarios) tables |
| Test Assembly Engine | Given an attempt, draws a random quota-based subset per category/level from the full bank (~50 of 375) and freezes it as that attempt's fixed item set | Server-side service seeded per-attempt; persists the assigned question ID list + order to the `attempts` table so it is never re-derived or trusted from the client |
| Attempt/Identity Guard | Enforces "one official attempt per email," creates/looks up the attempt record, tracks start time and deadline | Server-side check on submit of name+email before assembly is invoked; unique constraint on `attempts.email` (or hashed email) |
| Candidate-facing Test UI | Renders the gamified experience: level progression bar across the 3 banks-as-levels, per-question countdown, dashboard tabs for case questions, live point/score reveal | SPA/SSR frontend (React-based) driven purely by the sanitized question payload the server returns (never the answer key) |
| Grading & Scoring Engine | Deterministically grades raw answers against the server-held answer key, computes per-category raw scores, then maps those into the 3 trait scores + narrative "out-of-the-box thinking" insight + recommendation tier | Pure server-side module invoked once atomically on submit; stateless/deterministic function of `(assigned question IDs, submitted answers, answer key)` so re-running it is idempotent and auditable |
| Integrity Monitor (client) | Silently logs tab-switch/blur count+duration, copy/paste attempts, devtools-open heuristic, fullscreen-exit count, right-click blocking, and on-device webcam face-presence/face-count — never interrupts the candidate | Browser event listeners (`visibilitychange`, `fullscreenchange`, `copy`/`paste`/`cut`, `contextmenu`, devtools-size heuristics) + an in-browser face-detection model (e.g., a lightweight WASM/TF.js model) running on live video frames, never uploading raw video |
| Integrity Event Aggregator | Receives periodic event batches from the client, stores raw counts, and derives a violation summary per attempt (flag if above threshold) | A dedicated ingest endpoint keyed by attempt ID, decoupled from the answer-submission endpoint so integrity logging can never block or leak grading data |
| Reporting Service | Produces the single report data shape consumed identically by candidate and recruiter views: overall score, 3 trait scores, narrative insight, recommendation tier, integrity summary | A read model built once at grading time and persisted as an immutable `results` row — both UIs are pure read-only projections of that row, guaranteeing candidate/recruiter parity |
| Recruiter Admin Panel | Lists all candidates (name, email, date, score, violation count) and opens into the same shared report component for detail, with visible flags for multi-violation candidates | Authenticated internal-only UI/route; reads `attempts` + `results` joined, no separate scoring/report logic of its own |

## Recommended Project Structure

```
src/
  ingestion/            offline/admin-only content pipeline (not part of runtime request path)
    parsers/              docx + xlsx readers (mammoth, exceljs)
    normalize.ts          maps checkmark/checkbox markers -> structured answer keys
    validate.ts           schema + completeness checks before DB load
    load.ts               writes questions/options/cases into the content store
  content/              question bank domain logic (read-mostly)
    schema/                 DB models: questions, options, cases, categories, levels
    repository.ts           query interface used by assembly engine only
  assembly/             test-assembly engine
    quota-config.ts         per-category/level quotas (from FS QB Pattern.xlsx)
    sampler.ts               random draw honoring quotas, no repeats within attempt
    attempt-manifest.ts      persists assigned question IDs + order per attempt
  attempts/             attempt lifecycle & identity guard
    start.ts                 name+email intake, one-attempt-per-email enforcement
    session.ts               timing, deadline, submission-window validation
    submit.ts                receives answers, hands off to grading (never touches keys directly)
  grading/              deterministic scoring -- most security-sensitive module
    grade.ts                 raw per-question correctness against answer key
    score-mapping.ts         raw category scores -> 3 trait scores
    recommendation.ts        trait scores -> tier (Strong Fit / Consider / Not Recommended)
    narrative-insight.ts     derives "out-of-the-box thinking" from hardest-tier items
  integrity/            split client/server
    client/                  event listeners + on-device face-detection runner
    server/                  ingest endpoint + violation-summary aggregation
  reporting/            shared report data + view, consumed by both candidate & recruiter UIs
    build-report.ts
    ReportView.tsx (or equivalent shared component)
  admin/                recruiter-only surface
    candidate-list.ts
    candidate-detail.ts      thin wrapper around reporting/ReportView
  api/                  HTTP boundary -- this is where answer-key sanitization is enforced
    attempt-start.ts
    attempt-submit.ts
    integrity-events.ts
    report.ts
```

### Structure Rationale

- **`ingestion/` is isolated from the runtime path:** it only ever runs as an admin/CLI step against source docs, never in a candidate-facing request. Keeping it separate prevents accidental coupling between "one-time content authoring" concerns and "per-attempt serving" concerns.
- **`grading/` is the most sensitive module and is kept server-only, dependency-light, and pure:** given the constraint that answer keys must never reach the client, this module should have the smallest possible surface area and be unit-testable purely with fixture data (question set + answers in, score object out) — no HTTP, no DB writes inside the core scoring functions themselves.
- **`api/` is the explicit sanitization boundary:** every response that could theoretically contain a `correct`/`isCorrect` flag or point-weight must be stripped exactly once, at this layer, so there is a single reviewable place where "does this JSON contain answer-key data?" can be audited.
- **`reporting/` is shared, not duplicated per role:** candidate and recruiter views must be provably identical, so both call the same `build-report.ts`/`ReportView` rather than each re-deriving scores or narrative text.
- **`integrity/client` vs `integrity/server` are split because the trust boundary matters:** the client only ever emits aggregated events/counts (never raw video, never a "should I flag this" decision) and the server owns all thresholding/flagging logic, so tampering with the client cannot suppress or fabricate what actually gets stored.

## Architectural Patterns

### Pattern 1: Server-Authoritative Test Assembly with Frozen Attempt Manifest

**What:** On attempt start, the server randomly samples the quota-based subset from the full question bank and persists that exact set of question IDs (with order) against the attempt record. The client only ever receives the sanitized content for that frozen set — it never receives, generates, or re-derives the sample itself.
**When to use:** Any scenario where "randomized per-attempt content" must also be tamper-proof and where answer keys must stay server-side (this is the core requirement here).
**Trade-offs:** Requires an extra persisted table/row per attempt (small storage cost) but is the only way to guarantee the same random draw is used consistently for serving questions, validating submitted answers, and grading — without this, a client could submit answers for questions it was never actually shown, or the server could accidentally grade against a different random draw than what was served.

**Example:**
```typescript
// assembly/attempt-manifest.ts
async function startAttempt(email: string) {
  await assertNoExistingAttempt(email); // one-attempt-per-email guard
  const manifest = sampleByQuota(QUOTA_CONFIG); // e.g. 15 English, 20 AttentionToDetail, 15 CriticalThinking
  const attempt = await db.attempts.create({ email, questionIds: manifest, startedAt: now() });
  return sanitize(await getQuestions(manifest)); // strips isCorrect / answer-key fields
}
```

### Pattern 2: Deterministic Grading as a Pure, Idempotent Function

**What:** Grading is expressed as a pure function of `(assignedQuestionIds, submittedAnswers, answerKeySnapshot)` that always produces the same score for the same inputs — no LLM, no human step, no hidden mutable state.
**When to use:** Whenever the product decision is "100% objective, deterministic auto-grading" (explicitly required here) — this pattern makes the grading logic independently testable against fixtures and auditable/re-runnable if a bug is later found (re-grade historical attempts without re-collecting answers).
**Trade-offs:** Requires locking down the answer-key format early (MCQ/multi-select only, no partial-credit ambiguity) — but that constraint is already satisfied by the existing authored content, so this is a natural fit rather than a limitation.

**Example:**
```typescript
// grading/grade.ts
function gradeAttempt(assigned: Question[], answers: Record<string, string[]>): CategoryScores {
  return assigned.reduce((scores, q) => {
    const correct = isExactMatch(q.correctOptionIds, answers[q.id] ?? []);
    scores[q.category].raw += correct ? q.points : 0;
    scores[q.category].max += q.points;
    return scores;
  }, initCategoryScores());
}
```

### Pattern 3: Non-Blocking, Batched Client-Side Integrity Telemetry

**What:** All integrity signals (tab/blur, copy/paste, devtools, fullscreen-exit, right-click, on-device face presence) are captured via passive browser event listeners and an in-browser face-detection loop, buffered client-side, and flushed to the server periodically (e.g., every N seconds or on question-change) — never surfaced to the candidate and never blocking progression.
**When to use:** Any "silent monitoring, no live interruption" requirement, especially where the underlying signals (Page Visibility API, Fullscreen API, Clipboard events) are all standard, well-supported browser APIs rather than anything proprietary.
**Trade-offs:** Because signals are only heuristic (e.g., devtools-open detection is inherently a size/timing heuristic, not a guaranteed API), the aggregator should treat all of it as advisory "violation signal," feeding a count/flag rather than an automatic disqualification — matching the project's own framing of "logged, not blocking."

**Example:**
```typescript
// integrity/client/monitors.ts
document.addEventListener("visibilitychange", () => {
  if (document.hidden) buffer.push({ type: "tab_blur_start", t: Date.now() });
  else buffer.push({ type: "tab_blur_end", t: Date.now() });
});
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) buffer.push({ type: "fullscreen_exit", t: Date.now() });
});
document.addEventListener("copy", (e) => { e.preventDefault(); buffer.push({ type: "copy_attempt", t: Date.now() }); });
```
*(Page Visibility, Fullscreen, and Clipboard APIs verified against MDN — see Sources.)*

## Data Flow

### Request Flow — Attempt Lifecycle

```
Candidate enters name+email
  -> Attempt/Identity Guard (reject if email already attempted)
  -> Test Assembly Engine queries Question Bank (quota sample)
  -> Attempt Manifest persisted (question IDs + order, server-side)
  -> Sanitized question payload served to client (no answer keys, no point weights tied to options)
  -> Candidate answers + Integrity Monitor run in parallel
       - Answers buffered/synced per question
       - Event batches flushed to Integrity Aggregator
  -> Submit -> Grading & Scoring Engine (looks up Answer Keys, server-only)
  -> Result persisted: overall score, 3 trait scores, narrative insight, recommendation tier
  -> Reporting Service builds shared report row (joins Result + Integrity Summary)
       - Candidate sees report immediately
       - Recruiter Admin Panel lists attempt, opens same report
```

### Key Data Flows

1. **Content authoring → serving:** `.docx`/`.xlsx` → Ingestion Pipeline → Question Bank (one-way, admin-triggered, rare — not a live user-facing flow). This must complete and be validated *before* any candidate-facing flow can work, since the Test Assembly Engine depends entirely on a populated, validated bank.
2. **Assembly → grading consistency:** the exact question ID set frozen in the Attempt Manifest at start-time is the same set used to (a) serve sanitized content, (b) validate submitted answers belong to this attempt, and (c) grade — a single source of truth prevents any mismatch or tampering window.
3. **Integrity events are one-directional and decoupled from grading:** the client never learns whether a violation was "counted" or what the threshold is; the aggregator only ever writes forward into the attempt's violation log, and the Reporting Service reads that log after the fact — this keeps the "never interrupt the candidate" requirement structurally true rather than just a UI convention.
4. **Reporting is a pure read projection, not a computation site:** both candidate and recruiter views fetch the same persisted `results` row; no scoring or narrative-generation logic should live in either UI, only in the Grading & Scoring Engine that ran once at submit time.

## Scaling Considerations

This is an internal hiring tool (not a public product), so realistic load is low (likely tens to low hundreds of candidates at a time, bursty around hiring pushes) — architecture should optimize for **correctness and security of the answer-key boundary**, not throughput.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–1k attempts | Single monolithic app + single relational DB instance is more than sufficient. No queueing, no microservices needed. Focus all effort on the sanitization boundary and deterministic grading correctness. |
| 1k–100k attempts | Add indexes on `attempts.email`/`attempts.status`; consider read-replicas for the Admin Panel's candidate-list query if it starts joining large `results`/`events` tables; batch/rate-limit the integrity-event ingest endpoint if event volume grows. |
| 100k+ attempts | Unlikely for this project's use case, but if ever needed: separate the Integrity Event Aggregator into its own append-only store (time-series or log-oriented) since violation-event volume grows much faster than attempt volume, and it's the component least coupled to the transactional grading path. |

### Scaling Priorities

1. **First (and likely only relevant) bottleneck:** Admin Panel candidate-list query performance once `attempts`/`results`/`events` accumulate — mitigate with a denormalized "attempt summary" row (score, violation count) written once at grading time so the list view never has to aggregate on read.
2. **Second (unlikely to matter at this scale):** Integrity event ingest write volume if face-detection runs and reports at high frequency — mitigate by batching client-side flushes (e.g., every 5–10s) rather than one HTTP call per event.

## Anti-Patterns

### Anti-Pattern 1: Sending the Full Question Object (Including Answer Key) and Filtering Client-Side

**What people do:** Return the full question row — including `isCorrect`/`correctOptionId`/point weights — from the API and rely on the frontend to simply not *display* the correct answer.
**Why it's wrong:** Anyone can read the network response in DevTools and see the answer key; this is the single most common and most damaging mistake in auto-graded assessment platforms, and directly violates this project's explicit "answer keys must never be exposed to the candidate-facing client" constraint.
**Do this instead:** Strip answer-key fields at the API boundary (`api/attempt-start.ts` in the recommended structure) before serialization — never at the component/render layer. Treat "does this endpoint's response contain any correctness data" as a mandatory code-review/test checklist item.

### Anti-Pattern 2: Re-Deriving the Random Question Sample or Trusting Client-Reported Timing

**What people do:** Let the client pick/shuffle its own random subset of questions (needing the full bank client-side to do so), or trust a client-reported elapsed time / submission timestamp for grading deadlines.
**Why it's wrong:** Either the client ends up holding the full answer-keyed bank (defeats the entire security model), or a manipulated client clock/timer can extend time limits or replay/tamper with submissions.
**Do this instead:** Assembly always happens server-side and is frozen per attempt (Pattern 1). All timing (start, deadline, submission acceptance) is validated against server-side timestamps; the client-shown countdown is cosmetic only.

### Anti-Pattern 3: Continuous Webcam Recording/Upload for "Proctoring"

**What people do:** Stream or periodically upload raw webcam frames/video to a server or third-party vision API for "face verification."
**Why it's wrong:** Directly contradicts this project's explicit constraints (no paid cloud vision API, no continuous recording/storage) and creates unnecessary privacy/compliance/storage burden for a low-stakes internal screening tool.
**Do this instead:** Run face-presence/face-count detection entirely on-device using a lightweight in-browser model; only transmit small aggregated signals (e.g., "no-face-detected seconds," "multiple-faces-detected count") — never raw frames or video.

### Anti-Pattern 4: Duplicating Scoring/Narrative Logic Between Candidate and Recruiter Views

**What people do:** Build the candidate results page and the recruiter detail page as two separate implementations that each independently compute or format scores.
**Why it's wrong:** Guarantees eventual drift (a bug fix or scoring-model tweak applied to one but not the other), directly undermining the explicit requirement that both views show "the same report."
**Do this instead:** One Reporting Service builds a single immutable report data shape at grading time; both UIs are thin, read-only renderers of that same shape (Pattern in `reporting/` structure above).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| None required for grading/assembly/reporting | N/A | Entire scoring pipeline is self-contained and deterministic by design — no external API dependency, which also means no external outage risk for the core hiring-decision path |
| On-device face-detection model | Bundled/CDN-loaded JS/WASM model (e.g., a lightweight browser-based face detector), loaded once client-side | Not a network service at inference time — the model runs entirely in the browser using the local webcam stream via `getUserMedia`; only aggregated signals are sent to the server, never frames |
| Source content files (.docx/.xlsx) | One-time/rare offline ingestion, not a live integration | Treat as a build-time/admin-time input, versioned so re-ingestion is auditable if the source docs are revised |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Test Assembly Engine ↔ Question Bank | Direct server-side query/repository call | Never exposed as a client-callable endpoint that returns raw bank contents |
| Client Test UI ↔ API layer | HTTPS/JSON, sanitized payloads only | This is the critical trust boundary — every payload crossing it must be reviewed for answer-key leakage |
| Integrity Monitor (client) ↔ Integrity Aggregator (server) | Separate endpoint from answer submission, fire-and-forget batched POSTs | Decoupling prevents integrity logging from ever blocking or interfering with the grading-critical submit path |
| Grading Engine ↔ Reporting Service | Internal call/event at submit time, writes one immutable `results` row | Reporting never re-computes; it only reads |
| Recruiter Admin Panel ↔ Reporting Service | Same read path as candidate view, plus an auth/role check | No parallel scoring logic in the admin panel |

## Suggested Build Order (Dependency-Driven)

1. **Content Ingestion Pipeline + Question Bank schema** — everything else depends on structured, validated, answer-keyed data existing. Nothing else can be meaningfully built or tested without this (~375 items across 3 banks, quota config from the settled `.xlsx`).
2. **Test Assembly Engine + Attempt data model (server-only, API/script-testable)** — build and test the quota-based random sampler and attempt-manifest persistence against the real bank before any UI exists; this is where the "never leak the answer key" boundary is designed and enforced first.
3. **Grading & Scoring Engine (deterministic, fixture-testable)** — build against known fixture answer sets independent of any UI; this is the highest-risk-of-rewrite component if scoring rules are wrong, so nail it early with unit tests before layering UI on top.
4. **Candidate-facing gamified Test UI** — now consumes a stable assembly + grading API; levels/progress bar, per-question timer, dashboard tabs for case questions, and the submit flow.
5. **Integrity Monitoring (client events + on-device webcam)** — additive and non-blocking by design; can be layered onto the existing test-taking flow without touching assembly/grading, and could even ship in a later phase without risk to the core scoring pipeline.
6. **Shared Reporting component** — consumes the Grading Engine's persisted `results` row; build once, prove candidate-facing rendering works.
7. **Recruiter Admin Panel** — thin wrapper: candidate list (reads attempt summaries) + detail (reuses the same Reporting component from step 6). This naturally comes last since it has no logic of its own beyond auth and listing.

**Rationale:** steps 1–3 are pure server/data-model work that can be fully tested via scripts/fixtures without any frontend — this front-loads the highest-security, highest-rewrite-risk work (answer-key boundary, deterministic scoring) before UI investment. Steps 4–7 are progressively thinner UI layers over already-stable APIs, with integrity monitoring deliberately placed as an additive, low-coupling feature that doesn't gate the core candidate → score → report path.

## Sources

- MDN Web Docs — Page Visibility API: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API (official docs, HIGH confidence) — confirms `visibilitychange`/`document.hidden` as the standard mechanism for tab-switch/blur detection used in the Integrity Monitor.
- MDN Web Docs — Fullscreen API: https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API (official docs, HIGH confidence) — confirms `fullscreenchange`/`document.fullscreenElement` as the standard mechanism for fullscreen-exit detection.
- MDN Web Docs — Clipboard API: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API (official docs, HIGH confidence) — confirms `copy`/`paste`/`cut` events as the standard mechanism for copy-paste attempt logging.
- General architecture synthesis (server-authoritative test assembly, deterministic grading, shared reporting projection, answer-key sanitization boundary) is based on well-established, stable patterns common to e-assessment/LMS/quiz-engine systems (e.g., the "never trust the client with grading data" principle, and "assemble server-side, freeze per attempt" pattern used across most randomized-exam systems) — this synthesis is MEDIUM confidence: it reflects conventional, low-controversy software-architecture practice rather than a specific verified case study, since live web search/product-research tooling was unavailable in this research session (WebSearch and most WebFetch domains were denied by the environment's permission policy; only `developer.mozilla.org` was reachable via WebFetch).
- **Gap/flag for later phase-specific research:** if a specific on-device face-detection library needs to be chosen (vs. this document's generic recommendation), that library-specific evaluation (bundle size, WASM/WebGL requirements, accuracy at low resolution, licensing) should be a targeted spike during the integrity-monitoring build phase, since it could not be verified with live documentation lookup in this session.

---
*Architecture research for: Auto-graded gamified hiring assessment platform*
*Researched: 2026-07-29*
