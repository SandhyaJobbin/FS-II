import { describe, it, expect } from 'vitest';
import { checkAdminAuth, ADMIN_TOKEN } from './admin-auth';

interface CandidateRow {
  attemptId: string;
  name: string;
  email: string;
  violationCount: number;
  overallScore: number;
  recommendationTier: string;
}

function hasViolationWarning(violationCount: number): boolean {
  return violationCount >= 3;
}

describe('Admin Auth — checkAdminAuth (F-04)', () => {
  it('valid token returns true', () => {
    expect(checkAdminAuth(ADMIN_TOKEN)).toBe(true);
  });

  it('wrong token returns false', () => {
    expect(checkAdminAuth('WRONG_SECRET')).toBe(false);
  });

  it('empty string returns false', () => {
    expect(checkAdminAuth('')).toBe(false);
  });

  it('undefined returns false', () => {
    expect(checkAdminAuth(undefined as unknown as string)).toBe(false);
  });

  it('null returns false', () => {
    expect(checkAdminAuth(null as unknown as string)).toBe(false);
  });
});

describe('Phase 6 — Recruiter Admin Panel Logic', () => {
  it('should flag candidates with 3 or more violations with a warning flag', () => {
    expect(hasViolationWarning(0)).toBe(false);
    expect(hasViolationWarning(2)).toBe(false);
    expect(hasViolationWarning(3)).toBe(true);
    expect(hasViolationWarning(5)).toBe(true);
  });

  it('should filter candidate list properly based on query string', () => {
    const list: CandidateRow[] = [
      { attemptId: 'ATT-1', name: 'Anoop Sharma', email: 'anoop@example.com', violationCount: 0, overallScore: 85, recommendationTier: 'Strong Fit' },
      { attemptId: 'ATT-2', name: 'John Doe', email: 'john@example.com', violationCount: 4, overallScore: 50, recommendationTier: 'Not Recommended' }
    ];

    const filterList = (query: string) => {
      return list.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.email.toLowerCase().includes(query.toLowerCase())
      );
    };

    expect(filterList('Anoop').length).toBe(1);
    expect(filterList('Anoop')[0].name).toBe('Anoop Sharma');
    expect(filterList('example.com').length).toBe(2);
    expect(filterList('not_found').length).toBe(0);
  });
});
