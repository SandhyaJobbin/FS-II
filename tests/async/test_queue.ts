/**
 * test_queue.ts
 *
 * Phase 9 Async Queue -- Vitest test suite for tests/async/queue-logic.ts.
 * Covers the Stage/retry state machine and the 5-row batch-selection logic
 * (ASYNC-02/05, must_haves truth #1).
 *
 * Run: npx vitest run tests/async/test_queue.ts
 */

import { describe, it, expect } from 'vitest';
import {
  selectEligibleRows,
  isPermanentlyFailed,
  nextStageAfterGradingSuccess,
  nextStageAfterEmailsSent,
  nextStageAfterFailure,
  type PendingGradingRow,
  type Stage,
} from './queue-logic';

function makeRow(stage: Stage, attemptsCount = 0): PendingGradingRow {
  return { stage, attemptsCount };
}

// ─── selectEligibleRows ───────────────────────────────────────────────────────

describe('selectEligibleRows', () => {
  it('includes rows with stage "queued" or "graded"', () => {
    const rows = [makeRow('queued'), makeRow('graded')];
    const result = selectEligibleRows(rows);
    expect(result).toHaveLength(2);
  });

  it('excludes rows with stage "done" or "permanently_failed"', () => {
    const rows = [makeRow('queued'), makeRow('done'), makeRow('permanently_failed'), makeRow('graded')];
    const result = selectEligibleRows(rows);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.stage === 'queued' || r.stage === 'graded')).toBe(true);
  });

  it('caps the result at 5 items even when more than 5 rows qualify', () => {
    const rows = Array.from({ length: 12 }, () => makeRow('queued'));
    const result = selectEligibleRows(rows);
    expect(result).toHaveLength(5);
  });

  it('returns an empty array when no rows are eligible', () => {
    const rows = [makeRow('done'), makeRow('permanently_failed')];
    expect(selectEligibleRows(rows)).toEqual([]);
  });
});

// ─── isPermanentlyFailed (D-11 retry cap) ────────────────────────────────────

describe('isPermanentlyFailed', () => {
  it('returns false for attempt counts below the retry cap (0, 1, 2)', () => {
    expect(isPermanentlyFailed(0)).toBe(false);
    expect(isPermanentlyFailed(1)).toBe(false);
    expect(isPermanentlyFailed(2)).toBe(false);
  });

  it('returns true for attempt counts at or above the retry cap (3+)', () => {
    expect(isPermanentlyFailed(3)).toBe(true);
    expect(isPermanentlyFailed(4)).toBe(true);
    expect(isPermanentlyFailed(10)).toBe(true);
  });
});

// ─── Stage transitions ────────────────────────────────────────────────────────

describe('nextStageAfterGradingSuccess', () => {
  it('returns "graded"', () => {
    expect(nextStageAfterGradingSuccess()).toBe('graded');
  });
});

describe('nextStageAfterEmailsSent', () => {
  it('returns "done" only when both candidate and recruiter sends succeeded', () => {
    expect(nextStageAfterEmailsSent('sent', 'sent', true, 'graded')).toBe('done');
  });

  it('stays retryable when recruiter send failed or deferred', () => {
    expect(nextStageAfterEmailsSent('sent', 'failed', true, 'graded')).toBe('graded');
    expect(nextStageAfterEmailsSent('sent', 'deferred', true, 'graded')).toBe('graded');
    expect(nextStageAfterEmailsSent('deferred', 'sent', true, 'graded')).toBe('graded');
  });

  it('fails safe to "done" when recruiter emails unconfigured (D-06)', () => {
    expect(nextStageAfterEmailsSent('sent', 'failed', false, 'graded')).toBe('done');
  });
});

describe('nextStageAfterFailure (D-11 retry cap)', () => {
  it('returns "permanently_failed" once the incremented count reaches 3', () => {
    // attemptsCount=2 -> newCount=3 -> hits the cap
    expect(nextStageAfterFailure(2, 'graded')).toBe('permanently_failed');
    expect(nextStageAfterFailure(5, 'queued')).toBe('permanently_failed');
  });

  it('returns the unchanged current stage when below the retry cap', () => {
    expect(nextStageAfterFailure(0, 'queued')).toBe('queued');
    expect(nextStageAfterFailure(1, 'graded')).toBe('graded');
  });
});
