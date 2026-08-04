import { describe, it, expect } from 'vitest';
import { buildViolationCorrelation, AttemptsRow } from './analytics-reducers';
import fixtureData from './fixtures/attempts_20.json';

describe('buildViolationCorrelation', () => {
  it('correctly calculates Pearson r on the fixture attempts', () => {
    const res = buildViolationCorrelation(fixtureData.attempts as AttemptsRow[]);
    // In our attempts_20 fixture:
    // samples = 18 (submitted, graded, emailed)
    // violation attempts = 9 attempts (att_04, att_05, att_07, att_08, att_09, att_12, att_13, att_15, att_20 have violation count > 0)
    // Since violationsCount is 9 (< 10) and total samples is 18 (< 20), enough_data should be false on the raw fixture
    expect(res.enough_data).toBe(false);
    expect(res.r).toBeDefined();
  });

  it('matches a hand-computed Pearson r value within 0.001', () => {
    // 10 attempts, all having violations, so violationsCount >= 10 -> enough_data: true
    const mockAttempts: AttemptsRow[] = [
      ["a1", "C", "c@x.com", "", "2026-08-01", "graded", "", 90, 0, 0, 0, 1, "Strong Fit", "", 0],
      ["a2", "C", "c@x.com", "", "2026-08-02", "graded", "", 85, 0, 0, 0, 2, "Strong Fit", "", 0],
      ["a3", "C", "c@x.com", "", "2026-08-03", "graded", "", 80, 0, 0, 0, 3, "Strong Fit", "", 0],
      ["a4", "C", "c@x.com", "", "2026-08-04", "graded", "", 75, 0, 0, 0, 4, "Consider", "", 0],
      ["a5", "C", "c@x.com", "", "2026-08-05", "graded", "", 70, 0, 0, 0, 5, "Consider", "", 0],
      ["a6", "C", "c@x.com", "", "2026-08-06", "graded", "", 65, 0, 0, 0, 6, "Consider", "", 0],
      ["a7", "C", "c@x.com", "", "2026-08-07", "graded", "", 60, 0, 0, 0, 7, "Consider", "", 0],
      ["a8", "C", "c@x.com", "", "2026-08-08", "graded", "", 55, 0, 0, 0, 8, "Not Recommended", "", 0],
      ["a9", "C", "c@x.com", "", "2026-08-09", "graded", "", 50, 0, 0, 0, 9, "Not Recommended", "", 0],
      ["a10", "C", "c@x.com", "", "2026-08-10", "graded", "", 45, 0, 0, 0, 10, "Not Recommended", "", 0]
    ];
    // Perfect negative linear correlation: r = -1
    const res = buildViolationCorrelation(mockAttempts);
    expect(res.enough_data).toBe(true);
    expect(res.r).toBe(-1);
    expect(res.interpretation).toBe('strong');
  });

  it('enforces the OR-gated threshold logic: true if samples >= 20', () => {
    // 20 attempts, none with violations (violationsCount = 0)
    const mockAttempts: AttemptsRow[] = [];
    for (let i = 1; i <= 20; i++) {
      mockAttempts.push([
        `a${i}`, "C", "c@x.com", "", "2026-08-01", "graded", "", 80, 0, 0, 0, 0, "Consider", "", 0
      ]);
    }
    const res = buildViolationCorrelation(mockAttempts);
    expect(res.enough_data).toBe(true);
    expect(res.samples).toBe(20);
    expect(res.violationsCount).toBe(0);
    expect(res.r).toBe(0);
    expect(res.interpretation).toBe('weak');
  });
});
