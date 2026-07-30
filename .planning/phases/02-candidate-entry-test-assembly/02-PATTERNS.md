# Phase 2: Candidate Entry & Test Assembly — Pattern Map

**Mapped:** 2026-07-29
**Status:** EXISTING CODE — not greenfield. Both the GAS backend and Next.js frontend already implement Phase 2 requirements. This document records the canonical patterns in the existing code that all Phase 2 work must follow.

## Existing Implementation Patterns

### Pattern 1: GAS Handler Structure

All action handlers in `backend/Code.gs` follow this shape:

```javascript
function handleXxx(param1, param2) {
  // 1. Guard: validate required inputs
  if (!param1) return { success: false, error: "..." };

  // 2. Data access: getActiveSpreadsheet() + getSheetByName()
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("SheetName");
  const data = sheet.getDataRange().getValues();

  // 3. Business logic
  // ...

  // 4. Write result (appendRow or getRange().setValue())
  sheet.appendRow([...]);

  // 5. Return structured response
  return { success: true, ... };
}
```

**Apply to:** any new handler added in Phase 2 fixes.

### Pattern 2: Email Normalization

```javascript
function normalizeEmail(email) {
  if (!email) return "";
  let clean = email.trim().toLowerCase();
  if (clean.endsWith("@gmail.com")) {
    let local = clean.split("@")[0];
    local = local.split("+")[0];   // strip plus-addressing
    local = local.replace(/\./g, ""); // strip dots
    clean = local + "@gmail.com";
  }
  return clean;
}
```

**Rule:** Always call `normalizeEmail()` before any email comparison. Never compare raw emails directly.

### Pattern 3: Assembly — Pool Filtering + Case Grouping

```javascript
// Individual question sampling
const pool = QUESTIONS.filter(q => q.bank === "english" && q.section === "grammar");
selectedIds.push(...sampleRandom(pool, QUOTAS.grammar.count).map(q => q.id));

// Case-level sampling (whole cases only)
const pool = QUESTIONS.filter(q => q.bank === "attention" && q.level === "L1");
const cases = groupBy(pool, "case_id");
const chosenCaseIds = sampleRandom(Object.keys(cases), QUOTAS.attention_l1.count);
chosenCaseIds.forEach(cId => {
  selectedIds.push(...cases[cId].map(q => q.id));
});
```

**Rule:** Attention and Critical questions MUST be sampled at the case level. Never individually sample questions from these banks.

### Pattern 4: Client Payload Sanitization

```javascript
// Deep clone, strip is_correct
return {
  id: q.id,
  bank: q.bank,
  section: q.section,
  level: q.level,
  case_id: q.case_id,
  case_title: q.case_title,
  tabs: q.tabs,
  tables: q.tables,
  difficulty_tier: q.difficulty_tier,  // NOT answer key — safe to include
  response_type: q.response_type,
  stem: q.stem,
  options: q.options.map(o => ({ letter: o.letter, text: o.text })) // omit is_correct!
};
```

**Rule:** The `options` array MUST be remapped to `{ letter, text }` only. `is_correct` MUST never appear in any client-facing JSON. `difficulty_tier` is safe.

### Pattern 5: Attempt Storage (Frozen Set)

```javascript
// Write
attemptsSheet.appendRow([
  attemptId, name, email, startTime.toISOString(),
  "",       // EndTime (empty until submit)
  "active", // Status
  JSON.stringify(assembledIds), // Column 7 — the frozen set
  "", "", "", "", 0, "", ""     // Score columns empty
]);

// Read back (on submit)
const frozenIds = JSON.parse(attemptRow[6]); // column 7, 0-indexed = index 6
```

**Rule:** The frozen set is always in column 7 (1-indexed), index 6 (0-indexed). Never re-derive the assembly on submit.

### Pattern 6: Fisher-Yates Random Sampling

```javascript
function sampleRandom(arr, count) {
  const shuffled = arr.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}
```

**Rule:** This function must never be modified for Phase 2. It is used for both individual questions AND case IDs (passed as `Object.keys(cases)`).

### Pattern 7: Next.js Frontend State Machine

The app uses a simple `screen` state with 4 values: `'welcome' | 'assembly' | 'test' | 'report'`.

```
welcome → (submit form) → assembly → (proceed) → test → (submit) → report
```

localStorage keys:
- `fs_attempt_id`, `fs_name`, `fs_email`, `fs_questions`, `fs_gas_url`
- `fs_test_active` (boolean string, set when entering test screen)
- `fs_current_index`, `fs_answers`, `fs_xp`

**Rule:** Phase 2 work must not change the screen state machine or localStorage key names — Phase 4 depends on them.

## File Classification

| File | Role | Pattern | Status |
|---|---|---|---|
| `backend/Code.gs` | Full backend (assembly + identity + grading) | All 6 patterns above | EXISTS — minor fixes needed |
| `assessment-app/src/app/page.tsx` | App state machine + GAS fetcher | Pattern 7 | EXISTS — no changes |
| `assessment-app/src/components/WelcomeScreen.tsx` | Entry form | Pattern 7 | EXISTS — env var fallback to add |
| `assessment-app/src/components/AssemblyScreen.tsx` | Post-registration summary | Pattern 7 | EXISTS — no changes |
| `assessment-app/src/types/index.ts` | TypeScript types | — | EXISTS — `difficulty_tier` field to add |
| `tests/assembly/test_assembly.ts` | Vitest fixture suite | Patterns 2, 3, 4, 5, 6 extracted | NEW |
| `tests/assembly/fixtures/questions_fixture.json` | Test fixture | — | NEW |

## Conventions

1. **GAS V8 runtime**: All `Code.gs` code must be ES2019-compatible (no optional chaining `?.`, no nullish coalescing `??`, no top-level await). Check before adding new syntax.
2. **No external imports in Code.gs**: GAS cannot `require()` or `import` npm packages. All helpers must be inline.
3. **Test extraction pattern**: The vitest tests replicate the GAS logic as pure JS functions — they do not call the live GAS URL. Fixture question objects must include `is_correct` (as they do in the real QUESTIONS array) to test sanitization.
4. **QUESTIONS embed size**: At 559KB, `Code.gs` is near GAS script size limits (~50MB per file, well within). No concern for Phase 2.
