# Pitfalls Research

**Domain:** Self-serve, gamified, auto-graded hiring assessment platform (MCQ/multi-select, client-side integrity monitoring, no paid proctoring)
**Researched:** 2026-07-29
**Confidence:** MEDIUM overall — grounded in well-established web-security, browser-API, and EEOC/AI-hiring-compliance knowledge; live web verification was largely unavailable in this session (WebSearch denied, no Brave API key, WebFetch denied for all but one MDN lookup — see Sources). Treat legal/compliance claims as directional, not legal advice; validate with counsel before launch.

## Critical Pitfalls

### Pitfall 1: Full question+answer payload sent to the client ("view-source cheating")

**What goes wrong:**
The single most common failure in home-grown quiz platforms: the server assembles the ~50-item test and sends the *entire* question object — including `correctAnswer`, `answerKey`, or an `isCorrect` flag per option — to the browser in the initial page load or a single `/api/test/:attemptId` response, because it's simpler to render options and validate client-side. A candidate opens DevTools → Network/Sources tab, greps the JSON for the answer field, and gets 100% instantly. This is *the* textbook mistake in every "we built our own quiz app" post-mortem.

**Why it happens:**
It's the path of least resistance: one API call returns the question set, the client renders it, and "grade on submit" feels like it should compare client-side too. Developers moving fast from a CMS/ingestion pipeline (docx → question objects) often carry the answer key along in the same object all the way to the client because splitting it feels like extra plumbing.

**How to avoid:**
- Maintain two representations from ingestion onward: an **internal question record** (prompt + options + correct answer(s) + metadata) and a **candidate-safe projection** (prompt + options only, options order randomized, each option tagged with an opaque ID, not an index that maps predictably to key order).
- The server never serializes the internal record to any client-facing response — not in the initial payload, not in a "prefetch next question," not in an error message, not in a source map, not in a debug/console log left on in production.
- Grading endpoint accepts `{attemptId, questionId, selectedOptionIds[]}` and looks up the answer key server-side only; response returns pass/fail + running score, never "the correct answer was X" until the whole attempt closes (and even then, exposing per-question keys post-attempt should be a deliberate decision, not a leak).
- Automated test: assert every response body reaching the browser during a test attempt, when greped for the ingested answer-key field names, returns zero matches.

**Warning signs:**
- A single "get test" endpoint returns objects that already contain a field like `answer`, `correct`, `key`, or a boolean per-option `isCorrect`.
- Grading logic exists in client-side JS (a function that compares `selected === expectedAnswer` inside a bundle you can unminify).
- Network tab shows question data arriving before the candidate reaches that question (whole-test-at-once payload) rather than incrementally.

**How to avoid (phase mapping):**
**Phase to address:** Test Assembly & Grading Engine phase (server-side architecture must be decided before any UI is built against it) — this is a foundational architecture decision, not a late hardening pass.

---

### Pitfall 2: Weak/predictable randomization lets the question bank be reconstructed across attempts

**What goes wrong:**
Even with correct server-side grading, if the sampling algorithm is naive (e.g., `ORDER BY RANDOM() LIMIT 50` with no seed tracking, or worse, cycling deterministically through the bank in a fixed order shifted by attempt count), colluding candidates — or one candidate coordinating with future test-takers via a shared doc — can, over enough attempts, reconstruct large fractions of the 375-item bank and its answers, especially since this is explicitly a small, closed pool (not infinite item generation). Given only ~50 of 375 are shown per attempt, ~14-15 attempts is the theoretical minimum to see every item at least once if sampling were perfectly uniform with no repeats across candidates — realistically far fewer attempts are needed to build a "cheat sheet" covering the highest-yield categories.
This is compounded because the source content is **fixed and finite** (375 pre-authored items, not generated) — once an item and its answer are known, they are known forever; there's no way to "rotate" the bank without re-authoring content.

**Why it happens:**
Developers assume "random" is automatically secure. It's not: it's a probability problem, not a cryptography problem, and a finite closed bank is inherently exhaustible by determined collusion. The team also may not consider that this is a self-serve product with no gatekeeping — anyone can request unlimited attempts under different emails (see Pitfall 3) unless that's separately closed, multiplying the reconstruction rate.
This is not a request in your feature set to *prevent* eventually — it is a request to *plan for* (bank exhaustion is a content-lifecycle problem, not purely a technical one).

**How to avoid:**
- Treat "the bank will eventually leak" as the honest baseline assumption for a fixed, finite, non-generated pool — the goal is to slow reconstruction and detect it, not to make it impossible.
- Enforce true per-attempt randomization with quota constraints (see Pitfall 4) using a cryptographically fine (not necessarily crypto-secure, but unbiased) shuffle — `Math.random()`-based `ORDER BY RANDOM()` in SQL is acceptable for this threat model; the bigger risk is *quota logic bugs* that make certain items appear far more often than others (see Pitfall 4), which accelerates reconstruction of the high-frequency subset.
- Rate-limit and monitor: log which question IDs are served to which attempts; build (even a manual/periodic) report of item-exposure frequency. If particular items are being served to a disproportionate share of attempts, that's a signal to check the sampling algorithm, not just a security curiosity.
- Because one-attempt-per-email is the only gate (Pitfall 3), the real mitigation is upstream: making it costly to generate many distinct "official" attempts, and — as a content-lifecycle plan, not a v1 build task — periodically refreshing/retiring a portion of the bank between hiring cycles so a leaked cheat-sheet decays in value over months.
- Do not expose "you got question X wrong, the answer was Y" in a way that is copy-pasteable and shareable at scale (e.g., a fully public report URL with no auth that anyone can view) unless that's an accepted tradeoff — the shared-report requirement here explicitly makes correct answers visible to the candidate after their attempt, which is a deliberate design choice; document it as a known exposure vector, not an oversight.

**Warning signs:**
- No logging exists of "which question IDs were served in which attempt" — if you can't answer "how many times has item #217 been shown this month," you can't detect reconstruction risk.
- The post-attempt report reveals correct answers for every item (including ones the candidate got right), which is more exposure than necessary — consider showing correctness per category/trait without echoing the literal correct-answer text for every item, especially high-value/rare items.

**Phase to address:** Test Assembly Engine phase (sampling algorithm + exposure logging) and Reporting phase (decide how much per-item detail the shared report reveals).

---

### Pitfall 3: "One attempt per email" is enforced by email string alone — trivially bypassed

**What goes wrong:**
Because there is no invite link and no identity verification (explicitly out of scope), the only barrier to unlimited "official" attempts is the email address the candidate types in. Naive implementations check `WHERE email = ?` in the attempts table. This is defeated by:
- Gmail/Outlook **plus-addressing** (`jane+1@gmail.com`, `jane+2@gmail.com` — all deliver to the same inbox, all look "different" to a naive string-equality check).
- Gmail **dot-insensitivity** (`jane.doe@gmail.com` and `janedoe@gmail.com` are the same mailbox but different strings).
- Case sensitivity (`Jane@Gmail.com` vs `jane@gmail.com`).
- Disposable/temp-mail services generating an unlimited number of real, receivable addresses.
- Simply using a different real personal/work/friend's email each time — since there's no verification step (no confirmation email, no OTP), nothing confirms the submitter actually owns/controls the email at all.

**Why it happens:**
"One attempt per email" reads like a simple uniqueness constraint, so it's implemented as one. The team correctly scoped out invite links and OTP verification as unnecessary complexity for v1, but that decision has a direct side effect: it makes the uniqueness gate purely self-reported and easily gamed by anyone motivated enough to want a second try (which, notably, is exactly the population most likely to want to re-attempt — people who did poorly).

**How to avoid:**
- **Normalize email before uniqueness check**: lowercase the whole address; for known providers (Gmail, Googlemail), strip dots from the local part and strip everything after `+`. Store both the raw submitted email (for contact/report purposes) and the normalized canonical form (for the uniqueness constraint).
- Accept that full verification is out of scope, but at minimum add a **lightweight, zero-friction signal layer** that doesn't require an invite link: device/browser fingerprint hash + IP address/subnet logged alongside the attempt, so the admin panel can flag "same fingerprint, different email" as a probable retake even if not hard-blocked. Surface this as a violation flag rather than a hard block, consistent with the project's existing "flag rather than interrupt" philosophy for integrity monitoring.
- Decide and document explicitly what "blocked or flagged" means operationally (the PROJECT.md itself leaves this ambiguous — "blocked or flagged as a retake"): a hard block on a normalized-email match is cheap and should ship; the flag-based heuristics for evasion (fingerprint/IP reuse) should be visible to recruiters in the admin panel as a "possible duplicate" indicator, not silently auto-rejected (false positives are likely — shared work networks, corporate NAT, family members on one device).
- Do not treat email uniqueness as identity verification in messaging to stakeholders — internally document that this is a **speed bump for casual retakes**, not a security control against a determined bad actor, since that expectation-setting affects how much recruiters should trust "one attempt" as a hard guarantee when making hiring decisions.

**Warning signs:**
- The uniqueness check is a raw SQL `UNIQUE` constraint or `WHERE email = ?` on the literal submitted string with no normalization step visible in the ingestion/attempt-creation code.
- No fingerprint/IP is captured at attempt-start, meaning there is zero forensic trail if two attempts under different emails need to be compared later.
- No admin-panel surface exists for "candidates who may be retaking under a new email" — this pitfall silently costs nothing until a recruiter notices two near-identical answer patterns and asks "can we tell if this happened before?" and the answer is no.

**Phase to address:** Candidate Entry / Attempt Lifecycle phase (email normalization + fingerprint capture must be built into attempt creation from day one — retrofitting fingerprint capture after attempts already exist means historical attempts have no comparison data).

---

### Pitfall 4: Random test-assembly quota math doesn't sum cleanly, or produces uneven difficulty/category balance

**What goes wrong:**
"Draw ~50 items per attempt, per-category/level, from a pool of 375 split across three unevenly-sized banks (95 English, 160 Attention-to-Detail, 120 Critical Thinking, further subdivided by level/section)" is a quota-sampling problem, and quota-sampling implementations reliably get two things wrong:
1. **The quotas don't sum to the target length.** If English gets a fixed count per sub-category (Grammar, Sentence Correction, Macro Editing, Reading Comprehension, Case Closure Notes) and Attention-to-Detail gets a fixed count per level, and Critical Thinking gets a fixed count, rounding errors (e.g., "12% of 50 questions" per subcategory) mean the total assembled test is 47 or 53 items instead of exactly ~50, and this usually isn't caught until QA notices score-out-of-N is inconsistent between candidates.
2. **Uneven difficulty/category weighting in practice even when quotas are numerically correct.** If "4 questions per Attention-to-Detail case" is the atomic unit (per PROJECT.md: 40 cases × 4 questions each) but the sampler picks *cases* rather than *questions* to hit its quota, an off-by-one in case-selection math can produce lopsided category coverage (e.g., disproportionately drawing from Level 1 cases vs Level 2), silently making some attempts easier or harder than others — which directly undermines the stated goal of "every candidate gets a fair, consistent... read."

**Why it happens:**
Quota math is deceptively fiddly: percentages of an odd target number (50) rarely divide evenly across 3+ categories and their sub-levels, and case-based content (where a "unit" is 4 questions, not 1) breaks simple "pick N random rows" logic — you must sample at the case/group level and then take the whole group's questions, or explicitly handle partial-case selection, and it's easy to write code that assumes 1 row = 1 question everywhere.

**How to avoid:**
- Decide the exact quota table up front as integers, not percentages (e.g., "English: 15, Attention-to-Detail: 20 [across specific case counts], Critical Thinking: 15" — confirm these against `FS QB Pattern.xlsx`, which the project context says already contains the settled per-category quotas) and write a unit test that asserts `sum(quotas) === TARGET_LENGTH` at build/config-load time, not just at runtime per-attempt.
- For case-based banks (Attention-to-Detail, Critical Thinking), sample at the **case level** first (pick N cases), then include all 4 questions from each selected case — don't sample individual questions independently unless the design explicitly wants partial-case fragments (which would strip the case of its cross-referencing "research" context and likely isn't the intent, given the multi-tab dashboard is described as the point of those sections).
- Build an automated "assemble 1000 sample tests and report the distribution" check as a CI/QA step: verify every simulated attempt hits exactly the target length, every category quota is met exactly (not "approximately"), and item-frequency variance across the 1000 runs is within an acceptable band (catches biased/non-uniform sampling, e.g., a query that favors lower-ID rows).
- Explicitly define what happens when a quota can't be met (e.g., a category temporarily has fewer available *unused-recently* items than the quota requires) — fail loudly in development, decide a documented fallback in production (e.g., allow item reuse across attempts, since reuse *across different candidates* is expected/necessary here, unlike reuse *within* one candidate's single attempt).

**Warning signs:**
- Quota values are stored/computed as percentages applied to 50 with no rounding strategy specified (`Math.round` vs `Math.floor` vs largest-remainder method all give different totals).
- No test exists that asserts total assembled question count equals the target for every possible category-quota combination.
- Case-based sections have "pick 4 random questions" logic instead of "pick 1 random case, take all 4."

**Phase to address:** Test Assembly Engine phase — this must be validated with automated tests before any gamified UI (progress bar, level structure) is built on top of it, since the UI assumes a fixed, predictable structure (e.g., "Level 2 of 3," progress bar percentage) that breaks visibly if quotas are inconsistent per attempt.

---

### Pitfall 5: Client-side-only integrity monitoring produces unreliable signals that get over-trusted in hiring decisions

**What goes wrong:**
Every signal in the planned integrity stack (tab-switch/blur count, copy-paste detection, dev-tools detection, fullscreen-exit detection, right-click blocking, on-device webcam face-count) has known reliability gaps that produce **both false positives and false negatives**, and if the admin panel presents "violation count" as a clean, trustworthy number, recruiters will over-weight it:
- **Page Visibility API / blur-focus events**: reliably detects tab switches and window minimizing, but does NOT distinguish "candidate is cheating" from "candidate's OS notification popped up," "candidate has a second monitor and glanced at it without switching focus" (no signal at all — this is invisible to any of these APIs), or "candidate's browser triggered a permission prompt." A second monitor is a complete blind spot for tab/blur-based detection — a candidate can have the entire answer key open on a second screen and never trigger any tab-switch or blur event.
- **Dev-tools detection** (usually implemented via `debugger` statement timing tricks, window-size heuristics, or `console.log` getter tricks) is well known to be unreliable across browsers/OS combinations, generates false positives (a slow machine misreported as "devtools open" due to timing-based detection), and is trivially defeated by detaching devtools to a separate window sized to not trigger the heuristic, or by using a second device entirely to look up answers (which no client-side signal can ever detect, by definition — proctoring only sees the one device it's running on).
- **Right-click/context-menu blocking** is security-theater against copy-paste in particular: keyboard shortcuts (Ctrl+C, Ctrl+U for view-source, browser dev tools via F12) all bypass a JS-based `contextmenu` event handler entirely, and any candidate can disable JavaScript-driven blocking via reader mode, browser extensions, or simply reading network responses directly.
- **On-device webcam face-count/presence checks**: framed correctly in the project as a free, non-recorded, on-device-only signal, but must not be oversold as "verifies candidate identity" or "proves no one else is helping" — a face being present and roughly matching "count = 1" says nothing about a second person off-camera feeding answers verbally, a phone with the answer key held just out of frame, or the true identity of the face (no identity-matching against an ID document is in scope). Face-detection models also have well-documented differential accuracy issues across lighting conditions and skin tones, which risks disproportionately flagging some candidates as "no face detected" through no fault of their own — a fairness issue, not just a technical one, if that flag affects the recommendation tier.
- **A candidate can simply disable JavaScript** or use a non-standard/scriptable browser automation context; if the entire integrity layer is JS-based instrumentation with no server-side fallback check, disabling JS silently produces a "zero violations" record that looks identical to a perfectly clean, honest attempt.

**Why it happens:**
Client-side detection is fundamentally an arms race the client always loses in principle — anything running in a browser the candidate controls can be inspected, throttled, or subverted, because the "attacker" (a motivated candidate) has full control of the execution environment. Teams building this understandably reach for available browser APIs because they're free and easy to wire up, but treat "we detect X" as equivalent to "X cannot happen," which isn't true for any client-side signal.

**How to avoid:**
- Frame every integrity signal internally (and in any documentation recruiters see) as a **weak, probabilistic signal to be reviewed by a human, not an automated verdict**. The admin panel should show raw counts/timestamps of each flagged behavior (e.g., "3 tab-switches, total 45s away; devtools-open detected once at question 12; face-not-detected for 8% of session") rather than collapsing everything into a single "violations: 4" number that implicitly suggests all flags are equally meaningful or equally serious.
- Never let an integrity flag alone drive the recommendation tier automatically — keep integrity/violation reporting visually and structurally separate from the trait-score-based recommendation, exactly as the PROJECT.md already scopes it ("integrity/violation summary" as a distinct section) — do not let this separation erode during implementation for UI-simplicity reasons.
- Add a server-side floor check that doesn't depend on JS at all where feasible: e.g., total time-on-test vs. expected minimum time (a test "completed" in an implausibly short duration is a strong signal computable entirely server-side from submit timestamps, independent of any client instrumentation candidates could disable).
- Explicitly log "no integrity data received" (e.g., zero visibilitychange events fired for an entire session, which is itself unusual and suspicious) as its own distinct flag, rather than defaulting an absent signal to "clean." A total absence of any browser-event telemetry for a full attempt is itself a data point worth surfacing.
- Do not market or internally describe the platform as detecting "cheating" — describe it as detecting "behavioral irregularities for recruiter review," which is both more accurate and reduces legal/reputational exposure if a flagged candidate disputes a rejection.

**Warning signs:**
- The admin panel shows a single collapsed "violations" integer with no breakdown of which signal(s) fired, timestamps, or duration.
- Any part of the scoring/recommendation-tier logic reads the integrity fields as an input (rather than keeping them a fully separate, human-reviewed section).
- No test exists for "what does the report look like when JavaScript integrity signals never fired at all" (JS disabled, or all listeners failed silently) — if that state renders identically to "clean attempt," it's a gap.

**Phase to address:** Integrity Monitoring phase for signal capture/logging; Reporting phase for ensuring the UI keeps integrity data visually/structurally separate from the trait-score recommendation.

---

### Pitfall 6: Deriving "trait scores" and a hiring "recommendation tier" from an internally-authored, unvalidated question bank overclaims psychometric validity — and carries real legal exposure

**What goes wrong:**
Mapping raw category scores (English Proficiency → "Language Expertise," Attention to Detail → "Attention to Detail & Research," Critical Thinking → "Logical/Critical Thinking") directly into named trait scores, plus a headline "recommendation tier" (Strong Fit / Consider / Not Recommended), presents the output with the visual authority of a validated psychometric instrument — even though the underlying content is a hand-authored MCQ bank with no item-response-theory calibration, no measured reliability (test-retest, internal consistency/Cronbach's alpha), no adverse-impact/disparate-impact analysis across protected groups, and no established construct validity linking "getting these specific MCQs right" to "will perform well investigating fraud in review content." This is the single most common failure mode when small teams build in-house assessment tools: the *tool* looks and reads exactly like a validated pre-employment test, but was never held to that standard, and recruiters (and rejected candidates) will reasonably treat a named score + recommendation tier as more authoritative than it is.
There is also a distinct, separate legal-exposure dimension specific to *this being an employment decision tool*: in the US, several jurisdictions (most notably NYC Local Law 144) and the EEOC's technical guidance on Title VII/ADA treat "automated employment decision tools" used to substantially assist or replace human hiring judgment as subject to bias-audit and disclosure obligations, and any selection procedure with adverse impact across a protected class must be validated as job-related and consistent with business necessity (the "four-fifths rule" framework under the Uniform Guidelines on Employee Selection Procedures is the classic reference point US employers get tested against). A platform that auto-generates a recommendation tier without ever having examined whether pass rates differ meaningfully by gender, age, disability status (screen-reader compatibility of a timed, gamified UI is itself a relevant ADA consideration), or other protected characteristics is building exactly the kind of tool that draws regulatory and litigation attention if used at any real scale.

**Why it happens:**
The team's own rationale (documented in PROJECT.md) is entirely defensible from a product-simplicity standpoint — "avoids hand-tagging all 375 items by sub-trait before shipping" — but that's an engineering-effort tradeoff being made without an explicit, visible counterpart tradeoff being acknowledged: *the recommendation tier's apparent authority now exceeds its actual evidentiary basis*. This gap is invisible in development (nothing breaks, no test fails) and only becomes visible when a rejected candidate disputes the outcome or a regulator asks "how did you validate this tool."

**How to avoid:**
- **Language discipline in the UI/report itself**: label scores as "assessment performance" or "screening results," not as validated trait/competency measurements. Avoid language implying psychometric rigor ("IQ," "aptitude," "personality trait") that the underlying content can't support. A footnote/disclaimer on the report stating the nature of the assessment (internally authored, criterion-referenced to specific job tasks, not a validated psychometric instrument) is cheap insurance.
- **Reframe the recommendation tier as decision support, not a decision**: explicitly document (and ideally state in the report itself) that the tier is a screening aid, and hiring decisions require human review — this is both good practice and directly relevant to reducing "automated decision" regulatory exposure, since tools that assist rather than replace human judgment are treated differently than fully automated deny/hire tools in most current guidance.
- **Track adverse impact from day one, even informally**: at minimum, capture self-reported or inferable demographic signals where legally appropriate (often deliberately *not* collected at all to avoid the appearance of using them in scoring — consult counsel on whether/how to even measure this) or, more practically, monitor pass-rate patterns by any available proxy dimension and revisit if a stark skew appears. Build the admin panel/reporting data model so a future adverse-impact analysis is *possible* (i.e., retain enough attempt-level data, including which items were drawn and answered, in queryable form) rather than needing to be retrofitted after the tool's already in wide use.
- **Timed, gamified UI accessibility**: a per-question countdown timer and clock-pressure gamification can disadvantage candidates with certain disabilities or non-native-but-competent English readers in ways unrelated to the actual job skill being tested (this matters specifically for the English Proficiency category, where "under time pressure" and "proficient" are being conflated) — consider whether the timer element is testing the job-relevant skill or an unrelated speed trait, and whether reasonable-accommodation processes are needed for a fully automated self-serve tool with no human in the loop to request one from.
- **Do not silently expand scope**: if "recommendation tier" starts being used as a hard auto-reject gate rather than recruiter input, that's the exact threshold where legal exposure escalates from "assistive tool" to "automated employment decision"; flag this as a governance decision to revisit explicitly before it happens organically.

**Warning signs:**
- The report or UI copy uses confident, validated-sounding language ("Certified," "Verified Aptitude," a precise-looking numeric score like "87.3") without any accompanying methodology note.
- No one on the team can answer "if we ran this on 200 real candidates, would pass rates differ by gender/age/disability status?" because the data to check isn't even being retained.
- The recommendation tier is being treated (even informally, in early usage) as sufficient to reject a candidate without any further human review step.

**Phase to address:** Reporting & Trait Scoring phase for report language/disclaimers and separating "recommendation" from "decision"; this is also a **cross-cutting governance item** that should be flagged explicitly in the roadmap as a "needs stakeholder/legal sign-off" checkpoint rather than assumed resolved by any single engineering phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|--------------------|-----------------|------------------|
| Skip email normalization, use raw string equality for "one attempt per email" | Faster to ship the attempt-lifecycle flow | Trivial retake gaming via +addressing/dots/case; undermines "one official attempt" premise entirely | Never — normalization is a few lines of code, not a phase of work |
| Send the whole assembled question set (safe projection) to the client in one payload up front, instead of per-question fetches | Simpler client state management, works offline mid-attempt | Marginally larger attack surface for timing/ordering inference (still safe if answer key is excluded) but acceptable if genuinely no answer-bearing fields are present | Acceptable only if a payload-scanning test proves zero answer-key leakage; never acceptable as a substitute for keeping grading server-side |
| Hand-wave case-based quota sampling as "just pick 50 random questions" instead of case-then-question sampling | Faster to build v1 sampler | Breaks category balance guarantees, breaks the "research across dashboard tabs" experience for partially-sampled cases | Never for case-based banks (Attention to Detail, Critical Thinking); fine for flat item pools like English Proficiency sub-sections if quota math still sums correctly |
| Treat integrity "violations" as a single summed integer for MVP admin panel | Faster to build the admin list view | Recruiters over-trust a meaningless aggregate number; can't distinguish "glanced at a notification once" from "devtools open + no face detected the whole time" | Acceptable only as a placeholder before the detail-report view ships in the same phase; never acceptable as the permanent design |
| Hard-code trait-score mapping as 1:1 category-average with no confidence/reliability indicator | Ships v1 without hand-tagging 375 items by sub-trait | Report reads as more authoritative/precise than the underlying data supports; risk compounds every hiring cycle it's used unexamined | Acceptable for MVP if paired with explicit "not a validated instrument" disclaimer language; revisit before any high-volume or externally-scrutinized use |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|--------------|------------------|--------------------|
| docx/xlsx ingestion (Mammoth/docx4js/exceljs-style parsers) | Treating inline answer markers (✅/☑/☐ glyphs) as guaranteed-consistent formatting across all three source docs; a single differently-authored section silently ingests with no answer key or a wrong one | Build a post-ingestion validation pass: every ingested question must have exactly the expected number of marked-correct options for its type (exactly 1 for MCQ, ≥1 for multi-select); flag and manually review any item that fails this invariant before it enters the live pool |
| Browser fingerprinting libraries (for retake-detection heuristics) | Treating a fingerprint match as a hard "same person" signal and auto-blocking | Use fingerprint/IP only as a soft "possible duplicate" flag surfaced to a human recruiter, given shared-device/shared-network false positives are common and blocking a legitimate distinct candidate has real cost |
| On-device face-detection library (e.g., a WASM/TF.js model running client-side) | Sending detection results (or worse, frames/images) to the server for "verification," implicitly creating stored biometric data despite the explicit "no recording/storage" design intent | Keep all frame processing and disposal client-side; only transmit a minimal derived signal (e.g., periodic presence/count boolean + timestamp) to the server, never raw image data, and document this boundary clearly since biometric data handling has its own regulatory regime (e.g., BIPA-style state laws) distinct from general hiring-tool concerns |
| Countdown timer + client-clock trust | Trusting the client's `Date.now()`/timer state as authoritative for "did they finish in time" | Server independently timestamps question-serve and answer-submit events; time-per-question and total-duration calculations for both gamification (UI feedback) and integrity signals (implausibly fast completion) should be derived from server timestamps, not self-reported client timer state |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Naive `ORDER BY RANDOM() LIMIT N` per-category query against the full 375-item table on every attempt-start | Fine at low volume; becomes a full-table-scan-and-sort bottleneck as concurrent attempt-starts increase | Pre-shuffle/pre-index or use application-level weighted sampling from an in-memory or cached candidate pool rather than a DB-level random sort on every request | Noticeable once dozens of candidates start attempts concurrently (e.g., a bulk recruiting push sending the link to many applicants at once) — small absolute numbers, but bursty self-serve traffic is exactly this platform's expected usage pattern |
| Storing full per-question, per-event integrity telemetry (every blur/focus/copy-paste tick) as unindexed rows with no retention policy | Admin panel candidate-detail view gets slower to load per candidate over time; storage grows unbounded | Aggregate integrity events into per-attempt summary rows at write time (counts + first/last timestamps per event type) with an optional raw-event-log table that's archived/pruned separately, not the primary read path for the report | Becomes noticeable once the candidate pool is in the hundreds and the admin list view starts joining against a large raw-event table for every row |
| Re-rendering the entire multi-tab case dashboard (Customer Report, Booking Details, Review Info, Property Listing, Account Info) from scratch on every tab switch within a case | Sluggish, laggy "research" UX defeats the gamified feel, especially on lower-end devices candidates may be using | Keep all tab content mounted/cached client-side once a case loads; tab switching should be a pure visibility toggle, not a re-fetch/re-render | Becomes noticeable as soon as any tab contains non-trivial content (tables, multiple fields) and switches are frequent, which is the explicit design intent of "cross-referencing dashboard tabs" |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Answer key present anywhere in client-reachable payload (initial load, source maps, error responses, or a "review your answers" page rendered before the attempt is officially closed) | Instant, total compromise of that test instance's integrity; with a finite 375-item bank, a handful of full-payload leaks can meaningfully compromise large fractions of the pool | Server-side-only answer storage; automated response-payload scanning test in CI; never ship source maps for the candidate-facing bundle in production |
| Grading endpoint accepts client-declared "score" or "correct" fields as authoritative instead of recomputing server-side from submitted option IDs | Candidate can forge a passing score via a modified request even if the UI never displays the answer key | Server always recomputes score from stored answer keys + submitted option IDs; client-declared score/correctness fields are ignored entirely (log-and-alert if received, as evidence of tampering attempts) |
| Attempt-lifecycle state (has this email already attempted? is this attempt still "in progress" or "submitted") enforced only client-side (e.g., a `localStorage` flag "attempted: true") | Trivially bypassed by clearing browser storage or using a different browser/private window | All attempt-state gating enforced server-side against the normalized-email record; client-side flags are UX convenience only, never the actual gate |
| Admin panel (candidate list + full detail reports) reachable without authentication, or with weak/shared credentials, given it contains name+email+detailed performance data for every applicant | PII and hiring-decision data exposure; given "shared report" already means candidates see the same report as recruiters, the admin *list* view (aggregating everyone) still needs real access control distinct from the single-candidate report link | Proper auth (not just an obscure URL) for the admin panel; per-candidate report links should use non-guessable tokens/IDs, not sequential integers, since a candidate's own report link is candidate-facing and must not allow enumerating other candidates' reports |
| Case-file "research" dashboards (Customer Report, Booking Details, Account Info, etc.) implemented as static content bundled into the client for all cases at once, rather than fetched per-case at case-start | Candidate can inspect the client bundle/network cache to preview other cases' data (and correct answers, if co-located) before officially reaching them, undermining sequential/randomized case exposure | Fetch each case's dashboard content only when the candidate actually reaches that case in their randomly assembled test, scoped to that attempt |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Per-question countdown timer with no clear indication of how much time remains until it's nearly out | Candidates report anxiety/unfair pressure disproportionate to actual difficulty, especially for reading-heavy items (Reading Comprehension, multi-tab case research) that need more than a "quiz question" amount of read time | Calibrate per-item time budgets to actual content length/complexity (a Reading Comprehension passage needs more time than a one-line grammar item); show a persistent, unambiguous visual timer, not just a final-seconds flash |
| Silent integrity monitoring with zero candidate-facing disclosure that behavior is being logged | Feels covert/surveillance-like if candidates later discover it (e.g., via a rejection they suspect was integrity-driven); potential legal/trust issue for something explicitly framed as objective/fair | Disclose upfront, in plain language before the test starts, what is monitored (tab switches, copy-paste, webcam presence-only checks) and that it's not recorded/stored as video — this is both an ethical improvement and reduces "hidden surveillance" reputational risk, without requiring live interruption during the test itself |
| Shared report shows candidate a "Not Recommended" tier with no actionable detail on why | Damages candidate experience/employer brand for an explicitly "fair, transparent" tool; candidates who feel a black-box rejection are more likely to dispute or leave negative reviews of the hiring process | Give candidates constructive, category-level feedback (e.g., relative strength/weakness by trait) even in a rejection, without exposing exploitable specifics (which literal questions were missed) |
| Gamified level/progress-bar UI implies "levels" are getting harder or are sequential achievements, but items are randomly drawn per-attempt from unordered pools | Mismatch between game framing (implies mastery progression) and reality (random draw, no adaptive difficulty) can feel arbitrary if a candidate perceives inconsistent difficulty between "Level 1" and "Level 2" of different attempts | Keep gamification framing honest — "levels" as category groupings is fine, but avoid implying adaptive/increasing difficulty unless quota design actually delivers that consistently across all attempts |

## "Looks Done But Isn't" Checklist

- [ ] **Answer-key isolation:** "Grading works" is not the same as "answer key never touches the client" — verify by inspecting actual network payloads during a live attempt, not just by reading the server code that *should* filter it out.
- [ ] **One-attempt-per-email enforcement:** "It rejects a second submission with the same email" is not the same as "it rejects Gmail dot/plus variants, case variants, and disposable-email edge cases" — test explicitly with `user+test@gmail.com` vs `user@gmail.com` vs `User@Gmail.com`.
- [ ] **Random test assembly:** "It assembles a 50-question test" is not the same as "it assembles exactly 50 questions meeting exact category quotas on every run" — verify with a batch-simulation test (hundreds of simulated assemblies), not a single manual run.
- [ ] **Integrity monitoring:** "Tab-switch detection works" is not the same as "it degrades gracefully and is logged as a distinct condition when JavaScript integrity code never executes at all" — test with JS-disabled/dev-tools-detached scenarios explicitly, and verify the report doesn't silently render as "clean."
- [ ] **Webcam checks:** "Face detection runs" is not the same as "no frame or derived image data is ever transmitted or persisted anywhere" — verify by inspecting network traffic and server storage, not just reading the client code's stated intent.
- [ ] **Shared report:** "Candidate and recruiter see the same report" is not the same as "the candidate-facing report link can't be used to enumerate or access other candidates' reports" — verify report URLs/IDs are non-guessable, and access control (if any) is actually enforced.
- [ ] **Case-based dashboards:** "Cases render with multiple tabs" is not the same as "each case's content is scoped/fetched only for attempts that actually draw that case" — verify via network inspection that unreached cases' content isn't sitting in the client bundle/cache.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Answer keys leaked via client payload post-launch | HIGH | Immediately patch the leak; treat the entire exposed subset of the 375-item bank as compromised — retire/replace those specific items rather than the whole bank if scope is known; audit all attempts taken during the exposure window for suspiciously fast/perfect scores and flag for recruiter review |
| Retake-gaming discovered at scale (many duplicate candidates via email variants) | MEDIUM | Retroactively apply email normalization to existing attempt records to identify likely duplicates; do not auto-invalidate silently — surface flagged duplicate clusters to recruiters for manual judgment, since some may be legitimate (e.g., a genuine retake authorized informally) |
| Quota/sampling bug discovered after attempts have already been taken with inconsistent test lengths or category balance | MEDIUM | Re-run the assembled-test audit against historical attempts to quantify how many were affected and how (short test? category-skewed?); decide case-by-case whether affected attempts need to be flagged as "not directly comparable" in the admin panel rather than silently treated as equivalent to correctly-assembled ones |
| Adverse-impact concern raised after tool has been used for real hiring decisions | HIGH | This requires the underlying attempt-level data (which items, which candidates, outcomes) to already have been retained in queryable form — if it wasn't, retroactive analysis may be impossible; engage legal counsel before continuing to use the recommendation tier as any part of real hiring decisions until reviewed |
| Client-side integrity signal proven bypassable (e.g., a public writeup on defeating dev-tools detection) at scale | LOW-MEDIUM | Because integrity flags are (by design, per Pitfall 5's prevention strategy) advisory rather than automatic disqualifiers, a single bypassed signal shouldn't invalidate past hiring decisions on its own — but is a strong prompt to add the server-side timing-based floor check if not already present |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Answer-key leakage via client payload | Test Assembly & Grading Engine phase (architecture decision made before UI work begins) | Automated payload-scanning test asserting zero answer-key fields reach any candidate-facing response, run in CI on every change to the grading/serving endpoints |
| Question-bank reconstruction via weak randomization | Test Assembly Engine phase (sampling algorithm) + ongoing content-lifecycle practice | Item-exposure-frequency report reviewed periodically; automated distribution check across simulated attempts |
| One-attempt-per-email trivially bypassed | Candidate Entry / Attempt Lifecycle phase | Explicit unit tests for Gmail dot/plus/case normalization; fingerprint/IP capture verified present on every attempt record from the first attempt onward |
| Quota math / uneven test assembly | Test Assembly Engine phase | Batch-simulation test asserting exact target length and exact category quotas across hundreds of simulated assemblies before any gamified UI is built against it |
| Client-side integrity monitoring over-trusted | Integrity Monitoring phase (capture/logging) + Reporting phase (presentation, kept separate from recommendation tier) | Admin panel shows per-signal breakdown, not a collapsed integer; a documented test confirms JS-disabled sessions are flagged distinctly, not rendered as "clean" |
| Overclaimed psychometric validity / EEOC-style fairness exposure | Reporting & Trait Scoring phase (report language, tier framing) — flagged as a cross-cutting governance checkpoint | Report copy reviewed for validated-instrument-sounding language before launch; data model confirmed to retain enough attempt-level detail to support a future adverse-impact review if ever needed |

## Sources

- MDN Web Docs — Page Visibility API (fetched live this session): confirms blur/focus events are insufficient on their own, visibility states are coarse (visible/hidden only, no partial-occlusion or second-monitor detection), iframe visibility inherits from parent, and background-tab throttling has documented per-browser variance — directly supports Pitfall 5's characterization of tab-switch detection limitations. **Confidence: verified live fetch, treat as HIGH for the specific claims cited.**
- General, well-established web-application-security principles (client/server trust boundary, "never trust the client," server-side authoritative grading) — standard practice reflected across OWASP-style guidance; not independently re-fetched this session due to tool availability constraints (WebSearch was denied for this session; WebFetch succeeded once for MDN and was denied for subsequent lookups including EEOC.gov and a law-firm compliance summary). **Confidence: MEDIUM — well-established, stable domain knowledge, not live-re-verified this session.**
- US EEOC technical guidance on algorithmic/software-assisted employment decisions (Title VII adverse-impact framework) and NYC Local Law 144-style automated-employment-decision-tool bias-audit/disclosure obligations — cited from general domain knowledge of published regulatory guidance in this space; **could not be live-verified this session** (WebFetch denied for eeoc.gov and a law-firm summary page). Treat the specific claims in Pitfall 6 as directional and **verify current requirements with counsel before launch** rather than relying on this document as a compliance reference.
- Gmail dot-insensitivity and plus-addressing behavior — long-standing, publicly documented Gmail account behavior; general knowledge, not independently re-fetched this session.
- Common quiz-platform/exam-engine architecture failure patterns (answer-key-in-client-payload, naive random sampling, case-vs-item quota mismatches) — synthesized from general software-engineering domain knowledge of assessment-platform post-mortems and known anti-patterns; not tied to a single specific external source.

---
*Pitfalls research for: gamified, auto-graded, self-serve hiring assessment platform*
*Researched: 2026-07-29*
