# Feature Research

**Domain:** Gamified, auto-graded hiring assessment platform with browser-based (no-paid-API) integrity monitoring, for a Fraud Support screening test
**Researched:** 2026-07-29
**Confidence:** MEDIUM (see Sources — live web search/fetch tools were unavailable this session; findings reflect the researcher's trained knowledge of well-established, widely-documented industry patterns, not live-verified sources)

## Feature Landscape

### Table Stakes (Users Expect These)

Features candidates and recruiters assume exist. Missing these makes the product feel broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Pre-test instructions/onboarding screen (format, time limit, rules, "no going back once started") | Every assessment platform (HackerRank, Codility, TestGorilla, Mettl, Criteria Corp) shows this before the clock starts; candidates need to know the rules of engagement | LOW | Should state timer behavior, level count, and that answers are final once submitted |
| Visible progress indicator (X of Y questions, or per-level progress bar) | Universal in timed tests; anxiety and abandonment rise sharply when candidates can't tell how much is left | LOW | Maps directly to the 3-bank/level structure already decided in PROJECT.md |
| Visible countdown timer (overall and/or per-question) | Table stakes for any timed assessment; candidates actively distrust untimed "surprise cutoff" tests | LOW | Must be prominent, not hidden in a corner — ambiguity here reads as unfair |
| Auto-submit on timeout | Safety net so a stalled candidate doesn't lose the whole attempt to one question/section | LOW-MEDIUM | Must gracefully save partial progress and move on, not fail the whole session |
| End-of-test confirmation screen | Candidates need explicit confirmation their responses were received | LOW | "Your assessment has been submitted" — reduces support inquiries |
| One-way linear navigation within a section (no back-and-forth once answered, for gamified/timed formats) | Matches the "level" framing already chosen and prevents answer-changing exploits in a randomized bank | LOW-MEDIUM | Consistent with per-question timer; free back-navigation would conflict with per-question timing |
| Candidate identification capture (name + email) before starting | Needed to attach the report to a person and enforce one-attempt-per-email | LOW | Already an Active requirement in PROJECT.md |
| Overall score + per-trait score breakdown in the report | Standard across every pre-employment testing vendor (SHL, Criteria Corp, Pymetrics, HackerRank, Vervoe) — a single number alone is considered too opaque to act on | LOW-MEDIUM | Already decided as 3-axis model in PROJECT.md |
| Recommendation tier (e.g., Strong Fit / Consider / Not Recommended) | Recruiters do not want to interpret raw scores themselves; every commercial assessment tool ships some categorical verdict | LOW-MEDIUM | Requires defined score-to-tier thresholds, ideally calibrated by an SME before launch |
| Candidate list view for recruiters (name, email, date, score) | This is the baseline of every hiring-tool admin screen; without it there is no way to triage candidates | LOW-MEDIUM | Already an Active requirement |
| Detail view per candidate opened from the list | Recruiters always need to drill from summary → full report | LOW | |
| Basic authentication gating the admin panel | An assessment report containing PII must not be publicly reachable | LOW-MEDIUM | Non-negotiable security table stake, not just UX |
| Silent, non-interrupting integrity logging (tab-switch, blur, copy-paste, fullscreen-exit) | This is the accepted floor for any online, unproctored/lightly-proctored test today (TestGorilla, Mettl, Talview all offer this at the free/base tier) | MEDIUM | Already decided in PROJECT.md; must not interrupt the candidate mid-test |

### Differentiators (Competitive Advantage)

Not required, but valuable — and where this platform can meaningfully stand apart from generic assessment tools.

| Feature | Value Proposition | Complexity | Notes |
|---------|--------------------|------------|-------|
| Narrative "out-of-the-box thinking" insight (auto-generated text, not just a number) | Only a few vendors (Vervoe, Pymetrics) attempt natural-language insight generation; this converts the hardest/most-ambiguous-case performance into something a recruiter can act on without themselves interpreting raw scores | MEDIUM | Requires difficulty/ambiguity tagging on the Critical Thinking items during ingestion — a dependency, see below |
| Multi-tab "candidate dashboard" case simulation (Customer Report / Booking / Review / Property / Account tabs) | Directly mirrors the actual job task (cross-referencing fraud evidence); this is a much closer job-sample simulation than any generic MCQ test offers, and is the single strongest validity/face-validity asset this platform has | MEDIUM-HIGH | Already authored content; this is the platform's real differentiator versus HackerRank/Codility-style generic testing |
| Violation/integrity summary embedded directly in the shared candidate+recruiter report | Most free/self-serve tools either omit integrity data entirely or bury it in a separate proctoring vendor dashboard; surfacing it inline, in plain language, in the same report as the scores is unusual and useful | LOW-MEDIUM | Already decided; keep language neutral (see Anti-Features/Pitfalls) |
| Free, fully on-device webcam face-presence/face-count check (no frames uploaded, no paid vision API) | Most free/self-serve competitors skip webcam checks entirely (too costly to do server-side); running a lightweight in-browser model (e.g., a WASM/TF.js-class face detector) client-side, with nothing leaving the browser, sits near the frontier of what's achievable at zero marginal cost | MEDIUM-HIGH | This is more advanced than most "free tier" competitors attempt — a genuine differentiator, not just table stakes |
| Identical report shown to candidate and recruiter | Most vendors show recruiters a rich report and candidates a thin "thank you" page; full transparency is a candidate-experience differentiator and pre-empts "black box rejection" complaints | LOW | Already decided in PROJECT.md — validate, don't second-guess this choice |
| Level/mission narrative framing tied to the actual role story (fraud investigation theme) | Generic gamification (arcade points, unrelated badges) is common; theming the levels around the actual fraud-investigation narrative reinforces realistic job preview alongside engagement | LOW-MEDIUM | Keep restrained — see pitfall on over-gamification below |
| Stratified/difficulty-balanced random draw (not naive uniform sampling across all 375 items) | Guarantees every candidate faces a comparable difficulty mix even though each attempt is unique — most lightweight in-house assessment tools skip this and get uneven, less comparable scores across candidates | MEDIUM | Requires difficulty/level tags at ingestion time; strengthens validity of cross-candidate comparison |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create validity, legal, or scope problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|----------------|------------------|-------------|
| Live per-question correct/incorrect feedback during the test | Feels more "game-like" and immediately rewarding | Lets candidates recalibrate mid-test on later similar items, undermining measurement validity; can also demoralize or falsely inflate confidence based on partial info | Show a live points/progress counter (activity, not correctness) or defer all correctness feedback to the final report |
| Real-time leaderboard comparing the candidate to other candidates | Strong gamification hook, feels competitive/fun | Pressures candidates toward speed over accuracy (directly contradicts the "careful investigation" trait being measured for a Fraud Support role); legally risky as a disparate-impact vector; also requires exposing other candidates' data | Never show comparative data to the candidate in real time; keep any benchmarking recruiter-side only, and only once a meaningful sample exists (see below) |
| Live points/score-reveal as literal gamification currency, uncapped and un-normalized | Explicitly requested in PROJECT.md as part of "gamified" framing | If points reward raw speed of answering rather than accuracy, it creates a perverse incentive to blitz through Attention-to-Detail dashboard cases — exactly the opposite of the "patient, careful cross-referencing" trait the job requires | Keep points cosmetic/structural (tied to level completion, not per-second speed), and never let the point mechanic outweigh or leak the actual scoring model |
| True percentile/norm-group benchmarking shown from day one | "Feels" more rigorous and objective than a raw score | With zero or a handful of completed attempts, a percentile is statistically meaningless and can create false confidence in a hiring decision | Launch with raw score + SME-calibrated tier thresholds; only introduce true percentiles once a meaningful sample exists (order-of-magnitude: 100+ completed attempts) |
| Fully automated hire/reject action with no human step (auto-send rejection email, auto-schedule interview) | Aligns with the "zero human evaluation" grading philosophy already decided | Grading being deterministic is fine; making the *employment decision* itself fully automated with no human review carries real legal exposure (adverse-impact/disparate-treatment risk under frameworks like US Title VII, and automated-employment-decision-tool rules such as NYC Local Law 144 in other contexts) | Automate scoring and reporting fully; keep the recommendation tier advisory — a human recruiter still clicks "reject" or "advance" |
| Recruiter-side manual answer regrading/override UI in v1 | Feels like useful flexibility if a question is later found ambiguous | Reintroduces a human-in-the-loop grading path per-candidate, undermining the explicit "100% objective, no human grading" core value and creating scoring inconsistency across candidates | If a question is found flawed, fix or retire it in the content store and let the deterministic engine rescore; never hand-adjust one candidate's result |
| Full ATS feature set bolted on (job postings, interview scheduling, offer letters, pipeline stages) | "While we're building a hiring tool, why not go all-in" | Massive scope creep; this is a screening instrument, not an applicant tracking system, and competing with dedicated ATS tools is not the goal | Keep scope to assessment + report + admin review; let recruiters copy the recommendation into whatever ATS/email workflow they already use |
| Arcade-style gamification aesthetics (confetti, sound effects, mascot characters) | Increases "fun" and completion rates in consumer-app contexts | Can cheapen the perceived seriousness of a hiring decision; candidates report skepticism when a job screening feels like a mobile game, which undermines perceived fairness of the whole process | Keep gamification restrained and professional: level structure, progress, a coherent investigation narrative — not arcade polish |
| Hard, un-overridable one-attempt-per-email block with zero admin escape hatch | Matches the "one official attempt" decision literally | A browser crash, refresh, or power outage during a legitimate attempt permanently disqualifies an innocent candidate with no recourse | Keep the one-attempt policy as the default rule, but give the recruiter admin a manual reset/override capability for a specific email in documented technical-failure cases |

## Feature Dependencies

```
Question bank ingestion (375 items, tagged: category, level, difficulty/ambiguity)
    └──requires──> Structured content store (answer keys server-side only)
                       └──requires──> Deterministic auto-grading engine
                                          └──requires──> Trait score computation (3-axis)
                                                             └──requires──> Recommendation tier (score-to-tier thresholds)
                                                             └──requires──> Narrative "out-of-the-box thinking" insight
                                                                                (needs difficulty/ambiguity tags from ingestion)

Randomized per-attempt test assembly (~50 items)
    └──requires──> Question bank ingestion with category/level tags
    └──enhances──> Stratified/difficulty-balanced sampling (differentiator, avoids uneven cross-candidate difficulty)

Candidate identity capture (name + email)
    └──requires──> One-attempt-per-email enforcement
    └──requires──> Recruiter admin candidate list/report linkage

Client-side integrity monitoring (tab/blur, copy-paste, fullscreen, devtools, webcam)
    └──requires──> Backend logging endpoint tied to the candidate's attempt
    └──enhances──> Violation summary in shared report
    └──enhances──> Violation flag visibility in admin candidate list

Gamified UI (levels, progress bar, per-question timer, live points reveal)
    ──conflicts──> Live per-question correctness feedback (validity risk — see Anti-Features)
    ──conflicts──> Speed-rewarding point mechanics (undermines the "careful investigation" trait for Attention to Detail / Critical Thinking sections)

Fully automated recommendation tier
    ──conflicts──> Fully automated hire/reject action (legal/adverse-impact exposure — keep tier advisory, human-actioned)
```

### Dependency Notes

- **Trait score computation requires question bank ingestion with tags:** the 3-axis model (Language / Attention to Detail / Critical Thinking) only works if every ingested item is reliably tagged to its source bank; this must happen at ingestion, not after the fact.
- **Narrative insight requires difficulty/ambiguity tagging:** the "out-of-the-box thinking" narrative is explicitly derived from performance on the *hardest/most ambiguous* cases — this means Critical Thinking (and possibly Attention to Detail Level 2) items need a difficulty/ambiguity flag captured during ingestion, or this feature has nothing to key off of.
- **Stratified sampling enhances randomized test assembly:** without difficulty balancing, pure uniform random draw from 375 items risks giving different candidates meaningfully different difficulty mixes, weakening score comparability — this is a should-fix-early item, not a nice-to-have polish.
- **Gamified point mechanics conflict with per-question correctness feedback:** these two are commonly bundled together in generic "gamification" thinking, but for a role that specifically rewards care over speed, mixing them is actively counterproductive — treat them as separate design decisions, not a package deal.
- **Automated recommendation tier conflicts with automated hiring action:** scoring can be 100% automated safely; the *decision* to reject or advance a person should retain a human click, to manage legal/adverse-impact exposure.

## MVP Definition

### Launch With (v1)

Minimum viable product — already substantially matches PROJECT.md's Active requirements list; framed here by feature-research rationale.

- [ ] Candidate self-serve entry (name + email) — needed to identify candidates and enforce one-attempt-per-email
- [ ] Ingested, tagged 375-item content store (category, level, and at minimum a difficulty/ambiguity flag on Critical Thinking items) — every downstream feature depends on this
- [ ] Randomized ~50-item stratified draw per attempt — comparability across candidates requires at least basic difficulty balancing, not pure uniform random
- [ ] Gamified UI: level progress bar, per-question countdown timer, restrained (non-correctness-revealing) live progress/points indicator, auto-submit on timeout
- [ ] Deterministic MCQ/multi-select auto-grading engine, answer keys server-side only
- [ ] Baseline browser integrity signals, silently logged: tab/blur, copy-paste, fullscreen-exit, right-click block, soft devtools detection
- [ ] Free on-device webcam face-presence check (no upload/storage of frames)
- [ ] One-attempt-per-email enforcement
- [ ] Shared candidate+recruiter report: overall score, 3 trait scores, narrative insight, recommendation tier (advisory, not auto-actioned), plain-language violation summary
- [ ] Recruiter admin panel: authenticated candidate list (name, email, date, score, violation count) → full detail view

### Add After Validation (v1.x)

- [ ] Admin-side attempt reset/override for a specific candidate email — add once the first legitimate "my browser crashed" support case occurs
- [ ] Refine stratified sampling logic based on observed score distributions once real attempt data exists
- [ ] CSV export of the candidate list — add once recruiters start requesting data outside the tool
- [ ] Basic aggregate analytics (score distribution, average completion time, pass-rate trend) — add once there is enough volume (order of magnitude: dozens of completed attempts) for it to be meaningful
- [ ] Differentiated per-question-type time budgets (reading-heavy dashboard cases vs. quick grammar MCQ) if early data shows a section is unfairly time-pressured

### Future Consideration (v2+)

- [ ] True percentile/norm-group benchmarking — defer until a statistically meaningful sample exists (100+ completed attempts); shipping this earlier risks misleading precision
- [ ] Candidate pipeline/status tracking (interviewed, hired, rejected) — edges into ATS territory; defer unless recruiters explicitly ask to stop using their existing tool for this
- [ ] Role-based access control / multiple recruiter accounts with different permissions — defer while the hiring team is small and a shared login suffices
- [ ] Visual score breakdown polish (radar/spider chart) — cosmetic, defer until core report content is validated
- [ ] Downloadable/exportable PDF report — defer until there's a concrete compliance/archiving need
- [ ] Any demographic-segmented adverse-impact monitoring — legally sensitive, requires HR/legal sign-off on data collection before consideration, not a casual add

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Question bank ingestion with tags | HIGH | MEDIUM | P1 |
| Deterministic auto-grading engine | HIGH | MEDIUM | P1 |
| Randomized stratified test assembly | HIGH | MEDIUM | P1 |
| Gamified level/progress/timer UI | HIGH | MEDIUM | P1 |
| Baseline browser integrity monitoring | MEDIUM-HIGH | MEDIUM | P1 |
| Free on-device webcam check | MEDIUM | HIGH | P1 (already decided, but flag as the highest-effort v1 item) |
| Shared candidate+recruiter report w/ trait scores + tier | HIGH | MEDIUM | P1 |
| Narrative "out-of-the-box thinking" insight | MEDIUM-HIGH | MEDIUM | P1 |
| Recruiter admin candidate list + detail view | HIGH | LOW-MEDIUM | P1 |
| Violation flag visibility in admin list | MEDIUM | LOW | P1 |
| Admin-side attempt reset/override | MEDIUM | LOW | P2 |
| CSV export | LOW-MEDIUM | LOW | P2 |
| Aggregate analytics dashboard | MEDIUM | MEDIUM | P2 |
| Differentiated per-question-type timing | MEDIUM | LOW-MEDIUM | P2 |
| True percentile/norm benchmarking | MEDIUM | HIGH | P3 |
| Candidate pipeline/status tracking | LOW | MEDIUM | P3 |
| Role-based multi-recruiter access | LOW | MEDIUM | P3 |
| PDF export / visual chart polish | LOW | LOW-MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature Area | HackerRank / Codility (technical-assessment lineage) | Pymetrics / Arctic Shores (game-based psychometrics) | TestGorilla / Mercer Mettl / Criteria Corp (SMB pre-employment testing) | Our Approach |
|---------------|--------------------------------------------------------|--------------------------------------------------------|-----------------------------------------------------------------------------|--------------|
| Test UI framing | Plain timed test, minimal gamification, IDE/code-runner style | Full game framing (neuroscience-style mini-games, abstract) | Timed MCQ blocks, light progress bar, minimal game framing | Level/mission framing tied to the actual fraud-investigation narrative — more restrained than Pymetrics, more engaging than TestGorilla |
| Mid-test feedback | None (correctness withheld) | None (games don't reveal "correct/incorrect" by design) | None | None — restrained live progress indicator only, no correctness reveal (see Anti-Features) |
| Results report | Score + code quality metrics, no narrative text | Proprietary trait scores + narrative "fit" summary | Score + percentile benchmark (large existing norm pool) + tier | Score + 3 trait scores + narrative insight + tier, but percentile deferred until sample size supports it |
| Recruiter dashboard | Candidate list, detail view, some team collaboration features | Dashboard with fit-score comparisons across candidates | Candidate list, filters, CSV export, benchmark comparisons | Candidate list, detail view, violation flags in v1; export/analytics deferred to v1.x |
| Integrity/proctoring | Basic tab-switch detection at free tier; paid video proctoring add-on | Typically none (games are harder to "cheat" at meaningfully) | Free tier: tab/blur, copy-paste, fullscreen; paid tier adds webcam/video review | Baseline signals matched to the free tiers above, plus a free on-device webcam check most competitors reserve for paid tiers |
| Automated decisioning | Score threshold only, human still decides | Fit score, human still decides | Tier/recommendation, human still decides | Advisory recommendation tier, human recruiter still actions — consistent with all three lineages above |

## Sources

- No live web search or web fetch was available in this research session: the `WebSearch` and `WebFetch` tools were both denied by environment permissions, no Brave Search API key was configured for the `gsd-tools` websearch fallback, and no MCP server providing general web research was available (only `pencil` for design files and `context7` for library documentation, neither applicable to this domain question).
- This document is therefore built from the researcher's trained knowledge of widely-documented, well-established industry patterns as of training cutoff: HackerRank, Codility, TestGorilla, Mercer Mettl, Criteria Corp, Pymetrics, Arctic Shores, Vervoe, SHL, and proctoring vendors Proctorio/Examity/Honorlock, plus commonly cited concerns in HR-tech/EEOC and second-language-testing literature regarding timed tests and automated employment decision tools (e.g., discussions parallel to NYC Local Law 144-style automated-employment-decision-tool regulation).
- **Recommendation:** treat this file's factual claims about specific competitor feature sets as MEDIUM confidence (consensus industry patterns, not freshly verified citations); if a live web-research pass becomes available later in this project, re-verify vendor-specific claims (especially anything version- or pricing-specific) before using them in external-facing documentation.

---
*Feature research for: Gamified, auto-graded hiring assessment platform (Fraud Support screening)*
*Researched: 2026-07-29*
