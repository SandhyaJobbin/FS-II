/**
 * sync-check.ts
 *
 * Detects grading-logic drift between tests/grading/grading-engine.ts and
 * backend/Code.gs. Cannot do exact diff (TS vs GAS), so focuses on semantic
 * equivalence of scoring rules, tier thresholds, bank mappings, and constants.
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
// Both must use Math.round((correctCount / total) * 100)
has(
  "Scoring formula uses Math.round (mirror)",
  MIRROR,
  /Math\.round\(\(?correctCount\s*\/\s*total\w*\)?\s*\*\s*100\)/
);
has(
  "Scoring formula uses Math.round (Code.gs)",
  CODE_GS,
  /Math\.round\(\(?correctCount\s*\/\s*total\w*\)?\s*\*\s*100\)/
);

// ─── 2. Tier thresholds ─────────────────────────────────────────────────────
// Strong Fit: overall >= 80, critical >= 75, research >= 75
// Consider: overall >= 60
has("Strong Fit: overall >= 80 (mirror)", MIRROR, /overall\w*\s*>=\s*80/);
has("Strong Fit: critical >= 75 (mirror)", MIRROR, /critical\w*\s*>=\s*75/);
has("Strong Fit: research >= 75 (mirror)", MIRROR, /research\w*\s*>=\s*75/);
has("Consider: overall >= 60 (mirror)", MIRROR, /overall\w*\s*>=\s*60/);

has("Strong Fit: overall >= 80 (Code.gs)", CODE_GS, /overall\w*\s*>=\s*80/);
has("Strong Fit: critical >= 75 (Code.gs)", CODE_GS, /critical\w*\s*>=\s*75/);
has("Strong Fit: research >= 75 (Code.gs)", CODE_GS, /research\w*\s*>=\s*75/);
has("Consider: overall >= 60 (Code.gs)", CODE_GS, /overall\w*\s*>=\s*60/);

// ─── 3. Bank mapping ─────────────────────────────────────────────────────────
// attention → research trait, critical → critical trait, default → english
has("Bank mapping: attention → research (mirror)", MIRROR, /bank\s*===\s*["']attention["'][\s\S]{0,30}["']attention["']/);
has("Bank mapping: critical → critical (mirror)", MIRROR, /bank\s*===\s*["']critical["'][\s\S]{0,30}["']critical["']/);
has("Bank mapping: attention → research (Code.gs)", CODE_GS, /bank\s*===\s*["']attention["'][\s\S]{0,30}["']attention["']/);
has("Bank mapping: critical → critical (Code.gs)", CODE_GS, /bank\s*===\s*["']critical["'][\s\S]{0,30}["']critical["']/);

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

// Retry cap: recordQueueItemFailure's `newCount >= 3` permanent-failure
// condition (AsyncGrading.gs) vs queue-logic.ts's RETRY_CAP constant, which
// backs isPermanentlyFailed's threshold.
const asyncGsRetryCap = ASYNC_GS.match(/newCount\w*\s*>=\s*(\d+)/)?.[1] ?? "";
const asyncMirrorRetryCap = ASYNC_MIRROR.match(/RETRY_CAP\s*=\s*(\d+)/)?.[1] ?? "";
check("AsyncGrading retry cap", asyncMirrorRetryCap, asyncGsRetryCap);

// Batch cap: processGradingQueue's `.slice(0, 5)` (AsyncGrading.gs) vs
// queue-logic.ts's BATCH_CAP constant, which backs selectEligibleRows's cap.
const asyncGsBatchCap = ASYNC_GS.match(/\.slice\(\s*0\s*,\s*(\d+)\s*\)/)?.[1] ?? "";
const asyncMirrorBatchCap = ASYNC_MIRROR.match(/BATCH_CAP\s*=\s*(\d+)/)?.[1] ?? "";
check("AsyncGrading batch cap", asyncMirrorBatchCap, asyncGsBatchCap);

// Trigger cadence: installGradingTrigger's `everyMinutes(5)` call
// (AsyncGrading.gs is the sole source of truth for trigger installation).
has("AsyncGrading trigger cadence", ASYNC_GS, /\.everyMinutes\(\s*5\s*\)/);

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log("");
if (failures > 0) {
  console.error(`${failures} divergence(s) detected. Fix before merging.`);
  process.exit(1);
} else {
  console.log("All sync checks passed. No grading-logic drift detected.");
  process.exit(0);
}
