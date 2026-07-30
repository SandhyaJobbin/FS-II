# Fraud Support Gamified Assessment Platform

## What This Is

A self-serve web platform that auto-evaluates candidates for a Fraud Support role — where the job is investigating reviews of hotels, restaurants, attractions, and events for authenticity/fraud issues. Candidates take a randomized, gamified test drawn from three pre-authored, fully answer-keyed question banks (English Proficiency, Attention to Detail, Critical Thinking), and both the candidate and the recruiter instantly get the same detailed, auto-generated profile report — with zero human grading involved anywhere in the pipeline.

## Core Value

Every candidate gets a fair, consistent, fully automated read on their language ability, attention-to-detail/research skill, and critical thinking under ambiguous fraud scenarios (the job has no fixed playbook — every case differs) — without requiring a human to grade or score a single answer.

## Business Context

- **Customer**: The hiring/recruiting team screening Fraud Support applicants
- **Revenue model**: Internal hiring tool — not monetized; value is time saved on manual screening + more consistent signal on candidate fit
- **Success metric**: Recruiters can make a confident shortlist/reject decision from the report alone, without re-interviewing for baseline skill checks

## Current Milestone: v1.1 Async Reporting, Trust Repairs & Evaluation Quality

**Goal:** Move report generation off the critical path (thank-you screen + emailed report instead of instant on-screen results), close the F-03..F-06 audit gaps, raise UI quality, ship a recruiter analytics admin panel, upgrade proctoring, and deliberately reintroduce LLM-graded open-text questions — with the rubric/audit-trail safeguards needed to keep that trustworthy.

**Target features:**
- Async grading + report flow: "Thank You" screen on submit, candidate report delivered by email, recruiter team notified by email (concerns/positives/results) — compute continues server-side even if candidate closes the tab
- F-03: sync `tests/grading/grading-engine.ts` mirror with the real LLM open-text grading path in `Code.gs`
- F-04: add tests for admin auth and Code.gs↔mirror sync
- F-05: ARIA landmarks on `ReportScreen.tsx`
- F-06: remove dead legacy `frontend/` (app.js/index.html/style.css)
- UI quality pass across candidate + report screens
- Recruiter admin panel: analytics dashboard (score trends, question difficulty, violation patterns), optionally LLM-summarized insights
- Proctoring upgrade: evaluate free alternatives to current BlazeFace/TensorFlow.js setup; lock fullscreen-exit toggling once entered (currently exitable) as a hard integrity signal
- Expand open-ended (LLM-graded) question share — reverses the original v1.0 "no LLM grading" decision (see Key Decisions)
- Evaluation-quality improvements (open scope, refined during requirements): rubric-based open-text grading criteria instead of binary correct/incorrect, recruiter-visible transcript + LLM verdict for spot-checking/override (since LLM grading reduces the original "zero human review" guarantee), anti-cheat signal for open-text answers (remote unproctored test + free LLM tools make copy-paste-from-AI a real risk)

## Requirements

### Validated (v1.0, all phases 1-6)

- [x] Candidate self-serve entry (no invite link) capturing name + email before starting
- [x] Ingest the ~375 existing authored questions (English Proficiency, Attention to Detail, Critical Thinking docs) with their embedded answer keys into a structured, queryable content store
- [x] Assemble a randomized ~50-item test per attempt, drawn per-category/level from the full banks, so each attempt differs
- [x] Gamified test-taking UI: level progression through the 3 banks (treated as levels/missions with a progress bar), per-question countdown timer, live points/scoring reveal
- [x] Deterministic auto-grading engine for MCQ + multi-select against answer keys
- [x] In-browser integrity monitoring: tab-switch/window-blur count & duration, copy-paste attempts, dev-tools detection, fullscreen-exit detection, right-click/context-menu blocking — all logged silently (no live interruption of the candidate)
- [x] Free, on-device (client-side) webcam presence/face-count checks for integrity signal — no continuous video recording/storage, no paid cloud vision API
- [x] One official attempt per email; repeat attempts from the same email are blocked or flagged as a retake
- [x] Auto-generated results report, identical for candidate and recruiter: overall score, three trait scores, narrative insight, recommendation tier, integrity/violation summary
- [x] Recruiter/HR admin panel: candidate list opening into each candidate's full detail report; multiple-violation candidates visibly flagged

### Active

(Populated via REQUIREMENTS.md for v1.1 — see Target features above)

### Out of Scope

- Full video-based proctoring or third-party paid proctoring service integration — too costly/complex; browser-behavior signals + free on-device webcam checks give meaningful integrity signal at zero marginal API/storage cost
- Invite-link or token-gated access — open self-serve entry (name + email) stays
- Retakes / cooldown-based re-testing — one official attempt per email only, for now
- A separate, dedicated "research skill" section — existing Attention to Detail / Critical Thinking cases already exercise research/investigation skill

## Context

- All assessment content already exists and is authored, in `Fraud support/`:
  - `FS Question Bank_English Proficiency V2.docx` — Grammar, Sentence Correction, Macro Editing & Personalization, Reading Comprehension, Case Closure Notes (95 items)
  - `FS Question Bank_Attention to Detail V2.docx` — Level 1: Review & Listing Accuracy Investigation + Level 2: Account & Fraud Pattern Investigation, 40 dashboard-style cases × 4 questions (160 items)
  - `FS Question Bank_Critical Thinking V2.docx` — 30 case-file scenarios × 4 questions, no sub-levels (120 items)
  - `Fraud Support Question Bank - Category wise split(1).docx` — original category/volume summary (pre-revision)
  - `FS QB Pattern.xlsx` (Sheet2) / `FS QB Pattern(1).xlsx` — the settled per-category "questions to be given" quotas, post-revision
  - `file.xps` — the original draft blueprint, containing now-resolved editorial notes ("merge these 2 sections," "scrap level 1 and 2," "increase level 3 qb size")
- Total authored pool: 375 items. The authored docx content already reflects the **final/revised** structure — e.g. Attention to Detail's docx already has the merged "Level 1: Review & Listing Accuracy Investigation" (not the original 3-level split), and Critical Thinking is already flattened to 30 cases with no sub-levels. The per-attempt "given" quota (~45–50 total) is much smaller than the pool, which is what makes random per-attempt sampling meaningful.
- Every question is multiple-choice or multi-select, with correct answers already marked inline in the source docs (✅ for single-answer, ☑/☐ for multi-select) — this is a strong existing asset, not something to design from scratch.
- Case-based questions (Attention to Detail, Critical Thinking) present a multi-tab "candidate dashboard" (Customer Report, Booking Details, Review Information, Property Listing Information, Account Information) that the candidate must cross-reference — this is the built-in simulation of "research" for the role.

## Constraints

- **Content source**: v1 question content must come from ingesting the existing authored docs/answer keys, not be written from scratch
- **Grading**: MCQ/multi-select grading stays 100% deterministic. Open-text grading uses an LLM against an explicit rubric (as of v1.1) — must be covered by tests (F-03/F-04) and paired with a recruiter-visible transcript+verdict for spot-check/override, since it's no longer a zero-human-review guarantee
- **Proctoring cost**: No paid third-party proctoring or cloud vision APIs — integrity signals are limited to what's achievable client-side for free
- **Security**: Answer keys must never be exposed to the candidate-facing client — grading and correct-answer data must live server-side only
- **Async compute**: Report generation must survive the candidate closing the browser tab — Apps Script trigger/queue based, not tied to an open connection; email delivery via Apps Script MailApp/GmailApp, no new paid email service, unless revisited later

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| v1.1: Reverse "no LLM grading" — reintroduce LLM-graded open-text questions with rubric + recruiter override | v1.0's objective-only stance was clean but the LLM open-text grading path (Code.gs `evaluateOpenTextBatch`) was already added ad hoc without updating this doc (F-03 audit finding) and the user wants a better read on ambiguous fraud judgment, which MCQ alone struggles to capture | — Pending |
| Stay 100% objective grading for MCQ/multi-select portion | All existing content is already answer-keyed; keeps this slice deterministic and reliable | Validated (v1.0) |
| Random per-attempt draw from full banks, single fixed test length (~50 items) | Bank size (375) far exceeds per-attempt quota; prevents answer-sharing between candidates and fits the "every fraud case is different" philosophy | — Pending |
| Open self-serve access (no invite link), name + email required | Simplifies distribution while still identifying candidates for the report and admin panel | — Pending |
| One official attempt per email, with integrity flagging | Prevents easy retake-gaming while acknowledging this is a remote, unproctored-by-default test | — Pending |
| Browser-only integrity monitoring + free on-device webcam checks, no paid APIs | Full video proctoring is costly and out of scope; client-side signals (tab/blur/devtools/copy-paste + on-device face presence) give real signal at zero marginal cost | — Pending |
| Trait scores use a simple 3-axis mapping (English → Language, Attention to Detail → Research/Attention, Critical Thinking → Logical Reasoning); "out-of-the-box thinking" is a narrative insight, not a 4th numeric score | Keeps the v1 scoring model simple; avoids hand-tagging all 375 items by sub-trait before shipping | — Pending |
| Report shown identically to candidate and recruiter, plus an explicit recommendation tier | Full transparency for the candidate, and an actionable signal (not just raw scores) for recruiters | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-30 — milestone v1.1 started*
