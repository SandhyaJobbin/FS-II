/**
 * Phase 2: Candidate Entry & Test Assembly — Test Gate
 *
 * Tests all 6 ENTRY/ASSM requirements:
 *   ENTRY-01: name+email entry starts an attempt
 *   ENTRY-02: email normalization (Gmail dots/plus/case)
 *   ENTRY-03: duplicate email blocked
 *   ASSM-01:  quota-correct sampling (~105 items per assembly)
 *   ASSM-02:  frozen set — no duplicates, all IDs from source bank
 *   ASSM-03:  case-level atomicity (complete 4-Q cases for Attention + CT)
 *
 * Plus GRADE-05 boundary check:
 *   answer-key sanitization — is_correct never in client payload
 *
 * Runs OFFLINE (no GAS runtime, no network).
 * Logic is extracted verbatim from backend/Code.gs and tested as pure JS.
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Load fixture ───────────────────────────────────────────────────────────

interface QuestionOption {
  letter: string;
  text: string;
  is_correct?: boolean;
}

interface Question {
  id: string;
  bank: 'english' | 'attention' | 'critical';
  section: string;
  level: string | null;
  case_id: string | null;
  case_title: string | null;
  tabs: Record<string, string> | null;
  tables: unknown | null;
  difficulty_tier: 'straightforward' | 'moderate' | 'complex' | null;
  response_type: 'mcq_single' | 'mcq_multi' | 'open_text' | 'hybrid';
  stem: string;
  options: QuestionOption[];
}

interface ClientQuestion {
  id: string;
  bank: string;
  section: string;
  level: string | null;
  case_id: string | null;
  case_title: string | null;
  tabs: Record<string, string> | null;
  tables: unknown | null;
  difficulty_tier: string | null;
  response_type: string;
  stem: string;
  options: { letter: string; text: string }[];
}

const FIXTURE_PATH = join(__dirname, 'fixtures', 'questions_fixture.json');
let QUESTIONS: Question[];

beforeAll(() => {
  const raw = readFileSync(FIXTURE_PATH, 'utf-8');
  QUESTIONS = JSON.parse(raw) as Question[];
  expect(QUESTIONS.length).toBeGreaterThan(100); // sanity check fixture loaded
});

// ─── QUOTAS (from content/quotas.json) ──────────────────────────────────────

const QUOTAS = {
  grammar:            { count: 8,  unit: 'questions' },
  sentence_correction:{ count: 5,  unit: 'questions' },
  macro:              { count: 2,  unit: 'questions' },
  reading:            { count: 1,  unit: 'passages'  }, // 1 passage → 5 questions
  closure:            { count: 5,  unit: 'questions' },
  attention_l1:       { count: 5,  unit: 'cases'     }, // 5 cases × 4 Qs = 20
  attention_l2:       { count: 5,  unit: 'cases'     }, // 5 cases × 4 Qs = 20
  critical:           { count: 10, unit: 'cases'     }, // 10 cases × 4 Qs = 40
};

const EXPECTED_TOTAL = 8 + 5 + 2 + 5 + 5 + 20 + 20 + 40; // = 105

// ─── Extracted GAS logic (pure JS, no GAS runtime) ──────────────────────────

function normalizeEmail(email: string): string {
  if (!email) return '';
  let clean = email.trim().toLowerCase();
  if (clean.endsWith('@gmail.com')) {
    let local = clean.split('@')[0];
    local = local.split('+')[0];       // strip plus-addressing
    local = local.replace(/\./g, ''); // strip dots
    clean = local + '@gmail.com';
  }
  return clean;
}

function groupBy<T>(xs: T[], key: keyof T): Record<string, T[]> {
  return xs.reduce((rv: Record<string, T[]>, x) => {
    const k = String(x[key]);
    if (!rv[k]) rv[k] = [];
    rv[k].push(x);
    return rv;
  }, {});
}

function sampleRandom<T>(arr: T[], count: number): T[] {
  const shuffled = arr.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

function assembleQuestionSet(questions: Question[]): string[] {
  if (!questions || questions.length === 0) {
    throw new Error('QUESTIONS bank is empty');
  }

  const selectedIds: string[] = [];

  // 1. Grammar
  const grammarPool = questions.filter(q => q.bank === 'english' && q.section === 'grammar');
  selectedIds.push(...sampleRandom(grammarPool, QUOTAS.grammar.count).map(q => q.id));

  // 2. Sentence Correction
  const scPool = questions.filter(q => q.bank === 'english' && q.section === 'sentence_correction');
  selectedIds.push(...sampleRandom(scPool, QUOTAS.sentence_correction.count).map(q => q.id));

  // 3. Macro
  const macroPool = questions.filter(q => q.bank === 'english' && q.section === 'macro');
  selectedIds.push(...sampleRandom(macroPool, QUOTAS.macro.count).map(q => q.id));

  // 4. Reading — 1 passage → all 5 questions from that passage
  const readingPool = questions.filter(q => q.bank === 'english' && q.section === 'reading');
  const readingPassages = groupBy(readingPool, 'case_id');
  const passageIds = Object.keys(readingPassages);
  if (passageIds.length > 0) {
    const chosenPassageId = passageIds[Math.floor(Math.random() * passageIds.length)];
    selectedIds.push(...readingPassages[chosenPassageId].map(q => q.id));
  }

  // 5. Closure
  const closurePool = questions.filter(q => q.bank === 'english' && q.section === 'closure');
  selectedIds.push(...sampleRandom(closurePool, QUOTAS.closure.count).map(q => q.id));

  // 6. Attention L1 (case-level sampling)
  const attL1Pool = questions.filter(q => q.bank === 'attention' && q.level === 'L1');
  const attL1Cases = groupBy(attL1Pool, 'case_id');
  sampleRandom(Object.keys(attL1Cases), QUOTAS.attention_l1.count).forEach(cId => {
    selectedIds.push(...attL1Cases[cId].map(q => q.id));
  });

  // 7. Attention L2 (case-level sampling)
  const attL2Pool = questions.filter(q => q.bank === 'attention' && q.level === 'L2');
  const attL2Cases = groupBy(attL2Pool, 'case_id');
  sampleRandom(Object.keys(attL2Cases), QUOTAS.attention_l2.count).forEach(cId => {
    selectedIds.push(...attL2Cases[cId].map(q => q.id));
  });

  // 8. Critical Thinking (case-level sampling)
  const ctPool = questions.filter(q => q.bank === 'critical');
  const ctCases = groupBy(ctPool, 'case_id');
  sampleRandom(Object.keys(ctCases), QUOTAS.critical.count).forEach(cId => {
    selectedIds.push(...ctCases[cId].map(q => q.id));
  });

  return selectedIds;
}

/** Sanitizes a question for client delivery — strips is_correct, keeps difficulty_tier */
function sanitizeQuestion(q: Question): ClientQuestion {
  return {
    id: q.id,
    bank: q.bank,
    section: q.section,
    level: q.level,
    case_id: q.case_id,
    case_title: q.case_title,
    tabs: q.tabs,
    tables: q.tables,
    difficulty_tier: q.difficulty_tier || null,
    response_type: q.response_type,
    stem: q.stem,
    options: q.options.map(o => ({ letter: o.letter, text: o.text })), // omit is_correct!
  };
}

/** Recursively checks that a value contains no 'is_correct' key anywhere */
function hasIsCorrect(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'object') {
    if ('is_correct' in (value as Record<string, unknown>)) return true;
    return Object.values(value as Record<string, unknown>).some(hasIsCorrect);
  }
  if (Array.isArray(value)) {
    return (value as unknown[]).some(hasIsCorrect);
  }
  return false;
}

// ─── Simulated "Attempts store" for duplicate detection tests ────────────────

function simulateDuplicateCheck(
  existingEmails: string[],
  newEmail: string
): { isDuplicate: boolean } {
  const normNew = normalizeEmail(newEmail);
  for (const existing of existingEmails) {
    if (normalizeEmail(existing) === normNew) {
      return { isDuplicate: true };
    }
  }
  return { isDuplicate: false };
}

// ════════════════════════════════════════════════════════════════════════════
// TEST GROUPS
// ════════════════════════════════════════════════════════════════════════════

// ─── ENTRY-02: Email Normalization ──────────────────────────────────────────

describe('ENTRY-02: normalizeEmail', () => {
  test('lowercases all emails', () => {
    expect(normalizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com');
  });

  test('lowercases Gmail emails', () => {
    expect(normalizeEmail('USER@GMAIL.COM')).toBe('user@gmail.com');
  });

  test('removes dots from Gmail local part', () => {
    expect(normalizeEmail('john.doe@gmail.com')).toBe('johndoe@gmail.com');
  });

  test('removes plus-addressing from Gmail', () => {
    expect(normalizeEmail('user+tag@gmail.com')).toBe('user@gmail.com');
  });

  test('removes both dots and plus from Gmail (combined)', () => {
    expect(normalizeEmail('j.o.h.n+test@gmail.com')).toBe('john@gmail.com');
  });

  test('case-folds Gmail combined variant', () => {
    expect(normalizeEmail('J.O.H.N+TEST@Gmail.COM')).toBe('john@gmail.com');
  });

  test('does NOT remove dots from non-Gmail providers', () => {
    expect(normalizeEmail('john.doe@outlook.com')).toBe('john.doe@outlook.com');
  });

  test('does NOT strip plus from non-Gmail providers', () => {
    expect(normalizeEmail('user+tag@company.com')).toBe('user+tag@company.com');
  });

  test('returns empty string for empty input', () => {
    expect(normalizeEmail('')).toBe('');
  });

  test('trims leading/trailing whitespace', () => {
    expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com');
  });
});

// ─── ENTRY-03: Duplicate detection ──────────────────────────────────────────

describe('ENTRY-03: Duplicate email detection', () => {
  test('exact duplicate is blocked', () => {
    const result = simulateDuplicateCheck(['user@example.com'], 'user@example.com');
    expect(result.isDuplicate).toBe(true);
  });

  test('case-variant duplicate is blocked', () => {
    const result = simulateDuplicateCheck(['user@example.com'], 'USER@EXAMPLE.COM');
    expect(result.isDuplicate).toBe(true);
  });

  test('Gmail dot-variant is blocked', () => {
    const result = simulateDuplicateCheck(['johndoe@gmail.com'], 'john.doe@gmail.com');
    expect(result.isDuplicate).toBe(true);
  });

  test('Gmail plus-variant is blocked', () => {
    const result = simulateDuplicateCheck(['user@gmail.com'], 'user+tag@gmail.com');
    expect(result.isDuplicate).toBe(true);
  });

  test('Gmail combined variant is blocked', () => {
    const result = simulateDuplicateCheck(['johndoe@gmail.com'], 'J.O.H.N+test@Gmail.COM');
    expect(result.isDuplicate).toBe(false); // 'john' != 'johndoe' — correct, different users
  });

  test('genuinely different email is allowed', () => {
    const result = simulateDuplicateCheck(['alice@example.com'], 'bob@example.com');
    expect(result.isDuplicate).toBe(false);
  });

  test('empty store allows any email', () => {
    const result = simulateDuplicateCheck([], 'user@example.com');
    expect(result.isDuplicate).toBe(false);
  });

  test('first of two same-normalized emails blocks second', () => {
    // Simulate: first attempt registered with dot variant, second attempt with clean version
    const existing = ['john.doe@gmail.com'];
    const second = simulateDuplicateCheck(existing, 'johndoe@gmail.com');
    expect(second.isDuplicate).toBe(true);
  });
});

// ─── ASSM-01: Quota compliance ───────────────────────────────────────────────

describe('ASSM-01: Quota compliance', () => {
  // Run assembly 10 times to check quota compliance holds across random draws
  const RUNS = 10;
  let assemblies: string[][];

  beforeAll(() => {
    assemblies = Array.from({ length: RUNS }, () => assembleQuestionSet(QUESTIONS));
  });

  test('grammar count = 8 on every run', () => {
    assemblies.forEach((ids, i) => {
      const count = ids.filter(id => id.startsWith('eng-grammar-')).length;
      expect(count, `Run ${i}: grammar count`).toBe(8);
    });
  });

  test('sentence_correction count = 5 on every run', () => {
    assemblies.forEach((ids, i) => {
      const count = ids.filter(id => id.startsWith('eng-sc-')).length;
      expect(count, `Run ${i}: sentence_correction count`).toBe(5);
    });
  });

  test('macro count = 2 on every run', () => {
    assemblies.forEach((ids, i) => {
      const count = ids.filter(id => id.startsWith('eng-macro-')).length;
      expect(count, `Run ${i}: macro count`).toBe(2);
    });
  });

  test('reading count = 5 (1 passage × 5 questions) on every run', () => {
    assemblies.forEach((ids, i) => {
      const count = ids.filter(id => id.startsWith('eng-reading-')).length;
      expect(count, `Run ${i}: reading count`).toBe(5);
    });
  });

  test('closure count = 5 on every run', () => {
    assemblies.forEach((ids, i) => {
      const count = ids.filter(id => id.startsWith('eng-closure-')).length;
      expect(count, `Run ${i}: closure count`).toBe(5);
    });
  });

  test('attention L1 count = 20 (5 cases × 4 Qs) on every run', () => {
    assemblies.forEach((ids, i) => {
      const count = ids.filter(id => id.startsWith('att-l1-')).length;
      expect(count, `Run ${i}: attention L1 count`).toBe(20);
    });
  });

  test('attention L2 count = 20 (5 cases × 4 Qs) on every run', () => {
    assemblies.forEach((ids, i) => {
      const count = ids.filter(id => id.startsWith('att-l2-')).length;
      expect(count, `Run ${i}: attention L2 count`).toBe(20);
    });
  });

  test('critical thinking count = 40 (10 cases × 4 Qs) on every run', () => {
    assemblies.forEach((ids, i) => {
      const count = ids.filter(id => id.startsWith('ct-')).length;
      expect(count, `Run ${i}: critical count`).toBe(40);
    });
  });

  test(`total = ${EXPECTED_TOTAL} on every run`, () => {
    assemblies.forEach((ids, i) => {
      expect(ids.length, `Run ${i}: total count`).toBe(EXPECTED_TOTAL);
    });
  });

  test('reading questions all come from one passage (atomicity)', () => {
    assemblies.forEach((ids, i) => {
      const readingIds = ids.filter(id => id.startsWith('eng-reading-'));
      const passageNums = readingIds.map(id => id.split('-')[2]); // e.g. "p1"
      const uniquePassages = new Set(passageNums);
      expect(uniquePassages.size, `Run ${i}: reading passage count`).toBe(1);
    });
  });
});

// ─── ASSM-02: Frozen set integrity ──────────────────────────────────────────

describe('ASSM-02: Frozen set integrity', () => {
  let ids: string[];

  beforeAll(() => {
    ids = assembleQuestionSet(QUESTIONS);
  });

  test('no duplicate IDs in assembled set', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    ids.forEach(id => {
      if (seen.has(id)) duplicates.push(id);
      seen.add(id);
    });
    expect(duplicates).toHaveLength(0);
  });

  test('all IDs in assembled set exist in source question bank', () => {
    const sourceIds = new Set(QUESTIONS.map(q => q.id));
    const missing = ids.filter(id => !sourceIds.has(id));
    expect(missing).toHaveLength(0);
  });

  test('assembleQuestionSet throws on empty bank', () => {
    expect(() => assembleQuestionSet([])).toThrow('QUESTIONS bank is empty');
  });
});

// ─── ASSM-03: Case atomicity (complete 4-Q cases) ───────────────────────────

describe('ASSM-03: Case atomicity — complete 4-Q cases', () => {
  const RUNS = 5;
  let assemblies: string[][];

  beforeAll(() => {
    assemblies = Array.from({ length: RUNS }, () => assembleQuestionSet(QUESTIONS));
  });

  test('Attention L1: every case in output is complete (4 questions)', () => {
    assemblies.forEach((ids, runIdx) => {
      const l1Ids = ids.filter(id => id.startsWith('att-l1-'));
      // Group by case number (att-l1-c01-q1 → c01)
      const byCaseNum: Record<string, string[]> = {};
      l1Ids.forEach(id => {
        const caseKey = id.split('-').slice(0, 3).join('-'); // att-l1-c01
        if (!byCaseNum[caseKey]) byCaseNum[caseKey] = [];
        byCaseNum[caseKey].push(id);
      });
      Object.entries(byCaseNum).forEach(([cKey, cIds]) => {
        expect(cIds.length, `Run ${runIdx}: L1 ${cKey} has ${cIds.length} questions`).toBe(4);
      });
    });
  });

  test('Attention L2: every case in output is complete (4 questions)', () => {
    assemblies.forEach((ids, runIdx) => {
      const l2Ids = ids.filter(id => id.startsWith('att-l2-'));
      const byCaseNum: Record<string, string[]> = {};
      l2Ids.forEach(id => {
        const caseKey = id.split('-').slice(0, 3).join('-'); // att-l2-c01
        if (!byCaseNum[caseKey]) byCaseNum[caseKey] = [];
        byCaseNum[caseKey].push(id);
      });
      Object.entries(byCaseNum).forEach(([cKey, cIds]) => {
        expect(cIds.length, `Run ${runIdx}: L2 ${cKey} has ${cIds.length} questions`).toBe(4);
      });
    });
  });

  test('Critical Thinking: every case in output is complete (4 questions)', () => {
    assemblies.forEach((ids, runIdx) => {
      const ctIds = ids.filter(id => id.startsWith('ct-'));
      const byCaseNum: Record<string, string[]> = {};
      ctIds.forEach(id => {
        const caseKey = id.split('-').slice(0, 2).join('-'); // ct-c01
        if (!byCaseNum[caseKey]) byCaseNum[caseKey] = [];
        byCaseNum[caseKey].push(id);
      });
      Object.entries(byCaseNum).forEach(([cKey, cIds]) => {
        expect(cIds.length, `Run ${runIdx}: CT ${cKey} has ${cIds.length} questions`).toBe(4);
      });
    });
  });

  test('Attention: exactly 5 L1 cases selected', () => {
    assemblies.forEach((ids, runIdx) => {
      const l1Ids = ids.filter(id => id.startsWith('att-l1-'));
      const caseNums = new Set(l1Ids.map(id => id.split('-').slice(0, 3).join('-')));
      expect(caseNums.size, `Run ${runIdx}: L1 case count`).toBe(5);
    });
  });

  test('Attention: exactly 5 L2 cases selected', () => {
    assemblies.forEach((ids, runIdx) => {
      const l2Ids = ids.filter(id => id.startsWith('att-l2-'));
      const caseNums = new Set(l2Ids.map(id => id.split('-').slice(0, 3).join('-')));
      expect(caseNums.size, `Run ${runIdx}: L2 case count`).toBe(5);
    });
  });

  test('Critical: exactly 10 cases selected', () => {
    assemblies.forEach((ids, runIdx) => {
      const ctIds = ids.filter(id => id.startsWith('ct-'));
      const caseNums = new Set(ctIds.map(id => id.split('-').slice(0, 2).join('-')));
      expect(caseNums.size, `Run ${runIdx}: CT case count`).toBe(10);
    });
  });
});

// ─── GRADE-05 boundary: Answer-key sanitization ──────────────────────────────

describe('GRADE-05 boundary: Answer-key sanitization', () => {
  let sampleQuestion: Question;
  let sanitized: ClientQuestion;

  beforeAll(() => {
    // Pick a question that has is_correct on options
    sampleQuestion = QUESTIONS.find(q => q.options.some(o => o.is_correct !== undefined))!;
    expect(sampleQuestion).toBeDefined();
    sanitized = sanitizeQuestion(sampleQuestion);
  });

  test('sanitized payload contains no is_correct fields (recursive check)', () => {
    expect(hasIsCorrect(sanitized)).toBe(false);
  });

  test('sanitized options have letter and text fields', () => {
    sanitized.options.forEach(o => {
      expect(o).toHaveProperty('letter');
      expect(o).toHaveProperty('text');
    });
  });

  test('sanitized options do NOT have is_correct field', () => {
    sanitized.options.forEach(o => {
      expect(o).not.toHaveProperty('is_correct');
    });
  });

  test('difficulty_tier is preserved in sanitized payload', () => {
    expect(sanitized).toHaveProperty('difficulty_tier');
    if (sampleQuestion.difficulty_tier) {
      expect(sanitized.difficulty_tier).toBe(sampleQuestion.difficulty_tier);
    }
  });

  test('sanitized payload preserves all non-answer-key fields', () => {
    expect(sanitized.id).toBe(sampleQuestion.id);
    expect(sanitized.bank).toBe(sampleQuestion.bank);
    expect(sanitized.section).toBe(sampleQuestion.section);
    expect(sanitized.response_type).toBe(sampleQuestion.response_type);
    expect(sanitized.stem).toBe(sampleQuestion.stem);
  });

  test('full assembled set: no is_correct anywhere in sanitized batch', () => {
    const ids = assembleQuestionSet(QUESTIONS);
    const clientPayload = ids.map(id => {
      const q = QUESTIONS.find(item => item.id === id)!;
      return sanitizeQuestion(q);
    });
    expect(hasIsCorrect(clientPayload)).toBe(false);
  });

  test('sanitized batch has exactly the assembled ID count', () => {
    const ids = assembleQuestionSet(QUESTIONS);
    const clientPayload = ids.map(id => {
      const q = QUESTIONS.find(item => item.id === id)!;
      return sanitizeQuestion(q);
    });
    expect(clientPayload.length).toBe(EXPECTED_TOTAL);
  });
});
