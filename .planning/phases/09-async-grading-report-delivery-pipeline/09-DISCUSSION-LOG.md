# Phase 09: Async Grading & Report Delivery Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 09-async-grading-report-delivery-pipeline
**Areas discussed:** Email content & format, Recruiter recipient config, Queue cadence & failure handling, ThankYouScreen copy & tone

---

## Email content & format

| Option | Description | Selected |
|--------|-------------|----------|
| Full report inline | Same detail as today's on-screen report, embedded in email body, no link | ✓ |
| Condensed summary | Overall score + tier only | |
| You decide | Claude picks | |

**User's choice:** Full report inline (candidate email).

| Option | Description | Selected |
|--------|-------------|----------|
| Full report + flags | Same full report plus integrity/violation summary + tier highlighted | ✓ |
| Condensed alert | Name, email, score, tier, violation flag only | |
| You decide | Claude picks | |

**User's choice:** Full report + flags (recruiter email).

| Option | Description | Selected |
|--------|-------------|----------|
| Styled HTML | MailApp htmlBody | ✓ |
| Plain text | Simpler, guaranteed rendering | |

**User's choice:** Styled HTML.

| Option | Description | Selected |
|--------|-------------|----------|
| No — recruiter only | Violations are a screening signal, not candidate-facing | ✓ |
| Yes — show violation count | Candidate sees own violation count | |

**User's choice:** No — recruiter only.

**Notes:** All four questions in this area went with the recommended option.

---

## Recruiter recipient config

| Option | Description | Selected |
|--------|-------------|----------|
| Script Properties, comma-separated | RECRUITER_EMAILS, matches GEMINI_API_KEY/FALLBACK_API_KEY pattern | ✓ |
| Single hardcoded address | Constant in Code.gs | |
| You decide | Claude picks | |

**User's choice:** Script Properties, comma-separated.

| Option | Description | Selected |
|--------|-------------|----------|
| Log + mark email_status failed | Recruiter email fails independently, candidate flow unaffected | ✓ |
| Fail the whole queue item | Missing config treated as hard error | |

**User's choice:** Log + mark email_status failed.

| Option | Description | Selected |
|--------|-------------|----------|
| Everyone gets everything | No per-recipient targeting | ✓ |
| You decide | Claude picks | |

**User's choice:** Everyone gets everything.

| Option | Description | Selected |
|--------|-------------|----------|
| Script owner default | MailApp default sender | ✓ |
| Custom alias/name | Set display name via MailApp | |

**User's choice:** Script owner default.

**Notes:** All four questions in this area went with the recommended option.

---

## Queue cadence & failure handling

| Option | Description | Selected |
|--------|-------------|----------|
| Every 5 minutes | Balances turnaround vs. Apps Script trigger quota | ✓ |
| Every 1 minute | Fastest, burns quota faster | |
| Every 10-15 minutes | Conservative on quota, slower | |

**User's choice:** Every 5 minutes.

| Option | Description | Selected |
|--------|-------------|----------|
| 5 per run | Stays inside 6-min execution limit, drains backlog reasonably fast | ✓ |
| 1 per run | Safest, slowest to drain | |
| You decide | Claude picks | |

**User's choice:** 5 per run.

| Option | Description | Selected |
|--------|-------------|----------|
| 3 attempts | Rides out transient failures without infinite retry | ✓ |
| 1 attempt (no retry) | Fail fast | |
| Unlimited retries | Risk of stuck item | |

**User's choice:** 3 attempts.

| Option | Description | Selected |
|--------|-------------|----------|
| Surfaced in admin panel only | No extra email noise | ✓ |
| Also email recruiters an alert | Extra failure notification | |

**User's choice:** Surfaced in admin panel only.

**Notes:** All four questions in this area went with the recommended option.

---

## ThankYouScreen copy & tone

| Option | Description | Selected |
|--------|-------------|----------|
| "Within a few minutes" | Honest, no hard numeric promise | ✓ |
| Specific window (e.g. 15 min) | More concrete but riskier if delayed | |
| You decide | Claude picks | |

**User's choice:** "Within a few minutes".

| Option | Description | Selected |
|--------|-------------|----------|
| Keep gamified tone | Consistent with rest of candidate experience | ✓ |
| Plain/professional | More neutral/credible | |

**User's choice:** Keep gamified tone.

| Option | Description | Selected |
|--------|-------------|----------|
| Confirmation only | Matches roadmap goal exactly; no score teaser | ✓ |
| Confirmation + basic submission summary | e.g. "You answered N questions" | |

**User's choice:** Confirmation only.

| Option | Description | Selected |
|--------|-------------|----------|
| No auto-refresh only, no navigation lock | Simplest reading of roadmap goal | ✓ |
| Also block back-navigation into the test | Extra guard against re-entry | |

**User's choice:** No auto-refresh only, no navigation lock.

**Notes:** All four questions in this area went with the recommended option.

---

## Claude's Discretion

- Exact `PendingGrading` sheet column layout and `email_status`/`Attempts.Status` enum value naming (beyond the states already named in ROADMAP.md's Success Criteria).
- Retry backoff strategy within the 3-attempt cap (immediate vs. spaced re-attempts).

## Deferred Ideas

None — discussion stayed entirely within Phase 9's scope. Rubric-based LLM grading (Phase 10), recruiter transcript/override UI (Phase 10), and analytics (Phase 11) were not discussed here as they're already separated in the roadmap.
