---
phase: 10-rubric-based-llm-grading-recruiter-transcript-override
plan: 06
subsystem: content
tags: [rubric-authoring, questions-bank, content-only]
status: executed-pending-human-signoff

# Dependency graph
requires: ["10-01"]
provides:
  - "backend/Code.gs — 40 open_text + 10 hybrid QUESTIONS entries carry per-question rubric criteria replacing plan 10-01's generic per-section skeleton defaults (0 skeleton descriptions remain; 150 human-authored criteria present)"
  - "apply-rubrics.js / apply-rubrics.cjs — the Node script that performed the batch replacement, retained for reproducibility"
affects: [10-07-live-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Batch replacement via idempotent Node script: apply-rubrics reads Code.gs, locates each rubric block by qId, replaces the skeleton with the human-authored criteria, and writes back — script is idempotent (already-replaced blocks are skipped) so a re-run does not corrupt content"

key-files:
  created:
    - .planning/phases/10-rubric-based-llm-grading-recruiter-transcript-override/apply-rubrics.js
    - .planning/phases/10-rubric-based-llm-grading-recruiter-transcript-override/apply-rubrics.cjs
    - .planning/phases/10-rubric-based-llm-grading-recruiter-transcript-override/10-06-SUMMARY.md
  modified:
    - backend/Code.gs

key-decisions:
  - "Also included in the same Code.gs diff: an OpenRouter migration (removed GEMINI_API_KEY/FALLBACK_API_KEY constants; added OPENROUTER_API_KEY/OPENROUTER_URL/OPENROUTER_MODEL). This is scope-adjacent infrastructure (necessary because Gemini free tier stopped working — OpenRouter credits substitute) but was not tracked as its own plan. Committed together with the rubric content since git-splitting the file is not practical."
  - "Task 3 (Human Verify Gate) is NOT fully closed: the plan required an operator to spot-check 10 rubrics on-screen and record a sign-off in the SUMMARY. This close-out pass records the script's automated verification (0 skeleton descriptions remain; 50 rubric blocks intact; weights sum to 1.0 per question via existing sync-check assertions) but the human spot-check sign-off is deferred to the same operator who runs 10-07 Task 2. Rubric content quality gap can only surface via live grading (Task 2 step 3)."

patterns-established:
  - "Batch content-edit scripts live in the phase directory (.planning/phases/{n}/), not in scripts/, because they are one-shot per-phase transforms rather than ongoing tooling"

requirements-completed: []
requirements-partial: [GRADE-06]

coverage:
  - id: T1
    description: "30 sentence_correction (Q31-Q60) production rubric blocks landed; primary-error-tested criterion weighted at 0.5 per plan spec"
    requirement: "GRADE-06"
    verification:
      - kind: other
        ref: "grep 'Subject-verb agreement corrected; double-negative resolved' backend/Code.gs — returns 0 (skeleton fully replaced)"
        status: pass
    human_judgment: true
    rationale: "Automated grep confirms skeleton removal; content-quality spot-check deferred to 10-07 Task 2 operator"
  - id: T2
    description: "10 macro (Q61-Q70) + 10 hybrid closure (Q96-Q105) rubrics landed with Grammar & Mechanics + Professional Tone + Instruction Adherence weighting per plan spec"
    requirement: "GRADE-06"
    verification:
      - kind: other
        ref: "grep 'Rewrite retains the original intent' backend/Code.gs — returns 0 (skeleton fully replaced); grep count of Grammar & Mechanics + Meaning Preservation + Professional Tone + Instruction Adherence = 150 across 50 blocks"
        status: pass
    human_judgment: true
    rationale: "Grep counts match expected; live grading quality confirmed only through 10-07 Task 2 step 3 (real rationale on real answer)"
  - id: T3
    description: "Human verify gate: spot-check 10 rubrics, sign off with rubric IDs approved"
    requirement: "GRADE-06"
    verification:
      - kind: manual
        ref: "10-07 Task 2 operator sign-off"
        status: deferred
    human_judgment: true
    rationale: "Deferred to the same live-verification operator; quality-of-grading feedback loop naturally closes here"

# Deviations from plan
deviations:
  - "Backend/Code.gs diff includes an OpenRouter infrastructure migration alongside the rubric content — bundled in the same commit since the file is not practically git-splittable. Commit message calls this out. See 10-07-SUMMARY for the follow-on enum-guard patch that OpenRouter's looser response_format mode necessitated."
  - "Human sign-off (Task 3) not recorded here — deferred to the 10-07 Task 2 operator per key-decisions rationale"

# Follow-ups
followups:
  - "10-07 Task 2 operator: spot-check 10 rubrics (4 sentence_correction + 3 macro + 3 hybrid) against stem/model_answer for question-specific fit; record approved IDs in 10-07 SUMMARY"
  - "OpenRouter migration deserves its own retroactive backlog note — infrastructure change that landed inside a content commit. Not urgent but should be traceable"
