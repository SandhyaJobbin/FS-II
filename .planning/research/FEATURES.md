# Feature Research

**Domain:** Hiring assessment platform — async report delivery, recruiter analytics, LLM-graded open-text grading, fraud/trust-and-safety-analyst evaluation quality
**Milestone:** v1.1 Async Reporting, Trust Repairs & Evaluation Quality
**Researched:** 2026-07-31
**Confidence:** MEDIUM (see Sources — live web search/fetch was unavailable this session; findings are drawn from established ATS/assessment-platform UX patterns, standard psychometric item-analysis practice, and commonly documented LLM-as-judge evaluation principles. Nothing here is exotic or contested, but nothing was cross-checked against a live source this run — treat any vendor-specific claim as illustrative, not verified.)

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Immediate "Thank You" confirmation screen on submit | Every assessment platform confirms receipt instantly even when scoring is async — candidates need to know the submit succeeded before they leave | LOW | Must be idempotent: refreshing the thank-you page or re-hitting submit must not double-submit or re-trigger grading |
| "What happens next" messaging with a concrete timeframe | Vague "we'll be in touch" copy drives candidate support emails ("did it go through?"); stating an expected turnaround and confirming the destination email address sets an honest expectation | LOW | Copy must match reality — don't promise "instant" or "minutes" once grading is genuinely async/LLM-involved |
| Immediate lightweight confirmation email, separate from the full report | Gives the candidate an inbox anchor immediately, confirms the email address was captured correctly, reduces anxiety while the full report is still computing | LOW | Distinct from the full report email; reuses existing MailApp/GmailApp integration |
| Full report delivered as readable email content, not just a bare attachment/link | PDF-only or link-only emails frequently get clipped by Gmail, blocked by corporate filters, or ignored; inlining the key summary (scores, tier, narrative) in the email body itself is standard practice | MEDIUM | `GmailApp.sendEmail` supports HTML body — reuse the existing `ReportScreen.tsx` content model rather than building a second template from scratch |
| Recruiter-team notification email on every completed attempt | Recruiters shouldn't have to poll the admin panel to know a candidate finished; a per-attempt summary email (concerns/positives/results) is the async-flow equivalent of the old instant on-screen result | LOW-MEDIUM | Needs a recruiter-team distribution address (Script Property), not per-recruiter fan-out, to avoid inbox spam as volume grows |
| Question-level difficulty stats on the analytics dashboard (pass rate per question) | Standard psychometric "item analysis" — without it, a badly-worded or leaked question silently drags down the whole bank and nobody notices | MEDIUM | Requires joining `Responses` sheet by QuestionID against the static bank; Sheets isn't a real analytics DB, so this needs an aggregation function, likely cached given Apps Script quota limits |
| Score trend over time | Recruiters need to know if scores are drifting (better/worse sourcing channel, a leaked answer key causing a spike, a bank getting stale) — a single point-in-time average is not actionable | MEDIUM | A rolling-average-by-week/cohort view is sufficient; don't over-build |
| Violation/integrity summary correlated with score, not just raw counts | A raw "3 tab-switches" count means little alone; what matters is whether high-violation candidates also show anomalously high scores (cheating signal) vs. high violations with mediocre scores (probably a nervous candidate/unstable connection) | MEDIUM | Builds directly on existing `IntegrityLogs` + `Attempts.ViolationCount` — a correlation view, not new data collection |
| Explicit rubric (not "grade this 0-10") behind every LLM-graded open-text question | The single biggest reliability lever for LLM-as-judge scoring — decomposed, weighted criteria per question produce far more consistent, defensible grades than an unconstrained holistic score | MEDIUM | Formalizes what `evaluateOpenTextBatch` in `Code.gs` currently does ad hoc (the F-03 audit finding); rubric should be structured data per question, not baked into a single prompt string |
| Structured (JSON schema) LLM grading output: per-criterion score + overall + rationale | Freeform prose scores can't be tested, audited, or reliably parsed; structured output is what makes the F-03 test-mirror requirement and the recruiter override UI possible at all | MEDIUM | Gemini structured output/JSON mode should be used; direct dependency for both the pitfalls around grading drift and the recruiter override feature |
| Recruiter-visible transcript + LLM verdict + rationale, with override control | Already a stated project constraint — once an LLM affects a real hiring decision, "zero human review" is no longer true, and the report must let a recruiter see exactly what the LLM saw and said, and overrule it | MEDIUM-HIGH | New field on the report data model (`openTextGrading[]`: question, candidate answer, per-criterion scores, rationale, override state) surfaced via `handleGetAttemptReport` plus a new admin UI affordance |
| Graceful failure state for LLM grading (never silently pass or fail) | If the Gemini call errors or returns malformed JSON, the candidate must not get a default score — must surface as "grading incomplete, needs manual review" to the recruiter | LOW-MEDIUM | Directly covered by the already-scoped F-04 test-coverage requirement |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Candidate-revisitable "grading status" link in the confirmation email | Reduces anxiety and support load if email delivery lags (Apps Script MailApp can be rate-limited at volume); candidate can check "in progress / complete" instead of only waiting | MEDIUM | Not essential if email delivery is reliable — build only if delivery latency becomes a real, measured problem |
| LLM-generated dashboard narrative digest ("what changed, what to watch") | Turns raw item-analysis and trend stats into an action item recruiters will actually read (e.g., "pass rate on Case 12/Q3 dropped from 68%→40% this month — check for ambiguity or a leaked key") — this is what separates a useful dashboard from a wall of charts | MEDIUM-HIGH | Reuses the existing Gemini integration/API key already wired for open-text grading; keep strictly descriptive/diagnostic, never a per-candidate hire recommendation (see anti-feature below) |
| Two-pass / self-consistency LLM grading with disagreement flagging | Running the rubric grading twice (or with a differently-worded second pass) and flagging cases where the two scores diverge meaningfully raises grading trust substantially for a small number of open-text items, at added cost/latency | MEDIUM | Worth adding once the single-pass version is validated in production — not for first ship |
| Few-shot calibration anchors (gold-standard strong/medium/weak reference answers per question) in the grading prompt | Anchors the LLM's numeric scale to actual human judgment rather than the model's own drifting sense of "8/10" — a well-known lever for improving LLM-as-judge agreement with human raters | MEDIUM-HIGH | Needs a small authored reference-answer set per open-text question — real content work, not just engineering; do this after there's a corpus of real graded answers to draw examples from |
| Confidence-calibration scoring (candidate states confidence alongside verdict on ambiguous cases) | Domain-specific: a fraud analyst who's right 60% of the time and knows it is a better hire than one who's right 60% of the time and claims 95% confidence — this directly tests the "no fixed playbook" judgment the role requires | MEDIUM | New discrete answer-input element (a fixed confidence scale — still deterministic, not free text) + a calibration-scoring formula; layers onto existing Critical Thinking cases, no new content authoring required |
| False-positive vs. false-negative bias-direction indicator | Domain-specific: tags a candidate's wrong answers by whether they skew toward over-flagging (accusing legitimate reviews/accounts) or under-flagging (missing real fraud) — a directional trait, not just an accuracy number, that lets recruiters match candidates to team needs | LOW-MEDIUM | Pure scoring/aggregation change against already-answer-keyed MCQ items; requires tagging existing questions with a "direction" attribute where the wrong answer is classifiable — no new question content |
| "Escalate / insufficient information" as a scored-valid answer path on select ambiguous cases | Domain-specific: forced binary fraud/not-fraud choices train and select for false confidence; real analysts escalate ambiguous cases rather than guessing — scoring escalation as correct on genuinely under-determined cases tests a real on-the-job behavior a forced-choice test structurally cannot | MEDIUM | Requires tagging a subset of existing Critical Thinking cases as "escalation-valid" and extending the grading engine to accept a second correct answer path — still fully deterministic, no conflict with the MCQ-determinism constraint |
| Time-pressure accuracy-degradation signal | Domain-specific: compares accuracy on the first question of a case vs. later questions in the same case (which require more cross-tab synthesis) as a proxy for how the candidate holds up under queue/SLA-style time pressure, distinct from raw accuracy | LOW | Purely derived from timestamps already logged in `Responses` — no new content, UI, or grading changes needed |
| Bottom-N discriminating-question review queue on the dashboard | Domain-specific application of item analysis: surfaces questions where getting it right correlates weakly or negatively with overall score (i.e., your best candidates are getting it "wrong") — worth a recruiter/SME re-read to decide if the question is appropriately ambiguous or just broken | MEDIUM | Needs a discrimination-index computation (point-biserial or simplified top/bottom-group split) in addition to raw pass-rate; pairs naturally with the question-difficulty table-stakes feature above |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Showing partial/instant scores on the thank-you screen (e.g., reveal MCQ score immediately, LLM score later) | MCQ grading is deterministic and fast, so it's tempting to show *something* right away | Creates a confusing two-stage reveal, undermines the "wait for the full holistic report" framing, and risks candidates reverse-engineering which sections are objectively vs. subjectively graded | Hold everything until the full report (MCQ + LLM sections) is ready; single reveal via email |
| Auto-refreshing/polling the thank-you page for live grading status | Feels more "real-time" and modern | Apps Script backend isn't built for polling-friendly status endpoints at scale, and it re-introduces exactly the "must keep the tab open" anxiety the async flow was designed to remove | Push via email; only add a revisitable status link if delivery latency becomes a real, measured problem |
| Fully autonomous LLM decision on open-text with no transcript or override | Feels efficient — "let the AI decide" | Directly conflicts with the project's own stated constraint once LLM grading affects a real hiring outcome; also a general anti-pattern for a defensible hiring pipeline (a score nobody can explain is a liability) | LLM produces a rubric sub-score with rationale that feeds the same deterministic aggregation MCQ scores already use; recruiter can always see and override it |
| LLM used to set the pass/fail boundary or recommendation tier directly, bypassing the deterministic aggregation | Seems like a natural extension once the LLM is already grading open-text | Blends judgment into the "trusted" aggregate score in an opaque way and makes the whole report harder to defend or debug | Scope the LLM strictly to "grade this one answer against this one rubric" — the existing deterministic tier logic stays sole owner of the final recommendation |
| Publishing the grading rubric to candidates ahead of time (for "transparency") | Feels fair and transparent | Turns the open-text section into a checklist-matching exercise, defeating its purpose of testing genuine judgment under ambiguity | Keep rubrics server-side only (same boundary as MCQ answer keys); transparency comes from the candidate's own post-hoc transcript+verdict, not a pre-published rubric |
| Re-grading open-text answers fresh every time a recruiter opens the report | Seems harmless — "just call the LLM again" | Non-deterministic: could show a different score on different days for the same candidate, undermining trust and making audits meaningless | Grade once at submission time, persist verdict + transcript; only regenerate on an explicit, logged recruiter-triggered "regrade" action |
| LLM-generated per-candidate hire/no-hire recommendations at the aggregate dashboard level | Sounds like a natural extension of the "LLM summary insights" differentiator | Crosses from descriptive/diagnostic analytics into automated hiring decisions across candidates — real adverse-impact/fairness exposure for a tool with zero human calibration at that layer | Keep the LLM dashboard summary strictly diagnostic (item-quality and trend narrative); hire/no-hire stays a per-candidate, human-reviewed decision fed by the report |
| Raw "average score" or "total questions answered platform-wide" as headline dashboard numbers | Easy to compute, looks like progress | Classic vanity metrics — they don't segment by cohort/time, don't correlate with anything actionable, and don't drive a hiring decision | Lead the dashboard with score trend-by-cohort, question difficulty/discrimination, and violation-vs-score correlation instead |
| A separate "AI-detection" hard-fail signal on open-text answers (auto-reject suspiciously fluent/generic text) | Real risk: remote, unproctored test + free LLM tools make copy-paste-from-AI easy | AI-text heuristics are unreliable as sole graders and produce false accusations against strong, articulate human candidates | Log heuristic signals (unusually fluent relative to the candidate's own English-proficiency-section performance, paste-event correlation) as a soft flag for recruiter review alongside the transcript — never an auto-fail |

## Feature Dependencies

```
Async Report Delivery
    └──requires──> Async grading pipeline (trigger-based, decoupled from doPost)
                       [already a stated project constraint — must land first]
    └──requires──> Email delivery via MailApp/GmailApp
    └──enhances──> Recruiter-team summary email (concerns/positives/results)

Rubric-Based LLM Grading
    └──requires──> F-03 grading-engine mirror sync (existing audit item)
    └──requires──> Structured rubric schema per open-text question (new content/schema work)
    └──enables──> Recruiter transcript + verdict + override UI (admin panel)
    └──enables──> Confidence-calibration & bias-direction scoring (fraud-specific)

Recruiter Analytics Dashboard
    └──requires──> Sufficient historical attempt volume in Sheets (needs a documented low-N fallback state)
    └──requires──> Question-level aggregation logic (new — joins Responses × question bank)
    └──enhances-with──> Rubric-grading verdict data (open-text quality becomes a dashboard input)
    └──optionally requires──> LLM summary generation (reuses existing Gemini integration/API key)

Fraud-Specific Scoring Dimensions
(confidence calibration, bias direction, escalation-valid answers, time-pressure degradation)
    └──requires──> Extending grading engine (LOW-MEDIUM effort) + tagging existing question content
    └──enhances──> Recruiter Analytics Dashboard (new report dimensions) and candidate/recruiter Report
    └──conflicts with──> "MCQ/multi-select grading stays 100% deterministic" constraint IF implemented as
                          free text — must be implemented as discrete, still-deterministic answer options
                          (confidence as a fixed scale value, escalation as an additional valid MCQ choice)
```

### Dependency Notes

- **Async Report Delivery requires the async grading pipeline:** the thank-you page's "check your email shortly" copy is only honest if grading genuinely survives the candidate closing the tab — this is already a hard constraint in PROJECT.md and must be the true foundation, not just a UI change.
- **Rubric-Based LLM Grading requires F-03 mirror sync:** building recruiter-facing trust (transcript, override, structured output) on top of a grading path already known to have drifted from its test mirror (the F-03 audit finding) means fixing F-03 first, or the new trust-building UI is displaying an unverified grading engine.
- **Analytics Dashboard requires sufficient volume:** question-difficulty and discrimination stats are meaningless (or misleading) at low N — the dashboard needs an explicit "not enough data yet" state rather than showing noisy stats as if they were reliable.
- **Fraud-Specific Scoring Dimensions conflict with the determinism constraint if implemented as open text:** confidence and escalation signals must be discrete/structured inputs (a scale, an extra MCQ option) to stay inside the existing "MCQ/multi-select grading stays 100% deterministic" constraint — do not implement these as free-text fields requiring LLM interpretation.
- **LLM Dashboard Summary enhances but does not replace the deterministic dashboard:** the narrative digest is a value-add layer on top of the numeric item-analysis/trend views, not a substitute for them — recruiters should be able to trust the numbers even if the LLM summary is ignored or disabled.

## MVP Definition

### Launch With (v1.1 — this milestone)

- [ ] Thank-you screen with async report + recruiter-team summary email — why essential: this is the headline requirement of the milestone and the foundation everything else in this research builds on
- [ ] Rubric-based structured-output LLM grading for open-text (replacing the current ad hoc `evaluateOpenTextBatch` path) — why essential: without an explicit rubric and structured output, the recruiter override UI has nothing reliable to display
- [ ] Recruiter-visible transcript + verdict + override for LLM-graded questions — why essential: explicitly required by PROJECT.md once LLM grading is reintroduced; without it the "zero human review" guarantee is silently broken
- [ ] Core analytics dashboard: score trend, question-level difficulty (pass rate), violation-vs-score correlation — why essential: these are the metrics that actually drive better hiring/content decisions, not vanity counts, and directly serve the stated milestone goal
- [ ] False-positive/false-negative bias-direction indicator — why essential: low complexity, no new content authoring, and the single most directly "fraud-analyst-fit" scoring addition available at this cost

### Add After Validation (v1.2)

- [ ] LLM-generated dashboard narrative digest — trigger for adding: once the core numeric dashboard is in production and recruiters are actually reading it, add the digest to reduce time-to-insight
- [ ] Confidence-calibration scoring — trigger for adding: once the rubric-grading and dashboard foundations are stable; needs a small UI addition (confidence scale) worth sequencing after the core flow ships
- [ ] Escalation/"insufficient information" valid-answer path — trigger for adding: requires tagging a subset of the existing Critical Thinking bank; do this as a deliberate content pass once the scoring-engine changes for it are validated
- [ ] Bottom-N discrimination review queue — trigger for adding: once enough attempt volume exists for discrimination stats to be statistically meaningful

### Future Consideration (v2+)

- [ ] Two-pass/self-consistency LLM grading — why defer: added cost/latency only justified once single-pass grading has a track record and known failure modes to compare against
- [ ] Few-shot calibration anchors (gold-standard reference answers) — why defer: needs a real corpus of graded answers to build the reference set from; premature before v1.1 ships
- [ ] Candidate-revisitable grading-status page — why defer: only worth building if email delivery latency proves to be a real, measured problem in production
- [ ] Time-pressure accuracy-degradation signal — why defer: low complexity but lower priority than the bias-direction and difficulty-stat work; a nice-to-have refinement once the core dashboard exists

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Async thank-you + candidate/recruiter emails | HIGH | MEDIUM | P1 |
| Rubric-based structured LLM grading | HIGH | MEDIUM | P1 |
| Recruiter transcript + verdict + override UI | HIGH | MEDIUM-HIGH | P1 |
| Core analytics dashboard (trend, difficulty, violation correlation) | HIGH | MEDIUM | P1 |
| False-positive/false-negative bias-direction indicator | MEDIUM-HIGH | LOW-MEDIUM | P1 |
| LLM-generated dashboard narrative digest | MEDIUM | MEDIUM-HIGH | P2 |
| Confidence-calibration scoring | MEDIUM-HIGH | MEDIUM | P2 |
| Escalation/"insufficient information" valid path | MEDIUM | MEDIUM | P2 |
| Bottom-N discrimination review queue | MEDIUM | MEDIUM | P2 |
| Two-pass/self-consistency LLM grading | MEDIUM | MEDIUM | P3 |
| Few-shot calibration anchors | MEDIUM | MEDIUM-HIGH | P3 |
| Candidate-revisitable grading-status page | LOW-MEDIUM | MEDIUM | P3 |
| Time-pressure degradation signal | LOW-MEDIUM | LOW | P3 |

**Priority key:**
- P1: Must have for this milestone (v1.1)
- P2: Should have, add once P1 is stable (v1.2)
- P3: Nice to have, future consideration (v2+)

## Competitor Feature Analysis

| Feature | General ATS/skills-assessment platforms (TestGorilla, HackerRank, Codility-style) | Structured-hiring / psychometric tools (SHL, Pymetrics-style) | Our Approach |
|---------|--------------------------------------------------------------------------------|------------------------------------------------------------|--------------|
| Post-submission UX | Instant "thank you" screen, results delivered later by email/dashboard once any manual or async component exists | Similar — heavy emphasis on setting turnaround expectations since scoring often involves norm-referencing against a population | Match this pattern: thank-you screen with honest timeframe, immediate confirmation email, full report email once async grading completes |
| Analytics dashboard | Typically leads with completion rate, average score, time-on-test — often skews toward operational/vanity metrics unless the buyer specifically asks for item analysis | Stronger emphasis on item-level psychometrics (difficulty, discrimination) and norm groups, since defensibility against adverse-impact claims is a core selling point | Lead with item difficulty/discrimination and trend-by-cohort, not raw averages — closer to the psychometric-tool approach given this is a role with real judgment/fairness stakes |
| Open-text/free-response grading | Increasingly common to offer "AI-assisted" grading, but transparency/override support varies widely and is often a black box in cheaper tools | Traditionally avoided free-response scoring entirely in favor of structured/forced-choice formats specifically to keep scoring defensible | Take the more cautious posture: structured rubric + mandatory transcript/override, closer in spirit to the psychometric tools' defensibility standard, while still allowing genuine open-text judgment testing |
| Domain-specific judgment signals (calibration, bias direction, escalation paths) | Largely absent — most platforms are generic across job families and don't model direction of error or confidence calibration | Some presence in specialized risk/compliance-hiring products, but rarely exposed as recruiter-facing detail | This is where the platform can differentiate meaningfully — these signals map directly to what a fraud/trust-and-safety role actually needs, and are not standard even in higher-end tools |

## Sources

- General, established practice knowledge of ATS/pre-employment-assessment UX patterns (thank-you/async-result flows), standard psychometric item-analysis (pass rate, discrimination index) used in test-bank quality management, and LLM-as-judge/rubric-grading reliability practices (structured output, few-shot calibration anchors, human-in-the-loop override) commonly documented in applied-AI-evaluation literature.
- **Session limitation, disclosed for transparency:** live web search and web fetch tools were unavailable (permission denied by the environment) during this research session, and no Brave Search API key was configured for the `gsd-tools` websearch fallback, so no specific vendor pages, blog posts, or papers were fetched or cited this run. All findings above should be treated as MEDIUM-confidence domain synthesis rather than freshly verified sources — recommend a follow-up pass with live search enabled before treating any competitor-specific claim as authoritative.
- Internal source: `.planning/PROJECT.md` (existing constraints: MCQ/multi-select determinism, no paid proctoring/email services, async-must-survive-tab-close) and `backend/Code.gs` (existing `evaluateOpenTextBatch`, `handleSubmitAnswers`, `handleGetAttemptReport`, `handleAdminListCandidates` — read directly to ground dependency claims in the actual codebase rather than assumption).
- Prior milestone research: `.planning/research/FEATURES.md` (v1.0, dated 2026-07-29) covered table-stakes/differentiators for the original test-taking/reporting build — this document supersedes it for the v1.1 milestone scope (async delivery, analytics dashboard, LLM grading, fraud-fit evaluation quality) and does not repeat v1.0-validated features already shipped.

---
*Feature research for: Hiring assessment platform (fraud/trust-and-safety analyst vertical) — v1.1 async reporting, analytics dashboard, LLM open-text grading*
*Researched: 2026-07-31*
