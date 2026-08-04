import { describe, it, expect } from 'vitest';
import { buildQuestionStats, ResponsesRow, GradingTranscriptsRow } from './analytics-reducers';
import fixtureData from './fixtures/attempts_20.json';

describe('buildUngradedCaveat', () => {
  it('surfaces ungraded counts correctly and excludes them from sampleSize', () => {
    const stats = buildQuestionStats(
      fixtureData.responses as ResponsesRow[],
      fixtureData.transcripts as GradingTranscriptsRow[]
    );

    // In attempts_20.json, q5 has multiple ungraded responses
    const q5 = stats.rows.find(r => r.qId === 'q5');
    expect(q5).toBeDefined();
    if (q5) {
      expect(q5.ungraded).toBe(2);
      // Graded sample size is correct + incorrect, and doesn't count ungraded
      expect(q5.sampleSize).toBe(q5.correct + q5.incorrect);
      
      // Total responses in responses array for q5:
      const totalResponsesForQ5 = (fixtureData.responses as ResponsesRow[]).filter(r => r[1] === 'q5').length;
      // Note: for att_11, q5 was overridden so it counts as graded (correct), hence it's part of sampleSize.
      // Total responses for q5 is graded + ungraded.
      expect(totalResponsesForQ5).toBe(18);
    }

    // Top-level stats should also reflect actual evaluated ungraded count (5)
    const statsTotalUngraded = stats.rows.reduce((sum, r) => sum + r.ungraded, 0);
    expect(statsTotalUngraded).toBe(5);
  });
});
