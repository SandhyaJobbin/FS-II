import { describe, it, expect } from 'vitest';
import { buildScoreTrend, AttemptsRow } from './analytics-reducers';
import fixtureData from './fixtures/attempts_20.json';

describe('buildScoreTrend', () => {
  it('aggregates points by date and sorts them chronologically', () => {
    const res = buildScoreTrend(fixtureData.attempts as AttemptsRow[]);
    expect(res.enough_data).toBe(true);
    expect(res.samples).toBe(18); // 18 ready attempts in fixture (20 - pending_grading - grading_failed)
    expect(res.points.length).toBeGreaterThanOrEqual(3);
    
    // Check that points are sorted by date
    for (let i = 1; i < res.points.length; i++) {
      expect(res.points[i].date >= res.points[i - 1].date).toBe(true);
    }
  });

  it('enforces D-03 threshold: false if attempts < 5', () => {
    // Only 4 attempts across 4 days
    const mockAttempts: AttemptsRow[] = [
      ["a1", "C", "c@x.com", "", "2026-08-01", "graded", "", 90, 0, 0, 0, 0, "Strong Fit", "", 0],
      ["a2", "C", "c@x.com", "", "2026-08-02", "graded", "", 80, 0, 0, 0, 0, "Consider", "", 0],
      ["a3", "C", "c@x.com", "", "2026-08-03", "submitted", "", 70, 0, 0, 0, 0, "Consider", "", 0],
      ["a4", "C", "c@x.com", "", "2026-08-04", "emailed", "", 60, 0, 0, 0, 0, "Not Recommended", "", 0]
    ];
    const res = buildScoreTrend(mockAttempts);
    expect(res.enough_data).toBe(false);
    expect(res.samples).toBe(4);
  });

  it('enforces D-03 threshold: false if distinct days < 3', () => {
    // 6 attempts but only across 2 days (3 attempts on day 1, 3 on day 2)
    const mockAttempts: AttemptsRow[] = [
      ["a1", "C", "c@x.com", "", "2026-08-01T10:00:00Z", "graded", "", 90, 0, 0, 0, 0, "Strong Fit", "", 0],
      ["a2", "C", "c@x.com", "", "2026-08-01T11:00:00Z", "graded", "", 80, 0, 0, 0, 0, "Consider", "", 0],
      ["a3", "C", "c@x.com", "", "2026-08-01T12:00:00Z", "submitted", "", 70, 0, 0, 0, 0, "Consider", "", 0],
      ["a4", "C", "c@x.com", "", "2026-08-02T10:00:00Z", "emailed", "", 60, 0, 0, 0, 0, "Not Recommended", "", 0],
      ["a5", "C", "c@x.com", "", "2026-08-02T11:00:00Z", "graded", "", 75, 0, 0, 0, 0, "Consider", "", 0],
      ["a6", "C", "c@x.com", "", "2026-08-02T12:00:00Z", "graded", "", 85, 0, 0, 0, 0, "Strong Fit", "", 0]
    ];
    const res = buildScoreTrend(mockAttempts);
    expect(res.enough_data).toBe(false);
    expect(res.points).toHaveLength(2); // 2 distinct days
  });

  it('ignores attempts without valid EndTime or score', () => {
    const mockAttempts: AttemptsRow[] = [
      ["a1", "C", "c@x.com", "", "", "graded", "", 90, 0, 0, 0, 0, "Strong Fit", "", 0], // missing EndTime
      ["a2", "C", "c@x.com", "", "2026-08-01", "graded", "", "", 0, 0, 0, 0, "Consider", "", 0] // missing Score
    ];
    const res = buildScoreTrend(mockAttempts);
    expect(res.points).toHaveLength(0);
  });
});
