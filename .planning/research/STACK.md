# Stack Research — v1.1 Async Reporting, Analytics, Proctoring Upgrade, Rubric Grading

**Domain:** Additions to an existing Google Apps Script (Code.gs) + Google Sheets backend, Next.js 15/React 19 static-export frontend on GitHub Pages
**Researched:** 2026-07-30
**Confidence:** MEDIUM (see Sources — live search/fetch tools were restricted this session; one claim, fullscreen-exit-cannot-be-blocked, was live-verified against MDN; the rest rests on stable, slow-moving platform documentation from training knowledge and should get a quick spot-check against current Google docs before implementation, especially exact quota numbers)

**Note on the prior STACK.md this file replaces:** the previous version of this file (dated 2026-07-29) described a Postgres/Prisma/iron-session full-stack Next.js architecture. The actual v1.0 build that shipped is Google Apps Script (`backend/Code.gs`) + Google Sheets + a static-export (`output: 'export'`) Next.js frontend on GitHub Pages — confirmed by direct repo inspection this session. This file is scoped to the real, current stack and the v1.1 milestone's five new-capability questions; it does not re-litigate the original stack choice.

**Hard constraint reminder driving every recommendation below:** no new paid backend infra, no server runtime for the Next.js frontend (static export only). Every "how do we do X" answer below has to fit inside Apps Script's execution model (triggers, `UrlFetchApp`, `MailApp`/`GmailApp`, `SpreadsheetApp`) or inside the static-export client bundle. Nothing here introduces a new hosting target.

## Recommended Stack

### Core Technologies (new capability per feature)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Apps Script **installable time-driven trigger** (`ScriptApp.newTrigger`) + Sheet "pending" queue | Apps Script runtime (no version pin) | Async report generation that survives tab close (Feature 1) | This is the only background-execution primitive Apps Script has. A single recurring trigger polling a `status="pending"` column avoids the per-script trigger-count ceiling that per-attempt one-off triggers risk exhausting under load. Decouples grading duration entirely from the `doPost` response, so the candidate's "Thank You" screen renders in ~1-2s regardless of how long LLM grading takes |
| `MailApp.sendEmail(...)` with `htmlBody` + `HtmlService.createTemplateFromFile` | Apps Script runtime | Candidate report email + recruiter-team notification email (Feature 1) | Simpler auth surface than `GmailApp` (no broader Gmail OAuth scope needed) for one-way transactional send; `HtmlService` scriptlet templates keep HTML email markup out of `Code.gs` string literals, matching "keep files readable" project norms |
| `@mediapipe/tasks-vision` `FaceDetector` (short_range model) | latest `0.10.x` | Replace BlazeFace/TF.js for on-device face-presence proctoring (Feature 3) | Google's actively maintained, unified on-device vision task API — direct successor to both the old separate MediaPipe JS "Face Detection" solution and the effectively-frozen `@tensorflow-models/blazeface` wrapper the app currently CDN-loads. Runs fully in-browser (WASM), zero server calls, zero cost — satisfies the "free, on-device, no paid cloud vision API" constraint exactly like BlazeFace does today, but on a codebase Google still ships updates to |
| Gemini `responseSchema` (controlled generation) in `generationConfig`, called via existing `UrlFetchApp.fetchAll` | Gemini API `v1beta`, current-gen `gemini-2.x-flash` model id | Rubric-based structured LLM grading with consistent JSON output (Feature 5) | Upgrades the existing ad hoc `responseMimeType: "application/json"` call (which only guarantees syntactically-valid JSON, not a specific shape) to schema-constrained decoding — eliminates the `try/catch → "FAILED"` sentinel fragility already visible in `evaluateOpenTextBatch`, and gives a structured `{verdict, rubricBreakdown, rationale}` shape that can be stored verbatim as the recruiter-visible transcript |

### Supporting/Config Changes

| Item | Purpose | When to Use |
|------|---------|-------------|
| New Sheet column(s): `status` (`pending_grading` / `graded` / `emailed` / `failed`), `gradedAt`, `emailedAt` on the attempts sheet | Queue state machine for async grading | Add during Feature 1 implementation — this is the entire "durable state" mechanism since Apps Script has no external DB |
| `LockService.getScriptLock()` around the polling trigger's queue-claim step | Prevent two overlapping trigger runs from double-grading the same row | Needed once a recurring trigger is in place — Apps Script trigger runs can overlap if a previous run hasn't finished |
| `PropertiesService` key for Gemini model id (e.g. `GEMINI_MODEL`, default `gemini-2.5-flash` or current GA flash id) | One-line model bump without redeploying grading logic | Already partially done for `FALLBACK_MODEL`; extend the same pattern to the primary Gemini model so `gemini-1.5-flash` (aging toward deprecation) can be swapped without a code change |
| `temperature: 0` (not `0.1`) in the Gemini `generationConfig` for rubric grading | Deterministic, reproducible verdicts | Rubric grading with recruiter override needs "same answer in → same verdict out" more than it needs any creative variance |
| Recruiter-visible "transcript" storage: persist the full grading request+response JSON per open-text answer (new sheet/tab, e.g. `GradingTranscripts`) | Backs the audit/override requirement (F-05/rubric spec) and feeds the analytics dashboard directly | Needed for Feature 5's "recruiter-visible transcript + verdict for audit/override" requirement — store once at grading time, don't re-derive in the admin UI |

## Answers to the Five Specific Questions

### (a) Async/background compute in Apps Script that survives tab close

**Recommended pattern: "pending row + single recurring polling trigger,"** not per-attempt one-off triggers, and not continuation tokens (Apps Script has no continuation-token/queue service — that's a GCP Tasks/Cloud Functions concept and would violate the no-new-paid-infra constraint anyway).

1. `doPost` for `submitAnswers` does the fast, deterministic work synchronously (MCQ/multi-select grading — already instant), writes the attempt row with `status = "pending_grading"`, and returns immediately. The candidate sees "Thank You" in ~1-2s. This step already fully executes server-side inside the Apps Script Web App request — Apps Script continues running the request on Google's servers even if the candidate closes the tab immediately after the HTTP response starts, but do **not** rely on that alone for the LLM grading step, since `doPost` itself is capped at Apps Script's per-execution time limit and a synchronous batch of LLM calls for ~50 questions is exactly the kind of thing that can blow past it under load.
2. A single **installable time-driven trigger** (`ScriptApp.newTrigger('processPendingGrading').timeBased().everyMinutes(1).create()`, set up once, not per-attempt) scans the attempts sheet for `status = "pending_grading"` rows, claims a batch under `LockService`, runs `evaluateOpenTextBatch` (already exists, upgrade per item (e) below), computes the final report, flips `status` to `"graded"`, then sends the emails and flips to `"emailed"`.
3. **Why not a one-off `after()` trigger per attempt** (`ScriptApp.newTrigger('processAttempt').timeBased().after(2000).create()`): this is a valid alternative and lower-latency (grading starts ~seconds after submit instead of up to a minute), but every script has a hard ceiling on simultaneously-scheduled triggers per user (historically ~20 for consumer accounts). Under any submission burst (e.g. a cohort taking the test around the same time), leaked or backlogged one-off triggers risk hitting that ceiling and silently failing to schedule. It's viable **only** if every trigger function deletes itself (`ScriptApp.deleteTrigger`) immediately after running and you add monitoring for stuck triggers — meaningfully more failure-mode surface for an internal hiring tool that doesn't need sub-minute grading latency. Recommend the polling trigger as the primary mechanism; a one-off "fast path" trigger can be layered on later only if candidates start complaining about email delay.
4. Idempotency matters: since a polling trigger can, in rare overlap cases, run twice before a status flip commits, wrap the claim step in `LockService.getScriptLock().waitLock(...)` and re-check `status` after acquiring the lock before processing a row.

### (b) Apps Script email sending — MailApp vs GmailApp, quotas, HTML templates

- **Use `MailApp.sendEmail(recipient, subject, plainBody, {htmlBody, name})`**, not `GmailApp`. Both draw from the same underlying daily email quota; `GmailApp` exists for scenarios that need Gmail-specific features (drafts, threads, labels, aliases) which this feature doesn't need. `MailApp` requires a narrower authorization scope, which is the right default for a "send a candidate their report and notify the recruiter team" use case.
- **HTML templates**: build the report email as an `HtmlService` scriptlet template file (e.g. `CandidateReportEmail.html`) rendered via `HtmlService.createTemplateFromFile('CandidateReportEmail').evaluate().getContent()`, then pass that string as `htmlBody`. This keeps markup out of `Code.gs` string concatenation (which is how the file is already trending toward being very large — `Code.gs` is ~19k lines) and lets the email visually mirror the on-screen `ReportScreen.tsx` layout without duplicating logic inline.
- **Quotas**: Apps Script email sending is quota-limited per day and the exact number differs materially between a consumer/free Google account and a Google Workspace account (Workspace quotas are meaningfully higher, and vary further by Workspace edition). Given this project sends at minimum 2 emails per completed attempt (candidate + recruiter-team), and the recruiter-team email likely fans out to multiple `To`/`Cc` recipients (each recipient can count against the quota depending on account type), **do not treat this as unlimited** — confirm the exact current quota for the Google account this script will actually run under (`MailApp.getRemainingDailyQuota()` is callable at runtime and is the authoritative live source, cheaper than trusting a static number here) before assuming volume is safe. Wrap `sendEmail` calls in `try/catch`, log failures back onto the attempt row (`status = "email_failed"`) rather than losing the report, and consider checking `getRemainingDailyQuota()` proactively inside the polling trigger so a quota-exhausted day degrades to "graded but not yet emailed" (retried next run) instead of silently dropping candidate reports.
- This is flagged **MEDIUM confidence on the exact quota numbers specifically** (not on the MailApp/GmailApp/HtmlService API shapes, which are stable, well-established Apps Script APIs) — verify current numbers at `developers.google.com/apps-script/guides/services/quotas` before finalizing the polling-trigger batch size, since that page was not reachable during this research session (see Gaps).

### (c) Free/open on-device face-detection alternatives to BlazeFace/TensorFlow.js

Current implementation loads `@tensorflow/tfjs@4.22.0` + `@tensorflow-models/blazeface@0.0.7` from jsdelivr CDN via manual `<script>` injection inside `TestScreen.tsx` (not an npm dependency — `package.json` has no TF.js entries at all).

| Option | Verdict | Why |
|--------|---------|-----|
| **`@mediapipe/tasks-vision` `FaceDetector`** | **Recommended replacement** | Google's current, actively-maintained on-device vision runtime (the unified successor to both the legacy MediaPipe JS solutions and the TF.js model-zoo packages). Ships as a real npm package — installing it properly (`npm install @mediapipe/tasks-vision`) instead of ad hoc CDN script tags is itself an improvement, since it lets the existing Next.js build pipeline manage the dependency instead of runtime `loadScript()` race conditions (the current code has a comment explicitly documenting a script-load-order bug with the CDN approach). WASM runtime + short-range face model can still be fetched from a CDN at runtime (recommended, to avoid bloating the static-export bundle) while the JS API surface itself is a proper import. `detectForVideo()` runs a live webcam stream frame-by-frame, same integration point as today's `estimateFaces()` polling loop |
| `@tensorflow-models/blazeface` (current) | **Migrate off** | The model wrapper package itself has had no meaningful updates in years; it still functions (it's a static, already-trained model), but it's not receiving maintenance, and the manual CDN script-tag loading pattern is fragile (the existing code comment about UMD-global timing is evidence of that fragility) |
| `face-api.js` (justadudewhohacks) | **Do not adopt** | Long-unmaintained wrapper built on an old TF.js 1.x era API; frequently recommended in older tutorials but not a sound choice for new 2026 work — same "stale wrapper, no security/compat patching" problem as BlazeFace, without even BlazeFace's Google backing |
| Human.js (`@vladmandic/human`) | Not recommended for this use case | Actively maintained and capable (bundles face detection plus age/gender/emotion/etc.), but meaningfully heavier than needed — this feature only needs "is exactly one face present," not a full biometric feature set. Keep in mind only as a fallback if MediaPipe Tasks Vision integration hits a real blocker |

Practical migration note: keep the exact same integrity-signal semantics that exist today (`no_face` / `multiple_faces` / `ok`, logged silently via `silentLog`) — this is a drop-in replacement of the detection engine, not a UX change.

### (d) Can fullscreen-exit actually be blocked? (determines Feature 4 feasibility)

**No — this is a hard browser security invariant, not a implementation gap.** Verified directly against MDN's Fullscreen API guide: *"the user always has the ability to exit fullscreen mode of their own accord"* via Esc, F11, or switching tabs/apps, and no script-level API exists to intercept or cancel that exit (there is no `fullscreenchange`-equivalent of a cancelable `beforeunload` prompt for fullscreen exit). Additionally, re-entering fullscreen programmatically after an exit requires a **fresh user gesture** — `requestFullscreen()` calls made outside a direct event handler (e.g. from a `setTimeout` or automatically on `fullscreenchange`) will be silently denied by the browser.

**This means Feature 4 as literally scoped ("prevent toggling out") is not buildable on the web platform, full stop — for any browser.** The correct, honest reframing for the roadmap:

1. Keep exit **detection** exactly as it works today (`fullscreenchange` listener, already implemented in `TestScreen.tsx`/`AssemblyScreen.tsx`).
2. On exit, immediately overlay a blocking modal that (a) logs the violation with escalating severity metadata (1st exit vs. repeated), and (b) requires the candidate to click a "Return to Fullscreen" button — that click is itself the fresh user gesture that makes the subsequent `requestFullscreen()` call succeed.
3. Treat repeat exits as an escalating integrity signal feeding the report's violation summary/recommendation tier, the same way tab-switch/blur already work today — not as a hard block.

Recommend the roadmap phase for this be named/scoped as **"fullscreen-exit deterrence + escalation,"** not "fullscreen lock," to avoid committing to something the web platform cannot deliver.

### (e) Gemini rubric-based structured grading from Apps Script

Current `evaluateOpenTextBatch` already: calls `gemini-1.5-flash:generateContent` via `UrlFetchApp.fetchAll` (correct parallel-batch pattern for Apps Script — there's no async/await concurrency primitive otherwise, `fetchAll` **is** the built-in parallel HTTP primitive and should stay), sets `responseMimeType: "application/json"`, and falls back to an OpenRouter/OpenAI-compatible endpoint on failure. Three concrete upgrades for rubric grading with recruiter-visible transcripts:

1. **Add `responseSchema`** to `generationConfig` alongside `responseMimeType: "application/json"` — this is Gemini's controlled-generation feature: pass a JSON-Schema-shaped object (`type: OBJECT`, `properties`, `required`, `enum` for verdict categories) and Gemini constrains its own decoding to match it exactly. This removes the need for the current `try { JSON.parse(...) } catch { results[qId] = "FAILED" }` fallback path entirely for the shape-validity failure mode (a malformed/incomplete JSON blob) — it does not remove the need for basic error handling on HTTP-level failures (rate limits, timeouts), which should still fall through to the existing OpenRouter fallback.
2. **Set `temperature: 0`**, down from the current `0.1` — for a rubric-grading judge whose output a recruiter will later override or spot-check, reproducibility ("would this answer get graded the same way again?") is the priority, not stylistic variance.
3. **Design the schema around the audit requirement directly**: rather than the current binary `{"score": 1|0}`, define something like `{"verdict": "PASS"|"PARTIAL"|"FAIL", "criteriaMet": [{"criterion": string, "met": boolean}], "rationale": string}` matched to the actual rubric for that question, and persist the full raw response (not just a derived boolean) as the transcript row referenced above. This is what makes the recruiter-facing "transcript + verdict for spot-check/override" requirement (from `PROJECT.md`'s v1.1 scope) actually implementable without a second LLM call or re-parsing later.
4. **Do not reach for function calling** for this — function calling adds a second round-trip and tool-schema negotiation overhead that buys nothing over `responseSchema` for a single-turn "grade this against a rubric, return this exact shape" call. Reserve function calling only if a future requirement needs the model to pull additional Sheet data mid-grading, which nothing here requires.
5. **Model id**: `gemini-1.5-flash` is an older generation model; budget for bumping to the current-generation flash model id (e.g. `gemini-2.5-flash` or whichever is GA at implementation time) behind the `PropertiesService`-configurable model key described above, since Google's flash-tier models have historically moved through a roughly annual deprecation cadence and 1.5-flash is aging out of that window by mid-2026.

## Installation

```bash
# Frontend (assessment-app) — new dependency for Feature 3
npm install @mediapipe/tasks-vision

# Backend (backend/Code.gs) — no package.json / npm install applies.
# All new capability (triggers, MailApp, LockService, PropertiesService,
# UrlFetchApp with responseSchema) is built into the Apps Script runtime.
# The only backend "install" step is:
#   1. Project Settings > Script Properties: add/confirm GEMINI_MODEL (new),
#      alongside existing GEMINI_API_KEY / FALLBACK_API_KEY.
#   2. Triggers page (or Apps Script `ScriptApp.newTrigger` run once from the
#      editor): install the recurring `processPendingGrading` time-driven
#      trigger — this must be created once by a human running it from the
#      script editor (or an onInstall-style setup function), it cannot be
#      created implicitly by a Web App request the first time a candidate hits it.
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|--------------|-------------|--------------------------|
| Polling trigger + `status` column queue | One-off `after()` trigger per attempt | If email latency (currently ~≤1 min under polling) must drop to near-real-time and attempt volume is low enough that trigger-count exhaustion is a non-issue; must add self-deleting cleanup either way |
| `MailApp.sendEmail` | `GmailApp.sendEmail` | If the recruiter-team notification later needs Gmail-specific features (threading replies, labels, drafts for review-before-send) |
| `@mediapipe/tasks-vision` `FaceDetector` | `@vladmandic/human` | If a future requirement needs more than presence/count (e.g. attentiveness/gaze, emotion) — meaningfully bigger dependency, don't pull it in just for face-count |
| Gemini `responseSchema` controlled generation | Gemini function calling / tool use | If grading ever needs the model to fetch additional context mid-call rather than receiving it all in the prompt |
| `gemini-2.x-flash` (current GA flash model, via configurable Script Property) | `gemini-1.5-flash` (current hardcoded value) | Never for new work — only relevant if a specific 1.5-flash behavior is being intentionally pinned during a transition period |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Any new paid backend (Cloud Functions, Firebase Functions, a hosted queue/cron service) for async grading | Violates the explicit "no new paid backend infra" constraint and duplicates a capability Apps Script already has natively | Apps Script installable time-driven trigger + Sheet `status` queue |
| `face-api.js` | Long-unmaintained TF.js 1.x-era wrapper; frequently tutorialed but a poor 2026 choice, same staleness risk as current BlazeFace without Google's backing | `@mediapipe/tasks-vision` `FaceDetector` |
| Per-attempt one-off triggers without self-cleanup | Leaked/backlogged triggers can hit the per-script/per-user trigger-count ceiling under any submission burst, silently failing to schedule future grading | Single recurring polling trigger, or one-off triggers that always `ScriptApp.deleteTrigger()` themselves |
| `responseMimeType: "application/json"` alone (current state) without `responseSchema` | Guarantees syntactically valid JSON but not a specific shape — this is exactly why the current code needs a `"FAILED"` string-sentinel fallback path | Add `responseSchema` (controlled generation) so shape is enforced by the model provider, not recovered from after the fact |
| LLM function calling for single-turn rubric grading | Extra round-trip/negotiation overhead with no benefit for a "grade this text against this rubric" call | `responseSchema` controlled generation on a single `generateContent` call |
| Building a literal fullscreen-exit "lock" | Not achievable on any browser — the platform guarantees the user can always exit fullscreen | Detect-and-escalate pattern (modal + required user-gesture re-entry + violation severity scoring) |
| Any paid/third-party cloud vision or proctoring API for face detection | Already explicitly out of scope per `PROJECT.md` constraints | `@mediapipe/tasks-vision` (free, on-device) |

## Stack Patterns by Variant

**If submission volume is low/moderate (typical internal hiring-tool traffic — dozens to low hundreds of attempts/day):**
- Use the single recurring polling trigger at a 1-5 minute interval. Simpler, avoids trigger-quota risk, and email delay of up to a few minutes is acceptable for an async "you'll get an email" flow.

**If a specific candidate needs faster turnaround (e.g. a VIP/rush case):**
- Layer a one-off `after()` trigger as an additional fast path only for that submission, with mandatory self-deletion — don't switch the whole system to per-attempt triggers by default.

**If candidate devices are known to be low-end / bandwidth-constrained:**
- Use MediaPipe's `short_range` face detection model (smaller, faster) rather than `full_range` — sufficient for a centered webcam-framing presence check, and keeps the WASM+model download light, consistent with the existing "no continuous video recording/storage" low-footprint intent.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `@mediapipe/tasks-vision` | Next.js 16.2.12 / React 19.2.4 (static export) | Must be initialized entirely client-side (inside a `'use client'` component's `useEffect`), exactly like the current BlazeFace loader — no SSR/prerender concerns since detection logic is already client-gated in `TestScreen.tsx` |
| `@mediapipe/tasks-vision` | `@tensorflow/tfjs` (current CDN dependency) | No coexistence needed — MediaPipe Tasks Vision fully replaces the TF.js + blazeface pair; removing both CDN `<script>` loads in favor of one npm-managed dependency is a net simplification |
| Gemini `v1beta` REST endpoint (`generateContent`) | Apps Script `UrlFetchApp` | Called as raw REST via `UrlFetchApp`, not an SDK — no npm/package version pinning applies on the backend at all; a model upgrade is purely a URL-string / Script-Property change |
| `MailApp`/`GmailApp` daily quota | Google account type (consumer `gmail.com` vs. Google Workspace, and Workspace edition) | Quota is tied to whichever Google account the Apps Script project is deployed under — reconfirm live via `MailApp.getRemainingDailyQuota()` rather than assuming a fixed number, since this materially affects how aggressive the polling-trigger batch size and recruiter-team `Cc` list can be |

## Sources

- MDN Fullscreen API Guide (`developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API/Guide`) — live-fetched this session; confirmed fullscreen exit cannot be blocked/canceled by script, and `requestFullscreen()` requires a fresh user gesture after any exit. Confidence: verified directly, treat as authoritative (MDN is the canonical reference for this API's behavior across browsers).
- Google Apps Script triggers, `MailApp`/`GmailApp`, quotas, and `PropertiesService`/`LockService` behavior — training-knowledge based; **live verification against `developers.google.com` was not possible this session** (fetch tool access to Google's own documentation domains was restricted in this environment). These are stable, slow-moving platform APIs and the architectural recommendations (polling trigger + queue, `MailApp` over `GmailApp`, `LockService` for overlap safety) are sound regardless of exact quota numbers, but **the specific daily email/UrlFetchApp quota figures should be reconfirmed against current Apps Script docs (or via `MailApp.getRemainingDailyQuota()` at runtime) before finalizing batch sizes.**
- Gemini API structured output (`responseSchema`/`responseMimeType`, controlled generation) and current model naming — training-knowledge based, same live-verification restriction as above; the existing `Code.gs` `evaluateOpenTextBatch` function (read directly from this repo) confirms the current `responseMimeType`-only approach and its `"FAILED"`-sentinel fallback, which is the concrete gap `responseSchema` closes.
- `@mediapipe/tasks-vision` packaging/maintenance status and `face-api.js` staleness — training-knowledge based, same restriction; corroborated indirectly by the existing repo code itself, which already documents a script-load-ordering bug in the current CDN-based BlazeFace loading (`TestScreen.tsx` comment), supporting the recommendation to move off ad hoc CDN script injection.
- Repo inspection (this session, direct file reads, HIGH confidence — primary source): `backend/Code.gs` (`evaluateOpenTextBatch`, `doGet`/`doPost`, `GEMINI_API_KEY`/`FALLBACK_API_KEY` via `PropertiesService`), `assessment-app/src/components/TestScreen.tsx` (BlazeFace/TF.js CDN loading, fullscreen-exit detection), `assessment-app/src/components/AssemblyScreen.tsx` (fullscreen entry flow), `assessment-app/package.json` (no TF.js/face-detection npm deps currently present), `.planning/PROJECT.md` (v1.1 scope and constraints).

---
*Stack research for: Google Apps Script + Next.js static-export gamified assessment platform — v1.1 milestone additions*
*Researched: 2026-07-30*
