/**
 * grading-engine.ts
 *
 * Pure TypeScript extraction of the Phase 3 grading logic from backend/Code.gs.
 * This module has NO SpreadsheetApp dependencies — it operates solely on plain
 * data structures so it can be imported and tested under Vitest (Node.js).
 *
 * Any change to the scoring rules in Code.gs MUST be mirrored here.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GasQuestion {
  id: string;
  bank: 'english' | 'attention' | 'critical';
  section: string;
  level?: string | null;
  difficulty_tier?: 'straightforward' | 'moderate' | 'complex' | null;
  response_type: 'mcq_single' | 'mcq_multi' | 'open_text' | 'hybrid';
  options: Array<{ letter: string; text: string; is_correct: boolean }>;
}

export interface HybridAnswer {
  selected: string;
  text: string;
}

export type AnswerValue = string | string[] | HybridAnswer;
export type AnswersMap = Record<string, AnswerValue>;

export interface GradeResult {
  overallScore: number;
  traitScores: { language: number; research: number; critical: number };
  recommendationTier: 'Strong Fit' | 'Consider' | 'Not Recommended';
  narrativeInsight: string;
  perQuestion: Array<{ id: string; isCorrect: boolean; category: string; difficulty_tier: string | null }>;
  ungradedCount: number;
}

// ─── Core Grading Function ───────────────────────────────────────────────────

/**
 * gradeAttempt — deterministic, pure function.
 * Mirrors handleSubmitAnswers scoring logic in Code.gs exactly.
 * Accepts the frozen question objects (with is_correct) and the candidate
 * answers map, and returns the full graded result without any I/O.
 */
export function gradeAttempt(frozenQuestions: GasQuestion[], candidateAnswers: AnswersMap, llmResults?: Record<string, 'correct' | 'incorrect' | 'ungraded'>): GradeResult {
  let correctCount = 0;
  const bankCorrect  = { english: 0, attention: 0, critical: 0 };
  const bankTotal    = { english: 0, attention: 0, critical: 0 };
  const complexCorrect = { english: 0, attention: 0, critical: 0 };
  const complexTotal   = { english: 0, attention: 0, critical: 0 };
  let ungradedCount = 0;

  const perQuestion: GradeResult['perQuestion'] = [];

  for (const q of frozenQuestions) {
    const candidateAnswer = candidateAnswers[q.id];
    let isCorrect = false;
    let verdict: 'correct' | 'incorrect' | 'ungraded' = 'ungraded';

    const category = q.bank === 'attention' ? 'attention' : q.bank === 'critical' ? 'critical' : 'english';

    // GRADE-01: Deterministic grading — pure function, no random/LLM step
    if (q.response_type === 'mcq_single') {
      const correctOption = q.options.find((o) => o.is_correct);
      const correctLetter = correctOption?.letter ?? '';
      isCorrect = !!(candidateAnswer && candidateAnswer.toString().toLowerCase() === correctLetter.toLowerCase());
      verdict = isCorrect ? 'correct' : 'incorrect';
    } else if (q.response_type === 'mcq_multi') {
      const correctLetters = q.options.filter((o) => o.is_correct).map((o) => o.letter.toLowerCase()).sort();
      const submittedLetters = Array.isArray(candidateAnswer)
        ? candidateAnswer.map((a) => a.toString().toLowerCase()).sort()
        : [];
      isCorrect = JSON.stringify(correctLetters) === JSON.stringify(submittedLetters);
      verdict = isCorrect ? 'correct' : 'incorrect';
    } else if (q.response_type === 'hybrid') {
      const correctOption = q.options.find((o) => o.is_correct);
      const correctLetter = correctOption?.letter ?? '';
      let selectedLetter = '';
      if (candidateAnswer && typeof candidateAnswer === 'object' && !Array.isArray(candidateAnswer) && 'selected' in candidateAnswer) {
        selectedLetter = candidateAnswer.selected.toString().toLowerCase();
      } else if (candidateAnswer && typeof candidateAnswer === 'string') {
        selectedLetter = candidateAnswer.toLowerCase();
      }
      const mcqCorrect = !!(selectedLetter && selectedLetter === correctLetter.toLowerCase());
      const llmVerdict = llmResults?.[q.id] ?? 'ungraded';
      if (llmVerdict === 'ungraded') {
        verdict = 'ungraded';
      } else {
        const textCorrect = llmVerdict === 'correct';
        verdict = (mcqCorrect && textCorrect) ? 'correct' : 'incorrect';
      }
      isCorrect = verdict === 'correct';
    } else {
      // open_text: default ungraded matches AsyncGrading.gs evaluateWithRubric on failure
      verdict = llmResults?.[q.id] ?? 'ungraded';
      isCorrect = verdict === 'correct';
    }

    // A2 denominator policy: ungraded excluded from bankTotal/bankCorrect/complex tallies
    if (verdict !== 'ungraded') {
      bankTotal[category]++;
      if (isCorrect) {
        correctCount++;
        bankCorrect[category]++;
      }
      if (q.difficulty_tier === 'complex') {
        complexTotal[category]++;
        if (isCorrect) complexCorrect[category]++;
      }
    } else {
      ungradedCount++;
    }

    perQuestion.push({ id: q.id, isCorrect, category, difficulty_tier: q.difficulty_tier ?? null });
  }

  // GRADE-02: Trait score percentages (A2: denominator excludes ungraded)
  const totalGraded = bankTotal.english + bankTotal.attention + bankTotal.critical;
  const overallScore = totalGraded ? Math.round((correctCount / totalGraded) * 100) : 0;
  const language = bankTotal.english   ? Math.round((bankCorrect.english   / bankTotal.english)   * 100) : 0;
  const research = bankTotal.attention ? Math.round((bankCorrect.attention / bankTotal.attention) * 100) : 0;
  const critical = bankTotal.critical  ? Math.round((bankCorrect.critical  / bankTotal.critical)  * 100) : 0;

  // GRADE-04: Recommendation tier
  let recommendationTier: GradeResult['recommendationTier'] = 'Not Recommended';
  if (overallScore >= 80 && critical >= 75 && research >= 75) {
    recommendationTier = 'Strong Fit';
  } else if (overallScore >= 60) {
    recommendationTier = 'Consider';
  }

  // GRADE-03: Narrative from difficulty_tier === 'complex' items
  const globalComplexTotal   = complexTotal.english   + complexTotal.attention   + complexTotal.critical;
  const globalComplexCorrect = complexCorrect.english + complexCorrect.attention + complexCorrect.critical;
  const globalComplexFailed  = globalComplexTotal - globalComplexCorrect;

  let narrativeInsight: string;
  if (globalComplexTotal === 0) {
    if (overallScore >= 85) {
      narrativeInsight = 'Outstanding consistency across all question types. Completed every section with high accuracy and methodical reasoning.';
    } else if (overallScore >= 65) {
      narrativeInsight = 'The candidate demonstrated solid baseline performance across all competency areas with room to develop in edge-case scenarios.';
    } else {
      narrativeInsight = 'Performance indicates developing competency. Additional coaching on fraud-logic fundamentals and critical reasoning is recommended.';
    }
  } else if (globalComplexFailed === 0) {
    narrativeInsight = 'Exceptional investigative intuition. Resolved all complex and ambiguous fraud scenarios successfully \u2014 showing the kind of judgment that catches what others miss.';
  } else if (globalComplexFailed / globalComplexTotal < 0.25) {
    narrativeInsight = 'Strong analytical reasoning under ambiguity. Maintained logical consistency when rules aren\u2019t explicitly clear \u2014 a reliable signal for fraud-support readiness.';
  } else if (globalComplexFailed / globalComplexTotal < 0.6) {
    if (language > 80 && critical < 55) {
      narrativeInsight = 'Excellent language precision, but encountered difficulty on ambiguous reasoning tasks. Targeted fraud-logic coaching would likely close the gap quickly.';
    } else {
      narrativeInsight = 'Solid effort on standard questions with some hesitation on complex edge cases. Performance suggests the candidate would benefit from guided exposure to ambiguous fraud scenarios.';
    }
  } else {
    narrativeInsight = 'Struggled to maintain consistent reasoning under ambiguous conditions. Foundational fraud-logic training is recommended before a live support role.';
  }

  return {
    overallScore,
    traitScores: { language, research, critical },
    recommendationTier,
    narrativeInsight,
    perQuestion,
    ungradedCount,
  };
}

// ─── Sanitization Check (GRADE-05) ──────────────────────────────────────────

/**
 * containsAnswerKey — recursively checks whether an arbitrary object
 * contains any answer-key field (is_correct, answer_key, correct_answer,
 * correct_option). Returns true if any such field is found at any depth.
 */
export function containsAnswerKey(obj: unknown): boolean {
  if (obj === null || typeof obj !== 'object') return false;
  const SENSITIVE = new Set(['is_correct', 'answer_key', 'correct_answer', 'correct_option']);
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (SENSITIVE.has(key)) return true;
    if (containsAnswerKey((obj as Record<string, unknown>)[key])) return true;
  }
  return false;
}

// ─── Tier Boundary Helper (re-usable in tests) ───────────────────────────────

export function computeTier(
  overall: number,
  critical: number,
  research: number,
): 'Strong Fit' | 'Consider' | 'Not Recommended' {
  if (overall >= 80 && critical >= 75 && research >= 75) return 'Strong Fit';
  if (overall >= 60) return 'Consider';
  return 'Not Recommended';
}
