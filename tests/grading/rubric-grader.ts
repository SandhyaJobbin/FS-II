export const TRANSCRIPT_COLUMN_COUNT = 9;

export type Verdict = 'correct' | 'incorrect' | 'ungraded';

export interface RubricResult {
  verdict: Verdict;
  criteriaMet: Array<{ criterionName: string; met: boolean; score: number }>;
  rationale: string;
}

export interface TranscriptRow {
  OverrideVerdict: Verdict | null | '';
  Verdict: Verdict | null | '';
}

export interface ResponsesRow {
  IsCorrect: 0 | 1 | 'ungraded' | '0' | '1';
}

export function effectiveVerdict(transcriptRow: TranscriptRow | null, responsesRow: ResponsesRow | null): Verdict {
  if (transcriptRow && transcriptRow.OverrideVerdict) return transcriptRow.OverrideVerdict as Verdict;
  if (transcriptRow && transcriptRow.Verdict) return transcriptRow.Verdict as Verdict;
  if (!responsesRow) return 'ungraded';
  const raw = responsesRow.IsCorrect;
  if (raw === 'ungraded') return 'ungraded';
  return (raw === 1 || raw === '1') ? 'correct' : 'incorrect';
}

export function parseGeminiRubricResponse(rawText: string): RubricResult {
  try {
    const parsed = JSON.parse(rawText);
    if (typeof parsed.verdict !== 'string' || !['correct', 'incorrect'].includes(parsed.verdict)) {
      return { verdict: 'ungraded', criteriaMet: [], rationale: '' };
    }
    return {
      verdict: parsed.verdict as Verdict,
      criteriaMet: parsed.criteriaMet || [],
      rationale: parsed.rationale || '',
    };
  } catch {
    return { verdict: 'ungraded', criteriaMet: [], rationale: '' };
  }
}
