export interface Option {
  letter: string;
  text: string;
}

/** Case dashboard tab — matches ingestion Tab model and GAS served payload exactly. */
export interface Tab {
  name: string;
  content: string;
  position: number;
}

/** Inline docx table — matches ingestion TableContent model. */
export interface TableContent {
  caption?: string | null;
  headers: string[];
  rows: string[][];
  position: number;
}

export interface Question {
  id: string;
  bank: 'english' | 'attention' | 'critical';
  section: string;
  level?: string | null;
  case_id?: string | null;
  case_title?: string | null;
  /** Attention/Critical case tabs, ordered by `position` (Attention/Critical case tabs) */
  tabs?: Tab[] | null;
  /** Inline docx tables attached to a case */
  tables?: TableContent[] | null;
  /** NOT answer-key material — safe to expose client-side; used for Phase 4 level progress UI */
  difficulty_tier?: 'straightforward' | 'moderate' | 'complex' | null;
  response_type: 'mcq_single' | 'mcq_multi' | 'open_text' | 'hybrid';
  stem: string;
  options: Option[];
}

export interface TraitScores {
  language: number;
  research: number;
  critical: number;
}

/** Phase 3 Report — matches backend handleSubmitAnswers and handleGetAttemptReport return shape exactly. */
export interface Report {
  attemptId: string;
  name: string;
  email: string;
  /** ISO-8601 strings — available from getAttemptReport re-fetch (optional in submit response) */
  startTime?: string;
  endTime?: string;
  overallScore: number;
  traitScores: TraitScores;
  /** Advisory label — never auto-executes a hire/reject decision */
  recommendationTier: 'Strong Fit' | 'Consider' | 'Not Recommended';
  /** Generated from difficulty_tier === 'complex' item performance */
  narrativeInsight: string;
  violationCount: number;
}

export interface HybridAnswer {
  selected: string;
  text: string;
}

export type AnswerValue = string | string[] | HybridAnswer;
export type AnswersMap = Record<string, AnswerValue>;
