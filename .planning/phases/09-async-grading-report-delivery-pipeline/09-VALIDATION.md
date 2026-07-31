---
phase: 09
slug: async-grading-report-delivery-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-31
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.10 (root `package.json`) |
| **Config file** | `vitest.config.ts` — `include: ['tests/**/*.ts']`, excludes mirror files (`grading-engine.ts`, `admin-auth.ts`) from being run as test suites directly |
| **Quick run command** | `npx vitest run tests/async/test_queue.ts tests/async/test_email.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~1-2 seconds (90 existing tests currently run in 756ms) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/async/test_queue.ts tests/async/test_email.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green, plus the manual ASYNC-01 click-through below
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | ASYNC-01 | V4 Access Control | Candidate sees `ThankYouScreen.tsx` immediately on submit; no on-screen score/report rendered | manual | N/A — no frontend test runner configured | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ASYNC-02 | V5 Input Validation | Queue/trigger stage state machine (queued → graded → done/permanently_failed) and batch-selection logic survive tab close, independent of open connection | unit | `npx vitest run tests/async/test_queue.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ASYNC-03 | V8 Data Protection | `buildCandidateEmail(report)` output includes overall score, 3 trait scores, narrative insight, recommendation tier — and excludes violation data (D-04) | unit | `npx vitest run tests/async/test_email.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ASYNC-04 | V8 Data Protection | `buildRecruiterEmail(report, integritySummary)` includes violation/integrity summary + tier highlighted; `parseRecruiterEmails` correctly handles comma-separated/empty/whitespace `RECRUITER_EMAILS` (D-06/D-07) | unit | `npx vitest run tests/async/test_email.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ASYNC-05 | V7 Error Handling / Logging | Retry count increments per failed attempt, caps at 3 → `grading_failed` (D-11); `CandidateEmailStatus`/`RecruiterEmailStatus` track independently so an email-only retry never re-runs LLM grading | unit | `npx vitest run tests/async/test_queue.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task ID / Plan / Wave columns are TBD until `gsd-planner` assigns concrete tasks in Step 8 — this table's Requirement→Test contract is what those tasks must satisfy.*

---

## Wave 0 Requirements

- [ ] `tests/async/queue-logic.ts` — pure mirror of the stage/retry state machine + batch-selection logic (no `SpreadsheetApp`/`LockService` deps), covers ASYNC-02/05
- [ ] `tests/async/email-content.ts` — pure mirror of `buildCandidateEmail`/`buildRecruiterEmail`/`parseRecruiterEmails`, covers ASYNC-03/04
- [ ] `tests/async/test_queue.ts` — vitest suite for `queue-logic.ts`
- [ ] `tests/async/test_email.ts` — vitest suite for `email-content.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `ThankYouScreen.tsx` renders confirmation + turnaround copy, no score/report data, no auto-refresh/polling | ASYNC-01 | `assessment-app/` (Next.js frontend) has no test runner configured — no `test` script, no testing library installed, and root `vitest.config.ts` explicitly excludes `assessment-app/**` | Submit an attempt end-to-end; confirm `ThankYouScreen.tsx` renders with confirmation + "within a few minutes" copy (D-13/D-14/D-15) and no score/report data; confirm no auto-refresh/status-polling request loop fires (D-16) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
