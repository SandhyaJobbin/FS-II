# Phase 2: Candidate Entry & Test Assembly — Research

**Researched:** 2026-07-29
**Scope:** Audit of the existing `backend/Code.gs` GAS backend and `assessment-app/` Next.js frontend against ENTRY-01/02/03 and ASSM-01/02/03.

## Decisions Carried Forward from Phase 1

| Decision | Outcome |
|---|---|
| OQ-1 (difficulty tier source) | Resolved: `content/difficulty-tags.json`, provisional heuristic tiers |
| OQ-2 (quota unit semantics) | Resolved: English rows = questions; Attention/CT rows = cases |
| Total question bank size | 385 items (English 105 + Attention 160 + Critical Thinking 120) |
| Backend architecture | Google Apps Script web app embedding QUESTIONS array; Next.js frontend fetches via POST |

## Resolved Open Questions from Phase 2 Planning

### OQ-1: Total Assessment Item Count (~50 vs ~105)

**Finding:** The ROADMAP said "~50-item set" but the authored quotas in `quotas.json` (loaded directly from `FS QB Pattern.xlsx` Sheet2) produce **105 items**:

| Section | Quota | Item Count |
|---|---|---|
| Grammar | 8 questions | 8 |
| Sentence Correction | 5 questions | 5 |
| Macro | 2 questions | 2 |
| Reading Comprehension | 1 passage → 5 questions | 5 |
| Case Closure Notes | 5 questions | 5 |
| Attention L1 | 5 cases × 4 Qs | 20 |
| Attention L2 | 5 cases × 4 Qs | 20 |
| Critical Thinking | 10 cases × 4 Qs | 40 |
| **Total** | | **105** |

**Resolution:** Proceed with 105. The authored quotas in `FS QB Pattern.xlsx` are the authoritative specification. The "~50" figure in the ROADMAP was an approximation written before quotas were fully loaded. The real test is longer than initially estimated but matches the authored design intent.

### OQ-2: GAS URL Field in WelcomeScreen

**Finding:** Current `WelcomeScreen.tsx` exposes a manual GAS URL input field. This is a deliberate operational choice — it allows development testing against different GAS deployments without a redeploy.

**Resolution:** Keep runtime field as-is for Phase 2. Add `NEXT_PUBLIC_GAS_URL` env var fallback so production deploys can pre-populate it without candidate entry.

## Existing Implementation Audit

### backend/Code.gs — What Exists

| Function | ENTRY/ASSM | Status | Notes |
|---|---|---|---|
| `normalizeEmail(email)` | ENTRY-02 | ✅ COMPLETE | Gmail dot-removal, plus-addressing strip, case-fold |
| `handleStartAttempt(name, email)` | ENTRY-01, ENTRY-03 | ✅ COMPLETE | Scans Attempts sheet for normalized email match, blocks duplicates |
| `assembleQuestionSet()` | ASSM-01, ASSM-03 | ✅ COMPLETE | 8 sections sampled correctly, case-level grouping via `groupBy()` |
| `sampleRandom(arr, count)` | ASSM-01 | ✅ COMPLETE | Fisher-Yates shuffle, no-replacement |
| `groupBy(xs, key)` | ASSM-03 | ✅ COMPLETE | Groups by `case_id` for Attention/CT |
| Frozen set storage | ASSM-02 | ✅ COMPLETE | `JSON.stringify(assembledIds)` in Attempts sheet col 7 |
| Answer-key sanitization | GRADE-05 (Phase 3) | ✅ COMPLETE | `options.map(o => ({ letter, text }))` strips `is_correct` |

### Identified Gaps (minor, fixable in 02-02)

1. **Empty bank guard**: `assembleQuestionSet()` has no check for `QUESTIONS.length === 0`. A re-deploy before the QUESTIONS array is embedded would produce an empty attempt silently.

2. **`difficulty_tier` not in client payload**: The `handleStartAttempt` response strips `is_correct` but does not explicitly include `difficulty_tier` in the returned question object. `difficulty_tier` is not an answer key, so it's fine to include — but it's also fine to omit. Decision: include it explicitly for Phase 4 UI use (level progress bar).

3. **Reading quota comment**: The `QUOTAS.reading` entry has `count: 1` with `unit: "passages"` — this is correct per the Sheet2 values, but the assembly code comments say "5 questions" without noting the passage expansion. Should be documented clearly.

4. **No test coverage**: The GAS backend functions have zero automated tests. Phase 2 will add a Node/vitest fixture-based suite extracted from the GAS logic.

### assessment-app — What Exists

| Component | Phase 2 Role | Status |
|---|---|---|
| `WelcomeScreen.tsx` | ENTRY-01 form (name+email+GAS URL) | ✅ COMPLETE |
| `page.tsx` — `handleStartAttempt()` | Calls GAS `startAttempt` action | ✅ COMPLETE |
| `AssemblyScreen.tsx` | Shows frozen set summary, camera/fullscreen pre-flight | ✅ COMPLETE |
| `localStorage` restoration | Handles page reload during assembly | ✅ COMPLETE |

## Email Normalization Coverage (ENTRY-02)

The existing `normalizeEmail()` function in Code.gs handles:

| Input | Normalized | Case |
|---|---|---|
| `John.Doe@Gmail.COM` | `johndoe@gmail.com` | Case-fold + dot-removal |
| `user+tag@gmail.com` | `user@gmail.com` | Plus-addressing strip |
| `u.s.e.r+test@gmail.com` | `user@gmail.com` | Combined |
| `user@outlook.com` | `user@outlook.com` | Non-Gmail: case-fold only |
| `USER@COMPANY.COM` | `user@company.com` | Non-Gmail: case-fold only |

**Gap**: Non-Gmail providers do not get dot/plus normalization. This is intentional — Gmail is the only major provider with guaranteed dot-insensitivity. Documented as correct behavior.

## Assembly Integrity Analysis

### Question Pool Sizes (verified against ingestion-report.json)

| Pool | Available | Quota | Draw Rate |
|---|---|---|---|
| Grammar | 30 | 8 | 26.7% |
| Sentence Correction | 30 | 5 | 16.7% |
| Macro | 10 | 2 | 20% |
| Reading passages | 5 | 1 | 20% |
| Closure | 10 | 5 | 50% |
| Attention L1 cases | 20 | 5 | 25% |
| Attention L2 cases | 20 | 5 | 25% |
| Critical Thinking cases | 30 | 10 | 33.3% |

All draw rates < 100%, so random sampling without replacement is mathematically guaranteed to always succeed (no pool exhaustion edge cases).

### Case Atomicity (ASSM-03)

The assembly draws complete cases:
- Attention L1: 5 cases × 4 Qs = 20 questions (guaranteed 4-Q completeness by `groupBy(case_id)`)
- Attention L2: 5 cases × 4 Qs = 20 questions
- Critical Thinking: 10 cases × 4 Qs = 40 questions

Each case group was verified to have exactly 4 questions during Phase 1 ingestion (160 items ÷ 40 cases = 4; 120 items ÷ 30 cases = 4).

## Pitfalls to Avoid

1. **Do not add difficulty-tier-based stratified sampling in Phase 2** — this is a Phase 3/v2 enhancement. Keep assembly as pure random-within-quota.
2. **Do not test GAS functions by calling the live URL** — use extracted Node fixture tests to keep the test suite deterministic and offline-capable.
3. **Do not change quota numbers** — the `FS QB Pattern.xlsx` Sheet2 values are authoritative.
4. **Do not try to get tests to pass on GAS V8 runtime quirks** — the vitest tests run the extracted logic as plain JS; that's sufficient for Phase 2 verification.
