/**
 * Plan 10-06: Apply production rubrics to backend/Code.gs
 * Run: node .planning/phases/10-rubric-based-llm-grading-recruiter-transcript-override/apply-rubrics.js
 */
const fs = require('fs');
const path = require('path');

const fp = path.resolve(__dirname, '../../../backend/Code.gs');
let c = fs.readFileSync(fp, 'utf8');

const R = {
  // === TASK 1: 30 sentence_correction open_text (Q31-Q60) ===
  'eng-sentence-correction-q31': [
    ['Grammar & Mechanics', 0.5, "Corrects 'didn\\'t sent' to 'didn\\'t send' (base form after did); resolves double negative 'can\\'t verify nothing' to 'can\\'t verify anything' or 'can verify nothing'; proper punctuation and spelling"],
    ['Meaning Preservation', 0.3, "Retains original meaning: customer failed to send screenshot, verification is impossible"],
    ['Professional Tone', 0.2, "Formal register for case note; contractions replaced with full forms; professional phrasing"]
  ],
  'eng-sentence-correction-q32': [
    ['Grammar & Mechanics', 0.5, "Corrects 'is solve' to 'has been resolved' or 'is solved' (past participle required after auxiliary); adds punctuation between clauses"],
    ['Meaning Preservation', 0.3, "Retains meaning: case is resolved, customer should check account"],
    ['Professional Tone', 0.2, "Polite professional customer service tone; 'kindly' acceptable in context"]
  ],
  'eng-sentence-correction-q33': [
    ['Grammar & Mechanics', 0.5, "Adds missing auxiliary 'was' before 'not able'; corrects 'was expired' to 'had expired' (intransitive verb not used in passive); adds article 'The' before 'Agent'"],
    ['Meaning Preservation', 0.3, "Retains meaning: agent could not access link due to expiration"],
    ['Professional Tone', 0.2, "Formal register; avoids contractions; professional tone"]
  ],
  'eng-sentence-correction-q34': [
    ['Grammar & Mechanics', 0.5, "Changes to present perfect continuous 'have been following up for two days'; corrects 'you not respond' to 'you have not responded'; fixes preposition 'from' to 'for'"],
    ['Meaning Preservation', 0.3, "Retains meaning: repeated follow-ups over two days without response"],
    ['Professional Tone', 0.2, "Professional tone; avoids blaming language; formal register"]
  ],
  'eng-sentence-correction-q35': [
    ['Grammar & Mechanics', 0.5, "Replaces nonstandard 'fastly' with 'as soon as possible' or 'promptly'; corrects 'we done' to 'we can complete' (wrong verb form and missing modal)"],
    ['Meaning Preservation', 0.3, "Retains meaning: request for details to complete verification"],
    ['Professional Tone', 0.2, "Polite request; professional customer service register"]
  ],
  'eng-sentence-correction-q36': [
    ['Grammar & Mechanics', 0.5, "Corrects subject-verb agreement 'owner say' to 'owner states' or 'stated'; adds appropriate tense marking for reported speech"],
    ['Meaning Preservation', 0.3, "Retains meaning: owner claims review is fake"],
    ['Professional Tone', 0.2, "Uses past tense for reported speech; formal register"]
  ],
  'eng-sentence-correction-q37': [
    ['Grammar & Mechanics', 0.5, "Corrects 'didn\\'t received' to 'did not receive' (base form after did); changes uncountable 'evidences' to 'evidence'"],
    ['Meaning Preservation', 0.3, "Retains meaning: insufficient evidence received"],
    ['Professional Tone', 0.2, "Formal register; avoids contractions"]
  ],
  'eng-sentence-correction-q38': [
    ['Grammar & Mechanics', 0.5, "Corrects 'for verify' to 'so that we can verify' or 'to verify' (infinitive of purpose or subordinate clause required)"],
    ['Meaning Preservation', 0.3, "Retains meaning: request for booking ID to verify stay"],
    ['Professional Tone', 0.2, "Polite request; appropriate customer service tone"]
  ],
  'eng-sentence-correction-q39': [
    ['Grammar & Mechanics', 0.5, "Adds missing passive auxiliary 'has been' ('Your request has already been forwarded'); ensures correct present perfect passive construction"],
    ['Meaning Preservation', 0.3, "Retains meaning: request has been passed to specialists"],
    ['Professional Tone', 0.2, "Formal, reassuring tone"]
  ],
  'eng-sentence-correction-q40': [
    ['Grammar & Mechanics', 0.5, "Corrects 'patient' (adjective) to 'patience' (noun); adds article 'the' before 'investigation'"],
    ['Meaning Preservation', 0.3, "Retains meaning: gratitude for customer's patience during process"],
    ['Professional Tone', 0.2, "Warm, professional tone expressing appreciation"]
  ],
  'eng-sentence-correction-q41': [
    ['Grammar & Mechanics', 0.5, "Adds article 'The' before 'Review'; corrects 'has removed' to 'has been removed' (passive voice needed); corrects 'violate' to 'violated' (past tense) with subject 'it'; pluralizes 'guideline' to 'guidelines'"],
    ['Meaning Preservation', 0.3, "Retains meaning: review removed for policy violation"],
    ['Professional Tone', 0.2, "Formal, factual tone; avoids emotional language"]
  ],
  'eng-sentence-correction-q42': [
    ['Grammar & Mechanics', 0.5, "Adds article 'The' before 'Customer'; corrects 'not provide' to 'has not provided'; resolves double negative 'not provide insufficient' to 'has not provided sufficient'; adds article 'the' before 'investigation'"],
    ['Meaning Preservation', 0.3, "Retains meaning: customer has not supplied enough evidence"],
    ['Professional Tone', 0.2, "Neutral, factual tone"]
  ],
  'eng-sentence-correction-q43': [
    ['Grammar & Mechanics', 0.5, "Corrects 'image' to 'images' (plural to match 'are'); adds article 'the' before 'images'"],
    ['Meaning Preservation', 0.3, "Retains meaning: images unclear, re-upload needed"],
    ['Professional Tone', 0.2, "Polite request; clear instruction"]
  ],
  'eng-sentence-correction-q44': [
    ['Grammar & Mechanics', 0.5, "Corrects 'documents is' to 'documents are' (subject-verb agreement); adds article 'the required' before 'documents'"],
    ['Meaning Preservation', 0.3, "Retains meaning: request blocked pending document receipt"],
    ['Professional Tone', 0.2, "Formal, clear tone"]
  ],
  'eng-sentence-correction-q45': [
    ['Grammar & Mechanics', 0.5, "Replaces nonstandard 'soonest' with 'as soon as possible'; adds sentence boundary or conjunction for clarity between clauses"],
    ['Meaning Preservation', 0.3, "Retains meaning: investigation in progress, update forthcoming"],
    ['Professional Tone', 0.2, "Polite, reassuring tone"]
  ],
  'eng-sentence-correction-q46': [
    ['Grammar & Mechanics', 0.5, "Corrects 'there have no enough' to 'there was insufficient' or 'there was not enough' (wrong existential construction and adjective form)"],
    ['Meaning Preservation', 0.3, "Retains meaning: appeal rejected due to insufficient evidence"],
    ['Professional Tone', 0.2, "Formal, empathetic tone"]
  ],
  'eng-sentence-correction-q47': [
    ['Grammar & Mechanics', 0.5, "Removes redundant 'back' from 'contact us back'; replaces 'doubt' with 'further questions' or 'concerns' for clarity"],
    ['Meaning Preservation', 0.3, "Retains meaning: invitation to follow up if needed"],
    ['Professional Tone', 0.2, "Friendly, open tone; customer-service appropriate"]
  ],
  'eng-sentence-correction-q48': [
    ['Grammar & Mechanics', 0.5, "Adds article 'The' before 'Investigation'; adds missing verb 'is'; adds punctuation between clauses; replaces 'don\\'t create' with 'kindly avoid creating'"],
    ['Meaning Preservation', 0.3, "Retains meaning: case being worked, avoid duplicate tickets"],
    ['Professional Tone', 0.2, "Polite instruction; professional tone"]
  ],
  'eng-sentence-correction-q49': [
    ['Grammar & Mechanics', 0.5, "Adds article 'the' before 'wrong attachment'; corrects 'two time' to 'twice' or 'two times'"],
    ['Meaning Preservation', 0.3, "Retains meaning: customer submitted incorrect file multiple times"],
    ['Professional Tone', 0.2, "Factual, neutral tone"]
  ],
  'eng-sentence-correction-q50': [
    ['Grammar & Mechanics', 0.5, "Adds 'to' after 'unable' ('unable to verify'); adds article 'the' before 'booking details'; adds missing verb 'are' ('details are missing')"],
    ['Meaning Preservation', 0.3, "Retains meaning: verification blocked due to missing details"],
    ['Professional Tone', 0.2, "Formal, clear tone"]
  ],
  'eng-sentence-correction-q51': [
    ['Grammar & Mechanics', 0.5, "Corrects 'send' to 'sent' (past tense required by 'yesterday')"],
    ['Meaning Preservation', 0.3, "Retains meaning: customer submitted confirmation on a previous day"],
    ['Professional Tone', 0.2, "Factual report tone"]
  ],
  'eng-sentence-correction-q52': [
    ['Grammar & Mechanics', 0.5, "Corrects 'has' to 'have' (subject-verb agreement with 'We')"],
    ['Meaning Preservation', 0.3, "Retains meaning: evidence has been reviewed"],
    ['Professional Tone', 0.2, "Formal, factual tone"]
  ],
  'eng-sentence-correction-q53': [
    ['Grammar & Mechanics', 0.5, "Corrects 'are' to 'is' (subject-verb agreement with singular 'investigation')"],
    ['Meaning Preservation', 0.3, "Retains meaning: case is ongoing"],
    ['Professional Tone', 0.2, "Formal status update tone"]
  ],
  'eng-sentence-correction-q54': [
    ['Grammar & Mechanics', 0.5, "Corrects 'didn\\'t provided' to 'did not provide' (base form required after 'did')"],
    ['Meaning Preservation', 0.3, "Retains meaning: owner's evidence was insufficient"],
    ['Professional Tone', 0.2, "Neutral, factual tone"]
  ],
  'eng-sentence-correction-q55': [
    ['Grammar & Mechanics', 0.5, "Corrects 'have' to 'has' (subject-verb agreement with singular 'Customer'); adds article 'The' before 'Customer'"],
    ['Meaning Preservation', 0.3, "Retains meaning: incorrect file was submitted"],
    ['Professional Tone', 0.2, "Factual report tone"]
  ],
  'eng-sentence-correction-q56': [
    ['Grammar & Mechanics', 0.5, "Corrects 'all document' to 'all documents' (plural required); corrects 'is' to 'are' (subject-verb agreement with plural)"],
    ['Meaning Preservation', 0.3, "Retains meaning: all files must be attached prior to submission"],
    ['Professional Tone', 0.2, "Clear instruction; professional tone"]
  ],
  'eng-sentence-correction-q57': [
    ['Grammar & Mechanics', 0.5, "Corrects 'were' to 'was' (subject-verb agreement with singular 'review'); corrects 'violate' to 'violated' (past tense)"],
    ['Meaning Preservation', 0.3, "Retains meaning: review removed for guideline violation"],
    ['Professional Tone', 0.2, "Formal, factual tone"]
  ],
  'eng-sentence-correction-q58': [
    ['Grammar & Mechanics', 0.5, "Corrects 'patient' (adjective) to 'patience' (noun needed as object of 'appreciate')"],
    ['Meaning Preservation', 0.3, "Retains meaning: gratitude for patience during investigation"],
    ['Professional Tone', 0.2, "Warm, appreciative tone"]
  ],
  'eng-sentence-correction-q59': [
    ['Grammar & Mechanics', 0.5, "Corrects 'informations' to 'information' (uncountable noun in English)"],
    ['Meaning Preservation', 0.3, "Retains meaning: request for additional booking details"],
    ['Professional Tone', 0.2, "Polite request; professional register"]
  ],
  'eng-sentence-correction-q60': [
    ['Grammar & Mechanics', 0.5, "Adds 'to' after 'unable' ('unable to access' — infinitive required after adjective 'unable')"],
    ['Meaning Preservation', 0.3, "Retains meaning: agent could not open the file"],
    ['Professional Tone', 0.2, "Factual report tone"]
  ],

  // === TASK 2a: 10 macro open_text (Q61-Q70) ===
  'eng-macro-q61': [
    ['Grammar & Mechanics', 0.3, "All sentences grammatically correct with proper punctuation; no contractions in formal correspondence; correct articles and prepositions throughout"],
    ['Professional Tone', 0.3, "Polite, empathetic, non-defensive; acknowledges the owner's concern about the fake review; personalized rather than generic template language"],
    ['Instruction Adherence', 0.4, "Notes that reviews discussing booking or check-in experiences may be allowed under guidelines; suggests posting a management response; does not promise removal of the review"]
  ],
  'eng-macro-q62': [
    ['Grammar & Mechanics', 0.3, "Grammatically correct; proper punctuation and spelling; appropriate register for customer-facing email"],
    ['Professional Tone', 0.3, "Empathetic but firm; explains outcome without being dismissive; maintains professional distance from the traveler's frustration"],
    ['Instruction Adherence', 0.4, "Clearly states no policy violations were identified after investigation; confirms the review will remain published; explains the investigation outcome"]
  ],
  'eng-macro-q63': [
    ['Grammar & Mechanics', 0.3, "Grammatically correct; proper punctuation and sentence structure throughout"],
    ['Professional Tone', 0.3, "Reassuring tone; acknowledges the owner's report of multiple suspicious reviews; sets appropriate timeline expectations"],
    ['Instruction Adherence', 0.4, "Confirms investigation is currently in progress; does not claim the review was already removed (correcting the broken macro); promises to update once review is complete"]
  ],
  'eng-macro-q64': [
    ['Grammar & Mechanics', 0.3, "Grammatically correct; clear sentence structure; appropriate register for customer email"],
    ['Professional Tone', 0.3, "Polite and helpful; explains the document issue without blaming the traveler; provides a clear call to action"],
    ['Instruction Adherence', 0.4, "Explains that submitted ID documents were unclear; requests clear and readable copies; specifies what is needed to continue verification"]
  ],
  'eng-macro-q65': [
    ['Grammar & Mechanics', 0.3, "Grammatically correct; proper punctuation and spelling throughout"],
    ['Professional Tone', 0.3, "Respectful of the appeal process; firm but empathetic in communicating the unchanged decision; acknowledges the owner's effort"],
    ['Instruction Adherence', 0.4, "States the appeal was carefully reviewed; confirms the original decision remains unchanged; references review guidelines; does not promise future reversal"]
  ],
  'eng-macro-q66': [
    ['Grammar & Mechanics', 0.3, "Grammatically correct; appropriate sentence structure and punctuation"],
    ['Professional Tone', 0.3, "Responsive and reassuring; acknowledges receipt of the traveler's submitted documents"],
    ['Instruction Adherence', 0.4, "Confirms documents have been received; states the case is currently under review; does not incorrectly request documents again; promises notification once complete"]
  ],
  'eng-macro-q67': [
    ['Grammar & Mechanics', 0.3, "Grammatically correct; proper punctuation throughout"],
    ['Professional Tone', 0.3, "Helpful and clear; identifies the wrong-document issue without assigning blame to the customer"],
    ['Instruction Adherence', 0.4, "Notes that an incorrect document was uploaded; requests the correct booking confirmation; explains what is needed to proceed with verification"]
  ],
  'eng-macro-q68': [
    ['Grammar & Mechanics', 0.3, "Grammatically correct; professional sentence structure and punctuation"],
    ['Professional Tone', 0.3, "Reassuring tone; acknowledges the escalation to specialist team; sets appropriate expectations for timeline"],
    ['Instruction Adherence', 0.4, "Confirms the appeal has been escalated to the specialist team; does not incorrectly claim rejection (correcting the broken macro); promises update once the review is complete"]
  ],
  'eng-macro-q69': [
    ['Grammar & Mechanics', 0.3, "Grammatically correct; proper punctuation and register throughout"],
    ['Professional Tone', 0.3, "Empathetic but firm; does not celebrate or cheerfully announce the review removal; maintains professionalism"],
    ['Instruction Adherence', 0.4, "Confirms the review was removed because it did not comply with guidelines; does not incorrectly claim restoration (correcting the broken macro); explains the decision stands after appeal review"]
  ],
  'eng-macro-q70': [
    ['Grammar & Mechanics', 0.3, "Grammatically correct; clear and professional sentence structure"],
    ['Professional Tone', 0.3, "Polite request for additional information; non-accusatory tone toward the property owner"],
    ['Instruction Adherence', 0.4, "Explains that evidence provided is currently insufficient; requests specific supporting documents; does not incorrectly claim a policy violation was found (correcting the broken macro)"]
  ],

  // === TASK 2b: 10 hybrid closure (Q96-Q105) ===
  'eng-closure-q96': [
    ['Grammar & Mechanics', 0.4, "Grammatically correct closure note; proper punctuation; register appropriate for an internal case note"],
    ['Meaning Preservation', 0.4, "Accurately reflects that the reported listing was already removed due to policy violations; does not claim the investigation is ongoing or that further user action is needed"],
    ['Professional Tone', 0.2, "Factual and concise; confirms resolution without unnecessary elaboration"]
  ],
  'eng-closure-q97': [
    ['Grammar & Mechanics', 0.4, "Grammatically correct; professional punctuation and spelling throughout"],
    ['Meaning Preservation', 0.4, "States that no policy violations were identified after investigation; confirms the review will remain published; accurately reflects case closure"],
    ['Professional Tone', 0.2, "Objective, factual tone; neutral regarding the investigation outcome"]
  ],
  'eng-closure-q98': [
    ['Grammar & Mechanics', 0.4, "Grammatically correct; appropriate register for a case note"],
    ['Meaning Preservation', 0.4, "Reflects that the report was just received and investigation has not started; does not imply any findings or resolution prematurely"],
    ['Professional Tone', 0.2, "Neutral status update; sets expectation that investigation is pending"]
  ],
  'eng-closure-q99': [
    ['Grammar & Mechanics', 0.4, "Grammatically correct; clean punctuation throughout"],
    ['Meaning Preservation', 0.4, "Confirms all required documents were successfully verified; no further action is needed; accurately reflects completion of the case"],
    ['Professional Tone', 0.2, "Clear, affirmative tone; confirms resolution"]
  ],
  'eng-closure-q100': [
    ['Grammar & Mechanics', 0.4, "Grammatically correct; professional register maintained throughout"],
    ['Meaning Preservation', 0.4, "Notes that submitted images were unclear; requests clearer copies; accurately reflects that verification is blocked pending re-upload"],
    ['Professional Tone', 0.2, "Polite request; non-blaming language toward the traveler"]
  ],
  'eng-closure-q101': [
    ['Grammar & Mechanics', 0.4, "Grammatically correct; appropriate sentence structure and punctuation"],
    ['Meaning Preservation', 0.4, "States that booking details are required for the investigation to proceed; reflects the waiting state pending customer response"],
    ['Professional Tone', 0.2, "Neutral, factual tone; clearly communicates what information is needed"]
  ],
  'eng-closure-q102': [
    ['Grammar & Mechanics', 0.4, "Grammatically correct; professional punctuation throughout"],
    ['Meaning Preservation', 0.4, "Explains that additional supporting evidence is required before the investigation can continue; reflects the dependency on the property owner providing more information"],
    ['Professional Tone', 0.2, "Polite, clear request; professional register"]
  ],
  'eng-closure-q103': [
    ['Grammar & Mechanics', 0.4, "Grammatically correct; appropriate register for a case note"],
    ['Meaning Preservation', 0.4, "Confirms the verification request was received and logged; investigation is pending initial review; does not imply any findings"],
    ['Professional Tone', 0.2, "Neutral status update; sets expectation for the initial review process"]
  ],
  'eng-closure-q104': [
    ['Grammar & Mechanics', 0.4, "Grammatically correct; professional register maintained"],
    ['Meaning Preservation', 0.4, "States that the submitted document has expired; requests a valid replacement; accurately reflects that verification is blocked pending a current document"],
    ['Professional Tone', 0.2, "Polite, clear instruction; non-blaming tone"]
  ],
  'eng-closure-q105': [
    ['Grammar & Mechanics', 0.4, "Grammatically correct; clean punctuation and spelling throughout"],
    ['Meaning Preservation', 0.4, "Confirms the property listing details were found to be accurate based on the investigation; no discrepancy was found; case is resolved"],
    ['Professional Tone', 0.2, "Factual, neutral tone; confirms resolution"]
  ]
};

function buildRubric(criteria) {
  return 'rubric: { version: 1, criteria: [\n' +
    criteria.map(function(x) {
      return '      { name: "' + x[0] + '", weight: ' + x[1] + ', description: "' + x[2] + '" }';
    }).join(',\n') +
    '\n    ] }';
}

// Find all rubric blocks and their associated question IDs
var rubricRe = /rubric:\s*\{\s*version:\s*1,\s*criteria:\s*\[[\s\S]*?\]\s*\}/g;
var idRe = /"id":\s*"(eng-[^"]+)"/;
var replacements = [];
var m;

while ((m = rubricRe.exec(c)) !== null) {
  var searchWindow = c.substring(Math.max(0, m.index - 3000), m.index);
  var idMatch = searchWindow.match(idRe);
  if (idMatch && R[idMatch[1]]) {
    replacements.push({
      start: m.index,
      end: m.index + m[0].length,
      newRubric: buildRubric(R[idMatch[1]]),
      qId: idMatch[1]
    });
  }
}

// Sort by position descending so replacements don't shift earlier positions
replacements.sort(function(a, b) { return b.start - a.start; });

for (var i = 0; i < replacements.length; i++) {
  c = c.substring(0, replacements[i].start) + replacements[i].newRubric + c.substring(replacements[i].end);
}

fs.writeFileSync(fp, c, 'utf8');

console.log('=== Plan 10-06 Rubric Application ===');
console.log('Expected: 50 rubrics');
console.log('Replaced: ' + replacements.length + ' rubrics');
console.log('File: ' + fp);

// Verify weight sums
var verifyRe = /rubric:\s*\{\s*version:\s*1,\s*criteria:\s*\[([\s\S]*?)\]\s*\}/g;
var vm;
var weightFails = 0;
var totalCount = 0;
while ((vm = verifyRe.exec(c)) !== null) {
  totalCount++;
  var weights = [];
  var wm;
  var wRe = /weight:\s*([\d.]+)/g;
  while ((wm = wRe.exec(vm[1])) !== null) {
    weights.push(parseFloat(wm[1]));
  }
  var sum = weights.reduce(function(a, b) { return a + b; }, 0);
  if (Math.abs(sum - 1.0) > 0.01) {
    weightFails++;
    console.log('WEIGHT FAIL at position ' + totalCount + ': sum=' + sum);
  }
}

console.log('Total rubric blocks: ' + totalCount);
console.log('Weight sum failures: ' + weightFails);

if (totalCount !== 50) {
  console.error('FAIL: Expected 50 rubric blocks, got ' + totalCount);
  process.exit(1);
}
if (weightFails > 0) {
  console.error('FAIL: ' + weightFails + ' rubric(s) have weights not summing to 1.0 +/- 0.01');
  process.exit(1);
}

// Check for remaining generic skeleton descriptions
var genericDescs = [
  'Subject-verb agreement, tense, articles, punctuation, spelling. Common errors like double-negatives and dropped auxiliaries are resolved.',
  'Rewrite retains the original intent of the sentence and does not invent or omit facts.',
  'Register is suitable for a written case note or customer-facing message; no slang or informal contractions.',
  'Sentences are grammatically correct with appropriate punctuation and spelling; contractions and register are appropriate for a customer email.',
  'Polite, objective, helpful, non-defensive; personalizes to the customer\'s situation rather than defaulting to a generic template.',
  'Checks if the candidate addressed all constraints mentioned in the email prompt.',
  'Sentences are grammatically correct; punctuation and spelling are clean; register is appropriate for a customer closure message.',
  'Rewrite retains the original intent (customer failed to send screenshot; verification impossible).',
  'Polite, professional, empathetic; acknowledges the customer\'s concern before affirming the resolution.'
];
var genericHits = 0;
for (var g = 0; g < genericDescs.length; g++) {
  var count = (c.split(genericDescs[g]).length - 1);
  if (count > 0) {
    genericHits += count;
    console.log('Generic skeleton found (' + count + 'x): "' + genericDescs[g].substring(0, 60) + '..."');
  }
}

if (genericHits > 0) {
  console.error('FAIL: ' + genericHits + ' generic skeleton description(s) remain');
  process.exit(1);
}

console.log('OK: All 50 rubrics applied. No generic skeletons remain. Weights verified.');
