/**
 * email-content.ts
 *
 * Pure TypeScript extraction of the Phase 9 candidate/recruiter email
 * content-builder logic from backend/AsyncGrading.gs. This module has NO
 * MailApp or PropertiesService dependencies -- parseRecruiterEmails and the
 * two content builders accept plain string/object parameters instead of
 * reading Script Properties or sending mail directly, so it can be imported
 * and tested under Vitest (Node.js).
 *
 * Any change to the email content rules in AsyncGrading.gs MUST be mirrored here.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmailReport {
  name: string;
  email: string;
  overallScore: number;
  traitScores: {
    language: number;
    research: number;
    critical: number;
  };
  recommendationTier: string;
  narrativeInsight: string;
  violationCount: number;
}

export interface IntegritySummary {
  violationCount: number;
}

// ─── Report Content Builder (mirrors buildReportHtml) ────────────────────────

/**
 * buildReportContent -- mirrors buildReportHtml(report, options). Builds the
 * shared score/trait/tier/narrative body common to both the candidate and
 * recruiter emails; only appends the violation line when includeViolations
 * is true (D-04: candidate email never includes violation data).
 */
function buildReportContent(report: EmailReport, includeViolations: boolean): string {
  let content = ''
    + 'Fraud Support Assessment Report\n'
    + `Candidate: ${report.name} (${report.email})\n`
    + `Overall Score: ${report.overallScore}%\n`
    + `Language Ability: ${report.traitScores.language}%\n`
    + `Attention to Detail / Research: ${report.traitScores.research}%\n`
    + `Critical Thinking: ${report.traitScores.critical}%\n`
    + `Recommendation Tier: ${report.recommendationTier}\n`
    + `Narrative Insight: ${report.narrativeInsight}\n`;

  if (includeViolations) {
    content += `Integrity Signal: ${report.violationCount} violation(s) logged during the attempt.\n`;
  }

  return content;
}

// ─── Candidate Email (mirrors buildCandidateEmail) ────────────────────────────

/**
 * buildCandidateEmailContent -- D-01/D-03/D-04: full report (overall score,
 * all 3 trait scores, narrative insight, recommendation tier), never any
 * violation/integrity data.
 */
export function buildCandidateEmailContent(report: EmailReport): string {
  return buildReportContent(report, false);
}

// ─── Recruiter Email (mirrors buildRecruiterEmail) ────────────────────────────

/**
 * buildRecruiterEmailContent -- D-02: same report as the candidate version,
 * plus a violation/integrity summary section with the recommendation tier
 * visibly highlighted.
 */
export function buildRecruiterEmailContent(report: EmailReport, integritySummary?: IntegritySummary): string {
  const violationCount = integritySummary && typeof integritySummary.violationCount === 'number'
    ? integritySummary.violationCount
    : report.violationCount;

  const base = buildReportContent(report, true);

  const summary = ''
    + '--- INTEGRITY / VIOLATION SUMMARY ---\n'
    + `>>> Recommendation Tier: ${report.recommendationTier} <<<\n`
    + `Integrity/Violation Summary: ${violationCount} violation(s) logged.\n`;

  return base + summary;
}

// ─── Recruiter Recipient Parsing (mirrors parseRecruiterEmails) ─────────────

/**
 * parseRecruiterEmails -- D-06/D-07: comma-separated RECRUITER_EMAILS raw
 * string, whitespace-trimmed, empty-segment tolerant. Empty/falsy input
 * returns an empty array (fails safe, never blocks the candidate path).
 */
export function parseRecruiterEmails(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
