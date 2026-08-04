import { describe, it, expect } from 'vitest';
import { buildDiscriminationIndex, AttemptsRow, ResponsesRow, GradingTranscriptsRow } from './analytics-reducers';
import fixtureData from './fixtures/attempts_20.json';

describe('buildDiscriminationIndex', () => {
  it('identifies anti-discriminating questions and filters out low-sample questions', () => {
    const res = buildDiscriminationIndex(
      fixtureData.attempts as AttemptsRow[],
      fixtureData.responses as ResponsesRow[],
      fixtureData.transcripts as GradingTranscriptsRow[]
    );

    expect(res.enough_data).toBe(true);
    expect(res.samples).toBe(18); // 18 ready attempts

    // Let's look for our curated questions
    // q1-q5 should have enough samples, while q6 only has responses in some attempts.
    // Let's verify that the output rows are sorted by delta ascending
    for (let i = 1; i < res.rows.length; i++) {
      expect(res.rows[i].delta).toBeGreaterThanOrEqual(res.rows[i - 1].delta);
    }

    // Verify row structure
    res.rows.forEach(row => {
      expect(row.qId).toBeDefined();
      expect(row.passTop).toBeDefined();
      expect(row.passBottom).toBeDefined();
      expect(row.delta).toBe(row.passTop - row.passBottom);
      expect(row.sampleTop).toBeGreaterThanOrEqual(5);
      expect(row.sampleBottom).toBeGreaterThanOrEqual(5);
    });
  });

  it('enforces D-03: enough_data is false if ready attempts < 8', () => {
    const mockAttempts = (fixtureData.attempts as AttemptsRow[]).slice(0, 7);
    const res = buildDiscriminationIndex(
      mockAttempts,
      fixtureData.responses as ResponsesRow[],
      fixtureData.transcripts as GradingTranscriptsRow[]
    );
    expect(res.enough_data).toBe(false);
  });
});
