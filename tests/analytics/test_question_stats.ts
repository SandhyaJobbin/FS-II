import { describe, it, expect } from 'vitest';
import { buildQuestionStats, ResponsesRow, GradingTranscriptsRow } from './analytics-reducers';
import { gradeAttempt, GasQuestion } from '../grading/grading-engine';
import fixtureData from './fixtures/attempts_20.json';

describe('buildQuestionStats', () => {
  it('correctly aggregates counts, excluding ungraded from sampleSize', () => {
    const res = buildQuestionStats(
      fixtureData.responses as ResponsesRow[],
      fixtureData.transcripts as GradingTranscriptsRow[]
    );
    expect(res.enough_data).toBe(true);

    // Find a question with ungraded (e.g., q5 has ungraded in att_02, att_08 after overrides)
    const q5Stats = res.rows.find(r => r.qId === 'q5');
    expect(q5Stats).toBeDefined();
    if (q5Stats) {
      expect(q5Stats.ungraded).toBe(2);
      // Graded count = total responses for q5 - ungraded
      expect(q5Stats.sampleSize).toBe(q5Stats.correct + q5Stats.incorrect);
      expect(q5Stats.passRate).toBe(Math.round((q5Stats.correct / q5Stats.sampleSize) * 100));
    }
  });

  it('sets passRate to null and enough_data to false when samples < 5', () => {
    // q6 only has 15 responses in the fixture, but let's mock one with 3 graded
    const mockResponses: ResponsesRow[] = [
      ["a1", "qX", "ans", 1, ""],
      ["a2", "qX", "ans", 0, ""],
      ["a3", "qX", "ans", 1, ""]
    ];
    const res = buildQuestionStats(mockResponses, []);
    const qX = res.rows.find(r => r.qId === 'qX');
    expect(qX).toBeDefined();
    if (qX) {
      expect(qX.enough_data).toBe(false);
      expect(qX.passRate).toBeNull();
    }
  });

  describe('A2 parity anchor verification', () => {
    it('proves A2 parity between buildQuestionStats and gradeAttempt overallScore', () => {
      // Setup questions matching att_01 response categories
      const mockQuestions: GasQuestion[] = [
        { id: 'q1', bank: 'english', section: 'S1', response_type: 'mcq_single', options: [{ letter: 'A', text: '', is_correct: true }] },
        { id: 'q2', bank: 'english', section: 'S1', response_type: 'mcq_single', options: [{ letter: 'A', text: '', is_correct: true }] },
        { id: 'q3', bank: 'attention', section: 'S2', response_type: 'mcq_single', options: [{ letter: 'A', text: '', is_correct: true }] },
        { id: 'q4', bank: 'attention', section: 'S2', response_type: 'mcq_single', options: [{ letter: 'A', text: '', is_correct: true }] },
        { id: 'q5', bank: 'critical', section: 'S3', response_type: 'mcq_single', options: [{ letter: 'A', text: '', is_correct: true }] },
        { id: 'q6', bank: 'critical', section: 'S3', response_type: 'open_text', options: [] }
      ];

      // candidate answers map for att_01 (q1..q4 correct, q5 incorrect, q6 correct via override)
      // Note: we can mock candidateAnswers and llmResults to achieve the exact verdicts of att_01
      const candidateAnswers = {
        q1: 'A',
        q2: 'A',
        q3: 'A',
        q4: 'A',
        q5: 'B', // incorrect
        q6: 'B' // incorrect mcq, but we will mock llm override or let effectiveVerdict handle it in the stats path
      };
      
      const llmResults = {
        q6: 'correct' as const // override/transcript verdict
      };

      // Run through gradeAttempt
      const gradeResult = gradeAttempt(mockQuestions, candidateAnswers, llmResults);
      // overallScore = Math.round(((100 + 100 + 50) / 3)) = 83%

      // Run through buildQuestionStats for att_01 data only
      const att1Responses: ResponsesRow[] = [
        ["att_01", "q1", "", 1, ""],
        ["att_01", "q2", "", 1, ""],
        ["att_01", "q3", "", 1, ""],
        ["att_01", "q4", "", 1, ""],
        ["att_01", "q5", "", 0, ""],
        ["att_01", "q6", "", 0, ""]
      ];
      const att1Transcripts: GradingTranscriptsRow[] = [
        ["att_01", "q6", "1.0", "incorrect", "{}", "rationale", "correct", "", ""]
      ];

      const stats = buildQuestionStats(att1Responses, att1Transcripts);

      // Weighted average passRate (each question has weight 1 here since sample size is 1)
      const validRates = stats.rows.map(r => {
        // manually calculate passRate because enough_data will be false (N=1 < 5)
        const correct = r.correct;
        const total = r.sampleSize;
        return (correct / total) * 100;
      });

      const weightedAvg = validRates.reduce((sum, r) => sum + r, 0) / validRates.length;

      expect(Math.abs(weightedAvg - gradeResult.overallScore)).toBeLessThanOrEqual(1);
    });
  });
});
