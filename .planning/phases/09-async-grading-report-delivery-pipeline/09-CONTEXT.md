# Phase 09: Async Grading & Report Delivery Pipeline - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

`doPost(submitAnswers)` currently grades synchronously (including LLM open-text calls via `evaluateOpenTextBatch`) inside the request/response cycle. This phase moves that work off the critical path: `doPost` fast-enqueues to a new `PendingGrading` queue sheet and returns in ~100-300ms; a single recurring time-driven trigger drains the queue under `LockService`, calls an extracted `gradeAndFinalizeAttempt`, and sends candidate-report + recruiter-notification emails via `MailApp` with distinct `email_status` tracking. The candidate-facing UI adds a `ThankYouScreen.tsx` shown immediately on submit (email-only delivery, no polling).

Out of scope for this phase: the actual grading logic/rubric (Phase 10 — LLM rubric grading), the analytics dashboard (Phase 11), and ReportScreen.tsx ARIA work (Phase 13) — those touch adjacent but separate concerns.

</domain>

<decisions>
## Implementation Decisions

### Email content & format
- **D-01:** Candidate email contains the full report inline in the email body (overall score, 3 trait scores, narrative insight, recommendation tier) — same detail as today's on-screen report. No link to a report page, which also sidesteps the F-01 unauthenticated-report-read risk class entirely.
- **D-02:** Recruiter notification email contains the same full report as the candidate's, plus the integrity/violation summary and recommendation tier highlighted, so a recruiter can act without opening the admin panel.
- **D-03:** Emails are sent as styled HTML (`MailApp` `htmlBody`), not plain text — matches the product's existing gamified/branded feel and makes score/tier easier to scan.
- **D-04:** Integrity/violation details never appear in the candidate's own email — violation info is recruiter-only, consistent with how the on-screen report already treats it as a screening signal rather than candidate-facing feedback.

### Recruiter recipient config
- **D-05:** Recruiter notification addresses come from a `RECRUITER_EMAILS` Script Property, comma-separated — mirrors the existing `GEMINI_API_KEY` / `FALLBACK_API_KEY` Script Properties pattern already in `Code.gs`. No code deploy needed to add/remove recruiters.
- **D-06:** If `RECRUITER_EMAILS` is empty or misconfigured: log it and mark that queue item's recruiter `email_status` as `failed` (with a clear reason). Grading and the candidate email still proceed normally — a missing recruiter config must never block the candidate's flow.
- **D-07:** Every address in `RECRUITER_EMAILS` gets every notification — no per-recipient targeting/filtering rules (e.g. no "only alert on high violations to a subset").
- **D-08:** Recruiter emails send from the script owner's default `MailApp` sender — no custom "From" alias/display name.

### Queue cadence & failure handling
- **D-09:** The `processGradingQueue` recurring trigger runs every 5 minutes — installed exactly once at setup (never per-attempt), balancing candidate turnaround against Apps Script's daily trigger-execution quota.
- **D-10:** Each trigger run processes up to 5 queued attempts (batch cap) — keeps a run comfortably inside Apps Script's 6-minute execution limit even with LLM open-text grading calls, while draining a normal backlog within a couple of runs.
- **D-11:** An item that fails grading or email sending is retried; after 3 total failed attempts it stops retrying and is surfaced as `grading_failed` (a distinct `Attempts.Status` value, never silently merged into `graded`/`emailed`).
- **D-12:** A permanently-`grading_failed` item is surfaced in the existing admin candidate list/detail view only — no separate failure-alert email. Recruiters already check that panel; this avoids extra email noise.

### ThankYouScreen copy & tone
- **D-13:** Turnaround copy says "within a few minutes" rather than a specific numeric window — honest given the 5-min trigger cadence + LLM grading time, without a hard promise that could look broken if a run is delayed or an item retries.
- **D-14:** `ThankYouScreen.tsx` keeps the existing gamified/game-show tone of the rest of the test UI (level progression, points reveal) rather than shifting to a plain/professional register at the end.
- **D-15:** The screen shows confirmation + turnaround copy only — no score teaser or submission summary, since grading (including LLM rubric grading) is not finalized at submit time; the item is still queued.
- **D-16:** "No polling" means no auto-refresh / no status-check request loop on the ThankYouScreen. It does not need to actively block back-navigation into the test — the attempt is already marked submitted server-side, so re-entry isn't a scoring risk.

### Claude's Discretion
- Exact `PendingGrading` sheet column layout, `email_status` enum value names, and `Attempts.Status` enum extension (`pending_grading`/`graded`/`emailed`/`grading_failed`) wiring are left to research/planning — the roadmap's Success Criteria already lock the required states, decisions above lock the recipient/content/cadence/copy choices around them.
- Retry backoff strategy (e.g. immediate re-attempt next run vs. exponential-style spacing) within the 3-attempt cap (D-11) is left to planning, informed by what's simplest to implement reliably under `LockService`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & requirements
- `.planning/ROADMAP.md` §"Phase 9: Async Grading & Report Delivery Pipeline" (lines 130-140) — Goal, Depends on, Success Criteria for this phase
- `.planning/REQUIREMENTS.md` — currently holds an uncommitted v1.1 draft; not read as a locked source for this phase's decisions (draft status), but downstream agents should check it for any newly-formalized async-reporting requirement IDs before planning
- `.planning/PROJECT.md` — Current Milestone section describes the async reporting goal and constraint: "Async compute: Report generation must survive the candidate closing the browser tab — Apps Script trigger/queue based, not tied to an open connection; email delivery via Apps Script MailApp/GmailApp, no new paid email service"

### Existing code this phase modifies
- `backend/Code.gs` `doPost` (line 202) and `handleSubmitAnswers` (line 411) — current synchronous grading path being split into fast-enqueue + async-drain
- `backend/Code.gs` `initSheets` (line 243) — sheet-creation pattern to follow for the new `PendingGrading` sheet
- `backend/Code.gs` lines 57-58 — existing `PropertiesService.getScriptProperties()` pattern to follow for `RECRUITER_EMAILS`

No other external specs/ADRs — requirements fully captured in decisions above plus the roadmap Success Criteria.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `evaluateOpenTextBatch` (called from `handleSubmitAnswers`) — the LLM grading call that must move from the synchronous request path into the async `gradeAndFinalizeAttempt` step.
- Existing report-building logic inside `handleSubmitAnswers`/`handleGetAttemptReport` (line 626) — the trait-score/tier/narrative computation this phase's emails need to reuse rather than reimplement.
- `PropertiesService.getScriptProperties()` pattern (lines 57-58) — direct precedent for `RECRUITER_EMAILS`.

### Established Patterns
- Sheets are lazily created in `initSheets()` on first run, with a bold-header first row — the new `PendingGrading` sheet should follow this same convention.
- `jsonResponse()` wraps all `doPost`/`doGet` responses — the fast-path enqueue response should use the same helper.

### Integration Points
- `doPost`'s `submitAnswers` branch (line 218) is the enqueue entry point.
- A new time-driven trigger (installed once, e.g. at deployment/setup) is the drain entry point — no existing trigger infrastructure exists yet in `Code.gs` to extend.
- Frontend: wherever the candidate UI currently transitions after submit needs to route to the new `ThankYouScreen.tsx` instead of an on-screen report.

</code_context>

<specifics>
## Specific Ideas

No further specific UI mockups or exact copy text were dictated — "within a few minutes" (D-13) and "keep the gamified tone" (D-14) are the concrete anchors; exact wording is left to implementation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Rubric-based LLM grading itself, recruiter transcript/override UI, and analytics are explicitly Phase 10/11, already separated in the roadmap.)

</deferred>

---

*Phase: 09-async-grading-report-delivery-pipeline*
*Context gathered: 2026-07-31*
