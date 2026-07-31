---
phase: 08-cleanup-test-safety-net
plan: 04
subsystem: infra
tags: [github-actions, ci, vitest, tsx]

# Dependency graph
requires:
  - phase: 08-cleanup-test-safety-net (plan 01)
    provides: "tests/admin/admin-auth.ts mirror, checked by sync-check's ADMIN_TOKEN comparison"
  - phase: 08-cleanup-test-safety-net (plan 02)
    provides: "grading-engine.ts llmResults support, checked by sync-check's response-type/scoring comparisons"
provides:
  - ".github/workflows/test.yml — gates every PR to main on npm test + sync-check"
  - "scripts/sync-check.ts — detects grading-logic drift between the TS mirror and Code.gs across 5 categories"
  - "package-lock.json committed and un-ignored — npm ci now works in CI"
affects: []

# Tech tracking
tech-stack:
  added: [tsx@^4.23.1]
  patterns: ["regex-based semantic-equivalence checking across TS/GAS file pairs"]

key-files:
  created: [.github/workflows/test.yml, scripts/sync-check.ts]
  modified: [package.json, package-lock.json, .gitignore]

key-decisions:
  - "sync-check.ts uses tolerant regexes (e.g. total\\w*, overall\\w*) rather than exact string matches, since Code.gs (GAS) and the TS mirror legitimately use different variable-name suffixes (total vs totalQuestions, overall vs overallPercentage) for the same logic."
  - "Bank-mapping check uses a proximity window (condition followed by the same literal within 30 chars) instead of a ternary-specific pattern, since the mirror uses a ternary chain and Code.gs uses if-statements — different syntax, same semantics."
  - "test.yml triggers on pull_request only (not push), to avoid double-running alongside the existing deploy.yml push trigger."
  - "Discovered and fixed a blocking issue: package-lock.json was gitignored via a blanket `*.json` rule and had never been committed. npm ci would fail on every PR with no lockfile in a fresh checkout. Added `!package-lock.json` to .gitignore and committed the lockfile — required for this plan's own stated purpose (a working CI gate) to function at all."

patterns-established:
  - "Any file requiring both TS-mirror and Code.gs (GAS) representations gets a sync-check.ts entry using tolerant regex matching, not exact string equality, to avoid false-positive drift alarms from legitimate naming differences."

requirements-completed: [BUG-03]

coverage:
  - id: D1
    description: "sync-check.ts detects divergence across scoring formula, tier thresholds, bank mapping, response-type handling, and ADMIN_TOKEN — all 5 categories pass on the current, in-sync codebase"
    requirement: "BUG-03"
    verification:
      - kind: other
        ref: "npx tsx scripts/sync-check.ts — 17/17 checks PASS, exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: ".github/workflows/test.yml triggers on pull_request to main, runs npm ci + npm test + sync-check, following deploy.yml's Node 22 / actions@v4 conventions"
    requirement: "BUG-03"
    verification:
      - kind: other
        ref: "npm ci (dry-run of CI's first step) succeeds cleanly against committed package-lock.json"
        status: pass
    human_judgment: false
  - id: D3
    description: "No regression — full test suite still passes after the sync-check regex fix and lockfile commit"
    verification:
      - kind: unit
        ref: "npm test — 90/90 passed"
        status: pass
    human_judgment: false

# Metrics
duration: unknown
completed: 2026-07-31
status: complete
---

# Phase 08 Plan 04: CI Workflow & Sync-Check Summary

**`.github/workflows/test.yml` gates every PR on `npm test` + a 5-category grading-mirror drift detector (`scripts/sync-check.ts`); fixed 7 regex false-positives and a gitignored `package-lock.json` that would have broken `npm ci` on first run.**

## Performance

- **Started:** unknown (implementation was already present in the working tree when this session began; the regex bug fix and lockfile fix happened live in this session)
- **Completed:** 2026-07-31T10:36:36+05:30
- **Tasks:** 3 (regex fix, lockfile/gitignore fix, commit)
- **Files modified:** 5

## Accomplishments
- `.github/workflows/test.yml` created: triggers on `pull_request` to `main`, runs `actions/checkout@v4` → `actions/setup-node@v4` (Node 22, npm cache) → `npm ci` → `npm test` → `npx tsx scripts/sync-check.ts`
- `scripts/sync-check.ts` created: regex-based semantic-equivalence checks across 5 categories (scoring formula, tier thresholds, bank mapping, response-type handling, ADMIN_TOKEN constant), comparing `tests/grading/grading-engine.ts` against `backend/Code.gs`
- Fixed 7 false-positive divergence failures in the original regex patterns (see Deviations below) — all 17 checks now correctly PASS against the current, genuinely-in-sync codebase
- Fixed a blocking gap: `package-lock.json` was gitignored and never committed, which would have made `npm ci` fail on every single PR run

## Task Commits

The CI workflow and sync-check script were already implemented, uncommitted, in the working tree at the start of this session. This session found `npx tsx scripts/sync-check.ts` failing with 7 false-positive divergences, root-caused it to variable-naming differences between the mirror and Code.gs (not real drift), fixed the regexes, discovered and fixed the gitignored-lockfile blocker, verified, then committed:

1. **Fix sync-check.ts regex false positives** - part of `3f597f8` (feat)
2. **Un-ignore and commit package-lock.json** - part of `3f597f8` (feat)
3. **Add CI workflow + sync-check script** - `3f597f8` (feat)

## Files Created/Modified
- `.github/workflows/test.yml` - New PR-gating workflow (test + sync-check)
- `scripts/sync-check.ts` - New drift-detection script, regexes fixed for real-world Code.gs/mirror naming differences
- `package.json` - Added `tsx` devDependency and `sync-check` script entry
- `package-lock.json` - Newly committed (previously gitignored); regenerated via `npm install` to include `tsx` and its transitive deps
- `.gitignore` - Added `!package-lock.json` exception to the blanket `*.json` ignore rule

## Decisions Made
See `key-decisions` in frontmatter. Summary: tolerant regex matching over exact string matching for the TS/GAS comparisons, since the two languages/files use different (but semantically equivalent) variable names; `pull_request`-only trigger to avoid double-running with `deploy.yml`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] sync-check.ts regex patterns didn't account for Code.gs's actual variable-naming conventions**
- **Found during:** Verification (`npx tsx scripts/sync-check.ts` before any commits)
- **Issue:** The mirror (`grading-engine.ts`) uses bare variable names (`total`, `overall`, `critical`, `research`) and a single-quoted ternary for bank mapping. `Code.gs` uses suffixed names (`totalQuestions`, `overallPercentage`, `criticalPct`, `researchPct`) and double-quoted if-statements. Both are semantically correct and in sync, but the original regexes required exact bare-name/ternary matches, producing 7 false-positive "divergence" failures that would have blocked every PR even with zero real drift.
- **Fix:** Relaxed scoring-formula and tier-threshold regexes from bare names to `name\w*` (tolerates any suffix). Replaced the ternary-specific bank-mapping pattern with a condition-then-value proximity check (`bank === ["']X["'][\s\S]{0,30}["']X["']`) that matches both the mirror's ternary and Code.gs's if-statement structure without being so loose it'd miss real drift.
- **Files modified:** `scripts/sync-check.ts`
- **Verification:** `npx tsx scripts/sync-check.ts` — all 17 checks PASS, exit 0
- **Committed in:** `3f597f8` (part of the 08-04 commit)

**2. [Rule 3 - Blocking] package-lock.json was gitignored and never committed**
- **Found during:** Pre-commit investigation of package.json's new `tsx` devDependency
- **Issue:** `.gitignore` had a blanket `*.json` rule with exceptions only for `package.json`, `tsconfig.json`, and `.planning/**/*.json` — `package-lock.json` was never excepted, so it was untracked and gitignored. `npm ci` (used in the new `test.yml`) requires a committed lockfile; without one, every PR's CI run would fail at the `npm ci` step before tests even executed, making this plan's entire deliverable non-functional on arrival.
- **Fix:** Added `!package-lock.json` to `.gitignore`. Ran `npm install` to regenerate the lockfile so it correctly includes `tsx` (previously missing from it entirely — `package.json` and `package-lock.json` were out of sync even before this fix). Committed the lockfile.
- **Files modified:** `.gitignore`, `package-lock.json`
- **Verification:** `npm ci` runs cleanly against the committed lockfile (simulates CI's first step); `npm test` still 90/90 afterward
- **Committed in:** `3f597f8` (part of the 08-04 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both fixes were required for this plan's stated goal — a working PR test gate — to actually function. Without them, sync-check would false-fail on every run and `npm ci` would fail before reaching either check. No scope creep beyond what's needed to deliver a working CI gate.

## Issues Encountered

This plan's CI workflow and sync-check script were found already implemented in the working tree, with no git history and no SUMMARY.md, but `sync-check.ts` was failing when run. Diagnosed the failures as false positives (naming-convention differences, not real logic drift), fixed them, then discovered the deeper `npm ci`-breaking lockfile gitignore issue during pre-commit investigation. Both fixes were applied and verified before committing. Confirmed scope and approach with the user before closing out all 4 phase-08 plans.

## User Setup Required

None - no external service configuration required. The workflow will run automatically on the next PR to `main`.

## Next Phase Readiness
- Phase 08 (cleanup & test safety net) is now fully committed: all 4 plans closed out, 90/90 tests passing, sync-check passing, CI workflow verified functional via `npm ci` dry-run.
- `.planning/STATE.md` and `.planning/ROADMAP.md` still need updating to reflect phase 08 completion (tracked separately, not part of this plan's file scope).

---
*Phase: 08-cleanup-test-safety-net*
*Completed: 2026-07-31*
