# Phase 8 Context: Cleanup & Test-Safety Net

## Phase Goal (from ROADMAP)
Frontend legacy dead code removed; grading-engine.ts mirror fixed with divergence-test fixtures; test_admin.ts rewritten to exercise real extracted auth-check; new .github/workflows/test.yml running npm test + sync-check on every PR

## Requirements Addressed
- **BUG-05** (F-06): Remove dead `frontend/` directory
- **BUG-01** (F-03): Fix grading-engine.ts mirror sync with Code.gs
- **BUG-02** (F-04): Rewrite test_admin.ts to test real auth
- **BUG-03**: Create CI workflow for npm test on PR

## Codebase State

### frontend/ (F-06)
- 3 files: `app.js` (889 lines vanilla JS), `index.html`, `style.css`
- Legacy pre-React app; real app lives in `assessment-app/` (Next.js)
- **Status**: Confirmed dead code, safe to remove

### tests/grading/grading-engine.ts (F-03)
- 182-line TypeScript mirror of Code.gs `handleSubmitAnswers`
- **Divergence**: Treats `open_text` as always correct (`isCorrect = true`), hybrid only grades MCQ portion
- **Code.gs reality**: Calls `evaluateOpenTextBatch()` (Gemini API) for open_text/hybrid questions
- **Gap**: Mirror doesn't test LLM grading path at all

### tests/admin/test_admin.ts (F-04)
- 54 lines; reimplements `validatePasscode` locally (`input === ADMIN_TOKEN`)
- **Code.gs reality**: Auth is inline `if (token !== ADMIN_TOKEN)` in each handler (lines 624, 660, 686)
- **Gap**: No extracted auth function exists yet; tests don't exercise real code

### CI/CD
- No `.github/workflows/` files exist
- ROADMAP mentions `deploy.yml` but not found
- Test infra: `vitest.config.ts` exists; tests in `tests/` dir

### Code.gs Key Details
- 19,396 lines
- `ADMIN_TOKEN = "FS_RECRUITER_SECRET_2026"`
- `evaluateOpenTextBatch` at line 63 (Gemini API with fallback)
- `handleSubmitAnswers` at line 407

## Decisions Made

### 1. F-03: LLM Grading Path Strategy
**Decision**: Mock LLM with fixture responses (Option A)

**Rationale**: 
- The mirror's purpose is to catch grading bugs end-to-end
- LLM score integration (weighted averaging with MCQ) is highest-risk logic
- Fixture responses like `{ text: "good answer", score: 0.8 }` are cheap to maintain
- Tests the real integration path, not just invocation

**Implementation**:
- Mock `evaluateOpenTextBatch` to return fixture responses
- Verify scores are correctly integrated into final grade calculation
- Test weighted averaging logic (MCQ + open_text scores)

### 2. F-04: Auth Function Extraction
**Decision**: Extract `checkAdminAuth(token)` in Code.gs (Option A)

**Rationale**:
- ROADMAP explicitly states "extracted auth-check"
- 5-line extraction across 3 call sites (lines 624, 660, 686)
- Zero risk refactor; makes tests meaningful
- DRY principle; single source of truth for auth logic

**Implementation**:
- Extract `function checkAdminAuth(token) { return token === ADMIN_TOKEN; }`
- Replace 3 inline checks with function calls
- Rewrite test_admin.ts to import and test `checkAdminAuth` directly

### 3. CI Workflow Scope
**Decision**: Create `test.yml` + `scripts/sync-check.ts` (Options A+C combined)

**Rationale**:
- `test.yml` matches Phase 8 goal exactly
- `sync-check.ts` detects grading-logic drift between mirror and Code.gs
- Skip `deploy.yml` — separate concern, out of Phase 8 scope

**Implementation**:
- `.github/workflows/test.yml`: runs `npm test` on PR
- `scripts/sync-check.ts`: 
  - Verifies key constants match (question counts, scoring weights)
  - Runs fixture-based tests that fail if Code.gs logic diverges
  - Cannot do exact diff (TS vs GAS), so focuses on semantic equivalence

### 4. F-06: Frontend Removal Documentation
**Decision**: Search & update all references (Option A)

**Rationale**:
- Quick grep + targeted edits
- Stale references to deleted directory are maintenance hazard
- Clean break prevents future confusion

**Implementation**:
- Grep for `frontend/` in README, docs, configs, ROADMAP, REQUIREMENTS
- Update or remove mentions
- Verify no broken links remain

## Success Criteria
1. `frontend/` directory deleted; no stale references in docs
2. `grading-engine.ts` mirror tests LLM path with mocked fixtures; passes
3. `checkAdminAuth(token)` extracted in Code.gs; test_admin.ts tests real function
4. `.github/workflows/test.yml` runs `npm test` + `scripts/sync-check.ts` on every PR
5. All existing tests still pass
