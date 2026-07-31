/**
 * test_email.ts
 *
 * Phase 9 Async Email Content -- Vitest test suite for tests/async/email-content.ts.
 * Covers candidate/recruiter email content rules and recruiter recipient
 * parsing (ASYNC-03/04, must_haves truths #2 and #3).
 *
 * Run: npx vitest run tests/async/test_email.ts
 */

import { describe, it, expect } from 'vitest';
import {
  buildCandidateEmailContent,
  buildRecruiterEmailContent,
  parseRecruiterEmails,
  type EmailReport,
} from './email-content';

function makeReport(overrides: Partial<EmailReport> = {}): EmailReport {
  return {
    name: 'Jane Doe',
    email: 'jane@example.com',
    overallScore: 82,
    traitScores: { language: 90, research: 78, critical: 76 },
    recommendationTier: 'Strong Fit',
    narrativeInsight: 'Exceptional investigative intuition on complex scenarios.',
    violationCount: 2,
    ...overrides,
  };
}

// ─── Candidate email content (D-01/D-03/D-04) ────────────────────────────────

describe('buildCandidateEmailContent', () => {
  it('includes overall score, all 3 trait scores, narrative insight, and recommendation tier', () => {
    const report = makeReport();
    const content = buildCandidateEmailContent(report);

    expect(content).toContain(String(report.overallScore));
    expect(content).toContain(String(report.traitScores.language));
    expect(content).toContain(String(report.traitScores.research));
    expect(content).toContain(String(report.traitScores.critical));
    expect(content).toContain(report.narrativeInsight);
    expect(content).toContain(report.recommendationTier);
  });

  it('never includes violation-count or integrity-related substrings (D-04)', () => {
    const report = makeReport();
    const content = buildCandidateEmailContent(report).toLowerCase();

    expect(content).not.toContain('violation');
    expect(content).not.toContain('integrity');
  });
});

// ─── Recruiter email content (D-02) ───────────────────────────────────────────

describe('buildRecruiterEmailContent', () => {
  it('includes everything the candidate version contains', () => {
    const report = makeReport();
    const candidateContent = buildCandidateEmailContent(report);
    const recruiterContent = buildRecruiterEmailContent(report, { violationCount: report.violationCount });

    expect(recruiterContent).toContain(String(report.overallScore));
    expect(recruiterContent).toContain(String(report.traitScores.language));
    expect(recruiterContent).toContain(String(report.traitScores.research));
    expect(recruiterContent).toContain(String(report.traitScores.critical));
    expect(recruiterContent).toContain(report.narrativeInsight);
    expect(recruiterContent).toContain(report.recommendationTier);
    // The recruiter body is a strict superset of the candidate body's fields
    expect(candidateContent.length).toBeLessThan(recruiterContent.length);
  });

  it('includes a violation/integrity summary section with the tier visibly highlighted', () => {
    const report = makeReport();
    const content = buildRecruiterEmailContent(report, { violationCount: 3 });
    const lowered = content.toLowerCase();

    expect(lowered).toContain('violation');
    expect(lowered).toContain('integrity');
    expect(content).toContain('3 violation(s) logged.');
    // Tier highlighted -- appears wrapped in a visibly distinct marker
    expect(content).toContain(`>>> Recommendation Tier: ${report.recommendationTier} <<<`);
  });

  it('falls back to report.violationCount when integritySummary is omitted', () => {
    const report = makeReport({ violationCount: 5 });
    const content = buildRecruiterEmailContent(report);
    expect(content).toContain('5 violation(s) logged.');
  });
});

// ─── parseRecruiterEmails (D-06/D-07) ─────────────────────────────────────────

describe('parseRecruiterEmails', () => {
  it('parses comma-separated emails', () => {
    expect(parseRecruiterEmails('a@x.com, b@y.com')).toEqual(['a@x.com', 'b@y.com']);
  });

  it('returns an empty array for empty input', () => {
    expect(parseRecruiterEmails('')).toEqual([]);
  });

  it('tolerates whitespace-heavy input with empty segments', () => {
    expect(parseRecruiterEmails('  ,  ,c@z.com  ,  ')).toEqual(['c@z.com']);
  });

  it('returns an empty array for whitespace-only/comma-only input', () => {
    expect(parseRecruiterEmails('  ,  ,  ')).toEqual([]);
  });
});
