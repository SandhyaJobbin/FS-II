/**
 * sync-check.ts
 *
 * Detects grading-logic drift between tests/grading/grading-engine.ts and
 * backend/AsyncGrading.gs (scoring/tier/bank-mapping logic moved here from
 * Code.gs in plan 09-01), plus tests/async/queue-logic.ts vs the same file's
 * queue stage/retry/batch-cap logic. Cannot do exact diff (TS vs GAS), so
 * focuses on semantic equivalence of scoring rules, tier thresholds, bank
 * mappings, and constants.
 *
 * Exit code 0 = pass, 1 = divergence found.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const MIRROR = readFileSync(resolve(ROOT, "tests/grading/grading-engine.ts"), "utf-8");
const CODE_GS = readFileSync(resolve(ROOT, "backend/Code.gs"), "utf-8");
const ASYNC_MIRROR = readFileSync(resolve(ROOT, "tests/async/queue-logic.ts"), "utf-8");
const ASYNC_GS = readFileSync(resolve(ROOT, "backend/AsyncGrading.gs"), "utf-8");

let failures = 0;

function check(label: string, mirrorVal: string, gsVal: string) {
  if (mirrorVal !== gsVal) {
    console.error(`FAIL: ${label}`);
    console.error(`  mirror: ${mirrorVal}`);
    console.error(`  Code.gs: ${gsVal}`);
    failures++;
  } else {
    console.log(`PASS: ${label}`);
  }
}

function has(label: string, text: string, pattern: RegExp) {
  if (!pattern.test(text)) {
    console.error(`FAIL: ${label} — pattern not found`);
    failures++;
  } else {
    console.log(`PASS: ${label}`);
  }
}

// ─── 1. Scoring formula ─────────────────────────────────────────────────────
has(
  "Scoring formula uses Math.round (mirror)",
  MIRROR,
  /Math\.round\(\(?correctCount\s*\/\s*total\w*\)?\s*\*\s*100\)/
);
has(
  "Scoring formula uses Math.round (AsyncGrading.gs)",
  ASYNC_GS,
  /Math\.round\(\(?correctCount\s*\/\s*total\w*\)?\s*\*\s*100\)/
);

// ─── 2. Tier thresholds ─────────────────────────────────────────────────────
has("Strong Fit: overall >= 80 (mirror)", MIRROR, /overall\w*\s*>=\s*80/);
has("Strong Fit: critical >= 75 (mirror)", MIRROR, /critical\w*\s*>=\s*75/);
has("Strong Fit: research >= 75 (mirror)", MIRROR, /research\w*\s*>=\s*75/);
has("Consider: overall >= 60 (mirror)", MIRROR, /overall\w*\s*>=\s*60/);

has("Strong Fit: overall >= 80 (AsyncGrading.gs)", ASYNC_GS, /overall\w*\s*>=\s*80/);
has("Strong Fit: critical >= 75 (AsyncGrading.gs)", ASYNC_GS, /critical\w*\s*>=\s*75/);
has("Strong Fit: research >= 75 (AsyncGrading.gs)", ASYNC_GS, /research\w*\s*>=\s*75/);
has("Consider: overall >= 60 (AsyncGrading.gs)", ASYNC_GS, /overall\w*\s*>=\s*60/);

// ─── 3. Bank mapping ─────────────────────────────────────────────────────────
has("Bank mapping: attention → research (mirror)", MIRROR, /bank\s*===\s*["']attention["'][\s\S]{0,30}["']attention["']/);
has("Bank mapping: critical → critical (mirror)", MIRROR, /bank\s*===\s*["']critical["'][\s\S]{0,30}["']critical["']/);
has("Bank mapping: attention → research (AsyncGrading.gs)", ASYNC_GS, /bank\s*===\s*["']attention["'][\s\S]{0,30}["']attention["']/);
has("Bank mapping: critical → critical (AsyncGrading.gs)", ASYNC_GS, /bank\s*===\s*["']critical["'][\s\S]{0,30}["']critical["']/);

// ─── 4. Response type handling ───────────────────────────────────────────────
const mirrorTypes = ["mcq_single", "mcq_multi", "open_text", "hybrid"];
const missingInMirror = mirrorTypes.filter((t) => !MIRROR.includes(t));
if (missingInMirror.length > 0) {
  console.error(`FAIL: Mirror missing response types: ${missingInMirror.join(", ")}`);
  failures++;
} else {
  console.log("PASS: Mirror handles all 4 response types");
}

const missingInGs = mirrorTypes.filter((t) => !CODE_GS.includes(t));
if (missingInGs.length > 0) {
  console.error(`FAIL: Code.gs missing response types: ${missingInGs.join(", ")}`);
  failures++;
} else {
  console.log("PASS: Code.gs handles all 4 response types");
}

// ─── 5. ADMIN_TOKEN constant ─────────────────────────────────────────────────
try {
  const adminAuth = readFileSync(resolve(ROOT, "tests/admin/admin-auth.ts"), "utf-8");
  const mirrorToken = adminAuth.match(/ADMIN_TOKEN\s*=\s*"([^"]+)"/)?.[1] ?? "";
  const gsToken = CODE_GS.match(/ADMIN_TOKEN\s*=\s*"([^"]+)"/)?.[1] ?? "";
  check("ADMIN_TOKEN matches between admin-auth.ts and Code.gs", mirrorToken, gsToken);
} catch {
  console.error("FAIL: Could not read tests/admin/admin-auth.ts");
  failures++;
}

// ─── 6. AsyncGrading.gs / queue-logic.ts drift (T-09-11, D-09/D-10/D-11) ──────
const asyncGsRetryCap = ASYNC_GS.match(/newCount\w*\s*>=\s*(\d+)/)?.[1] ?? "";
const asyncMirrorRetryCap = ASYNC_MIRROR.match(/RETRY_CAP\s*=\s*(\d+)/)?.[1] ?? "";
check("AsyncGrading retry cap", asyncMirrorRetryCap, asyncGsRetryCap);

const asyncGsBatchCap = ASYNC_GS.match(/\.slice\(\s*0\s*,\s*(\d+)\s*\)/)?.[1] ?? "";
const asyncMirrorBatchCap = ASYNC_MIRROR.match(/BATCH_CAP\s*=\s*(\d+)/)?.[1] ?? "";
check("AsyncGrading batch cap", asyncMirrorBatchCap, asyncGsBatchCap);

has("AsyncGrading trigger cadence", ASYNC_GS, /\.everyMinutes\(\s*5\s*\)/);

// ─── 7. Rubric verdict enum discipline (Pitfall 1) ──────────────────────────
has("Rubric verdict enum restricted to correct/incorrect only", ASYNC_GS, /enum:\s*\[\s*["']correct["']\s*,\s*["']incorrect["']\s*\]/);

// ─── 8. evaluateWithRubric declares a rubric schema + locks LLM output shape ─
// The schema is declared as documentation of the expected shape. Runtime
// enforcement is via OpenRouter's response_format (json_object / json_schema)
// or Gemini's responseSchema — accept either since Phase 10 shipped on
// OpenRouter after Gemini free tier stopped working (see 10-07-SUMMARY).
has("evaluateWithRubric declares responseSchema variable", ASYNC_GS, /const\s+responseSchema\s*=/);
has("evaluateWithRubric locks LLM output shape", ASYNC_GS, /response_format|responseSchema\s*:/);

// ─── 9. GradingTranscripts column count matches mirror ───────────────────────
try {
  const rubricMirror = readFileSync(resolve(ROOT, "tests/grading/rubric-grader.ts"), "utf-8");
  const mirrorCount = rubricMirror.match(/TRANSCRIPT_COLUMN_COUNT\s*=\s*(\d+)/)?.[1] ?? "";
  const gsHeader = CODE_GS.match(/insertSheet\(["']GradingTranscripts["']\)[\s\S]*?appendRow\(\[([\s\S]*?)\]\)/);
  const gsCount = gsHeader ? String(gsHeader[1].split(",").filter((s: string) => s.trim().length).length) : "";
  check("GradingTranscripts column count", mirrorCount, gsCount);
} catch {
  console.error("FAIL: could not read tests/grading/rubric-grader.ts");
  failures++;
}

// ─── 10. No silent-true LLM fallback in AsyncGrading.gs ────────────────────
if (/results\[\w+\.qId\]\s*=\s*true/.test(ASYNC_GS) || /results\[req\.qId\]\s*=\s*true/.test(ASYNC_GS)) {
  console.error("FAIL: silent-true LLM fallback detected in AsyncGrading.gs — Phase 10 forbids this");
  failures++;
} else {
  console.log("PASS: no silent-true LLM fallback");
}

// ─── 11. Ungraded verdict propagated in AsyncGrading ─────────────────────────
has("Ungraded verdict propagated in AsyncGrading", ASYNC_GS, /["']ungraded["']/);

// ─── 12. handleOverrideVerdict uses LockService with 10000ms timeout ─────────
has("handleOverrideVerdict uses LockService with 10000ms timeout", CODE_GS, /handleOverrideVerdict[\s\S]{0,800}tryLock\(\s*10000\s*\)/);

// ─── 13. handleOverrideVerdict hashes token via SHA-256 ──────────────────────
has("handleOverrideVerdict hashes token via SHA-256", CODE_GS, /handleOverrideVerdict[\s\S]{0,800}SHA_256/);

// ─── 14. Mirror uses verdict-string llmResults (not boolean) ─────────────────
has("Mirror llmResults typed as verdict-string map", MIRROR, /llmResults\?*:\s*Record<string,\s*["']correct["']\s*\|\s*["']incorrect["']\s*\|\s*["']ungraded["']/);

// ─── 15. Mirror has ungradedCount in GradeResult ─────────────────────────────
has("Mirror GradeResult includes ungradedCount", MIRROR, /ungradedCount/);

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log("");
if (failures > 0) {
  console.error(`${failures} divergence(s) detected. Fix before merging.`);
  process.exit(1);
} else {
  console.log("All sync checks passed. No grading-logic drift detected.");
  process.exit(0);
}
