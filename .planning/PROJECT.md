# Fraud Support Gamified Assessment Platform

## What This Is

A self-serve web platform that auto-evaluates candidates for a Fraud Support role — where the job is investigating reviews of hotels, restaurants, attractions, and events for authenticity/fraud issues. Candidates take a randomized, gamified test drawn from three pre-authored, fully answer-keyed question banks (English Proficiency, Attention to Detail, Critical Thinking), and both the candidate and the recruiter instantly get the same detailed, auto-generated profile report — with zero human grading involved anywhere in the pipeline.

## Core Value

Every candidate gets a fair, consistent, fully automated read on their language ability, attention-to-detail/research skill, and critical thinking under ambiguous fraud scenarios (the job has no fixed playbook — every case differs) — without requiring a human to grade or score a single answer.

## Business Context

- **Customer**: The hiring/recruiting team screening Fraud Support applicants
- **Revenue model**: Internal hiring tool — not monetized; value is time saved on manual screening + more consistent signal on candidate fit
- **Success metric**: Recruiters can make a confident shortlist/reject decision from the report alone, without re-interviewing for baseline skill checks

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Candidate self-serve entry (no invite link) capturing name + email before starting
- [ ] Ingest the ~375 existing authored questions (English Proficiency, Attention to Detail, Critical Thinking docs) with their embedded answer keys into a structured, queryable content store
- [ ] Assemble a randomized ~50-item test per attempt, drawn per-category/level from the full banks, so each attempt differs
- [ ] Gamified test-taking UI: level progression through the 3 banks (treated as levels/missions with a progress bar), per-question countdown timer, live points/scoring reveal
- [ ] Fully objective, deterministic auto-grading engine (MCQ + multi-select against answer keys) — no free text, no LLM-in-the-loop grading
- [ ] In-browser integrity monitoring: tab-switch/window-blur count & duration, copy-paste attempts, dev-tools detection, fullscreen-exit detection, right-click/context-menu blocking — all logged silently (no live interruption of the candidate)
- [ ] Free, on-device (client-side) webcam presence/face-count checks for integrity signal — no continuous video recording/storage, no paid cloud vision API
- [ ] One official attempt per email; repeat attempts from the same email are blocked or flagged as a retake
- [ ] Auto-generated results report, identical for candidate and recruiter: overall score, three trait scores (Language Expertise ← English Proficiency, Attention to Detail & Research ← Attention to Detail, Logical/Critical Thinking ← Critical Thinking), a narrative "out-of-the-box thinking" insight derived from performance on the hardest/most ambiguous cases specifically, a recommendation tier (e.g. Strong Fit / Consider / Not Recommended), and an integrity/violation summary
- [ ] Recruiter/HR admin panel: candidate list (name, email, date, overall score, violation count) opening into each candidate's full detail report; multiple-violation candidates visibly flagged

### Out of Scope

- Free-text/open-ended questions graded by an LLM — considered, but rejected in favor of staying 100% objective and deterministic; all existing authored content is already MCQ/multi-select with baked-in answer keys, and the user chose reliability over the extra nuance AI grading could add
- Full video-based proctoring or third-party proctoring service integration — too costly/complex for this build; browser-behavior signals + free on-device webcam checks give meaningful integrity signal at zero marginal API/storage cost
- Invite-link or token-gated access — open self-serve entry (name + email) was chosen instead
- Retakes / cooldown-based re-testing — one official attempt per email only, for now
- A separate, dedicated "research skill" section — the existing Attention to Detail (cross-referencing dashboard tabs) and Critical Thinking (evidence evaluation) cases already exercise the research/investigation skill; no new content category needed

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
- **Grading**: Must remain 100% deterministic/objective — no LLM or human in the scoring loop, per explicit decision
- **Proctoring cost**: No paid third-party proctoring or cloud vision APIs — integrity signals are limited to what's achievable client-side for free
- **Security**: Answer keys must never be exposed to the candidate-facing client — grading and correct-answer data must live server-side only

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Stay 100% objective grading, no AI-graded free text | All existing content is already answer-keyed; keeps "zero human evaluation" scoring deterministic and reliable rather than resting on an LLM grader's consistency | — Pending |
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
*Last updated: 2026-07-29 after initialization*
