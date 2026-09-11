/**
 * test_grading.ts
 *
 * Phase 3 Grading & Scoring Engine — Vitest test suite.
 * Covers all 5 GRADE success criteria.
 *
 * Run: npx vitest run tests/grading/test_grading.ts
 */

import { describe, it, expect } from 'vitest';
import {
  gradeAttempt,
  computeTier,
  containsAnswerKey,
  type GasQuestion,
  type AnswersMap,
} from './grading-engine';

// ─── Fixture Builders ─────────────────────────────────────────────────────────

function makeQ(
  id: string,
  bank: GasQuestion['bank'],
  section: string,
  correctLetter: string,
  difficulty: GasQuestion['difficulty_tier'] = 'straightforward',
  responseType: GasQuestion['response_type'] = 'mcq_single',
): GasQuestion {
  return {
    id,
    bank,
    section,
    difficulty_tier: difficulty,
    response_type: responseType,
    options: [
      { letter: 'A', text: 'Option A', is_correct: correctLetter === 'A' },
      { letter: 'B', text: 'Option B', is_correct: correctLetter === 'B' },
      { letter: 'C', text: 'Option C', is_correct: correctLetter === 'C' },
      { letter: 'D', text: 'Option D', is_correct: correctLetter === 'D' },
    ],
  };
}

function makeMultiQ(
  id: string,
  bank: GasQuestion['bank'],
  correctLetters: string[],
  difficulty: GasQuestion['difficulty_tier'] = 'straightforward',
): GasQuestion {
  return {
    id,
    bank,
    section: 'multi',
    difficulty_tier: difficulty,
    response_type: 'mcq_multi',
    options: ['A', 'B', 'C', 'D'].map((l) => ({
      letter: l,
      text: `Option ${l}`,
      is_correct: correctLetters.includes(l),
    })),
  };
}

/** Minimal fixture: 4 english, 4 attention, 4 critical (12 total) */
function makeFixture12(): GasQuestion[] {
  return [
    makeQ('e1', 'english',   'grammar',   'A'),
    makeQ('e2', 'english',   'grammar',   'B'),
    makeQ('e3', 'english',   'sentence',  'C'),
    makeQ('e4', 'english',   'closure',   'D'),
    makeQ('a1', 'attention', 'l1',        'A', 'moderate'),
    makeQ('a2', 'attention', 'l1',        'B', 'moderate'),
    makeQ('a3', 'attention', 'l2',        'C', 'complex'),
    makeQ('a4', 'attention', 'l2',        'D', 'complex'),
    makeQ('c1', 'critical',  'ct',        'A', 'moderate'),
    makeQ('c2', 'critical',  'ct',        'B', 'complex'),
    makeQ('c3', 'critical',  'ct',        'C', 'complex'),
    makeQ('c4', 'critical',  'ct',        'D', 'complex'),
  ];
}

// ─── GRADE-01: Determinism ────────────────────────────────────────────────────

describe('GRADE-01 — Determinism', () => {
  it('identical answers produce identical scores on repeated calls', () => {
    const questions = makeFixture12();
    const answers: AnswersMap = {
      e1: 'A', e2: 'B', e3: 'C', e4: 'D',
      a1: 'A', a2: 'B', a3: 'C', a4: 'D',
      c1: 'A', c2: 'B', c3: 'C', c4: 'D',
    };

    const r1 = gradeAttempt(questions, answers);
    const r2 = gradeAttempt(questions, answers);
    const r3 = gradeAttempt(questions, answers);

    expect(r1.overallScore).toBe(r2.overallScore);
    expect(r2.overallScore).toBe(r3.overallScore);
    expect(r1.traitScores).toEqual(r2.traitScores);
    expect(r2.traitScores).toEqual(r3.traitScores);
    expect(r1.recommendationTier).toBe(r2.recommendationTier);
    expect(r1.narrativeInsight).toBe(r2.narrativeInsight);
  });

  it('all-wrong answers produce 0% overall', () => {
    const questions = makeFixture12();
    const answers: AnswersMap = { e1: 'B', e2: 'C', e3: 'D', e4: 'A', a1: 'B', a2: 'C', a3: 'D', a4: 'A', c1: 'B', c2: 'C', c3: 'D', c4: 'A' };
    const result = gradeAttempt(questions, answers);
    expect(result.overallScore).toBe(0);
  });

  it('all-correct answers produce 100% overall', () => {
    const questions = makeFixture12();
    const answers: AnswersMap = { e1: 'A', e2: 'B', e3: 'C', e4: 'D', a1: 'A', a2: 'B', a3: 'C', a4: 'D', c1: 'A', c2: 'B', c3: 'C', c4: 'D' };
    const result = gradeAttempt(questions, answers);
    expect(result.overallScore).toBe(100);
    expect(result.traitScores.language).toBe(100);
    expect(result.traitScores.research).toBe(100);
    expect(result.traitScores.critical).toBe(100);
  });

  it('empty answers map produces 0% (unanswered = wrong for MCQ)', () => {
    const questions = makeFixture12();
    const result = gradeAttempt(questions, {});
    expect(result.overallScore).toBe(0);
  });
});

// ─── GRADE-02: Trait Score Rollup ────────────────────────────────────────────

describe('GRADE-02 — Trait Score Rollup', () => {
  it('rolls up english correct answers into language trait only', () => {
    const questions = makeFixture12();
    const answers: AnswersMap = { e1: 'A', e2: 'B', e3: 'C', e4: 'D', a1: 'Z', a2: 'Z', a3: 'Z', a4: 'Z', c1: 'Z', c2: 'Z', c3: 'Z', c4: 'Z' };
    const r = gradeAttempt(questions, answers);
    expect(r.traitScores.language).toBe(100);
    expect(r.traitScores.research).toBe(0);
    expect(r.traitScores.critical).toBe(0);
    expect(r.overallScore).toBe(33); // 4/12
  });

  it('rolls up attention correct answers into research trait only', () => {
    const questions = makeFixture12();
    const answers: AnswersMap = { e1: 'Z', e2: 'Z', e3: 'Z', e4: 'Z', a1: 'A', a2: 'B', a3: 'C', a4: 'D', c1: 'Z', c2: 'Z', c3: 'Z', c4: 'Z' };
    const r = gradeAttempt(questions, answers);
    expect(r.traitScores.language).toBe(0);
    expect(r.traitScores.research).toBe(100);
    expect(r.traitScores.critical).toBe(0);
  });

  it('rolls up critical correct answers into critical trait only', () => {
    const questions = makeFixture12();
    const answers: AnswersMap = { e1: 'Z', e2: 'Z', e3: 'Z', e4: 'Z', a1: 'Z', a2: 'Z', a3: 'Z', a4: 'Z', c1: 'A', c2: 'B', c3: 'C', c4: 'D' };
    const r = gradeAttempt(questions, answers);
    expect(r.traitScores.language).toBe(0);
    expect(r.traitScores.research).toBe(0);
    expect(r.traitScores.critical).toBe(100);
  });

  it('calculates exact percentages for partial correctness', () => {
    const questions = makeFixture12();
    const answers: AnswersMap = { e1: 'A', e2: 'B', e3: 'Z', e4: 'Z', a1: 'A', a2: 'Z', a3: 'Z', a4: 'Z', c1: 'A', c2: 'B', c3: 'Z', c4: 'Z' };
    const r = gradeAttempt(questions, answers);
    expect(r.traitScores.language).toBe(50);
    expect(r.traitScores.research).toBe(25);
    expect(r.traitScores.critical).toBe(50);
  });

  it('mcq_multi graded as correct only when all letters match exactly', () => {
    const q = makeMultiQ('m1', 'english', ['A', 'C'], 'moderate');
    expect(gradeAttempt([q], { m1: ['A', 'C'] }).traitScores.language).toBe(100);
    expect(gradeAttempt([q], { m1: ['A'] }).traitScores.language).toBe(0);
    expect(gradeAttempt([q], { m1: ['A', 'B', 'C'] }).traitScores.language).toBe(0);
    expect(gradeAttempt([q], { m1: ['C', 'A'] }).traitScores.language).toBe(100);
  });

  it('case-insensitive letter matching for mcq_single', () => {
    const q = makeQ('ci1', 'english', 'grammar', 'A');
    expect(gradeAttempt([q], { ci1: 'a' }).traitScores.language).toBe(100);
    expect(gradeAttempt([q], { ci1: 'A' }).traitScores.language).toBe(100);
  });

  it('open_text defaults to ungraded when no LLM results provided', () => {
    const q: GasQuestion = { id: 'ot1', bank: 'english', section: 'open', response_type: 'open_text', options: [], difficulty_tier: 'straightforward' };
    const r1 = gradeAttempt([q], { ot1: 'any text here' });
    expect(r1.perQuestion[0].isCorrect).toBe(false);
    expect(r1.traitScores.language).toBe(0);
    expect(r1.overallScore).toBe(0);
  });

  it('open_text graded as correct when LLM says correct', () => {
    const q: GasQuestion = { id: 'ot1', bank: 'english', section: 'open', response_type: 'open_text', options: [], difficulty_tier: 'straightforward' };
    const r = gradeAttempt([q], { ot1: 'any text here' }, { ot1: 'correct' });
    expect(r.perQuestion[0].isCorrect).toBe(true);
    expect(r.traitScores.language).toBe(100);
  });
});

// ─── GRADE-03: Narrative Routing ─────────────────────────────────────────────

describe('GRADE-03 — Narrative from complex-tagged items only', () => {
  it('no complex-tagged items → uses overall score proxy, NOT level/section heuristic', () => {
    const questions = [
      makeQ('e1', 'english',  'grammar', 'A', 'straightforward'),
      makeQ('c1', 'critical', 'ct',      'B', 'moderate'),
    ];
    const r = gradeAttempt(questions, { e1: 'A', c1: 'B' });
    expect(r.narrativeInsight).toContain('Outstanding');
    expect(r.narrativeInsight).not.toContain('investigative intuition');
  });

  it('all complex items correct → "Exceptional investigative intuition"', () => {
    const questions = [
      makeQ('c1', 'critical', 'ct', 'A', 'complex'),
      makeQ('c2', 'critical', 'ct', 'B', 'complex'),
      makeQ('a1', 'attention', 'l2', 'C', 'complex'),
    ];
    const r = gradeAttempt(questions, { c1: 'A', c2: 'B', a1: 'C' });
    expect(r.narrativeInsight).toContain('Exceptional investigative intuition');
  });

  it('<25% of complex items failed → "Strong analytical reasoning"', () => {
    const questions = Array.from({ length: 8 }, (_, i) =>
      makeQ(`cx${i}`, 'critical', 'ct', 'A', 'complex')
    );
    const answers: AnswersMap = { cx0: 'B' };
    for (let i = 1; i < 8; i++) answers[`cx${i}`] = 'A';
    const r = gradeAttempt(questions, answers);
    expect(r.narrativeInsight).toContain('Strong analytical reasoning');
  });

  it('≥60% of complex items failed → "Struggled" narrative', () => {
    const questions = Array.from({ length: 5 }, (_, i) =>
      makeQ(`cx${i}`, 'critical', 'ct', 'A', 'complex')
    );
    const answers: AnswersMap = { cx0: 'B', cx1: 'B', cx2: 'B', cx3: 'A', cx4: 'A' };
    const r = gradeAttempt(questions, answers);
    expect(r.narrativeInsight).toContain('Struggled');
  });

  it('25–59% complex failed, high english & low critical → language-coaching narrative', () => {
    const questions = [
      makeQ('e1', 'english', 'g', 'A', 'straightforward'),
      makeQ('e2', 'english', 'g', 'A', 'straightforward'),
      makeQ('e3', 'english', 'g', 'A', 'straightforward'),
      makeQ('e4', 'english', 'g', 'A', 'straightforward'),
      makeQ('e5', 'english', 'g', 'A', 'straightforward'),
      makeQ('cx1', 'critical', 'ct', 'A', 'complex'),
      makeQ('cx2', 'critical', 'ct', 'A', 'complex'),
      makeQ('cx3', 'critical', 'ct', 'A', 'complex'),
      makeQ('cx4', 'critical', 'ct', 'A', 'complex'),
    ];
    const answers: AnswersMap = {
      e1: 'A', e2: 'A', e3: 'A', e4: 'A', e5: 'A',
      cx1: 'A', cx2: 'A', cx3: 'B', cx4: 'B',
    };
    const r = gradeAttempt(questions, answers);
    expect(r.narrativeInsight).toContain('language precision');
  });

  it('narrative does NOT use q.level or q.section as a proxy for difficulty', () => {
    const q: GasQuestion = {
      id: 'lv2', bank: 'attention', section: 'l2', level: 'L2',
      difficulty_tier: 'straightforward',
      response_type: 'mcq_single',
      options: [{ letter: 'A', text: 'A', is_correct: true }, { letter: 'B', text: 'B', is_correct: false }],
    };
    const r = gradeAttempt([q], { lv2: 'B' });
    expect(r.narrativeInsight).toContain('developing competency');
    expect(r.narrativeInsight).not.toContain('investigative intuition');
    expect(r.narrativeInsight).not.toContain('Strong analytical');
  });
});

// ─── GRADE-04: Recommendation Tier Boundaries ────────────────────────────────

describe('GRADE-04 — Recommendation Tier Boundaries', () => {
  it('overall ≥80, critical ≥75, research ≥75 → Strong Fit', () => {
    expect(computeTier(80, 75, 75)).toBe('Strong Fit');
    expect(computeTier(100, 100, 100)).toBe('Strong Fit');
    expect(computeTier(80, 80, 80)).toBe('Strong Fit');
  });

  it('overall ≥60 but fails strong-fit conditions → Consider', () => {
    expect(computeTier(60, 74, 80)).toBe('Consider');
    expect(computeTier(70, 80, 74)).toBe('Consider');
    expect(computeTier(79, 80, 80)).toBe('Consider');
    expect(computeTier(60, 0,  0)).toBe('Consider');
  });

  it('overall <60 → Not Recommended', () => {
    expect(computeTier(59, 100, 100)).toBe('Not Recommended');
    expect(computeTier(0,  0,   0)).toBe('Not Recommended');
    expect(computeTier(40, 90, 90)).toBe('Not Recommended');
  });

  it('Strong Fit requires ALL three conditions simultaneously', () => {
    expect(computeTier(80, 74, 75)).toBe('Consider');
    expect(computeTier(80, 75, 74)).toBe('Consider');
    expect(computeTier(79, 75, 75)).toBe('Consider');
  });

  it('gradeAttempt produces matching recommendation tier', () => {
    const qs = makeFixture12();
    const allCorrect: AnswersMap = { e1:'A', e2:'B', e3:'C', e4:'D', a1:'A', a2:'B', a3:'C', a4:'D', c1:'A', c2:'B', c3:'C', c4:'D' };
    expect(gradeAttempt(qs, allCorrect).recommendationTier).toBe('Strong Fit');

    const allWrong: AnswersMap = { e1:'B', e2:'C', e3:'D', e4:'A', a1:'B', a2:'C', a3:'D', a4:'A', c1:'B', c2:'C', c3:'D', c4:'A' };
    expect(gradeAttempt(qs, allWrong).recommendationTier).toBe('Not Recommended');
  });
});

// ─── GRADE-05: Zero Answer-Key Leakage ───────────────────────────────────────

describe('GRADE-05 — Zero Answer-Key Leakage', () => {
  it('containsAnswerKey returns false for clean report shape', () => {
    const cleanReport = {
      attemptId: 'ATT-001',
      name: 'Jane Doe',
      email: 'jane@example.com',
      overallScore: 75,
      traitScores: { language: 80, research: 70, critical: 75 },
      recommendationTier: 'Consider',
      narrativeInsight: 'Some insight.',
      violationCount: 0,
    };
    expect(containsAnswerKey(cleanReport)).toBe(false);
  });

  it('containsAnswerKey detects is_correct at top level', () => {
    expect(containsAnswerKey({ is_correct: true })).toBe(true);
  });

  it('containsAnswerKey detects is_correct nested in options array', () => {
    const leakyReport = {
      report: {
        options: [{ letter: 'A', is_correct: true }],
      },
    };
    expect(containsAnswerKey(leakyReport)).toBe(true);
  });

  it('containsAnswerKey detects answer_key field', () => {
    expect(containsAnswerKey({ question: { answer_key: 'A' } })).toBe(true);
  });

  it('containsAnswerKey detects correct_answer field', () => {
    expect(containsAnswerKey({ correct_answer: 'B' })).toBe(true);
  });

  it('gradeAttempt result itself contains no answer-key fields', () => {
    const qs = makeFixture12();
    const answers: AnswersMap = { e1:'A', e2:'B', e3:'C', e4:'D', a1:'A', a2:'B', a3:'C', a4:'D', c1:'A', c2:'B', c3:'C', c4:'D' };
    const result = gradeAttempt(qs, answers);
    const clientFacingReport = {
      attemptId: 'ATT-TEST',
      name: 'Test',
      email: 'test@example.com',
      overallScore: result.overallScore,
      traitScores: result.traitScores,
      recommendationTier: result.recommendationTier,
      narrativeInsight: result.narrativeInsight,
      violationCount: 0,
    };
    expect(containsAnswerKey(clientFacingReport)).toBe(false);
  });

  it('questions sent to client must not contain is_correct in options', () => {
    const serverQ = makeQ('e1', 'english', 'grammar', 'A');
    const clientQ = {
      id: serverQ.id,
      bank: serverQ.bank,
      section: serverQ.section,
      stem: 'Some question stem?',
      options: serverQ.options.map((o) => ({ letter: o.letter, text: o.text })),
      response_type: serverQ.response_type,
    };
    expect(containsAnswerKey(clientQ)).toBe(false);
    expect(serverQ.options.some((o) => 'is_correct' in o)).toBe(true);
  });
});

// ─── DIVERGENCE — LLM-scored paths (F-03) ──────────────────────────────────

function makeOpenTextQ(id: string, bank: GasQuestion['bank'] = 'english', difficulty: GasQuestion['difficulty_tier'] = 'straightforward'): GasQuestion {
  return {
    id,
    bank,
    section: 'open',
    response_type: 'open_text',
    options: [],
    difficulty_tier: difficulty,
  };
}

function makeHybridQ(id: string, bank: GasQuestion['bank'], correctLetter: string, difficulty: GasQuestion['difficulty_tier'] = 'moderate'): GasQuestion {
  return {
    id,
    bank,
    section: 'hybrid',
    response_type: 'hybrid',
    difficulty_tier: difficulty,
    options: [
      { letter: 'A', text: 'Option A', is_correct: correctLetter === 'A' },
      { letter: 'B', text: 'Option B', is_correct: correctLetter === 'B' },
      { letter: 'C', text: 'Option C', is_correct: correctLetter === 'C' },
      { letter: 'D', text: 'Option D', is_correct: correctLetter === 'D' },
    ],
  };
}

describe('DIVERGENCE — LLM-scored paths (F-03)', () => {
  it('open_text with llmResults={ot1: "correct"} → counted correct', () => {
    const q = makeOpenTextQ('ot1');
    const r = gradeAttempt([q], { ot1: 'any text' }, { ot1: 'correct' });
    expect(r.perQuestion[0].isCorrect).toBe(true);
    expect(r.traitScores.language).toBe(100);
  });

  it('open_text with llmResults={ot1: "incorrect"} → counted incorrect', () => {
    const q = makeOpenTextQ('ot1');
    const r = gradeAttempt([q], { ot1: 'bad text' }, { ot1: 'incorrect' });
    expect(r.perQuestion[0].isCorrect).toBe(false);
    expect(r.traitScores.language).toBe(0);
  });

  it('open_text with no llmResults → defaults to ungraded (excluded from denominator)', () => {
    const q = makeOpenTextQ('ot1');
    const r = gradeAttempt([q], { ot1: 'any text' });
    expect(r.perQuestion[0].isCorrect).toBe(false);
    expect(r.traitScores.language).toBe(0);
    expect(r.overallScore).toBe(0);
    expect(r.ungradedCount).toBe(1);
  });

  it('hybrid with MCQ correct + llmResults={h1: "correct"} → correct', () => {
    const q = makeHybridQ('h1', 'english', 'A');
    const r = gradeAttempt([q], { h1: { selected: 'A', text: 'good' } }, { h1: 'correct' });
    expect(r.perQuestion[0].isCorrect).toBe(true);
  });

  it('hybrid with MCQ correct + llmResults={h1: "incorrect"} → incorrect (text fails)', () => {
    const q = makeHybridQ('h1', 'english', 'A');
    const r = gradeAttempt([q], { h1: { selected: 'A', text: 'bad' } }, { h1: 'incorrect' });
    expect(r.perQuestion[0].isCorrect).toBe(false);
  });

  it('hybrid with MCQ wrong + llmResults={h1: "correct"} → incorrect (MCQ fails)', () => {
    const q = makeHybridQ('h1', 'english', 'A');
    const r = gradeAttempt([q], { h1: { selected: 'B', text: 'good' } }, { h1: 'correct' });
    expect(r.perQuestion[0].isCorrect).toBe(false);
  });

  it('LLM scores integrate into overallScore correctly (weighted by question count)', () => {
    const q1 = makeOpenTextQ('ot1', 'english');
    const q2 = makeQ('mcq1', 'english', 'grammar', 'A');
    const r = gradeAttempt([q1, q2], { mcq1: 'A' }, { ot1: 'correct' });
    expect(r.overallScore).toBe(100);
    const r2 = gradeAttempt([q1, q2], { mcq1: 'A' }, { ot1: 'incorrect' });
    expect(r2.overallScore).toBe(50);
  });

  it('LLM scores affect trait scores for correct bank', () => {
    const q1 = makeOpenTextQ('ot1', 'english');
    const q2 = makeOpenTextQ('ot2', 'english');
    const r = gradeAttempt([q1, q2], {}, { ot1: 'correct', ot2: 'correct' });
    expect(r.traitScores.language).toBe(100);
    const r2 = gradeAttempt([q1, q2], {}, { ot1: 'correct', ot2: 'incorrect' });
    expect(r2.traitScores.language).toBe(50);
  });

  it('divergence guard — if Code.gs scoring weight changes, fixture catches it', () => {
    const questions = [
      makeQ('e1', 'english', 'grammar', 'A'),
      makeQ('e2', 'english', 'grammar', 'B'),
      makeQ('a1', 'attention', 'l1', 'A'),
      makeQ('c1', 'critical', 'ct', 'A'),
    ];
    const answers: AnswersMap = { e1: 'A', e2: 'B', a1: 'A', c1: 'Z' };
    const r = gradeAttempt(questions, answers);
    expect(r.overallScore).toBe(67); // (100 + 100 + 0) / 3 = 67
    expect(r.traitScores.language).toBe(100);
    expect(r.traitScores.research).toBe(100);
    expect(r.traitScores.critical).toBe(0);
  });

  it('ungradedCount tracked correctly for open_text questions', () => {
    const q1 = makeOpenTextQ('ot1', 'english');
    const q2 = makeQ('mcq1', 'english', 'grammar', 'A');
    const r = gradeAttempt([q1, q2], { mcq1: 'A' });
    expect(r.ungradedCount).toBe(1);
    expect(r.overallScore).toBe(100);
  });

  it('all-ungraded returns 0 overall (no NaN)', () => {
    const q1 = makeOpenTextQ('ot1', 'english');
    const q2 = makeOpenTextQ('ot2', 'english');
    const r = gradeAttempt([q1, q2], {});
    expect(r.overallScore).toBe(0);
    expect(r.ungradedCount).toBe(2);
  });
});
