# Pitfalls Research

**Domain:** Hiring/candidate-assessment platform on a constrained serverless stack (Google Apps Script backend + Google Sheets datastore + statically-exported Next.js frontend on GitHub Pages, no dedicated job queue/database)
**Researched:** 2026-07-31 (v1.1 milestone — supersedes the 2026-07-29 v1.0-era version of this file; see note below)
**Confidence:** MEDIUM-HIGH — codebase findings below are HIGH confidence (direct read of `backend/Code.gs`, `tests/grading/grading-engine.ts`, `tests/admin/test_admin.ts`, `assessment-app/src/components/*`, `.github/workflows/deploy.yml`, `package.json`). Fullscreen API behavior is HIGH confidence (verified live against MDN in this session). Google Apps Script quota figures are MEDIUM confidence — live fetch of `developers.google.com` was blocked in this research session; figures reflect stable, long-documented Apps Script limits but should be re-confirmed against the current quotas page before the async-pipeline phase is built. Hiring-AI legal/fairness landscape is MEDIUM confidence — jurisdiction-dependent and evolving; treat as directional, not legal advice.

> **Note on scope:** This revision replaces the prior version of this file, which covered v1.0 pitfalls (answer-key leakage, quota-sampling math, retake-gaming via email variants, client-side integrity over-trust, psychometric-validity overclaiming). Those v1.0 findings were validated and largely addressed in phases 1-6; they are not repeated here except where a v1.1 feature directly interacts with them (e.g., Pitfall 6 below extends the original psychometric/legal-exposure pitfall now that LLM grading is a "real hiring signal," not just an MCQ-only tool). This version focuses exclusively on the six v1.1 milestone areas: async report generation + email delivery, recruiter analytics dashboard, proctoring upgrade + fullscreen lock, expanded LLM open-text grading, and the F-03/F-04/F-05/F-06 bug fixes.

## Critical Pitfalls

### Pitfall 1: Grading everything synchronously inside `doPost` hits Apps Script's 6-minute execution ceiling as volume grows

**What goes wrong:**
`handleSubmitAnswers` in `backend/Code.gs` currently does *everything* in one execution: it batches every open-text/hybrid answer into `evaluateOpenTextBatch`, waits on `UrlFetchApp.fetchAll()` to Gemini (and a fallback provider) for every LLM-graded question, computes trait scores, and writes to the `Attempts`/`Responses` sheets — all before returning a response to the candidate's `fetch()` call. If the team simply "makes report generation async" by keeping this same code path but moving only the *email send* to the end of the same function, the fundamental problem isn't solved: a single Apps Script execution (whether triggered by `doPost` or a time-driven trigger) is still capped at **6 minutes**. This milestone explicitly expands the open-text question share, so a larger LLM batch combined with any provider slowness/rate-limiting can blow through that ceiling — and the whole execution (grading, sheet writes, email) aborts with nothing partially saved unless writes were already committed incrementally.

**Why it happens:**
Apps Script has no separate "background worker" concept — every unit of work, sync or async, is just another bounded execution. Teams coming from Node/Python instinctively reach for "just do it in a background job" without internalizing that the job itself inherits the same 6-minute wall.

**How to avoid:**
- Split into two phases: (1) `doPost` writes an `attemptId` row with `status = "pending_grading"` and *immediately* returns an ack to the candidate (this is what makes the "Thank You" screen possible even if grading takes longer) — no LLM calls happen inline in the request handler; (2) a **time-driven trigger** (e.g., every 1–5 minutes) picks up rows in `pending_grading`, grades them, and flips status to `graded`/`emailed`. This decouples request latency from LLM latency entirely.
- Cap the LLM batch size processed per trigger run (e.g., grade N pending attempts per invocation, not the whole backlog) so a single trigger execution never approaches 6 minutes even under a backlog.
- Make grading idempotent and resumable: if a trigger run is killed mid-way (timeout, quota, crash), the next run must be able to pick up exactly where it left off (per-question grading state, not "all or nothing" for a whole attempt) — write partial LLM results as they arrive, don't hold them all in memory until the end.

**Warning signs:**
- Local/manual testing with 1-2 open-text questions "feels fine" and the team assumes it scales — no load test with the full expanded open-text share and a slow provider.
- No `status` state machine on `Attempts` beyond `active`/`submitted` — no way to represent "grading in progress" or "grading failed, retry".
- Trigger function has no batch-size cap or max-runtime guard (early-exit check against elapsed time).

**Phase to address:**
Async grading + report flow phase (Target feature: "Async grading + report flow: 'Thank You' screen on submit... compute continues server-side").

---

### Pitfall 2: Naive trigger design exhausts Apps Script's daily trigger-runtime and per-script trigger-count quotas

**What goes wrong:**
Apps Script limits both the **number of triggers a script can register per user** and the **total trigger execution time per day** (these have historically been on the order of 20 triggers/script and a per-day trigger-runtime budget that differs for consumer Gmail accounts vs. Google Workspace accounts — confirm current numbers before implementation, see confidence note above). A common async-migration mistake is creating a *new time-driven trigger per attempt* (e.g., "schedule a trigger to grade attempt X in 1 minute") instead of one recurring polling trigger that processes a queue. At even modest hiring volume (dozens of candidates/day, bursts around a hiring push), per-attempt trigger creation will hit the per-script trigger cap and start throwing errors — silently breaking async grading for every candidate after the cap is hit.

**Why it happens:**
Per-event trigger creation mirrors how you'd think about a "job" in a real queue system (SQS, Cloud Tasks), but Apps Script triggers are a *scarce, capped resource*, not a lightweight job primitive.

**How to avoid:**
- Use exactly **one** recurring time-driven trigger (installed once, e.g. via a one-time setup function, not created per submission) that polls the `Attempts` sheet for `pending_grading` rows on a fixed interval.
- Never call `ScriptApp.newTrigger()` from inside `doPost`/`handleSubmitAnswers`.
- Add a startup/admin check that asserts exactly one grading trigger exists (defensive check against duplicate installs during redeploys).

**Warning signs:**
- Any code path that calls `ScriptApp.newTrigger(...)` per-attempt rather than once at setup time.
- `ScriptApp.getProjectTriggers().length` growing unbounded over time in the Apps Script dashboard.

**Phase to address:**
Async grading + report flow phase.

---

### Pitfall 3: Concurrent submissions race on Sheets reads/writes with no locking

**What goes wrong:**
`handleSubmitAnswers` (and `handleStartAttempt`) currently read `attemptsSheet.getDataRange().getValues()`, scan for a row index, then later write back to that row index (`attemptsSheet.getRange(attemptRowIdx, ...)`). There is **no `LockService` usage anywhere in `Code.gs`** today (confirmed by search). Under low concurrency (one candidate at a time) this is invisible. Once report generation becomes trigger-driven and polls/updates multiple `pending_grading` rows per run, and especially once a recruiter-analytics dashboard starts reading the same sheet concurrently with writes, two concurrent executions (a second submission racing the grading trigger, or two trigger runs overlapping if one runs long) can read stale row indices or clobber each other's writes — a classic Sheets-as-database race condition.

**Why it happens:**
Google Sheets has no native row-level transactions; Apps Script executions only appear "serial" under low load, but multiple triggers/web-app requests from different callers can and do run concurrently.

**How to avoid:**
- Wrap any read-modify-write sequence against the `Attempts` sheet (status transitions, score writes, violation-count reads) in `LockService.getScriptLock()` with a short, explicit `waitLock` timeout and a `finally { lock.releaseLock() }`.
- Keep locked sections as short as possible (only the read+write, not the LLM calls) to avoid serializing the slow part of the pipeline.
- Consider a dedicated "claim" step: trigger run atomically flips `pending_grading` → `grading_in_progress` for a batch of rows under lock, then does the slow LLM work *outside* the lock, then writes final results under a second short lock.

**Warning signs:**
- No `LockService` calls anywhere in `Code.gs` (confirmed absent as of this research pass).
- Duplicate/overwritten rows in `Attempts`/`Responses` observed under any concurrent testing.

**Phase to address:**
Async grading + report flow phase.

---

### Pitfall 4: MailApp/GmailApp daily quota is silently exhausted — emails just stop sending, no error surfaces

**What goes wrong:**
`MailApp`/`GmailApp` on Apps Script are quota-limited **per day, per executing Google account** (the account that owns/authorizes the script), and the quota is materially different for a free consumer Gmail account vs. a paid Google Workspace account. This project has **zero existing `MailApp`/`GmailApp` usage today** (confirmed by search — email delivery is entirely new for this milestone), so there is no established pattern for handling quota exhaustion. If the script account is a free consumer Gmail (likely, given the "no new paid email service" constraint), and this milestone needs **two emails per attempt** (candidate report + recruiter-team notification), volume can hit the daily cap far faster than expected — and when the quota is exceeded, `MailApp.sendEmail()` throws, but only *inside* whatever execution called it. If that's inside the unguarded grading trigger, the exception can silently abort that trigger run, leaving the attempt stuck in `pending_grading`/`graded-but-not-emailed` with no visible failure to recruiters unless someone checks execution logs.

**Why it happens:**
Quota errors from `MailApp` are exceptions, not soft failures — teams that don't explicitly `try/catch` around the send call and persist a distinct `email_status` conflate "graded" with "graded and delivered," so a quota failure looks like nothing happened rather than like a specific, diagnosable failure.

**How to avoid:**
- Treat email as a separate state from grading: `graded` → `email_pending` → `email_sent`/`email_failed`, written to its own column(s), not inferred from `status = submitted`.
- Wrap every `MailApp.sendEmail`/`GmailApp.sendEmail` in `try/catch`; on failure, log to a dedicated log sheet (or extend `IntegrityLogs`) with the error text and leave the row retryable by the next trigger run instead of marking it done.
- Track a running daily-send counter (script property, reset at midnight) and pre-empt sends past a safety margin below the known quota, queuing the rest for the next day rather than hitting the hard error.
- Consolidate to fewer emails where possible (e.g., one recruiter-team digest email rather than one email per stakeholder per attempt) to reduce quota pressure per candidate as volume grows.
- If volume is expected to exceed consumer quotas at any point, this is the one place worth revisiting the "no new paid email service" constraint explicitly with the business owner rather than silently degrading.

**Warning signs:**
- No distinct `email_status` field — email success is assumed rather than recorded.
- No daily-send counter or quota safety margin anywhere in the code.
- Recruiters report "some candidates never got a report email" with no corresponding error surfaced anywhere.

**Phase to address:**
Async grading + report flow phase.

---

### Pitfall 5: "Lock fullscreen exit" as literally stated is not achievable in any current browser — must be reframed as detect-and-hard-flag

**What goes wrong:**
The milestone goal states: *"lock fullscreen-exit toggling once entered (currently exitable) as a hard integrity signal."* Taken literally ("prevent the candidate from exiting fullscreen"), this is **not technically possible** in any mainstream browser. Verified directly against MDN's Fullscreen API guide during this research pass: *"The user always has the ability to exit fullscreen mode of their own accord,"* and pressing **Esc (or F11) always exits fullscreen** — this is a browser-enforced, JavaScript-unblockable security guarantee specifically designed to prevent sites from trapping users. There is no hook that lets a page `preventDefault()` the browser-native Esc-triggered fullscreen exit; `keydown` listeners can observe the Escape keypress but cannot stop the fullscreen exit it triggers. Any implementation that claims to "block" fullscreen exit will either (a) not actually work in real browsers and give a false sense of security, or (b) only catch *some* exit paths (e.g., a custom "exit fullscreen" button the candidate never uses) while Esc/F11/Alt-Tab remain fully available.

**Why it happens:**
This is a very common, reasonable-sounding ask from non-technical stakeholders ("just don't let them leave fullscreen") that collides with an intentional, long-standing browser security boundary most engineers don't discover until they've already promised it.

**How to avoid:**
- Reframe the requirement explicitly during planning/requirements as **detect-and-hard-flag**, not prevent: the existing `fullscreenchange` listener (already in `TestScreen.tsx`, currently used only for silent logging via `INTEG-04`) is the correct mechanism — escalate its *consequence*, not its blocking power. E.g.: on fullscreen exit, immediately re-prompt re-entry, visibly pause/timer-hold the test, and record a high-severity violation that materially affects `recommendationTier` or surfaces a prominent recruiter-facing flag — rather than trying to stop the exit itself.
- Communicate this constraint back to whoever wrote "lock" into the requirement before it's built, so the phase's acceptance criteria don't silently ship a broken promise (a QA pass that manually presses Esc will immediately "disprove" a "lock" claim).
- Optional complementary layer: combine with the existing tab-switch/blur and devtools-detection signals already logged, so fullscreen exit is one signal among several converging on a violation score, not the sole gate.

**Warning signs:**
- Any implementation attempt centered on `keydown`/`beforeunload` handlers trying to intercept the Escape key's fullscreen-exit behavior — this will not work and time will be lost building it.
- Acceptance criteria or stakeholder-facing copy that says "prevented" or "locked" rather than "detected and flagged."

**Phase to address:**
Proctoring upgrade phase (Target feature: "Proctoring upgrade... lock fullscreen-exit toggling").

---

### Pitfall 6: LLM-graded hiring assessments carry real bias, defensibility, and adverse-impact risk that "reversing a prior no-LLM-grading decision" must not wave away

**What goes wrong:**
This is explicitly a **hiring tool** (per `.planning/PROJECT.md`: "Customer: The hiring/recruiting team screening... applicants"), and the milestone reverses a prior "zero human grading involved anywhere" design principle to introduce LLM-graded open-text scoring as "a real hiring signal." In many jurisdictions, algorithmic/AI tools used to make or materially inform employment decisions are subject to specific scrutiny: bias/disparate-impact audit requirements (e.g., NYC Local Law 144-style automated employment decision tool rules), general employment-discrimination frameworks (adverse-impact/four-fifths-rule style analysis under EEOC-adjacent guidance in the US), and emerging EU AI Act classification of hiring tools as high-risk with transparency/human-oversight obligations. An LLM grading free-text answers against a rubric can produce systematically different scores for candidates based on writing style, English dialect/register, verbosity, or cultural framing that correlates with protected characteristics — even with no intent to discriminate. Shipping this without any bias testing, without a documented rubric, and without a human-reviewable rationale for every LLM verdict creates real legal and reputational exposure, not just a UX nit.

**Why it happens:**
Teams treat "add an LLM grader" as a pure engineering task (prompt + rubric + API call) and underweight that a hiring tool's grading logic is functionally an employment-decision input, which is regulated very differently from, say, an internal content-moderation classifier.

**How to avoid:**
- Explicit, versioned rubric per open-text question (not just a system prompt) that a human can audit independently of the LLM's output — the milestone's stated plan ("rubric-based open-text grading criteria instead of binary correct/incorrect") is the right direction; make the rubric a first-class, reviewable artifact (e.g., stored alongside the question content), not just embedded prose in a prompt string.
- Store the LLM's full rationale/verdict text per answer (not just a boolean), surfaced to recruiters for spot-check/override — this milestone's stated plan already calls for a "recruiter-visible transcript + LLM verdict"; make sure the *reasoning*, not just the score, is captured and retained, since defensibility later depends on being able to show *why* a candidate was scored a given way.
- Build in recruiter override as a real, logged action (who overrode, from what score to what score, and why) — not just a UI affordance, but an auditable trail, since "human in the loop" is the standard mitigation regulators and courts look for.
- Before shipping, run a basic bias sanity check on the rubric/prompt with varied writing styles/registers on the same underlying "correct" content, to catch obvious stylistic-bias failure modes early (this doesn't need to be a formal audit at v1.1 scale, but should not be skipped entirely given the domain).
- Keep the final `recommendationTier` computation transparent about how much weight LLM-graded questions contribute, so a candidate/recruiter can trace a "Not Recommended" outcome back to specific, reviewable evidence rather than an opaque blended score.

**Warning signs:**
- Rubric exists only as inline prompt text with no separate, versioned, human-reviewable representation.
- LLM verdict stored as boolean only (current `Code.gs` behavior: `results[qId] = parsedScore.score === 1` — no rationale text is captured or persisted anywhere today).
- No recruiter override UI/logging shipped alongside the expanded LLM grading share — grading expansion ships before the safeguard it depends on.
- No test coverage or spot-check process comparing LLM verdicts across demographically-varied writing samples.

**Phase to address:**
Expand LLM-graded open-text share phase (Target feature: "Expand open-ended (LLM-graded) question share" + "Evaluation-quality improvements... rubric-based grading... recruiter-visible transcript + LLM verdict").

---

### Pitfall 7: Silently reversing the "zero human grading / fully automated, fair for everyone" guarantee erodes trust with candidates and stakeholders who were told otherwise

**What goes wrong:**
v1.0's core value proposition, as recorded in `PROJECT.md`, was explicit: *"...both the candidate and the recruiter instantly get the same detailed, auto-generated profile report — with zero human grading involved anywhere in the pipeline"* and *"Every candidate gets a fair, consistent, fully automated read... without requiring a human to grade or score a single answer."* This was very likely surfaced to candidates in some form (report framing, "how this works" copy, or verbally by recruiters) as a fairness/consistency promise. v1.1 both (a) reintroduces an LLM in the grading loop (already true today via `evaluateOpenTextBatch`, but now being expanded and made a "real hiring signal") and (b) adds a **recruiter override capability**, which means the "same report, zero human involvement" guarantee is genuinely no longer true — a recruiter can now change a candidate's outcome. Shipping this purely as a backend/engineering change, without updating any candidate-facing language, FAQ, or consent framing that referenced the old guarantee, risks candidates later discovering (e.g., via a rejection they contest, or a transparency request) that what they were told doesn't match what actually happened — a fairness and trust problem independent of whether the LLM grading itself is accurate.

**Why it happens:**
The decision to reverse "no LLM grading" is tracked in `PROJECT.md`'s Key Decisions table as an internal/technical decision, but nothing in the milestone scope currently calls out updating any *candidate-facing* representation of how grading works — it's easy for this to fall through the cracks between "product decision" and "engineering task."

**How to avoid:**
- Audit any existing candidate-facing copy (report screen text, any pre-test instructions, consent/privacy language) for claims like "no human review" or "fully automated" and update it to accurately describe the new pipeline (LLM-assisted grading with optional recruiter review) before this ships.
- Since the recommendation tier can now be human-adjusted, make sure the report itself (both candidate- and recruiter-facing) is honest about that possibility, consistent with the "Report shown identically to candidate and recruiter" principle already in `PROJECT.md`.
- Flag this explicitly as a requirements/product question during roadmap planning, not just a technical one — "what do we tell candidates now that a human can review their answers" is a business decision, not something engineering should decide implicitly by shipping code.

**Warning signs:**
- No task in the milestone scope for updating candidate-facing copy/FAQ/consent language.
- Report screen or pre-test instructions still reference "fully automated" / "no human involved" after LLM grading + override ships.

**Phase to address:**
Expand LLM-graded open-text share phase — should be paired with a copy/content review step, even if implemented as a small task within that phase rather than a full separate phase.

---

### Pitfall 8: Fail-open LLM grading defaults quietly undermine both fairness and the "hiring signal" value of the feature

**What goes wrong:**
`evaluateOpenTextBatch` in `Code.gs` has three separate fail-open paths: if no API keys are configured, **every open-text answer is marked correct**; if the Gemini call fails, it falls through to a secondary provider, but if that also fails or no fallback key is set, the answer is **again marked correct** ("Final safe fallback" / "just mark as true to not penalize"). This is a reasonable instinct (don't let an API outage tank a candidate's score) but has two serious side effects once open-text becomes "a real hiring signal": (1) it's **inconsistent across candidates** — a candidate whose batch happened to hit a transient API failure gets free credit for open-text questions, while another candidate graded during a healthy API window gets genuinely evaluated, which is itself a fairness problem (different candidates are held to different standards based on infrastructure luck, not ability); (2) it **silently inflates scores** in a way that's invisible in the report and in any admin analytics — a spike in "Strong Fit" recommendations could just be a period of API instability, and nothing in the current design distinguishes "the LLM said this was a great answer" from "the LLM couldn't be reached so we didn't grade it at all."

**Why it happens:**
Fail-open was likely chosen to avoid the more obviously bad failure mode (silently failing the candidate, or crashing the whole submission) without recognizing that "always correct" is its own form of bias once results are compared across candidates and used to inform hiring decisions.

**How to avoid:**
- Distinguish "LLM graded this and scored it correct" from "LLM was unavailable, this question was not gradable" as separate states — do not conflate the latter into `isCorrect = true`.
- For ungraded questions, either (a) exclude them from the trait-score denominator entirely rather than silently crediting them, or (b) flag the whole attempt for mandatory recruiter review before a report is finalized/emailed, rather than emailing a report that looks fully graded but partially wasn't.
- Surface an "ungraded question count" per attempt in both the recruiter-visible transcript and (ideally) the admin analytics dashboard, so systemic LLM-outage periods are visible as a data-quality signal, not hidden inside an inflated score.
- Add explicit test coverage (this ties directly into F-03/F-04) for the "LLM unavailable" path so its behavior is a deliberate, tested decision going forward, not an incidental fallback nobody revisits.

**Warning signs:**
- `isCorrect`/grading result has no distinct state for "not evaluated" vs. "evaluated and correct."
- No metric anywhere (report, admin dashboard, logs) showing how many open-text answers were actually LLM-graded vs. fell back to the safe-default.

**Phase to address:**
Expand LLM-graded open-text share phase — should be fixed alongside F-03 since it's the same code path being brought under test.

---

### Pitfall 9: Fixing F-03 once doesn't prevent the mirror from drifting again — there's currently no CI gate enforcing it

**What goes wrong:**
`tests/grading/grading-engine.ts` is a hand-maintained TypeScript re-implementation of `handleSubmitAnswers`'s scoring logic from `Code.gs`, explicitly documented as "Any change to the scoring rules in Code.gs MUST be mirrored here" — a manual convention, not an enforced one. This is confirmed as the root cause of F-03: the mirror currently hardcodes `// open_text: treated as correct` / `isCorrect = true` for every open-text/hybrid question, while the real `Code.gs` path grades those via `evaluateOpenTextBatch`'s LLM call — the two have already diverged once. Critically, **fixing F-03 today does not prevent it from happening again**: there is no automated check that would catch the *next* time someone edits the scoring logic in one file and forgets the other. Root `package.json` does define `npm test` (`vitest run`) and a real test suite exists (`tests/grading/test_grading.ts`, `tests/admin/test_admin.ts`, etc.), but the only GitHub Actions workflow in the repo (`.github/workflows/deploy.yml`) **only builds and deploys the Next.js frontend — it never runs `npm test`**. So even the existing test suite provides no CI safety net today; a PR that reintroduces drift in either `Code.gs` or the mirror would merge and deploy without any test failure surfacing.

**Why it happens:**
"We wrote tests" and "tests run somewhere before merge" are treated as equivalent, but without a CI step invoking `npm test`, the test suite only protects whoever remembers to run it locally — which is exactly how F-03 happened in the first place.

**How to avoid:**
- Add a CI job (either as a step in the existing workflow or a new `.github/workflows/test.yml`) that runs `npm test` (or `npm run test:grading` at minimum) on every PR/push, and make it a required check before merge if branch protection is available.
- As part of F-03's fix, add an explicit "divergence" test: a test that runs the *same* frozen-question + candidate-answer fixture through both `gradeAttempt()` (the mirror) and a Code.gs-equivalent expectation, asserting they agree on `isCorrect` for representative open-text cases — this converts "please remember to keep these in sync" into a test that fails loudly the next time they drift.
- Longer-term (optional, not required for this milestone): consider whether the scoring logic can be extracted into a single source of truth that both the Apps Script deployment and the test suite consume, rather than two hand-maintained copies — even a build step that generates the `.gs`-compatible file from the TypeScript source would remove the drift risk structurally. If that's out of scope for v1.1, at minimum document the dual-maintenance requirement prominently at the top of both files (partially done already in the mirror's header comment) and rely on the CI divergence test above as the real safety net.

**Warning signs:**
- `.github/workflows/` contains no job that runs `npm test`/`vitest`.
- Any PR touching `handleSubmitAnswers` in `Code.gs` that doesn't also touch `tests/grading/grading-engine.ts` in the same diff.
- No test asserting the two implementations agree on the same fixture — only that each independently "does what it does."

**Phase to address:**
F-03/F-04 bug-fix phase (Target features: "F-03: sync `tests/grading/grading-engine.ts` mirror..." and "F-04: add tests for admin auth and Code.gs↔mirror sync").

---

### Pitfall 10: F-04's "admin auth tests" risk testing a reimplementation instead of the real authorization code — a second, subtler form of the same mirror-drift problem

**What goes wrong:**
`tests/admin/test_admin.ts` already exists and looks like it satisfies "tests for admin auth," but on inspection it **redefines its own local `ADMIN_TOKEN` constant and its own local `validatePasscode()` function**, then tests that reimplementation — it never imports or exercises the actual `handleGetAttemptReport`/`handleAdminListCandidates`/`handleAdminResetAttempt` authorization checks (`if (token !== ADMIN_TOKEN) return { success: false, error: "Unauthorized" }`) from `Code.gs`. This means the test suite could pass 100% green while the real admin-auth code path in `Code.gs` has a bug, a bypass, or drifts from the hardcoded secret used in the test — the exact same "looks tested, isn't actually testing production logic" failure mode as F-03's grading mirror, just for the auth surface instead of the grading surface. This is especially risky given this milestone **expands the admin surface** (new analytics dashboard, potentially new LLM-summarized endpoints, recruiter override actions) — all likely gated by the same single hardcoded `ADMIN_TOKEN`, meaning any auth gap here now protects a larger blast radius than v1.0's simple read-only candidate list.

**Why it happens:**
`Code.gs` has no `SpreadsheetApp`-free exported functions for its auth checks (unlike the grading logic, which already got a proper extraction into `grading-engine.ts`), so the path of least resistance when writing a Vitest test for Apps Script auth logic is to copy the constant and reimplement the check inline, rather than extract the real logic into a testable module first.

**How to avoid:**
- As part of F-04, extract the admin-auth check itself (`token !== ADMIN_TOKEN` plus any future per-recruiter/role logic) into a small, `SpreadsheetApp`-free shared module (mirroring how `grading-engine.ts` extracted grading), and have both `Code.gs` and the test suite import/exercise that same function — not two independent copies.
- Rewrite `test_admin.ts` to test the extracted real function, not a local reimplementation; keep the violation-flagging and filter-list tests (those are fine, they're pure UI/data logic) but replace the passcode test.
- Since the admin surface is growing (analytics dashboard, LLM summaries, recruiter override), design the auth check once, now, so every new admin endpoint added this milestone consumes the same tested function rather than each new handler re-checking `token !== ADMIN_TOKEN` inline with copy-paste risk of a missed check on a new route.
- Consider whether a single shared static token (as opposed to per-recruiter identity) is still adequate once "recruiter team notified by email" and "recruiter override, logged with who overrode" are both in scope — an override audit trail is hard to make meaningful ("who overrode this?") if every recruiter shares one secret with no per-user identity. At minimum, flag this as a known limitation even if a full auth upgrade is out of scope for v1.1.

**Warning signs:**
- Test file defines its own copy of a secret/constant that also exists in production code, rather than importing the production value/function.
- New admin/analytics endpoints added this milestone each inline their own `token !== ADMIN_TOKEN` check rather than calling one shared, tested function.
- Override-logging design has no way to attribute "who" beyond "someone with the admin token."

**Phase to address:**
F-03/F-04 bug-fix phase, coordinated with the recruiter admin analytics dashboard phase (since the dashboard adds the endpoints this auth model needs to protect).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Fail-open LLM grading (`isCorrect = true` on API failure/missing key) | Never blocks a submission on an API outage | Inconsistent, silently inflated scores across candidates once open-text is "a real hiring signal" | Only acceptable if the ungraded state is tracked separately and surfaced, never silently merged into "correct" |
| Single shared static `ADMIN_TOKEN` for all recruiter access | Trivial to implement, no auth infra needed | No per-user attribution for overrides, can't revoke one recruiter without breaking all, growing admin surface increases blast radius of a leak | Acceptable at very small recruiter-team scale (single team, low turnover) but should be flagged as a known limitation once override actions need "who did this" logging |
| Polling-based async grading (time-driven trigger scanning sheet for `pending_grading`) instead of a real queue | Zero new infra, fits "no dedicated job queue" constraint | Added latency (poll interval) between submit and email; more complex retry/idempotency logic than a real queue would need | Acceptable and effectively required given the Apps-Script-only constraint — just budget for the latency in UX copy ("your report will arrive shortly") |
| Reading the entire `Attempts` sheet into memory (`getDataRange().getValues()`) for lookups | Simple, works fine at current scale | Slows down and eventually risks execution-time/memory pressure as candidate count grows into the hundreds/thousands, especially once an analytics dashboard reads it too | Acceptable through moderate scale (low hundreds of attempts); revisit if analytics dashboard queries get slow or attempt volume grows substantially |
| LLM-summarized analytics regenerated on every dashboard page load | Simple to implement, always "fresh" | Extra LLM cost/latency per view, non-deterministic summary text on reload (confusing for recruiters comparing sessions), extra pressure on the same API quota used for grading | Never for production — cache/store the summary and regenerate on a schedule or explicit refresh action instead |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Gemini / fallback LLM API (`UrlFetchApp.fetchAll`) | Treating any non-200 or parse failure as "grade as correct" rather than "not graded" | Track a distinct "ungraded" state; only apply a safe default with that state visible downstream (report, analytics), never merged silently into "correct" |
| `MailApp`/`GmailApp` | Assuming `sendEmail()` either always succeeds or crashes the whole flow visibly | Wrap in try/catch, persist a distinct `email_status`, track a daily-send counter against the known quota, make failures retryable and visible to recruiters |
| Apps Script time-driven triggers | Creating a trigger per event/attempt instead of one recurring polling trigger | Install one trigger at setup time; have it scan for and batch-process pending work each run |
| Browser Fullscreen API | Trying to intercept/prevent the Escape-key fullscreen exit | Treat fullscreen exit as an unblockable, detectable event only — react with escalated flagging/consequence, not prevention |
| BlazeFace / TensorFlow.js (current proctoring) | Loading BlazeFace's UMD bundle from CDN with implicit script-order assumptions (already a documented source of past bugs per `TestScreen.tsx` comments about `tf`/`blazeface` load-order) | If replacing BlazeFace, prefer a self-contained, actively-maintained free option (e.g., MediaPipe Tasks Vision face detection, which succeeded the older TF.js face-detection models) and keep explicit script-load-order handling if using any UMD/CDN-script pattern rather than an ES-module bundler-friendly package |
| Google Sheets as datastore | Read-then-write without `LockService` under concurrent access | Wrap read-modify-write sequences in `LockService.getScriptLock()`, keep locked sections short |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Whole-sheet scan (`getDataRange().getValues()`) per lookup/write | Slower `doPost`/trigger runs as row count grows; eventually risks approaching execution-time limits | Cache attempt-ID→row-index mapping where safe, or migrate hot lookups to a keyed structure (e.g., `CacheService` for short-lived lookups) | Becomes noticeable in the low hundreds of rows, a real risk in the low thousands given the 6-minute execution ceiling shared with LLM grading calls |
| Grading trigger processing unbounded backlog in one run | A backlog spike (e.g., many candidates submit around the same time) causes a single trigger execution to approach/exceed 6 minutes and abort mid-batch | Cap batch size per trigger invocation; process backlog incrementally across multiple trigger firings | Any burst of concurrent submissions larger than what a single 6-minute window can grade at current LLM latency |
| Recruiter analytics dashboard computing aggregates (score trends, difficulty, violation patterns) live on every page load by re-scanning all sheets | Dashboard feels slow/laggy as attempt count grows; risk of hitting execution-time limits on the `doGet` serving the dashboard | Precompute/cache aggregate stats (e.g., on a schedule or incrementally as attempts are graded) rather than recomputing from scratch per view | Once attempt count is large enough that a full-sheet aggregate scan takes more than a second or two per dashboard load |
| Two-provider LLM fallback (`fetchAll` to Gemini, then a second `fetchAll` to a fallback for failures) doubling latency on any partial outage | Grading trigger runs take much longer during any Gemini instability, increasing risk of hitting the 6-minute cap right when it matters most | Bound the fallback pass with its own timeout/early-exit; don't let a struggling provider silently double the worst-case runtime of every affected batch | Any period of partial Gemini degradation coinciding with normal-to-high submission volume |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Single static `ADMIN_TOKEN` shared across a growing recruiter-facing surface (report view, candidate list, and now analytics dashboard, LLM summaries, override actions) | One leaked token exposes every candidate's full report data, analytics, and grants override capability with no per-user attribution | At minimum, keep the token out of client bundles (already partially addressed by F-01) and treat it as a shared secret rotated periodically; flag per-recruiter identity as a future improvement given override actions now need "who did this" attribution |
| Candidate PII (name, email, full open-text answers) sent to a third-party LLM API for grading and, if implemented literally, for dashboard "LLM-summarized insights" | Data-handling/privacy exposure if the LLM provider's data-retention/training policies aren't reviewed for a hiring context | Confirm the configured LLM provider(s)' data-use policy is appropriate for candidate PII before expanding usage; avoid sending more PII than the grading/summary task needs (e.g., summarize aggregate stats, not raw candidate answers, for the analytics dashboard where possible) |
| LLM rationale/transcript text stored and shown to recruiters without sanitization | Prompt-injection-style content in a candidate's open-text answer could manipulate the LLM's rationale text shown to recruiters, or include unexpected HTML/script content if rendered unsanitized in the admin UI | Treat LLM-generated rationale text as untrusted output when rendering in the recruiter UI (escape/sanitize), same as any user-generated content |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| "Thank You" screen with no indication of when/whether the report will arrive | Candidates left uncertain if their submission worked, may retry submission or contact support unnecessarily | Explicit copy on the Thank You screen setting expectations ("your report will be emailed within X minutes") and, ideally, a way to check status without needing a new attempt |
| Copy claiming "fully automated, no human review" persisting after LLM grading + recruiter override ships | Misleads candidates about how their assessment is actually evaluated | Update all candidate-facing copy to accurately reflect LLM-assisted grading and optional recruiter review (see Pitfall 7) |
| Fullscreen-exit UX that implies blocking ("you cannot leave fullscreen") when it's actually just detection | Candidates who successfully exit via Esc despite the UI's claim lose trust in the tool's stated integrity guarantees, and recruiters may over-trust a "lock" that never worked | UI/instructional copy should say "exiting fullscreen will be recorded and flagged," not "fullscreen exit is prevented" |
| Recruiter analytics dashboard showing LLM-summarized insights with no indication of confidence/data quality (e.g., ungraded questions due to API failures folded silently into scores) | Recruiters make hiring-adjacent decisions on a summary that may be masking data-quality issues | Surface data-quality caveats in the dashboard itself (e.g., "N questions could not be auto-graded this period") rather than presenting a falsely-clean summary |

## "Looks Done But Isn't" Checklist

- [ ] **F-03 fix (grading-engine.ts sync):** Often "fixed" by just updating the mirror's open-text branch to match today's `Code.gs` behavior — verify there's also a regression test that would fail if the two diverge *again* in the future (Pitfall 9), not just a one-time correction.
- [ ] **F-04 admin auth tests:** Often "added" by writing tests against a reimplemented local copy of the auth check (as `test_admin.ts` currently does) — verify the tests import and exercise the real `Code.gs` authorization logic (via an extracted, testable module), not a parallel copy (Pitfall 10).
- [ ] **Async report flow:** Often "async" only in the sense that email sending is deferred, while grading itself (including all LLM calls) still happens synchronously inside the request that created the attempt — verify grading itself is trigger-driven and the candidate-facing acknowledgment returns before any LLM call is made (Pitfall 1).
- [ ] **Fullscreen-exit "lock":** Often implemented as event listeners that appear to work in casual testing (because the developer didn't actually press Esc) — verify by explicitly testing Esc/F11/Alt-Tab and confirming the feature is documented internally as detect-and-flag, not prevent (Pitfall 5).
- [ ] **Recruiter-visible LLM transcript/verdict:** Often shipped as just the score/boolean without the actual rationale text, or with rationale generated but not persisted anywhere retrievable later — verify the full rationale is stored per-answer and viewable historically, not just at grading time (Pitfall 6).
- [ ] **Recruiter override capability:** Often shipped as a UI control that changes displayed data without a durable, attributable audit log entry — verify every override writes a permanent record of who, when, from-what, to-what, and why (Pitfall 6, Pitfall 10).
- [ ] **Email delivery (candidate + recruiter team):** Often "done" once a happy-path test send succeeds, without any handling for quota exhaustion or partial-recipient failure — verify there's a distinct email-status field and a retry path, not just a fire-and-forget send (Pitfall 4).
- [ ] **CI test enforcement:** Often assumed to exist because a test suite and `npm test` script exist — verify the actual GitHub Actions workflow invokes `npm test` (it currently does not) (Pitfall 9).
- [ ] **F-06 dead legacy `frontend/` removal:** Verify removal doesn't just mean "stop linking to it" but actually deletes `frontend/app.js`, `frontend/index.html`, `frontend/style.css` from the repo, since dead-but-present code is a recurring source of confusion about which implementation is authoritative (confirmed still present as of this research pass).

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Grading trigger exceeds 6-minute limit mid-backlog | MEDIUM | Add batch-size cap to the trigger function; add a `grading_in_progress`-with-timestamp state so stuck rows past a threshold get reclaimed by the next run instead of stuck forever |
| Trigger-count/runtime quota exhausted | LOW-MEDIUM | Consolidate to a single recurring trigger if per-attempt triggers were mistakenly created; audit `ScriptApp.getProjectTriggers()` and delete duplicates |
| MailApp daily quota exceeded, backlog of unsent report emails | LOW | Since `email_status` is tracked separately (per Pitfall 4's fix), the next day's quota reset naturally resumes sending backlogged rows — no data loss if grading and email are properly decoupled |
| Fullscreen "lock" shipped as a broken prevention claim | LOW | Reframe UI copy and internal documentation to detect-and-flag; no data migration needed, this is a framing/UX fix, not a data fix |
| LLM grading mirror drifts again after F-03 | LOW (if divergence test exists) / MEDIUM (if not) | With a divergence test in place (Pitfall 9's fix), a future drift fails CI immediately and is a same-day fix; without it, requires manual side-by-side re-audit of both files |
| Candidate-facing "fully automated" copy discovered to be stale/inaccurate post-launch | LOW | Straightforward copy update; no backend change needed, but consider whether any already-emailed reports need a retroactive clarification depending on how prominently the old claim was made |
| Fail-open LLM grading discovered to have inflated a cohort of scores during a past outage window | MEDIUM-HIGH | Requires identifying affected attempts by timestamp correlation with known API outage windows (harder after the fact if ungraded state wasn't tracked separately at the time — this is why Pitfall 8's prevention matters) and potentially re-grading or flagging those reports for recruiter re-review |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| 1. Synchronous grading hits 6-min execution ceiling | Async grading + report flow phase | Load-test submission with full expanded open-text share + simulated slow LLM provider; confirm candidate-facing response returns before any LLM call starts |
| 2. Per-attempt trigger creation exhausts trigger quota | Async grading + report flow phase | Code review confirms exactly one `ScriptApp.newTrigger()` call exists at setup time, none inside request/trigger handlers |
| 3. Concurrent Sheets read-modify-write races | Async grading + report flow phase | Code review confirms `LockService` wraps all `Attempts` row read-modify-write sequences; manual concurrent-submission test shows no clobbered rows |
| 4. MailApp/GmailApp quota silently exhausted | Async grading + report flow phase | Confirm distinct `email_status` field exists, failures are caught and logged, and a daily-send counter/safety margin is implemented |
| 5. Fullscreen "lock" is technically infeasible | Proctoring upgrade phase | Manual test: press Esc/F11 during a fullscreen-locked test session and confirm the feature is documented/labeled as detect-and-flag, not prevent |
| 6. LLM hiring bias/defensibility risk | Expand LLM-graded open-text share phase | Confirm versioned rubric artifact exists per question, rationale text (not just score) is persisted per answer, and recruiter override is logged with who/when/from/to/why |
| 7. Silent reversal of "no LLM grading" candidate-facing guarantee | Expand LLM-graded open-text share phase (paired copy task) | Audit all candidate-facing text for stale "fully automated"/"no human review" claims before phase sign-off |
| 8. Fail-open LLM grading inflates/masks scores inconsistently | Expand LLM-graded open-text share phase (alongside F-03 fix) | Confirm "ungraded" is a distinct, visible state (report + analytics), never merged into "correct"; test coverage exists for the LLM-unavailable path |
| 9. Grading mirror can drift again post-F-03 | F-03/F-04 bug-fix phase | CI workflow runs `npm test` on every PR; a dedicated divergence test exists comparing `grading-engine.ts` output against Code.gs-equivalent expectations for open-text cases |
| 10. Admin-auth tests validate a reimplementation, not real code | F-03/F-04 bug-fix phase (coordinated with admin dashboard phase) | `test_admin.ts` imports and exercises the actual extracted auth-check function used by `Code.gs`, not a locally redefined constant/function |

## Sources

- Direct codebase read: `backend/Code.gs` (doGet/doPost routers, `evaluateOpenTextBatch`, `handleSubmitAnswers`, `handleGetAttemptReport`/`handleAdminListCandidates`/`handleAdminResetAttempt` auth checks, `ADMIN_TOKEN` constant, absence of `LockService`/`MailApp`/`GmailApp`/`ScriptApp.newTrigger` usage) — HIGH confidence, first-party source.
- Direct codebase read: `tests/grading/grading-engine.ts` (confirmed hardcoded `isCorrect = true` for open-text, diverging from `Code.gs`'s LLM-graded path) — HIGH confidence.
- Direct codebase read: `tests/admin/test_admin.ts` (confirmed local reimplementation of `ADMIN_TOKEN`/`validatePasscode` rather than testing production code) — HIGH confidence.
- Direct codebase read: `assessment-app/src/components/TestScreen.tsx`, `AssemblyScreen.tsx` (confirmed fullscreen-exit is currently silently logged only, not blocked; confirmed BlazeFace CDN load-order fragility already documented in code comments) — HIGH confidence.
- Direct codebase read: `assessment-app/src/components/ReportScreen.tsx` (confirmed near-total absence of ARIA landmarks/roles, only one heading element found) — HIGH confidence.
- Direct codebase read: `.github/workflows/deploy.yml`, root `package.json`, `assessment-app/package.json` (confirmed CI only builds/deploys the frontend and never runs `npm test`, despite a real Vitest suite existing) — HIGH confidence.
- Direct codebase read: `frontend/app.js`, `frontend/index.html`, `frontend/style.css` (confirmed still present, F-06 target) — HIGH confidence.
- Direct codebase read: `.planning/PROJECT.md` (v1.0 "zero human grading" / "fully automated" language, v1.1 milestone scope and Key Decisions table) — HIGH confidence, first-party source.
- MDN Web Docs, Fullscreen API Guide (fetched live during this research pass): confirmed Escape/F11 always exit fullscreen regardless of script behavior, by design, as a browser security guarantee — HIGH confidence, verified against current documentation.
- Google Apps Script quotas (execution time limits, trigger count/runtime quotas, `MailApp`/`GmailApp` daily send limits, `UrlFetchApp` call limits): based on long-stable, well-documented Apps Script platform limits; live verification against `developers.google.com/apps-script/guides/services/quotas` was blocked in this research session — MEDIUM confidence, **recommend re-confirming exact current figures before finalizing the async-pipeline and email-quota-handling design**.
- Hiring-AI legal/fairness landscape (automated employment decision tool bias-audit obligations in some US jurisdictions, EU AI Act high-risk classification trend for hiring tools, general adverse-impact/disparate-treatment framing): based on general, evolving regulatory knowledge — MEDIUM confidence, directional only, **not legal advice**; recommend the business owner confirm current applicable obligations for the specific jurisdiction(s) candidates are hired in before relying on this milestone's safeguards as sufficient.
- Prior version of this file (v1.0 research, 2026-07-29): answer-key leakage, quota-sampling, retake-gaming, client-side integrity over-trust, and psychometric-validity-overclaiming pitfalls were researched and largely addressed in phases 1-6; superseded by this v1.1-scoped revision but available in git history if needed for reference.

---
*Pitfalls research for: Hiring/candidate-assessment platform, v1.1 milestone (async reporting, recruiter analytics, proctoring upgrade, LLM grading expansion, bug fixes) — Google Apps Script + static-export frontend stack*
*Researched: 2026-07-31*
