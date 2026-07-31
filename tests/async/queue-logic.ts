/**
 * queue-logic.ts
 *
 * Pure TypeScript extraction of the Phase 9 async queue stage/retry/batch-selection
 * logic from backend/AsyncGrading.gs. This module has NO SpreadsheetApp, LockService,
 * MailApp, or PropertiesService dependencies -- it operates solely on plain data
 * structures so it can be imported and tested under Vitest (Node.js).
 *
 * Any change to the stage/retry/batch rules in AsyncGrading.gs MUST be mirrored here.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type Stage = 'queued' | 'graded' | 'done' | 'permanently_failed';

export interface PendingGradingRow {
  rowIndex?: number;
  attemptId?: string;
  stage: Stage;
  attemptsCount: number;
  [key: string]: unknown;
}

// ─── Constants (D-09/D-10/D-11) ─────────────────────────────────────────────

/** D-10: processGradingQueue batch cap -- readEligiblePendingRows().slice(0, 5) */
export const BATCH_CAP = 5;

/** D-11: retry cap -- recordQueueItemFailure marks permanently_failed once count >= 3 */
export const RETRY_CAP = 3;

/** D-09: trigger cadence in minutes -- installGradingTrigger's everyMinutes(5) */
export const TRIGGER_CADENCE_MINUTES = 5;

// ─── Batch Selection (mirrors readEligiblePendingRows + processGradingQueue) ──

/**
 * selectEligibleRows -- mirrors readEligiblePendingRows()'s stage filter
 * ("queued" or "graded" only) combined with processGradingQueue()'s
 * `.slice(0, 5)` batch cap.
 */
export function selectEligibleRows<T extends PendingGradingRow>(rows: T[]): T[] {
  return rows
    .filter((row) => row.stage === 'queued' || row.stage === 'graded')
    .slice(0, BATCH_CAP);
}

// ─── Retry Cap (mirrors recordQueueItemFailure) ─────────────────────────────

/**
 * isPermanentlyFailed -- mirrors recordQueueItemFailure's `newCount >= 3` check.
 */
export function isPermanentlyFailed(attemptsCount: number): boolean {
  return attemptsCount >= RETRY_CAP;
}

// ─── Stage Transitions (mirrors processQueueItem) ───────────────────────────

/**
 * nextStageAfterGradingSuccess -- mirrors processQueueItem's
 * setPendingGradingStage(row.rowIndex, "graded") call after
 * gradeAndFinalizeAttempt succeeds.
 */
export function nextStageAfterGradingSuccess(): Stage {
  return 'graded';
}

/**
 * nextStageAfterCandidateEmailSent -- mirrors processQueueItem's
 * setPendingGradingStage(row.rowIndex, "done") call once the candidate
 * email send result is "sent".
 */
export function nextStageAfterCandidateEmailSent(): Stage {
  return 'done';
}

/**
 * nextStageAfterFailure -- mirrors recordQueueItemFailure's stage transition:
 * the attempts counter is incremented first, and once the incremented count
 * reaches the retry cap (3), the row moves to the terminal "permanently_failed"
 * stage. Otherwise the row's stage is left unchanged so it remains eligible
 * for retry on the next queue-drain pass.
 */
export function nextStageAfterFailure(attemptsCount: number, currentStage: Stage): Stage {
  const newCount = attemptsCount + 1;
  return newCount >= RETRY_CAP ? 'permanently_failed' : currentStage;
}
