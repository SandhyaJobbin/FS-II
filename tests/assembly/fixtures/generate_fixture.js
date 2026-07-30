// Script to generate the assembly test fixture
// Produces tests/assembly/fixtures/questions_fixture.json

const fs = require('fs');
const path = require('path');

function makeOption(letter, isCorrect, difficulty) {
  return { letter, text: `Option ${letter}`, is_correct: isCorrect };
}

function makeOptions(correctLetter) {
  return ['A','B','C','D'].map(l => makeOption(l, l === correctLetter));
}

const questions = [];

// English Grammar — 12 questions (need to draw 8)
for (let i = 1; i <= 12; i++) {
  questions.push({
    id: `eng-grammar-q${String(i).padStart(2,'0')}`,
    bank: 'english', section: 'grammar',
    level: null, case_id: null, case_title: null,
    tabs: null, tables: null,
    difficulty_tier: 'straightforward',
    response_type: 'mcq_single',
    stem: `Grammar question ${i}: The agent ___ correctly.`,
    options: makeOptions('B')
  });
}

// English Sentence Correction — 8 questions (need 5)
for (let i = 1; i <= 8; i++) {
  questions.push({
    id: `eng-sc-q${String(i).padStart(2,'0')}`,
    bank: 'english', section: 'sentence_correction',
    level: null, case_id: null, case_title: null,
    tabs: null, tables: null,
    difficulty_tier: 'straightforward',
    response_type: 'open_text',
    stem: `Correct the following sentence ${i}.`,
    options: []
  });
}

// English Macro — 4 questions (need 2)
for (let i = 1; i <= 4; i++) {
  questions.push({
    id: `eng-macro-q${String(i).padStart(2,'0')}`,
    bank: 'english', section: 'macro',
    level: null, case_id: null, case_title: null,
    tabs: null, tables: null,
    difficulty_tier: 'moderate',
    response_type: 'open_text',
    stem: `Macro question ${i}: Edit the following macro template.`,
    options: []
  });
}

// English Reading — 2 passages x 5 questions each (need 1 passage = 5 questions)
for (let p = 1; p <= 2; p++) {
  for (let q = 1; q <= 5; q++) {
    questions.push({
      id: `eng-reading-p${p}-q${q}`,
      bank: 'english', section: 'reading',
      level: null,
      case_id: `reading-passage-${p}`,
      case_title: `Reading Passage ${p}`,
      tabs: null, tables: null,
      difficulty_tier: 'moderate',
      response_type: 'mcq_single',
      stem: `Passage ${p}, Question ${q}: Based on the text, what does...`,
      options: makeOptions('C')
    });
  }
}

// English Closure — 6 questions (need 5)
for (let i = 1; i <= 6; i++) {
  questions.push({
    id: `eng-closure-q${String(i).padStart(2,'0')}`,
    bank: 'english', section: 'closure',
    level: null, case_id: null, case_title: null,
    tabs: null, tables: null,
    difficulty_tier: 'moderate',
    response_type: 'mcq_single',
    stem: `Case Closure question ${i}: What is the appropriate status?`,
    options: makeOptions('A')
  });
}

// Attention L1 — 8 cases x 4 questions each (need 5 cases = 20 questions)
for (let c = 1; c <= 8; c++) {
  for (let q = 1; q <= 4; q++) {
    questions.push({
      id: `att-l1-c${String(c).padStart(2,'0')}-q${q}`,
      bank: 'attention', section: 'attention',
      level: 'L1',
      case_id: `att-l1-case-${String(c).padStart(2,'0')}`,
      case_title: `L1 Case ${c}: Listing Accuracy Investigation`,
      tabs: {
        'Customer Report': `Customer report content for case ${c}.`,
        'Booking Details': `Booking details for case ${c}.`
      },
      tables: null,
      difficulty_tier: q <= 2 ? 'straightforward' : 'moderate',
      response_type: q === 3 ? 'mcq_multi' : 'mcq_single',
      stem: `L1 Case ${c}, Q${q}: What discrepancy do you identify?`,
      options: q === 3
        ? [
            { letter: 'A', text: 'Option A', is_correct: true },
            { letter: 'B', text: 'Option B', is_correct: false },
            { letter: 'C', text: 'Option C', is_correct: true },
            { letter: 'D', text: 'Option D', is_correct: false }
          ]
        : makeOptions('B')
    });
  }
}

// Attention L2 — 8 cases x 4 questions each (need 5 cases = 20 questions)
for (let c = 1; c <= 8; c++) {
  for (let q = 1; q <= 4; q++) {
    questions.push({
      id: `att-l2-c${String(c).padStart(2,'0')}-q${q}`,
      bank: 'attention', section: 'attention',
      level: 'L2',
      case_id: `att-l2-case-${String(c).padStart(2,'0')}`,
      case_title: `L2 Case ${c}: Account & Fraud Pattern Investigation`,
      tabs: {
        'Customer Report': `Customer report content for L2 case ${c}.`,
        'Account Information': `Account information for L2 case ${c}.`
      },
      tables: null,
      difficulty_tier: q <= 1 ? 'straightforward' : 'complex',
      response_type: q === 4 ? 'mcq_multi' : 'mcq_single',
      stem: `L2 Case ${c}, Q${q}: Evaluate the account activity pattern.`,
      options: q === 4
        ? [
            { letter: 'A', text: 'Option A', is_correct: true },
            { letter: 'B', text: 'Option B', is_correct: true },
            { letter: 'C', text: 'Option C', is_correct: false },
            { letter: 'D', text: 'Option D', is_correct: false }
          ]
        : makeOptions('D')
    });
  }
}

// Critical Thinking — 15 cases x 4 questions each (need 10 cases = 40 questions)
for (let c = 1; c <= 15; c++) {
  for (let q = 1; q <= 4; q++) {
    questions.push({
      id: `ct-c${String(c).padStart(2,'0')}-q${q}`,
      bank: 'critical', section: 'risk_assessment',
      level: null,
      case_id: `ct-case-${String(c).padStart(2,'0')}`,
      case_title: `CT Case ${c}: Risk Assessment & Business Decision`,
      tabs: {
        'Customer Report': `Customer report for CT case ${c}.`,
        'Booking Details': `Booking details for CT case ${c}.`,
        'Review Information': `Review info for CT case ${c}.`
      },
      tables: null,
      difficulty_tier: q === 4 ? 'complex' : 'moderate',
      response_type: 'mcq_single',
      stem: `CT Case ${c}, Q${q}: Based on the evidence, what is your recommendation?`,
      options: makeOptions('A')
    });
  }
}

const outPath = path.join(__dirname, 'questions_fixture.json');
fs.writeFileSync(outPath, JSON.stringify(questions, null, 2), 'utf-8');
console.log(`Written ${questions.length} fixture questions to ${outPath}`);

// Verify expected counts
const grammarCount = questions.filter(q => q.bank === 'english' && q.section === 'grammar').length;
const scCount = questions.filter(q => q.bank === 'english' && q.section === 'sentence_correction').length;
const macroCount = questions.filter(q => q.bank === 'english' && q.section === 'macro').length;
const readingCount = questions.filter(q => q.bank === 'english' && q.section === 'reading').length;
const closureCount = questions.filter(q => q.bank === 'english' && q.section === 'closure').length;
const attL1Count = questions.filter(q => q.bank === 'attention' && q.level === 'L1').length;
const attL2Count = questions.filter(q => q.bank === 'attention' && q.level === 'L2').length;
const ctCount = questions.filter(q => q.bank === 'critical').length;

console.log('Fixture breakdown:');
console.log(`  Grammar: ${grammarCount} (need >= 8)`);
console.log(`  Sentence Correction: ${scCount} (need >= 5)`);
console.log(`  Macro: ${macroCount} (need >= 2)`);
console.log(`  Reading: ${readingCount} (2 passages x 5 Qs, need >= 5)`);
console.log(`  Closure: ${closureCount} (need >= 5)`);
console.log(`  Attention L1: ${attL1Count} (${attL1Count/4} cases, need >= 5 cases)`);
console.log(`  Attention L2: ${attL2Count} (${attL2Count/4} cases, need >= 5 cases)`);
console.log(`  Critical: ${ctCount} (${ctCount/4} cases, need >= 10 cases)`);
console.log(`  Total: ${questions.length}`);
