import { effectiveVerdict, Verdict } from '../grading/rubric-grader';

export type AttemptsRow = [
  string, // AttemptID (0)
  string, // Name (1)
  string, // Email (2)
  any,    // StartTime (3)
  any,    // EndTime (4)
  string, // Status (5)
  string, // FrozenQuestionIDs (6)
  any,    // OverallScore (7)
  any,    // LanguageScore (8)
  any,    // ResearchScore (9)
  any,    // CriticalScore (10)
  any,    // ViolationCount (11)
  string, // RecommendationTier (12)
  string, // NarrativeInsight (13)
  any     // UngradedCount (14)
];

export type ResponsesRow = [
  string, // AttemptID (0)
  string, // QuestionID (1)
  string, // SubmittedAnswer (2)
  any,    // IsCorrect (3)
  any     // Timestamp (4)
];

export type GradingTranscriptsRow = [
  string, // AttemptID (0)
  string, // QuestionID (1)
  string, // RubricVersion (2)
  any,    // Verdict (3)
  string, // CriteriaMetJSON (4)
  string, // Rationale (5)
  any,    // OverrideVerdict (6)
  any,    // OverrideAt (7)
  string  // OverrideTokenHash (8)
];

export { effectiveVerdict };

export const MIN_QUESTION_SAMPLES = 5;
export const MIN_TREND_ATTEMPTS = 5;
export const MIN_TREND_DAYS = 3;
export const MIN_CORR_VIOLATIONS = 10;
export const MIN_CORR_TOTAL = 20;
export const MIN_BIAS_ATTEMPTS = 15;
export const MIN_DISCRIM_READY = 8;

const READY_STATUSES = ['submitted', 'graded', 'emailed'];

// Helper: Coerce overall score to a clean number
function getScore(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return isFinite(num) ? num : null;
}

export function buildScoreTrend(attempts: AttemptsRow[]) {
  const readyAttempts = attempts.filter(row => READY_STATUSES.includes(row[5]));
  const pointsMap: { [date: string]: { sum: number; count: number } } = {};

  readyAttempts.forEach(row => {
    const endTime = row[4];
    const score = getScore(row[7]);
    if (!endTime || score === null) return;

    let dateStr = '';
    if (endTime instanceof Date) {
      dateStr = endTime.toISOString().split('T')[0];
    } else {
      const d = new Date(endTime);
      if (!isNaN(d.getTime())) {
        dateStr = d.toISOString().split('T')[0];
      } else {
        const match = String(endTime).match(/^\d{4}-\d{2}-\d{2}/);
        if (match) dateStr = match[0];
      }
    }

    if (!dateStr) return;

    if (!pointsMap[dateStr]) {
      pointsMap[dateStr] = { sum: 0, count: 0 };
    }
    pointsMap[dateStr].sum += score;
    pointsMap[dateStr].count += 1;
  });

  const points = Object.keys(pointsMap).map(date => ({
    date,
    avgScore: Math.round(pointsMap[date].sum / pointsMap[date].count),
    n: pointsMap[date].count
  })).sort((a, b) => a.date.localeCompare(b.date));

  const distinctDays = points.length;
  const scoredAttempts = points.reduce((acc, p) => acc + p.n, 0);
  const enough_data = scoredAttempts >= MIN_TREND_ATTEMPTS && distinctDays >= MIN_TREND_DAYS;

  return {
    enough_data,
    threshold: MIN_TREND_ATTEMPTS,
    samples: scoredAttempts,
    thresholdNote: `Requires ≥${MIN_TREND_ATTEMPTS} attempts spanning ≥${MIN_TREND_DAYS} distinct calendar days.`,
    points
  };
}

export function buildQuestionStats(responses: ResponsesRow[], transcripts: GradingTranscriptsRow[]) {
  const transcriptMap: { [key: string]: GradingTranscriptsRow } = {};
  transcripts.forEach(row => {
    transcriptMap[`${row[0]}_${row[1]}`] = row;
  });

  const statsMap: { [qId: string]: { correct: number; incorrect: number; ungraded: number } } = {};
  let totalGraded = 0;

  responses.forEach(row => {
    const attemptId = row[0];
    const qId = row[1];
    const tRow = transcriptMap[`${attemptId}_${qId}`];

    // Build standard argument objects for effectiveVerdict
    const tArg = tRow ? { Verdict: tRow[3], OverrideVerdict: tRow[6] } : null;
    const rArg = { IsCorrect: row[3] };
    const verdict = effectiveVerdict(tArg, rArg);

    if (!statsMap[qId]) {
      statsMap[qId] = { correct: 0, incorrect: 0, ungraded: 0 };
    }

    if (verdict === 'correct') {
      statsMap[qId].correct += 1;
      totalGraded += 1;
    } else if (verdict === 'incorrect') {
      statsMap[qId].incorrect += 1;
      totalGraded += 1;
    } else {
      statsMap[qId].ungraded += 1;
    }
  });

  const rows = Object.keys(statsMap).map(qId => {
    const s = statsMap[qId];
    const sampleSize = s.correct + s.incorrect;
    const enough_data = sampleSize >= MIN_QUESTION_SAMPLES;
    const passRate = enough_data ? Math.round((s.correct / sampleSize) * 100) : null;
    return {
      qId,
      correct: s.correct,
      incorrect: s.incorrect,
      ungraded: s.ungraded,
      sampleSize,
      passRate,
      enough_data
    };
  });

  return {
    enough_data: totalGraded >= 5,
    threshold: MIN_QUESTION_SAMPLES,
    samples: totalGraded,
    rows
  };
}

export function buildViolationCorrelation(attempts: AttemptsRow[]) {
  const readyAttempts = attempts.filter(row => READY_STATUSES.includes(row[5]));
  const points: { v: number; s: number }[] = [];
  let violationsCount = 0;

  readyAttempts.forEach(row => {
    const score = getScore(row[7]);
    if (score === null) return;
    const v = Number(row[11]) || 0;
    points.push({ v, s: score });
    if (v > 0) violationsCount += 1;
  });

  const samples = points.length;
  const enough_data = violationsCount >= MIN_CORR_VIOLATIONS || samples >= MIN_CORR_TOTAL;

  let r: number | null = null;
  let interpretation = 'weak';

  if (enough_data && samples > 1) {
    const sumV = points.reduce((sum, p) => sum + p.v, 0);
    const sumS = points.reduce((sum, p) => sum + p.s, 0);
    const meanV = sumV / samples;
    const meanS = sumS / samples;

    let num = 0;
    let denV = 0;
    let denS = 0;

    points.forEach(p => {
      const diffV = p.v - meanV;
      const diffS = p.s - meanS;
      num += diffV * diffS;
      denV += diffV * diffV;
      denS += diffS * diffS;
    });

    const den = Math.sqrt(denV * denS);
    r = den === 0 ? 0 : Number((num / den).toFixed(3));
    
    const absR = Math.abs(r);
    if (absR >= 0.5) interpretation = 'strong';
    else if (absR >= 0.2) interpretation = 'moderate';
  }

  return {
    enough_data,
    threshold: MIN_CORR_VIOLATIONS,
    samples,
    violationsCount,
    thresholdNote: `Requires ≥${MIN_CORR_VIOLATIONS} attempts with violations OR ≥${MIN_CORR_TOTAL} total attempts.`,
    points,
    r,
    interpretation
  };
}

export function buildDiscriminationIndex(
  attempts: AttemptsRow[],
  responses: ResponsesRow[],
  transcripts: GradingTranscriptsRow[]
) {
  const readyAttempts = attempts
    .filter(row => READY_STATUSES.includes(row[5]))
    .map(row => ({ id: row[0], score: getScore(row[7]) }))
    .filter(a => a.score !== null) as { id: string; score: number }[];

  const readyCount = readyAttempts.length;
  const enough_data = readyCount >= MIN_DISCRIM_READY;

  if (!enough_data) {
    return {
      enough_data: false,
      threshold: MIN_DISCRIM_READY,
      samples: readyCount,
      rows: []
    };
  }

  // Sort by score ascending to identify quartiles
  const sorted = [...readyAttempts].sort((a, b) => a.score - b.score);
  const qSize = Math.max(1, Math.round(readyCount * 0.25));

  const bottomIds = new Set(sorted.slice(0, qSize).map(a => a.id));
  const topIds = new Set(sorted.slice(sorted.length - qSize).map(a => a.id));

  // Build maps for responses and transcripts
  const transcriptMap: { [key: string]: GradingTranscriptsRow } = {};
  transcripts.forEach(row => {
    transcriptMap[`${row[0]}_${row[1]}`] = row;
  });

  const questionGroupMap: {
    [qId: string]: {
      topCorrect: number;
      topTotal: number;
      bottomCorrect: number;
      bottomTotal: number;
    };
  } = {};

  responses.forEach(row => {
    const attemptId = row[0];
    const qId = row[1];
    const isTop = topIds.has(attemptId);
    const isBottom = bottomIds.has(attemptId);

    if (!isTop && !isBottom) return;

    const tRow = transcriptMap[`${attemptId}_${qId}`];
    const tArg = tRow ? { Verdict: tRow[3], OverrideVerdict: tRow[6] } : null;
    const rArg = { IsCorrect: row[3] };
    const verdict = effectiveVerdict(tArg, rArg);

    if (!questionGroupMap[qId]) {
      questionGroupMap[qId] = { topCorrect: 0, topTotal: 0, bottomCorrect: 0, bottomTotal: 0 };
    }

    if (verdict === 'correct') {
      if (isTop) {
        questionGroupMap[qId].topCorrect += 1;
        questionGroupMap[qId].topTotal += 1;
      } else {
        questionGroupMap[qId].bottomCorrect += 1;
        questionGroupMap[qId].bottomTotal += 1;
      }
    } else if (verdict === 'incorrect') {
      if (isTop) {
        questionGroupMap[qId].topTotal += 1;
      } else {
        questionGroupMap[qId].bottomTotal += 1;
      }
    }
  });

  const rows = Object.keys(questionGroupMap)
    .map(qId => {
      const g = questionGroupMap[qId];
      const sampleTop = g.topTotal;
      const sampleBottom = g.bottomTotal;
      
      const enoughTop = sampleTop >= MIN_QUESTION_SAMPLES;
      const enoughBottom = sampleBottom >= MIN_QUESTION_SAMPLES;
      
      const passTop = enoughTop ? Math.round((g.topCorrect / sampleTop) * 100) : 0;
      const passBottom = enoughBottom ? Math.round((g.bottomCorrect / sampleBottom) * 100) : 0;
      const delta = passTop - passBottom;

      return {
        qId,
        passTop,
        passBottom,
        delta,
        sampleTop,
        sampleBottom,
        enough_data: enoughTop && enoughBottom
      };
    })
    .filter(row => row.enough_data)
    .sort((a, b) => a.delta - b.delta); // ascending by delta: smallest delta first

  return {
    enough_data: rows.length > 0,
    threshold: MIN_DISCRIM_READY,
    samples: readyCount,
    rows
  };
}

export function buildBiasSignals(attempts: AttemptsRow[]) {
  const readyAttempts = attempts.filter(row => READY_STATUSES.includes(row[5]));
  const samples = readyAttempts.length;
  const enough_data = samples >= MIN_BIAS_ATTEMPTS;

  const getDist = (arr: AttemptsRow[], window: 'last20' | 'allTime') => {
    let strong = 0, consider = 0, recommend = 0;
    arr.forEach(row => {
      const tier = row[12];
      if (tier === 'Strong Fit') strong += 1;
      else if (tier === 'Consider') consider += 1;
      else recommend += 1;
    });
    const total = arr.length || 1;
    return [
      { tier: 'Strong Fit' as const, pct: Math.round((strong / total) * 100), n: strong, window },
      { tier: 'Consider' as const, pct: Math.round((consider / total) * 100), n: consider, window },
      { tier: 'Not Recommended' as const, pct: Math.round((recommend / total) * 100), n: recommend, window }
    ];
  };

  const allTime = getDist(readyAttempts, 'allTime');
  const last20Attempts = readyAttempts.slice(-20);
  const last20 = getDist(last20Attempts, 'last20');

  return {
    enough_data,
    threshold: MIN_BIAS_ATTEMPTS,
    samples,
    tierDistribution: [...last20, ...allTime]
  };
}
