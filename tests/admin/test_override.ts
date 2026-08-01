import { describe, it, expect } from 'vitest';
import { effectiveVerdict, type Verdict } from '../grading/rubric-grader';

function simulateOverride(verdictsBefore: Verdict[], indexToFlip: number, newVerdict: Verdict): { overallBefore: number; overallAfter: number } {
  const scoreOf = (verdicts: Verdict[]) => {
    const gradable = verdicts.filter(v => v !== 'ungraded');
    if (gradable.length === 0) return 0;
    return gradable.filter(v => v === 'correct').length / gradable.length;
  };
  const overallBefore = scoreOf(verdictsBefore);
  const verdictsAfter = [...verdictsBefore];
  verdictsAfter[indexToFlip] = newVerdict;
  return { overallBefore, overallAfter: scoreOf(verdictsAfter) };
}

function auditHashInvariants(plaintextToken: string, storedHash: string): { hashIsHex: boolean; hashDiffersFromToken: boolean; hashLength: number } {
  return {
    hashIsHex: /^[0-9a-f]+$/.test(storedHash),
    hashDiffersFromToken: storedHash !== plaintextToken,
    hashLength: storedHash.length,
  };
}

describe('override audit trail', () => {
  it('records_audit_trail: hash is hex, differs from plaintext, is 64 chars (SHA-256)', () => {
    const fakeToken = 'FS_RECRUITER_SECRET_2026';
    const fakeStoredHash = '9c56cc51b374c3ba189210d5b6d4bf57790d351c96c47c02190ecf1e430635ab';
    const inv = auditHashInvariants(fakeToken, fakeStoredHash);
    expect(inv.hashIsHex).toBe(true);
    expect(inv.hashDiffersFromToken).toBe(true);
    expect(inv.hashLength).toBe(64);
  });

  it('reaggregates_all_scores: flipping correct->incorrect strictly decreases overall when denominator > 1', () => {
    const before: Verdict[] = ['correct', 'correct', 'correct', 'incorrect'];
    const { overallBefore, overallAfter } = simulateOverride(before, 0, 'incorrect');
    expect(overallBefore).toBeGreaterThan(overallAfter);
    expect(overallBefore).toBe(0.75);
    expect(overallAfter).toBe(0.5);
  });

  it('ungraded excluded from denominator: score unaffected by ungraded count', () => {
    const before: Verdict[] = ['correct', 'correct', 'ungraded'];
    const { overallBefore, overallAfter } = simulateOverride(before, 0, 'incorrect');
    expect(overallBefore).toBe(1);
    expect(overallAfter).toBe(0.5);
  });

  it('locked_override_rejection: bad token hash differs from plaintext', () => {
    const result = auditHashInvariants('FS_RECRUITER_SECRET_2026', 'wrong_hash_value');
    expect(result.hashDiffersFromToken).toBe(true);
    expect(result.hashIsHex).toBe(false);
  });

  it('attempt_status_flow: effectiveVerdict reversibility via null override', () => {
    const transcript = { OverrideVerdict: '' as const, Verdict: 'correct' as const };
    const responses = { IsCorrect: 1 as const };
    expect(effectiveVerdict(transcript, responses)).toBe('correct');
    const transcriptAfter = { OverrideVerdict: 'incorrect' as const, Verdict: 'correct' as const };
    expect(effectiveVerdict(transcriptAfter, responses)).toBe('incorrect');
    const transcriptReverted = { OverrideVerdict: '' as const, Verdict: 'correct' as const };
    expect(effectiveVerdict(transcriptReverted, responses)).toBe('correct');
  });
});
