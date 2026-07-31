# Phase 9: Async Grading & Report Delivery Pipeline - Research

**Researched:** 2026-07-31
**Domain:** Google Apps Script async job queue (Sheet-as-queue + time-driven trigger + LockService), MailApp email delivery, Next.js candidate-flow UI state
**Confidence:** MEDIUM (backend patterns cross-checked against official Apps Script docs; exact quota/account-type facts flagged as ASSUMED pending user confirmation)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Email content & format**
- D-01: Candidate email contains the full report inline in the email body (overall score, 3 trait scores, narrative insight, recommendation tier) — same detail as today's on-screen report. No link to a report page, which also sidesteps the F-01 unauthenticated-report-read risk class entirely.
- D-02: Recruiter notification email contains the same full report as the candidate's, plus the integrity/violation summary and recommendation tier highlighted, so a recruiter can act without opening the admin panel.
- D-03: Emails are sent as styled HTML (`MailApp` `htmlBody`), not plain text — matches the product's existing gamified/branded feel and makes score/tier easier to scan.
- D-04: Integrity/violation details never appear in the candidate's own email — violation info is recruiter-only, consistent with how the on-screen report already treats it as a screening signal rather than candidate-facing feedback.

**Recruiter recipient config**
- D-05: Recruiter notification addresses come from a `RECRUITER_EMAILS` Script Property, comma-separated — mirrors the existing `GEMINI_API_KEY` / `FALLBACK_API_KEY` Script Properties pattern already in `Code.gs`. No code deploy needed to add/remove recruiters.
- D-06: If `RECRUITER_EMAILS` is empty or misconfigured: log it and mark that queue item's recruiter `email_status` as `failed` (with a clear reason). Grading and the candidate email still proceed normally — a missing recruiter config must never block the candidate's flow.
- D-07: Every address in `RECRUITER_EMAILS` gets every notification — no per-recipient targeting/filtering rules.
- D-08: Recruiter emails send from the script owner's default `MailApp` sender — no custom "From" alias/display name.

**Queue cadence & failure handling**
- D-09: The `processGradingQueue` recurring trigger runs every 5 minutes — installed exactly once at setup (never per-attempt).
- D-10: Each trigger run processes up to 5 queued attempts (batch cap).
- D-11: An item that fails grading or email sending is retried; after 3 total failed attempts it stops retrying and is surfaced as `grading_failed` (a distinct `Attempts.Status` value, never silently merged into `graded`/`emailed`).
- D-12: A permanently-`grading_failed` item is surfaced in the existing admin candidate list/detail view only — no separate failure-alert email.

**ThankYouScreen copy & tone**
- D-13: Turnaround copy says "within a few minutes" rather than a specific numeric window.
- D-14: `ThankYouScreen.tsx` keeps the existing gamified/game-show tone rather than shifting to a plain/professional register.
- D-15: The screen shows confirmation + turnaround copy only — no score teaser or submission summary.
- D-16: "No polling" means no auto-refresh / no status-check request loop. Does not need to actively block back-navigation into the test.

### Claude's Discretion
- Exact `PendingGrading` sheet column layout, `email_status` enum value names, and `Attempts.Status` enum extension (`pending_grading`/`graded`/`emailed`/`grading_failed`) wiring are left to research/planning.
- Retry backoff strategy (immediate re-attempt next run vs. exponential-style spacing) within the 3-attempt cap (D-11) is left to planning, informed by what's simplest to implement reliably under `LockService`.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. Rubric-based LLM grading (Phase 10), recruiter transcript/override UI (Phase 10), and analytics (Phase 11) are explicitly out of scope for this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| ASYNC-01 | Candidate sees a "Thank You" screen immediately on submit — no instant on-screen score/report | See `ThankYouScreen.tsx` design in Architecture Patterns; `page.tsx` screen-state changes in Recommended Project Structure |
| ASYNC-02 | Grading/report computation continues server-side even if the candidate closes the tab (queue + time-driven trigger, not tied to an open connection) | See `PendingGrading` sheet schema, `processGradingQueue` trigger design, LockService pattern in Architecture Patterns and Code Examples |
| ASYNC-03 | Candidate receives an emailed report (overall score, 3 trait scores, narrative insight, recommendation tier) once grading completes | See email content-builder pattern (mirrors `ReportScreen.tsx` fields) in Architecture Patterns and Don't Hand-Roll |
| ASYNC-04 | Recruiter team receives an email per completed attempt summarizing concerns, positives, and results | See recruiter email-builder + `RECRUITER_EMAILS` parsing pattern in Code Examples |
| ASYNC-05 | Email delivery failures are tracked as a distinct status (not silently dropped) and are retryable | See `CandidateEmailStatus`/`RecruiterEmailStatus` columns + retry/stage state machine in Architecture Patterns and Common Pitfalls |

**Note on requirement status:** `.planning/REQUIREMENTS.md` lists ASYNC-01..05 as `[ ]` (not yet checked off) with traceability marked "TBD (roadmap pending)" — this is expected; the roadmap phase entry (`.planning/ROADMAP.md` §"Phase 9", lines 130-140) is the authoritative Goal/Success-Criteria source per `09-CONTEXT.md`'s `canonical_refs`, and its 5 Success Criteria map 1:1 to ASYNC-01..05 in substance. Confirmed current as of this research session (2026-07-31) — the REQUIREMENTS.md draft-status flag in CONTEXT.md is now resolved: the IDs exist and match the roadmap's success criteria.
</phase_requirements>

## Summary

This phase splits a currently-synchronous `doPost(submitAnswers)` → `handleSubmitAnswers()` code path (which calls the LLM grading batch inline) into a fast enqueue step and a deferred, trigger-driven grading+email step. The codebase already establishes clear precedent for both halves of this work: `initSheets()` shows the lazy-sheet-creation convention to follow for a new `PendingGrading` sheet, and `PropertiesService.getScriptProperties()` (lines 57-58) shows the exact pattern to follow for a new `RECRUITER_EMAILS` property. Apps Script itself provides all the primitives needed — `ScriptApp.newTrigger(...).timeBased().everyMinutes(5)` for the recurring drain, `LockService.getScriptLock()` to serialize concurrent drain runs, and `MailApp.sendEmail(to, subject, body, {htmlBody})` for styled email — with zero new npm/GAS-library dependencies.

The single highest-risk pitfall is **installing the trigger from inside a per-request code path** (e.g. `initSheets()`, which currently runs on every `doPost`/`doGet` call) — this would either spam duplicate triggers past the 20-trigger-per-script cap within minutes, or add idempotency-check overhead to every request that defeats the ~100-300ms fast-path goal. The trigger must be installed from a one-time, manually-invoked `setup`/`installGradingTrigger` function, checked for existence via `ScriptApp.getProjectTriggers()`.

The second major finding is that the roadmap's "no breaking of 6 numeric-indexed call sites" success criterion refers to exactly 6 literal `[5]`-index reads of the `Attempts.Status` column in `backend/Code.gs` (lines 309, 377, 380, 435, 636, 678) — of these, line 636 (`handleGetAttemptReport`'s `!== "submitted"` gate) and its 3 frontend consumers in `assessment-app/src/app/admin/page.tsx` (`row.status === 'submitted'` at lines 330, 355-357, 366) **must** be updated to recognize the new terminal states (`graded`/`emailed`), or the admin panel's "View Report" button and score/tier columns will silently stop appearing once submissions start landing on `pending_grading` instead of `submitted`.

**Primary recommendation:** Add a new `backend/AsyncGrading.gs` file (Apps Script projects share one global scope across files, no import needed) containing `gradeAndFinalizeAttempt`, `processGradingQueue`, `installGradingTrigger`, and the email builders — keeping `Code.gs` from growing further past its already-large size, consistent with the project's "keep files under 500 lines" convention. Mirror the new pure logic (stage/retry state machine, email content builders, recipient parsing) into `tests/async/*.ts` following the existing `grading-engine.ts`/`admin-auth.ts` precedent, since Apps Script code itself cannot run under Vitest.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fast submit acknowledgment (`doPost` enqueue) | API/Backend (Apps Script `doPost`) | Database/Storage (Sheets appendRow) | Must return in ~100-300ms; only a validate + 1 appendRow + 1 status write, no LLM call |
| Queue persistence (`PendingGrading`) | Database/Storage | — | Google Sheet acting as the durable queue; survives the candidate closing the tab (ASYNC-02) |
| Scheduled grading execution (`gradeAndFinalizeAttempt`) | API/Backend (Apps Script trigger) | Database/Storage (writes `Attempts`/`Responses`) | Server-side, trigger-driven — not tied to any open HTTP connection |
| Concurrency control | API/Backend (`LockService`) | — | Prevents two overlapping 5-min trigger firings from double-processing the same queue rows |
| Email delivery (candidate + recruiter) | API/Backend (`MailApp`, external service boundary) | — | Apps Script's only outbound-email primitive; no new paid service (per PROJECT.md constraint) |
| Candidate confirmation UI (`ThankYouScreen.tsx`) | Browser/Client (Next.js component) | — | Pure client-side confirmation state, no polling (D-16) |
| Recruiter notification content | API/Backend (built server-side) | — | Never composed client-side; violation data must never reach the candidate tier (D-04) |

## Standard Stack

### Core
| Library / Service | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ScriptApp` (built-in) | GAS V8 runtime | Install/query/delete time-driven triggers | Only mechanism for recurring server-side execution in Apps Script; no external scheduler needed |
| `LockService` (built-in) | GAS V8 runtime | Serialize the drain worker so overlapping trigger firings don't double-process | Documented, purpose-built for exactly this concurrency problem `[CITED: developers.google.com/apps-script/reference/lock/lock-service]` |
| `MailApp` (built-in) | GAS V8 runtime | Send candidate + recruiter HTML emails | Zero-cost, no-new-paid-service constraint (PROJECT.md); already scoped/authorized for this project |
| `SpreadsheetApp` (built-in) | GAS V8 runtime | `PendingGrading` sheet CRUD | Same pattern already used for `Attempts`/`Responses`/`IntegrityLogs` |
| `PropertiesService` (built-in) | GAS V8 runtime | `RECRUITER_EMAILS` script property | Direct precedent: `GEMINI_API_KEY`/`FALLBACK_API_KEY` (Code.gs lines 57-58) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | ^4.1.10 (already installed, root `package.json`) | Unit-test pure mirror logic (state machine, email content builders) | Apps Script code cannot run under Vitest directly — extract pure functions into `tests/async/*.ts` mirrors, same as `grading-engine.ts`/`admin-auth.ts` |
| `framer-motion` | ^12.43.0 (already installed, `assessment-app/package.json`) | `ThankYouScreen.tsx` transitions | Already the animation library used by every other screen (`ReportScreen.tsx`, etc.) — no new dependency |
| `@phosphor-icons/react` | ^2.1.10 (already installed) | Confirmation icon on `ThankYouScreen.tsx` | Already used elsewhere in the UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sheet-as-queue + time-driven trigger | Cloud Tasks / Pub/Sub / a real queue service | Would need a GCP project + billing + new auth surface — directly violates the "no new paid infra" constraint (PROJECT.md) and the "Apps Script trigger/queue based" architecture already locked by the roadmap |
| `MailApp` | `GmailApp` | `GmailApp` has full inbox read/send access and is more likely to trigger re-authorization prompts; `MailApp` is send-only and matches the "no new paid email service" constraint and the least-privilege scope already implied by existing code `[CITED: developers.google.com/apps-script/reference/mail/mail-app]` |
| Retry-count column on `PendingGrading` | Exponential-backoff timestamp column (`NextRetryAt`) | Apps Script triggers cannot be told "run this one row in N minutes" without per-row triggers (would blow the 20-trigger cap); a simple attempt-count cap (D-11: 3) checked every 5-min drain is far simpler and was explicitly left to planning's discretion as "whatever's simplest to implement reliably under LockService" |

**Installation:**
No new packages to install. This phase is 100% built-in Apps Script services on the backend and already-installed dependencies on the frontend.

**Version verification:** N/A — no new npm/PyPI/crates packages introduced by this phase. Existing root `package.json` (vitest ^4.1.10, tsx ^4.23.1, typescript ^7.0.2) and `assessment-app/package.json` (next 16.2.12, react 19.2.4, framer-motion ^12.43.0) verified by direct `Read` of both files during this research session — versions current as installed, no registry check needed since no new packages are added.

## Package Legitimacy Audit

**No new packages are introduced by this phase.** Apps Script backend work uses only built-in GAS services (`MailApp`, `LockService`, `ScriptApp`, `SpreadsheetApp`, `PropertiesService`) which are part of the runtime and have no registry/package-legitimacy surface. Frontend `ThankYouScreen.tsx` reuses `framer-motion` and `@phosphor-icons/react`, both already installed and in production use elsewhere in `assessment-app/`. The Package Legitimacy Gate protocol is not applicable — this section is intentionally empty of table rows.

**Packages removed due to [SLOP] verdict:** none (N/A — no packages evaluated)
**Packages flagged as suspicious [SUS]:** none (N/A — no packages evaluated)

## Architecture Patterns

### System Architecture Diagram

```
CANDIDATE BROWSER                    APPS SCRIPT (server)                    GOOGLE SHEETS (storage)
──────────────────                   ─────────────────────                   ────────────────────────

TestScreen.tsx
   │ submit answers
   ▼
fetch POST                           doPost(action=submitAnswers)
  action:submitAnswers  ───────────▶   1. find Attempts row by attemptId
                                      2. validate Status === "active"        Attempts sheet
                                         (idempotency guard: if already      ┌──────────────────┐
                                         pending_grading/graded/emailed,     │ ...existing cols  │
                                         short-circuit, don't re-enqueue)    │ Status (col F/idx5)│
                                      3. appendRow to PendingGrading  ──────▶│  "active"          │
                                      4. write Status="pending_grading"  ──▶│  → "pending_grading"│
                                      5. return fast ack (~100-300ms)       └──────────────────┘
   ◀─── { success:true,
          status:"pending_grading" }                                        PendingGrading sheet (NEW)
   │                                                                        ┌──────────────────────┐
   ▼                                                                        │ AttemptID             │
ThankYouScreen.tsx                                                         │ SubmittedAnswersJSON  │
 (D-13/14/15/16:                                                           │ Stage: "queued"       │
  confirmation only,                                                       │ AttemptsCount: 0      │
  no polling, no score                                                     │ CandidateEmailStatus  │
  teaser, gamified tone)                                                   │ RecruiterEmailStatus  │
                                                                             └──────────────────────┘
                                                                                      ▲
                                                                                      │ appendRow (fast path)
                                                                                      │
                                      ┌───────────────────────────────────────────────┘
                                      │
                              [every 5 min — ScriptApp time-driven trigger, D-09]
                                      │
                                      ▼
                              processGradingQueue()
                                 1. LockService.getScriptLock().tryLock(short timeout)
                                    → if not acquired, exit (another run in progress)
                                 2. read up to 5 "queued"/retry-eligible rows (D-10)
                                 3. for each row (try/catch — one failure doesn't
                                    sink the batch):
                                    a. if Stage !== "graded":
                                       gradeAndFinalizeAttempt(attemptId, answers)
                                         → evaluateOpenTextBatch (LLM calls, now OFF
                                           the request path)
                                         → write scores/tier/narrative to Attempts
                                         → Attempts.Status = "graded"
                                         → PendingGrading.Stage = "graded"
                                    b. send candidate email (MailApp htmlBody, D-01/03)
                                       → CandidateEmailStatus = sent | failed | retried
                                    c. send recruiter email(s) (RECRUITER_EMAILS,
                                       D-02/04/05/07/08)
                                       → RecruiterEmailStatus = sent | failed | retried
                                       → misconfigured RECRUITER_EMAILS never blocks (c)
                                         from marking candidate email done (D-06)
                                    d. if candidate email sent: Attempts.Status="emailed"
                                    e. on failure: AttemptsCount++; if AttemptsCount >= 3
                                       (D-11): Stage="permanently_failed",
                                       Attempts.Status="grading_failed" (surfaced in
                                       admin panel only, D-12 — no alert email)
                                 4. lock.releaseLock() in finally

                                                              Admin Panel (existing,
                                                              unaffected auth model)
                                                              — reads Attempts.Status;
                                                              MUST recognize "graded"/
                                                              "emailed"/"grading_failed"
                                                              in addition to legacy
                                                              "submitted"
```

### Recommended Project Structure
```
backend/
├── Code.gs                    # existing — doPost/doGet dispatch shrinks: submitAnswers
│                               #   branch becomes fast-enqueue only; handleGetAttemptReport's
│                               #   "submitted"-only gate (line 636) updated to accept the new
│                               #   terminal statuses
├── AsyncGrading.gs             # NEW — gradeAndFinalizeAttempt, processGradingQueue,
│                               #   installGradingTrigger, PendingGrading init, email builders.
│                               #   Same global scope as Code.gs (GAS shares one namespace
│                               #   across .gs files, no import needed) [CITED: web search
│                               #   cross-referencing developers.google.com/apps-script/guides/projects]
tests/
├── grading/                    # existing, unchanged
├── admin/                      # existing, unchanged
├── async/                      # NEW — mirrors AsyncGrading.gs pure logic (no SpreadsheetApp/
│   ├── queue-logic.ts          #   MailApp deps), same pattern as grading-engine.ts
│   ├── email-content.ts        #   Pure builders: buildCandidateEmail(report),
│   │                           #   buildRecruiterEmail(report, integritySummary),
│   │                           #   parseRecruiterEmails(propertyValue)
│   ├── test_queue.ts           # NEW vitest suite — stage transitions, retry cap, batch selection
│   └── test_email.ts           # NEW vitest suite — content assertions (D-01/02/04), recipient parsing
scripts/
├── sync-check.ts               # EXTEND — add checks for retry cap (3), batch cap (5),
│                               #   trigger interval (5 min) matching between AsyncGrading.gs
│                               #   and tests/async/queue-logic.ts, same precedent as the
│                               #   existing grading-engine.ts divergence checks
assessment-app/src/
├── components/
│   ├── ReportScreen.tsx        # UNCHANGED — stays admin-only (still used by admin/page.tsx)
│   └── ThankYouScreen.tsx      # NEW — confirmation-only screen (D-13/14/15/16)
├── app/
│   └── page.tsx                # MODIFIED — screen union drops 'report', adds 'thankyou';
│                                #   handleTestSubmit no longer sets reportData; submitAnswers
│                                #   response no longer carries a `report` field
```

### Pattern 1: Idempotent Trigger Installation (never per-request)
**What:** A one-time setup function that checks for an existing trigger by handler-function name before creating a new one.
**When to use:** Any recurring/time-driven trigger. Must NEVER be called from `doPost`/`doGet`/`initSheets` (all of which run on every request).
**Example:**
```javascript
// Source: developers.google.com/apps-script/reference/script/script-app (cross-checked via WebSearch)
function installGradingTrigger() {
  const FN = 'processGradingQueue';
  const already = ScriptApp.getProjectTriggers()
    .some(t => t.getHandlerFunction() === FN);
  if (already) return; // idempotent — safe to run this function more than once
  ScriptApp.newTrigger(FN).timeBased().everyMinutes(5).create(); // D-09; n must be 1/5/10/15/30
}
// Run installGradingTrigger() ONCE manually from the Apps Script editor at deploy/setup time.
// Do NOT call it from initSheets() or doPost/doGet.
```

### Pattern 2: LockService-guarded drain worker with batch cap
**What:** The recurring trigger handler acquires a script-wide lock with a short, non-blocking timeout; if it can't acquire the lock, another run is already in progress and it exits immediately rather than queuing up.
**When to use:** Any trigger-driven worker that reads/writes shared Sheet state and could overlap with itself if a run takes close to its cadence interval.
**Example:**
```javascript
// Source: developers.google.com/apps-script/reference/lock/lock-service (cross-checked via WebSearch)
function processGradingQueue() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return; // another run is already draining — exit, don't stack up
  try {
    const rows = selectBatch(readPendingGradingRows(), 5); // D-10: batch cap
    rows.forEach(row => {
      try {
        processQueueItem(row); // grading + emails + stage transitions, see Pattern 3
      } catch (err) {
        recordFailure(row, err); // one bad row must not sink the whole batch
      }
    });
  } finally {
    lock.releaseLock();
  }
}
```

### Pattern 3: Stage-separated retry (don't re-grade on email retry)
**What:** Split queue-item processing into a `Stage` field (`queued` → `graded` → `done`/`permanently_failed`) so a retry after an email failure does NOT re-run the LLM grading step (avoids duplicate LLM cost and duplicate/inconsistent scores).
**When to use:** Any multi-step async job where an earlier step is expensive/non-idempotent and a later step is what's actually retried most often (email delivery, in this case).
**Example:**
```javascript
function processQueueItem(row) {
  if (row.stage !== 'graded') {
    gradeAndFinalizeAttempt(row.attemptId, JSON.parse(row.submittedAnswersJson)); // writes Attempts scores, sets Attempts.Status="graded"
    setStage(row, 'graded');
  }
  const report = buildReportFromAttemptsRow(row.attemptId); // reuses handleGetAttemptReport's shape
  sendCandidateEmailIfNeeded(row, report);   // D-01/03 — idempotent: skip if already CandidateEmailStatus="sent"
  sendRecruiterEmailIfNeeded(row, report);   // D-02/04/05/06/07/08 — independent status, never blocks candidate path
  if (row.candidateEmailStatus === 'sent') {
    setAttemptsStatus(row.attemptId, 'emailed');
    setStage(row, 'done');
  }
}
```

### Pattern 4: Backward-compatible report-readiness check
**What:** Update the single `!== "submitted"` gate (`handleGetAttemptReport`, Code.gs line 636) — and its 3 frontend consumers in `assessment-app/src/app/admin/page.tsx` (`isSubmitted` at line 330, status-badge coloring at 355-357, "View Report" button gate at 366) — to recognize the new terminal states while still honoring any pre-existing rows.
**Example:**
```javascript
const READY_STATUSES = ['submitted', 'graded', 'emailed']; // "submitted" kept for backward compat
                                                              // with any rows written before this phase shipped
if (!READY_STATUSES.includes(data[i][5])) {
  return { success: false, error: "Report is not available yet" };
}
```
```tsx
// assessment-app/src/app/admin/page.tsx
const READY_STATUSES = ['submitted', 'graded', 'emailed'];
const isSubmitted = READY_STATUSES.includes(row.status);
```

### Anti-Patterns to Avoid
- **Installing the trigger inside `initSheets()` or `doPost`:** `initSheets()` currently runs at the top of every `doPost`/`doGet` call (Code.gs line 214). Putting `ScriptApp.newTrigger(...)` there — even with an idempotency check — either races two concurrent requests past the check-then-create window, or adds an unnecessary `getProjectTriggers()` scan to every request, defeating the ~100-300ms goal.
- **Re-running `gradeAndFinalizeAttempt` on every retry:** if grading itself is retried whenever only the *email* step failed, LLM calls are repeated (cost) and there's a risk of re-computing slightly different scores if `evaluateOpenTextBatch`'s non-deterministic fallback path is hit twice (see existing scoring-purity concern noted elsewhere in the codebase's history). Use Pattern 3's stage separation instead.
- **`waitLock()` with a long timeout in the trigger handler:** a long `waitLock` inside a 5-minute-cadence trigger risks the *next* scheduled firing queuing up behind the lock rather than skipping cleanly, effectively serializing runs back-to-back instead of skipping overlapping ones. Prefer a short `tryLock` and exit immediately (Pattern 2).
- **Sending the recruiter notification as N separate `MailApp.sendEmail` calls when a single call with multiple `to` recipients would do:** either approach consumes the same total recipient-quota count, but N separate calls also multiply `email_status` bookkeeping complexity for no benefit given D-07 (every recruiter gets the identical email).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recurring background execution | A custom "poll every N seconds" loop, a `setTimeout`-style self-rescheduling function, or a Cloud Function | `ScriptApp.newTrigger(...).timeBased().everyMinutes(5)` | Apps Script has no persistent process — only installable triggers survive across executions; this is the only supported recurring-execution primitive `[CITED: developers.google.com/apps-script/reference/script/clock-trigger-builder]` |
| Concurrency control across trigger firings | A manual "IsRunning" flag column checked/set without atomicity | `LockService.getScriptLock()` | A hand-rolled flag has a check-then-set race condition; `LockService` is purpose-built and atomic at the platform level |
| Retry/backoff scheduling | A "run this row again in N minutes" mechanism using per-row triggers or `Utilities.sleep()` | A simple attempt-count column checked every fixed-cadence drain (D-11: cap at 3) | Per-row triggers would blow the 20-trigger-per-script cap under any real candidate volume; `Utilities.sleep()` inside a trigger just burns execution-time budget without actually deferring anything across runs |
| Email templating | Hand-built string concatenation prone to unescaped HTML / broken markup | A single shared `buildReportHtml(report, { includeViolations })` helper reused by both candidate (D-01/04: excludes violations) and recruiter (D-02: includes violations) builders | Keeping one shared template with an `includeViolations` flag guarantees the two emails can never drift out of sync on the shared fields, and makes the D-04 exclusion a single boolean rather than two independently-maintained templates |

**Key insight:** Apps Script deliberately has no persistent background process, no native job queue, and no cross-execution sleep/backoff — every "async" pattern in this environment is actually *stateless trigger + durable Sheet state*, re-read from scratch on every firing. Fighting this by trying to simulate long-running processes (self-rescheduling triggers, sleep loops, per-item triggers) reliably runs into the 20-trigger cap or the 6-minute execution cap; embracing the stateless-drain model (Patterns 1-3 above) is both simpler and is what the roadmap's Success Criteria already describe.

## Runtime State Inventory

> Phase extends the `Attempts.Status` enum and changes what value gets written at submit time (`"submitted"` → `"pending_grading"`, with `"graded"`/`"emailed"` as new terminal states). This is a semantic change to a stored-data field, not a pure code refactor, so this inventory applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **Unconfirmed** — this research session had no access to the live Google Sheet backing the deployed Apps Script project. If any candidates have already completed the assessment under the pre-Phase-9 synchronous flow, their `Attempts.Status` will already read `"submitted"`. | Code edit only, no forced migration: adopt Pattern 4 (backward-compatible `READY_STATUSES` check) rather than requiring a one-time backfill of existing rows from `"submitted"` to `"emailed"`. This is the simplest option and requires zero manual Sheet edits. Flag for the planner to confirm with the user whether any live rows exist before finalizing. |
| Live service config | None found — the Apps Script Web App deployment itself, and its existing `GEMINI_API_KEY`/`FALLBACK_API_KEY` Script Properties, are unaffected by this phase. `RECRUITER_EMAILS` is a **new** property being added, not a rename of existing config. | None for existing config. New: document that `RECRUITER_EMAILS` must be set in Script Properties post-deploy (D-05) — this is a manual one-time setup step for whoever owns the Apps Script project, same as the existing `GEMINI_API_KEY` setup step already required for grading to work at all. |
| OS-registered state | None — Apps Script triggers are registered *inside* the Apps Script project itself (via `ScriptApp`), not in any OS-level scheduler (no cron/Task Scheduler/launchd involved). | None. |
| Secrets/env vars | None renamed. `RECRUITER_EMAILS` is additive. | None for existing secrets. New property to add at setup time (see above). |
| Build artifacts | None — Apps Script has no build/bundle step (`.gs` files are pushed directly, e.g. via `clasp` or the web editor). `assessment-app/` is a standard Next.js build, structurally unaffected by adding one new component and modifying `page.tsx`'s state. | None. |

## Common Pitfalls

### Pitfall 1: Trigger installed from a per-request code path
**What goes wrong:** Duplicate `processGradingQueue` triggers get created — either hitting the 20-trigger-per-script cap within minutes under any real traffic, or (if idempotency-checked) adding a `getProjectTriggers()` scan to every single `doPost`/`doGet`, undermining the ~100-300ms fast-path goal that's the whole point of this phase.
**Why it happens:** `initSheets()` (Code.gs line 214) already runs unconditionally at the top of both `doPost` and `doGet` today — it's a natural but wrong place to also drop trigger-installation logic, since it "already runs on every request anyway."
**How to avoid:** Trigger installation lives in its own function (`installGradingTrigger`), run exactly once manually (Apps Script editor "Run" button, or a one-off `?action=installTrigger` admin-only endpoint gated by `checkAdminAuth`), never from `initSheets`/`doPost`/`doGet`.
**Warning signs:** `ScriptApp.getProjectTriggers().length` growing over time in the Apps Script "Triggers" dashboard; `doPost` latency creeping up even for the fast-enqueue path.

### Pitfall 2: MailApp daily recipient quota exhaustion
**What goes wrong:** Every completed attempt consumes `1 (candidate) + N (RECRUITER_EMAILS count)` of `MailApp`'s daily recipient quota. Consumer/free Gmail accounts are capped at **100 recipients/day**; Workspace accounts get **1,500/day** (2,000 within-domain) `[CITED: web search results cross-referencing developers.google.com/apps-script/guides/services/quotas]`. With 3 recruiter addresses configured, a consumer account hits its quota after only ~25 completed attempts in a single day — after which candidate emails silently start failing too (not just recruiter emails), directly undermining ASYNC-03.
**Why it happens:** The quota is easy to overlook because it doesn't manifest until real usage volume; local/manual testing during development rarely sends enough emails to notice.
**How to avoid:** Check `MailApp.getRemainingDailyQuota()` before sending; if insufficient, leave the item at its current stage (don't increment the retry-failure counter — this isn't the item's fault) and let the next day's quota reset pick it up on a subsequent 5-min drain. Confirm with the user which Google account type (consumer vs Workspace) the Apps Script project is deployed under — this materially changes how much headroom exists.
**Warning signs:** `RecruiterEmailStatus`/`CandidateEmailStatus` flipping to `failed` in bursts correlated with high daily attempt volume rather than individual delivery errors.

### Pitfall 3: Double-enqueue from a retried/duplicate `submitAnswers` request
**What goes wrong:** If the candidate's browser retries a timed-out `POST` (or the tab is closed and reopened mid-request), a second `doPost(submitAnswers)` for the same `attemptId` could append a second `PendingGrading` row, causing duplicate grading and duplicate candidate/recruiter emails.
**Why it happens:** The fast-enqueue path is new; nothing currently checks "has this attempt already been enqueued" before appending.
**How to avoid:** The existing `attemptRow[5] !== "active"` check (Code.gs line 435) already provides this guard almost for free — once the first successful `doPost` call flips `Status` to `"pending_grading"`, a second call for the same `attemptId` will see `Status !== "active"` and can short-circuit to an idempotent "already submitted" success response instead of re-appending to `PendingGrading`.
**Warning signs:** Two `PendingGrading` rows sharing the same `AttemptID`; a candidate reporting two report emails.

### Pitfall 4: `handleGetAttemptReport` / admin panel silently stop showing reports
**What goes wrong:** `handleGetAttemptReport`'s `data[i][5] !== "submitted"` gate (Code.gs line 636) and the admin frontend's `row.status === 'submitted'` checks (`assessment-app/src/app/admin/page.tsx` lines 330, 355-357, 366) will never match once submissions land on `"pending_grading"` → `"graded"` → `"emailed"` instead of `"submitted"`. The "View Report" button disappears, the score/tier columns show `-`, and the status badge falls into the wrong (blue "active"-style) color bucket for every future candidate.
**Why it happens:** These are 4 of the 6 `[5]`-indexed reads of `Attempts.Status` in the codebase (see Summary) — easy to miss if the planner only updates the *write* side (doPost/gradeAndFinalizeAttempt) and not the *read* side.
**How to avoid:** Apply Pattern 4 (backward-compatible `READY_STATUSES` list) to both the backend gate and all 3 frontend call sites in the same plan/wave that introduces the new enum values.
**Warning signs:** Admin panel showing "-" for score/tier on every new candidate after this phase ships, even though grading clearly completed (visible in the Sheet directly).

### Pitfall 5: First trigger-driven execution fails on authorization, not logic
**What goes wrong:** A newly-installed time-driven trigger runs `processGradingQueue` which calls `MailApp.sendEmail` (requires `script.send_mail` scope) and `UrlFetchApp.fetch` (external-request scope, used inside `evaluateOpenTextBatch`). If the project's authorization for these scopes hasn't been explicitly granted under the account that owns the trigger, the trigger-driven run fails silently/logs an authorization error rather than sending anything.
**Why it happens:** Deploying the Web App and manually testing `doPost`/`doGet` via a browser or Postman doesn't necessarily exercise every scope a trigger-driven function will need; trigger executions always run as the trigger's *owner*, not as "anyone" (unlike the deployed web app itself, which may be set to run as "me" but be accessible to "anyone").
**How to avoid:** After calling `installGradingTrigger()`, manually run `processGradingQueue()` once from the Apps Script editor's "Run" button under the owning account, to force the one-time OAuth consent dialog before relying on the 5-minute trigger to fire it unattended.
**Warning signs:** Trigger shows as installed in the "Triggers" dashboard and fires on schedule (visible in "Executions" log), but every execution errors out immediately with an authorization exception.

### Pitfall 6: A single slow/failing queue item stalls the whole 6-minute batch
**What goes wrong:** If `gradeAndFinalizeAttempt` for one row throws (e.g. LLM timeout) without being individually caught, the entire `processGradingQueue` execution aborts — the other up-to-4 items in the batch (D-10) never get processed that run, and the lock is only released via `finally` if the surrounding structure is correct.
**Why it happens:** It's tempting to write a simple `rows.forEach(row => processQueueItem(row))` without a per-item `try/catch`, especially since none of the existing synchronous handlers in Code.gs needed per-item fault isolation (they process one attempt per request, not a batch).
**How to avoid:** Wrap each item's processing individually (Pattern 2's example already shows this) so one bad row increments *that row's* `AttemptsCount` and moves on, rather than sinking the batch.
**Warning signs:** Trigger "Executions" log shows a run erroring out with only 1 of 5 items ever getting a `Stage` update.

## Code Examples

### `PendingGrading` sheet initialization (follows existing `initSheets()` convention)
```javascript
// Source: pattern mirrors backend/Code.gs initSheets() (lines 243-269) exactly
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // ...existing Attempts/Responses/IntegrityLogs blocks unchanged...

  let pendingSheet = ss.getSheetByName("PendingGrading");
  if (!pendingSheet) {
    pendingSheet = ss.insertSheet("PendingGrading");
    pendingSheet.appendRow([
      "AttemptID", "SubmittedAnswersJSON", "EnqueuedAt", "Stage",
      "AttemptsCount", "LastError", "LastAttemptAt",
      "CandidateEmailStatus", "RecruiterEmailStatus"
    ]);
    pendingSheet.getRange("A1:I1").setFontWeight("bold").setBackground("#e2e8f0");
  }
}
```

### `RECRUITER_EMAILS` parsing (mirrors the `GEMINI_API_KEY` Script Property pattern)
```javascript
// Source: pattern mirrors backend/Code.gs lines 57-58 exactly
const RECRUITER_EMAILS_RAW = PropertiesService.getScriptProperties().getProperty("RECRUITER_EMAILS") || "";

function parseRecruiterEmails(raw) {
  return raw.split(",").map(s => s.trim()).filter(s => s.length > 0); // D-06: empty/misconfigured → []
}
```

### MailApp htmlBody send (D-03)
```javascript
// Source: developers.google.com/apps-script/reference/mail/mail-app (cross-checked via WebSearch)
MailApp.sendEmail(candidateEmail, "Your Fraud Support Assessment Results", "", {
  htmlBody: buildReportHtml(report, { includeViolations: false }) // D-04
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `doPost(submitAnswers)` grades synchronously inline (including LLM calls via `evaluateOpenTextBatch`) | `doPost` fast-enqueues to `PendingGrading`; grading + emailing happens in a separate trigger-driven `gradeAndFinalizeAttempt` call | This phase (Phase 9) | Request latency drops from however long the LLM batch call takes (variable, network-dependent) to ~100-300ms; candidate no longer waits on an open connection for grading |
| Candidate sees `ReportScreen.tsx` immediately with live score/tier/narrative | Candidate sees `ThankYouScreen.tsx` (confirmation only); score/tier/narrative arrive only via email | This phase (Phase 9) | Removes the F-01 unauthenticated-report-read risk class entirely for the candidate-facing flow (no report-fetch endpoint is ever called from the candidate browser) |
| `Attempts.Status` only ever `"active"` or `"submitted"` | Extended to `"active"` → `"pending_grading"` → `"graded"` → `"emailed"`, or `"grading_failed"` on permanent failure | This phase (Phase 9) | All 6 `[5]`-indexed reads of this column (Code.gs) and all admin-frontend consumers of `row.status` must account for the new values |

**Deprecated/outdated:** The synchronous-grading code path inside `handleSubmitAnswers` (the scoring loop, lines 475-624 in Code.gs) is not deleted — it's extracted into `gradeAndFinalizeAttempt` and called from the trigger instead of from `doPost` directly. The *shape* of what it returns (the `report` object) is unchanged; only *when* and *from where* it runs changes.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | The Apps Script project's Google account type (consumer/free Gmail vs. Google Workspace) is unknown to this research session — quota figures (100 vs 1,500 recipients/day) were taken from general Apps Script documentation, not confirmed against this specific deployment. | Common Pitfalls (Pitfall 2), Standard Stack | If the account is consumer-tier and candidate volume + recruiter count is high, candidate emails (not just recruiter emails) could start silently failing well before anyone notices — directly breaks ASYNC-03. Planner should have the user confirm account type before finalizing batch-cap/quota-check logic. |
| A2 | Whether the live `Attempts` sheet already contains rows with `Status === "submitted"` from pre-Phase-9 candidate attempts is unconfirmed (this research session had no access to the deployed Google Sheet). | Runtime State Inventory | If historical `"submitted"` rows exist and the backward-compatible `READY_STATUSES` check (Pattern 4) isn't applied, those candidates' reports become permanently inaccessible via `handleGetAttemptReport`/admin panel. |
| A3 | `RECRUITER_EMAILS` Script Property has not yet been set in the live deployment (assumed not configured, since it's a brand-new property introduced by this phase). | Runtime State Inventory, Locked Decisions D-05/D-06 | If planning assumes it's already set and doesn't include an explicit setup step/checkpoint, the first live run after deploy will hit the D-06 "misconfigured" path for every attempt until someone manually sets it. |
| A4 | Multiple `.gs` files in one Apps Script project share a single global scope automatically (no import statements) — confirmed via WebSearch cross-referencing `developers.google.com/apps-script/guides/projects`, not verified by directly reading that specific page (which 404'd during this session). | Recommended Project Structure (`AsyncGrading.gs` split) | Low risk — this is long-established, widely-documented Apps Script behavior; if somehow wrong, worst case is a straightforward compile-time "function not found" error caught immediately during first test/deploy, not a silent runtime issue. |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Does the live deployment already have candidate attempts with `Status === "submitted"`?**
   - What we know: The codebase and product have clearly been in use (docx question banks, backup folders, a functioning admin panel) — real usage is plausible.
   - What's unclear: Whether the specific live Google Sheet backing the current deployment has any rows yet, and if so how many.
   - Recommendation: Planner/user should check the live Sheet directly (or the user can confirm from memory) before deciding whether Pattern 4's backward-compatible check is sufficient or whether a one-time backfill script is warranted. Given zero migration risk either way (Pattern 4 handles both cases), this doesn't need to block planning — just needs to be confirmed before the phase is considered "done."

2. **What Google account type (consumer vs. Workspace) hosts this Apps Script project?**
   - What we know: `MailApp` quotas differ by roughly 15x between the two tiers (100 vs 1,500 recipients/day).
   - What's unclear: Which tier applies here, and therefore how urgently the `getRemainingDailyQuota()` defer-don't-fail check (Pitfall 2) needs to be treated as a hard requirement vs. a nice-to-have.
   - Recommendation: Ask the user directly; in the meantime, plan for the `getRemainingDailyQuota()` check regardless, since it's cheap to implement and protects against both tiers' quotas equally.

3. **Should `Attempts.Status = "emailed"` require both candidate AND recruiter email success, or candidate-only?**
   - What we know: D-06 explicitly says a misconfigured/empty `RECRUITER_EMAILS` must never block the candidate's flow. `Attempts.Status` has no per-recipient granularity (that lives on `PendingGrading`'s two separate `email_status` columns).
   - What's unclear: CONTEXT.md leaves the exact `Attempts.Status` wiring to research/planning discretion.
   - Recommendation (see Pattern 3): tie `Attempts.Status = "emailed"` to candidate-email success only, since that's the field the roadmap explicitly ties to candidate-facing outcome; recruiter email success/failure is tracked independently via `PendingGrading.RecruiterEmailStatus` and surfaced in the admin panel per D-12, without gating the attempt's overall terminal status.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Google Apps Script runtime (`ScriptApp`, `LockService`, `MailApp`, `SpreadsheetApp`, `PropertiesService`) | Entire backend of this phase | ✓ (already the deployment target — `backend/Code.gs` runs here today) | V8 runtime (current GAS default) | — |
| `vitest` (root `package.json`) | Testing the new pure-logic mirrors (`tests/async/*.ts`) | ✓ | ^4.1.10, confirmed via direct file read | — |
| Local ability to execute/verify actual `.gs` code | Full end-to-end verification of `processGradingQueue`/trigger behavior | ✗ — Apps Script code cannot run under Node/Vitest locally | — | Verify pure logic via the `tests/async/*.ts` mirrors (same as `grading-engine.ts` precedent); verify actual trigger/Sheet/MailApp behavior manually in the Apps Script editor + a live/test spreadsheet, since there is no local GAS emulator in this stack |
| Confirmed live-deployment MailApp quota tier (consumer vs Workspace) | Sizing the batch-cap/quota-defer logic realistically | ✗ — unconfirmed this session (see Assumption A1 / Open Question 2) | — | Implement `getRemainingDailyQuota()` defer-not-fail logic regardless of tier, so it's safe either way |

**Missing dependencies with no fallback:**
None — all gaps have a documented fallback above.

**Missing dependencies with fallback:**
- Local Apps Script execution — use the pure-logic-mirror + manual-editor-verification fallback described above.
- Confirmed MailApp quota tier — implement quota-defensive logic regardless of the answer.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.10 (root `package.json`, confirmed via direct read) |
| Config file | `vitest.config.ts` — `include: ['tests/**/*.ts']`, excludes mirror files themselves (`grading-engine.ts`, `admin-auth.ts`) from being run as test suites directly |
| Quick run command | `npx vitest run tests/async/test_queue.ts tests/async/test_email.ts` |
| Full suite command | `npm test` (→ `vitest run`, covers all of `tests/**/*.ts`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| ASYNC-01 | Candidate sees ThankYouScreen immediately, no on-screen report | manual-only | N/A — `assessment-app/` has no configured test runner (root `vitest.config.ts` explicitly excludes `assessment-app/**`); component-level assertions would need a new test harness, out of scope for this phase per the "add nothing not asked for" project convention | ❌ Wave 0 gap (documented, not filled — see justification below) |
| ASYNC-02 | Grading continues after tab close (queue + trigger, not connection-bound) | unit | `npx vitest run tests/async/test_queue.ts` — asserts the stage/retry state machine and batch-selection logic (pure functions, no real trigger needed) | ❌ Wave 0 gap |
| ASYNC-03 | Candidate emailed full report (score, 3 traits, narrative, tier) | unit | `npx vitest run tests/async/test_email.ts` — asserts `buildCandidateEmail(report)` output contains all 4 required fields | ❌ Wave 0 gap |
| ASYNC-04 | Recruiter emailed summary incl. concerns/positives/results | unit | `npx vitest run tests/async/test_email.ts` — asserts `buildRecruiterEmail(report, integritySummary)` includes violation summary + tier; asserts `parseRecruiterEmails` handles comma-separated/empty/whitespace input (D-06/D-07) | ❌ Wave 0 gap |
| ASYNC-05 | Email failures tracked as distinct, retryable status | unit | `npx vitest run tests/async/test_queue.ts` — asserts retry-count increments, cap-at-3 → `permanently_failed` transition (D-11), and that `CandidateEmailStatus`/`RecruiterEmailStatus` are independently settable | ❌ Wave 0 gap |

**Manual-only justification (ASYNC-01):** `assessment-app/` (the Next.js frontend) has no test runner configured at all — `assessment-app/package.json` has no `test` script and no testing library installed, and the root `vitest.config.ts`'s `include`/`exclude` patterns are scoped to the `tests/` directory only, explicitly excluding `assessment-app/**`. Adding a frontend test harness is a larger, separate concern than this phase's scope (and would violate the "never create files unless absolutely necessary" project convention absent an explicit ask) — verify ASYNC-01 by manual click-through instead: submit an attempt, confirm `ThankYouScreen.tsx` renders with confirmation + "within a few minutes" copy and no score/report data.

### Sampling Rate
- **Per task commit:** `npx vitest run tests/async/test_queue.ts tests/async/test_email.ts` (fast, seconds)
- **Per wave merge:** `npm test` (full suite, includes `scripts/sync-check.ts`-covered divergence checks if extended per this research's recommendation)
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus the manual ASYNC-01 click-through above.

### Wave 0 Gaps
- [ ] `tests/async/queue-logic.ts` — pure mirror of the stage/retry state machine + batch-selection logic (no `SpreadsheetApp`/`LockService` deps), covers ASYNC-02/05
- [ ] `tests/async/email-content.ts` — pure mirror of `buildCandidateEmail`/`buildRecruiterEmail`/`parseRecruiterEmails`, covers ASYNC-03/04
- [ ] `tests/async/test_queue.ts` — vitest suite for the above
- [ ] `tests/async/test_email.ts` — vitest suite for the above
- [ ] (Optional, recommended not required) extend `scripts/sync-check.ts` with divergence checks for retry cap (3), batch cap (5), and trigger interval (5 min) between `AsyncGrading.gs` and `tests/async/queue-logic.ts`, following the existing `grading-engine.ts` precedent (BUG-01)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|---------------------|
| V2 Authentication | No change | Admin endpoints (`getAttemptReport`, `adminListCandidates`, `adminResetAttempt`) keep their existing `checkAdminAuth(token)` gate, untouched by this phase |
| V3 Session Management | N/A | No session state introduced; candidate flow remains stateless per-request with `attemptId` as the correlation key, same as today |
| V4 Access Control | Yes | The candidate-facing flow gains **zero** new read endpoints — email-only delivery (D-01) is itself the access-control win here, since there's no new URL/token surface for an unauthenticated party to guess or intercept a report through (this is explicitly why D-01 "sidesteps the F-01 unauthenticated-report-read risk class entirely") |
| V5 Input Validation | Yes | `doPost`'s fast-enqueue path must still validate `attemptId` exists and `answers` is a plausible object *before* the `appendRow` — same validation rigor as today's `handleSubmitAnswers`, just performed earlier/faster |
| V6 Cryptography | N/A | No new cryptographic operations introduced by this phase |
| V7 Error Handling / Logging | Yes | Grading/email failures must be logged with enough detail (`LastError` column) to debug `grading_failed` items from the admin panel (D-12) without ever emailing violation/grading internals to the candidate (D-04) |
| V8 Data Protection | Yes | D-04 is itself a data-protection control: integrity/violation details must never appear in the candidate's own email — this must be enforced at the shared-template level (Don't Hand-Roll's `includeViolations` flag), not left to per-callsite discipline |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Recruiter notification recipient-list misconfiguration silently leaking to/omitting the wrong people | Information Disclosure / Repudiation | `RECRUITER_EMAILS` is a Script Property (server-side only, never client-editable); D-06 already specifies fail-safe behavior (log + mark `failed`, don't block candidate) rather than fail-open guessing |
| Denial of service via `MailApp` daily quota exhaustion (a burst of legitimate or malicious duplicate submissions) | Denial of Service | Idempotency guard on `doPost` (Pitfall 3) prevents a single attempt from consuming quota more than once; `getRemainingDailyQuota()` defer-not-fail check (Pitfall 2) prevents quota exhaustion from silently dropping emails rather than deferring them |
| Duplicate/replayed `submitAnswers` requests causing duplicate grading or duplicate emails | Tampering / Repudiation | `Attempts.Status !== "active"` idempotency check (Pitfall 3) — the same guard the codebase already effectively has via the existing `attemptRow[5] !== "active"` check, just now load-bearing for a new failure mode |
| Violation/integrity data reaching the candidate via a shared-template bug | Information Disclosure | Single shared HTML-builder function with an explicit `includeViolations` boolean (Don't Hand-Roll) rather than two independently-hand-maintained templates that could drift |

## Sources

### Primary (HIGH confidence)
None — Context7 MCP tooling was unavailable in this session (tool not registered); all backend-platform facts below were obtained via WebSearch/WebFetch and are therefore capped at MEDIUM confidence per this project's `classify-confidence` seam output.

### Secondary (MEDIUM confidence)
- WebFetch of `developers.google.com/apps-script/reference/script/clock-trigger-builder` — `everyMinutes(n)` valid values (1/5/10/15/30)
- WebFetch of `developers.google.com/apps-script/reference/lock/lock-service` — `getScriptLock`/`tryLock`/`waitLock`/`finally`-release pattern
- WebFetch of `developers.google.com/apps-script/reference/mail/mail-app` — `htmlBody` advanced-parameter, `getRemainingDailyQuota()`, MailApp vs GmailApp scope differences
- WebFetch of `developers.google.com/apps-script/reference/script/script-app` — `getProjectTriggers()`/`deleteTrigger()` idempotent-installation pattern
- WebSearch (cross-referencing `developers.google.com/apps-script/guides/services/quotas` and multiple third-party 2026 quota-reference posts) — consumer vs. Workspace quota figures (6-min per-execution cap unified; 90 min vs 6 hr daily trigger runtime; 100 vs 1,500 recipients/day; 20 triggers/script)
- WebSearch (cross-referencing `developers.google.com/apps-script/guides/projects`) — multiple `.gs` files share one global scope, no import needed
- Direct codebase `Read`/`Grep` of `backend/Code.gs`, `assessment-app/src/app/page.tsx`, `assessment-app/src/app/admin/page.tsx`, `assessment-app/src/components/ReportScreen.tsx`, `assessment-app/src/types/index.ts`, `tests/grading/grading-engine.ts`, `tests/admin/admin-auth.ts`, `scripts/sync-check.ts`, `vitest.config.ts`, `package.json`, `assessment-app/package.json` — this is treated as VERIFIED-equivalent since it's direct inspection of the actual project files, not a claim requiring external sourcing.

### Tertiary (LOW confidence)
None retained — all findings that could be cross-checked were; any that couldn't (see Assumptions Log A1-A3) are explicitly flagged as ASSUMED rather than presented as sourced fact.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (equivalent) — every backend primitive is a built-in GAS service already in production use elsewhere in this exact codebase (Sheets, PropertiesService); no new external dependency risk exists.
- Architecture: MEDIUM — the queue/trigger/lock/email design is cross-checked against official Apps Script reference docs, but the exact `PendingGrading` schema and state-machine wiring are this research's own synthesis (explicitly delegated to research/planning discretion by CONTEXT.md), not sourced from a canonical "how to build a GAS queue" reference.
- Pitfalls: HIGH for the trigger-installation and status-enum pitfalls (directly grounded in reading the actual `Code.gs`/`admin/page.tsx` source and counting the exact 6 `[5]`-indexed call sites); MEDIUM for the quota-exhaustion pitfall (account-type unconfirmed, see Assumption A1).

**Research date:** 2026-07-31
**Valid until:** 2026-08-30 (30 days — Apps Script platform APIs/quotas are stable, but the account-type and live-Sheet-state assumptions should be re-confirmed if planning is delayed significantly past this window)
