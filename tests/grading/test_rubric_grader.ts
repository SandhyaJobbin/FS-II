import { describe, it, expect } from 'vitest';
import { parseGeminiRubricResponse, effectiveVerdict, TRANSCRIPT_COLUMN_COUNT } from './rubric-grader';

describe('rubric-grader', () => {
  it('parses valid schema', () => {
    const raw = JSON.stringify({
      verdict: 'correct',
      criteriaMet: [{ criterionName: 'A', met: true, score: 1 }],
      rationale: 'ok',
    });
    const r = parseGeminiRubricResponse(raw);
    expect(r.verdict).toBe('correct');
    expect(r.criteriaMet).toHaveLength(1);
    expect(r.rationale).toBe('ok');
  });

  it('failure yields ungraded', () => {
    expect(parseGeminiRubricResponse('not-json').verdict).toBe('ungraded');
    expect(parseGeminiRubricResponse(JSON.stringify({ verdict: 'maybe' })).verdict).toBe('ungraded');
    expect(parseGeminiRubricResponse('').verdict).toBe('ungraded');
  });

  it('persists rubric version implicitly via TRANSCRIPT_COLUMN_COUNT', () => {
    expect(TRANSCRIPT_COLUMN_COUNT).toBe(9);
  });

  it('persists rationale verbatim', () => {
    const long = 'The candidate correctly identified X but missed Y.';
    const raw = JSON.stringify({ verdict: 'incorrect', criteriaMet: [], rationale: long });
    expect(parseGeminiRubricResponse(raw).rationale).toBe(long);
  });

  it('effectiveVerdict precedence: OverrideVerdict > Verdict > IsCorrect', () => {
    expect(effectiveVerdict({ OverrideVerdict: 'incorrect', Verdict: 'correct' }, { IsCorrect: 1 })).toBe('incorrect');
    expect(effectiveVerdict({ OverrideVerdict: '', Verdict: 'correct' }, { IsCorrect: 0 })).toBe('correct');
    expect(effectiveVerdict({ OverrideVerdict: '', Verdict: '' }, { IsCorrect: 1 })).toBe('correct');
    expect(effectiveVerdict({ OverrideVerdict: '', Verdict: '' }, { IsCorrect: 'ungraded' })).toBe('ungraded');
    expect(effectiveVerdict(null, null)).toBe('ungraded');
  });
});
