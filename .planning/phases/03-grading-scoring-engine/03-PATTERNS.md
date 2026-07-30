# Phase 3 — Patterns

## Pattern 1: Deterministic Grading Function

The scoring function in `Code.gs / grading-engine.ts` is a **pure function**:
- Input: frozen question objects (with `is_correct`) + candidate answers map
- Output: scores, tier, narrative
- No randomness, no I/O, no LLM calls

This enables offline testing via `tests/grading/grading-engine.ts` without mocking SpreadsheetApp.

## Pattern 2: Difficulty-Tier-Driven Narrative

Narrative insight is generated **exclusively** from `difficulty_tier === 'complex'` tagged items:

```
if (complexTotal === 0)     → use overall% proxy (3 branches)
elif (complexFailed === 0)  → "Exceptional investigative intuition"
elif (failed < 25%)         → "Strong analytical reasoning"
elif (failed < 60%)         → language/coaching branch
else                        → "Struggled" narrative
```

**Never** uses `q.section`, `q.level`, or `q.bank` as a proxy for difficulty.

## Pattern 3: Atomic Batch Write

All scored columns written in 2 batch calls, not 8 individual `setValue`:

```javascript
attemptsSheet.getRange(row, 5, 1, 2).setValues([[endTime, "submitted"]]); // E:F
attemptsSheet.getRange(row, 8, 1, 4).setValues([[overall, lang, research, crit]]); // H:K
attemptsSheet.getRange(row, 13, 1, 2).setValues([[tier, narrative]]); // M:N
```

Response rows written via single `setValues` block instead of per-row `appendRow`.

## Pattern 4: Field Name Contract

Client-facing report object field names are the canonical source of truth:

| Field | Backend variable | TypeScript Report field |
|-------|-----------------|------------------------|
| Tier | `recommendationTier` | `recommendationTier` |
| Narrative | `narrativeInsight` | `narrativeInsight` |
| Overall | `overallPercentage` | `overallScore` |
| Traits | `{ englishPct, researchPct, criticalPct }` | `traitScores.{ language, research, critical }` |

## Pattern 5: Leakage Guard

GAS handler never returns:
- `options` array (only scores)
- `is_correct`, `answer_key`, `correct_answer`, `correct_option` fields
- `frozenIds` or the raw question objects

The `containsAnswerKey()` function in `grading-engine.ts` verifies this recursively in tests.

## Pattern 6: Trait Progress Bar Colouring

Three-band colour scheme applied to all trait bars in `ReportScreen`:

| Score | Colour |
|-------|--------|
| ≥ 70% | `#10b981` (emerald) |
| 50–69% | `#f59e0b` (amber) |
| < 50% | `#ef4444` (red) |
