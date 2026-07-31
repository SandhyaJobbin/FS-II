#!/usr/bin/env node
/**
 * Plan 10-01 Task 1: Add rubric skeleton block to all 40 open_text + 10 hybrid QUESTIONS entries.
 *
 * Strategy: per-entry regex on `{ ... "id": "...", ..., "difficulty_tier": "..." }` blocks.
 * For each matched entry, if response_type is open_text or hybrid, insert a `rubric` field
 * (unquoted-key JS style, per plan spec) immediately after the `"model_answer":` line and
 * before the `"position":` line.
 *
 * Skeleton criteria per plan:
 *   sentence_correction (30): Grammar 0.5 | Meaning 0.3 | Tone 0.2
 *   macro (10):               Grammar 0.3 | Tone 0.3    | Instruction 0.4
 *   closure hybrid (10):      Grammar 0.4 | Meaning 0.4 | Tone 0.2
 */

import fs from 'node:fs';

const FILE = 'backend/Code.gs';
const src = fs.readFileSync(FILE, 'utf-8');

const RUBRIC_SENTENCE_CORRECTION = `    rubric: { version: 1, criteria: [
      { name: "Grammar & Mechanics", weight: 0.5, description: "Subject-verb agreement, tense, articles, punctuation, spelling. Common errors like double-negatives and dropped auxiliaries are resolved." },
      { name: "Meaning Preservation", weight: 0.3, description: "Rewrite retains the original intent of the sentence and does not invent or omit facts." },
      { name: "Professional Tone", weight: 0.2, description: "Register is suitable for a written case note or customer-facing message; no slang or informal contractions." }
    ] },
`;

const RUBRIC_MACRO = `    rubric: { version: 1, criteria: [
      { name: "Grammar & Mechanics", weight: 0.3, description: "Sentences are grammatically correct with appropriate punctuation and spelling; contractions and register are appropriate for a customer email." },
      { name: "Professional Tone", weight: 0.3, description: "Polite, objective, helpful, non-defensive; personalizes to the customer's situation rather than defaulting to a generic template." },
      { name: "Instruction Adherence", weight: 0.4, description: "Checks if the candidate addressed all constraints mentioned in the email prompt." }
    ] },
`;

const RUBRIC_CLOSURE_HYBRID = `    rubric: { version: 1, criteria: [
      { name: "Grammar & Mechanics", weight: 0.4, description: "Sentences are grammatically correct; punctuation and spelling are clean; register is appropriate for a customer closure message." },
      { name: "Meaning Preservation", weight: 0.4, description: "Rewrite retains the original intent (customer failed to send screenshot; verification impossible)." },
      { name: "Professional Tone", weight: 0.2, description: "Polite, professional, empathetic; acknowledges the customer's concern before affirming the resolution." }
    ] },
`;

const OPEN_TEXT = '"response_type": "open_text"';
const HYBRID = '"response_type": "hybrid"';

let modified = src;
let insertions = { sentence_correction: 0, macro: 0, closure_hybrid: 0 };

/**
 * Find each QUESTIONS entry that has response_type open_text OR hybrid,
 * capture the section, and inject the rubric block after "model_answer":.
 *
 * Match the smallest surrounding shape:
 *   "section": "<section>",
 *   ... any lines ...
 *   "response_type": "<open_text|hybrid>",
 *   ... any lines ...
 *   "model_answer": <string>,
 *   ...
 *   "position":
 *
 * Insert rubric block BEFORE the "position": line.
 */

// Pattern: `"model_answer": "..."` followed by newline+spaces+`"position":`
// We need to know section to pick the rubric. Since section appears earlier in
// the entry, walk each entry by locating "id" -> "difficulty_tier" and process
// the whole entry text.

// Simpler: split by top-level entries. QUESTIONS entries are delimited by `\n  {\n` starts
// and `\n  },?\n` closes at the same indentation level.

const entryRegex = /(\{\s*\n\s*"id":\s*"[^"]+",[\s\S]*?"difficulty_tier":\s*"[^"]+"\s*\n\s*\})/g;

let matchCount = 0;
let touched = 0;

modified = modified.replace(entryRegex, (entryBlock) => {
  matchCount++;

  // Skip if this entry isn't open_text or hybrid
  const isOpen = entryBlock.includes(OPEN_TEXT);
  const isHybrid = entryBlock.includes(HYBRID);
  if (!isOpen && !isHybrid) return entryBlock;

  // Skip if rubric already present (idempotency)
  if (/rubric:\s*\{\s*version:\s*1/.test(entryBlock)) return entryBlock;

  // Determine which skeleton to use
  const sectionMatch = entryBlock.match(/"section":\s*"([^"]+)"/);
  const section = sectionMatch ? sectionMatch[1] : null;

  let rubricBlock;
  if (isHybrid && section === 'closure') {
    rubricBlock = RUBRIC_CLOSURE_HYBRID;
    insertions.closure_hybrid++;
  } else if (isOpen && section === 'sentence_correction') {
    rubricBlock = RUBRIC_SENTENCE_CORRECTION;
    insertions.sentence_correction++;
  } else if (isOpen && section === 'macro') {
    rubricBlock = RUBRIC_MACRO;
    insertions.macro++;
  } else {
    // Unrecognized combo — log and skip so a human sees it
    console.warn(`  SKIP entry: isOpen=${isOpen} isHybrid=${isHybrid} section=${section}`);
    return entryBlock;
  }

  // Inject BEFORE the "position": line
  const injected = entryBlock.replace(
    /(\s*)"position":/,
    (match, ws) => `\n${rubricBlock}${ws.replace(/^\n?/, '')}"position":`
  );

  if (injected === entryBlock) {
    console.warn(`  FAIL to inject rubric — "position": pattern not matched`);
    return entryBlock;
  }
  touched++;
  return injected;
});

console.log(`Scanned ${matchCount} QUESTIONS entries`);
console.log(`Injected rubric skeleton into ${touched} entries:`);
console.log(`  sentence_correction: ${insertions.sentence_correction}`);
console.log(`  macro:               ${insertions.macro}`);
console.log(`  closure hybrid:      ${insertions.closure_hybrid}`);
console.log(`  TOTAL:               ${insertions.sentence_correction + insertions.macro + insertions.closure_hybrid}`);

if (modified === src) {
  console.log('No changes to write (all entries already had rubric blocks?)');
  process.exit(0);
}

fs.writeFileSync(FILE, modified, 'utf-8');
console.log(`Wrote ${FILE}`);
