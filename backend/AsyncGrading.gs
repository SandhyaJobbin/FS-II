/**
 * AsyncGrading.gs
 * Google Apps Script Web App -- deferred half of the grading/report pipeline.
 *
 * Shares the same Apps Script project global scope as Code.gs (no import/require).
 * Reads PendingGrading rows enqueued by Code.gs's handleSubmitAnswers (plan 09-01),
 * runs the grading logic moved verbatim from the old synchronous handleSubmitAnswers,
 * and sends the candidate report + recruiter notification emails.
 *
 * Trigger entry point: processGradingQueue (installed once via installGradingTrigger,
 * never wired to doPost/doGet/initSheets -- manual one-time run only, see plan 09-06).
 */

// --- SCRIPT PROPERTIES ---
// Mirrors the GEMINI_API_KEY / FALLBACK_API_KEY pattern in Code.gs (lines 57-58).
const RECRUITER_EMAILS_RAW = PropertiesService.getScriptProperties().getProperty("RECRUITER_EMAILS") || "";

// --- RECRUITER RECIPIENT PARSING ---

function parseRecruiterEmails(raw) {
  if (!raw) return [];
  return raw.split(",").map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
}

// --- GRADING (moved verbatim from the old synchronous handleSubmitAnswers) ---

function gradeAndFinalizeAttempt(attemptId, submittedAnswersJson) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const attemptsSheet = ss.getSheetByName("Attempts");
  const attemptsData = attemptsSheet.getDataRange().getValues();

  let attemptRowIdx = -1;
  let attemptRow = null;
  for (let i = 1; i < attemptsData.length; i++) {
    if (attemptsData[i][0] === attemptId) {
      attemptRowIdx = i + 1;
      attemptRow = attemptsData[i];
      break;
    }
  }
  if (attemptRowIdx === -1) {
    throw new Error("Attempt not found: " + attemptId);
  }

  const frozenIds = JSON.parse(attemptRow[6]);
  const candidateAnswers = JSON.parse(submittedAnswersJson);
  const name = attemptRow[1];
  const email = attemptRow[2];

  const responsesSheet = ss.getSheetByName("Responses");
  const timestamp = new Date().toISOString();

  // --- GRADE-02: Per-bank counters (correct / total / complex-tagged) ---
  let correctCount = 0;
  let bankCorrect = { english: 0, attention: 0, critical: 0 };
  let bankTotal = { english: 0, attention: 0, critical: 0 };

  // GRADE-03: Track complex-difficulty items per-bank for narrative
  let complexCorrect = { english: 0, attention: 0, critical: 0 };
  let complexTotal = { english: 0, attention: 0, critical: 0 };

  const responseRows = [];

  // --- LLM PRE-PROCESSING ---
  const llmRequests = [];
  frozenIds.forEach(function(qId) {
    const q = QUESTIONS.find(function(item) { return item.id === qId; });
    if (!q) return;
    const candidateAnswer = candidateAnswers[qId];

    if (q.response_type === "open_text") {
      llmRequests.push({ qId: qId, prompt: q.stem, answer: candidateAnswer || "" });
    } else if (q.response_type === "hybrid") {
      let textPortion = "";
      if (candidateAnswer && typeof candidateAnswer === "object" && candidateAnswer.text) {
        textPortion = candidateAnswer.text;
      }
      llmRequests.push({ qId: qId, prompt: q.stem, answer: textPortion });
    }
  });

  const llmResults = evaluateOpenTextBatch(llmRequests);

  frozenIds.forEach(function(qId) {
    const q = QUESTIONS.find(function(item) { return item.id === qId; });
    if (!q) return;

    const candidateAnswer = candidateAnswers[qId];
    let isCorrect = false;

    // Map bank to major scoring category
    let category = "english";
    if (q.bank === "attention") category = "attention";
    if (q.bank === "critical") category = "critical";

    bankTotal[category]++;

    // GRADE-01: Deterministic grading -- pure function, no random/LLM step
    if (q.response_type === "mcq_single") {
      const correctOption = q.options.find(function(o) { return o.is_correct; });
      const correctLetter = correctOption ? correctOption.letter : "";
      isCorrect = !!(candidateAnswer && candidateAnswer.toString().toLowerCase() === correctLetter.toLowerCase());
    } else if (q.response_type === "mcq_multi") {
      const correctLetters = q.options
        .filter(function(o) { return o.is_correct; })
        .map(function(o) { return o.letter.toLowerCase(); })
        .sort();
      const submittedLetters = Array.isArray(candidateAnswer)
        ? candidateAnswer.map(function(a) { return a.toString().toLowerCase(); }).sort()
        : [];
      isCorrect = (JSON.stringify(correctLetters) === JSON.stringify(submittedLetters));
    } else if (q.response_type === "hybrid") {
      // hybrid: grade MCQ selection + LLM text portion
      const correctOption = q.options.find(function(o) { return o.is_correct; });
      const correctLetter = correctOption ? correctOption.letter : "";
      var selectedLetter = "";
      if (candidateAnswer && typeof candidateAnswer === "object" && candidateAnswer.selected) {
        selectedLetter = candidateAnswer.selected.toString().toLowerCase();
      } else if (candidateAnswer && typeof candidateAnswer === "string") {
        selectedLetter = candidateAnswer.toLowerCase();
      }
      const mcqCorrect = !!(selectedLetter && selectedLetter === correctLetter.toLowerCase());
      const textCorrect = llmResults[qId] === true;
      isCorrect = mcqCorrect && textCorrect;
    } else {
      // open_text: autograded by LLM
      isCorrect = llmResults[qId] === true;
    }

    if (isCorrect) {
      correctCount++;
      bankCorrect[category]++;
    }

    // GRADE-03: Track difficulty_tier === 'complex' items specifically (NOT level/section)
    if (q.difficulty_tier === "complex") {
      complexTotal[category]++;
      if (isCorrect) complexCorrect[category]++;
    }

    // GRADE-05: Log response -- never include is_correct from options or answer_key fields
    responseRows.push([
      attemptId,
      qId,
      JSON.stringify(candidateAnswer || ""),
      isCorrect ? 1 : 0,
      timestamp
    ]);
  });

  // Batch-write all responses (faster than individual appendRow calls)
  if (responseRows.length > 0) {
    const lastRow = responsesSheet.getLastRow();
    responsesSheet.getRange(lastRow + 1, 1, responseRows.length, 5).setValues(responseRows);
  }

  // --- GRADE-02: Trait score percentages ---
  const totalQuestions = frozenIds.length;
  const overallPercentage = totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const englishPct = bankTotal.english ? Math.round((bankCorrect.english / bankTotal.english) * 100) : 0;
  const researchPct = bankTotal.attention ? Math.round((bankCorrect.attention / bankTotal.attention) * 100) : 0;
  const criticalPct = bankTotal.critical ? Math.round((bankCorrect.critical / bankTotal.critical) * 100) : 0;

  // --- GRADE-04: Recommendation tier (advisory only -- never auto-executes a hire/reject decision) ---
  let recommendationTier = "Not Recommended";
  if (overallPercentage >= 80 && criticalPct >= 75 && researchPct >= 75) {
    recommendationTier = "Strong Fit";
  } else if (overallPercentage >= 60) {
    recommendationTier = "Consider";
  }

  // --- GRADE-03: Narrative insight -- driven exclusively by difficulty_tier === 'complex' items ---
  const globalComplexTotal = complexTotal.english + complexTotal.attention + complexTotal.critical;
  const globalComplexCorrect = complexCorrect.english + complexCorrect.attention + complexCorrect.critical;
  const globalComplexFailed = globalComplexTotal - globalComplexCorrect;

  let narrativeInsight;
  if (globalComplexTotal === 0) {
    // No complex-tagged items in this assembled set -- use overall performance proxy
    if (overallPercentage >= 85) {
      narrativeInsight = "Outstanding consistency across all question types. Completed every section with high accuracy and methodical reasoning.";
    } else if (overallPercentage >= 65) {
      narrativeInsight = "The candidate demonstrated solid baseline performance across all competency areas with room to develop in edge-case scenarios.";
    } else {
      narrativeInsight = "Performance indicates developing competency. Additional coaching on fraud-logic fundamentals and critical reasoning is recommended.";
    }
  } else if (globalComplexFailed === 0) {
    // Perfect on every complex/ambiguous item
    narrativeInsight = "Exceptional investigative intuition. Resolved all complex and ambiguous fraud scenarios successfully -- showing the kind of judgment that catches what others miss.";
  } else if (globalComplexFailed / globalComplexTotal < 0.25) {
    // <25% of complex items failed
    narrativeInsight = "Strong analytical reasoning under ambiguity. Maintained logical consistency when rules aren't explicitly clear -- a reliable signal for fraud-support readiness.";
  } else if (globalComplexFailed / globalComplexTotal < 0.6) {
    // 25-59% failed on complex items
    if (englishPct > 80 && criticalPct < 55) {
      narrativeInsight = "Excellent language precision, but encountered difficulty on ambiguous reasoning tasks. Targeted fraud-logic coaching would likely close the gap quickly.";
    } else {
      narrativeInsight = "Solid effort on standard questions with some hesitation on complex edge cases. Performance suggests the candidate would benefit from guided exposure to ambiguous fraud scenarios.";
    }
  } else {
    // >=60% of complex items failed
    narrativeInsight = "Struggled to maintain consistent reasoning under ambiguous conditions. Foundational fraud-logic training is recommended before a live support role.";
  }

  // --- Atomic batch-write scored columns ---
  // Sheet columns: H=8(Overall), I=9(Lang), J=10(Research), K=11(Critical), M=13(Tier), N=14(Narrative)
  attemptsSheet.getRange(attemptRowIdx, 8, 1, 4).setValues([[overallPercentage, englishPct, researchPct, criticalPct]]); // H:K
  attemptsSheet.getRange(attemptRowIdx, 13, 1, 2).setValues([[recommendationTier, narrativeInsight]]); // M:N

  // Mark grading stage complete. EndTime (column 5) is untouched -- plan 09-01 already set it at enqueue time.
  attemptsSheet.getRange(attemptRowIdx, 6).setValue("graded");

  // Get violation count (written separately by logIntegrity calls -- read fresh here)
  const violationCount = parseInt(attemptsSheet.getRange(attemptRowIdx, 12).getValue() || 0);

  // GRADE-05: Report shape -- zero answer-key fields exposed
  return {
    attemptId: attemptId,
    name: name,
    email: email,
    overallScore: overallPercentage,
    traitScores: {
      language: englishPct,
      research: researchPct,
      critical: criticalPct
    },
    recommendationTier: recommendationTier,
    narrativeInsight: narrativeInsight,
    violationCount: violationCount
  };
}

function buildReportFromAttemptsRow(attemptId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const attemptsSheet = ss.getSheetByName("Attempts");
  const data = attemptsSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === attemptId) {
      return {
        attemptId: data[i][0],
        name: data[i][1],
        email: data[i][2],
        overallScore: data[i][7],
        traitScores: {
          language: data[i][8],
          research: data[i][9],
          critical: data[i][10]
        },
        recommendationTier: data[i][12],
        narrativeInsight: data[i][13],
        violationCount: data[i][11]
      };
    }
  }

  throw new Error("Attempt not found: " + attemptId);
}

// --- EMAIL CONTENT BUILDERS ---

function buildReportHtml(report, options) {
  const includeViolations = !!(options && options.includeViolations);

  let html = ''
    + '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">'
    + '<h2 style="color:#1e293b;">Fraud Support Assessment Report</h2>'
    + '<p>Candidate: <strong>' + report.name + '</strong> (' + report.email + ')</p>'
    + '<p style="font-size:20px;"><strong>Overall Score: ' + report.overallScore + '%</strong></p>'
    + '<table style="width:100%; border-collapse:collapse; margin:12px 0;">'
    + '<tr><td style="padding:6px; border:1px solid #e2e8f0;">Language Ability</td><td style="padding:6px; border:1px solid #e2e8f0;">' + report.traitScores.language + '%</td></tr>'
    + '<tr><td style="padding:6px; border:1px solid #e2e8f0;">Attention to Detail / Research</td><td style="padding:6px; border:1px solid #e2e8f0;">' + report.traitScores.research + '%</td></tr>'
    + '<tr><td style="padding:6px; border:1px solid #e2e8f0;">Critical Thinking</td><td style="padding:6px; border:1px solid #e2e8f0;">' + report.traitScores.critical + '%</td></tr>'
    + '</table>'
    + '<p><strong>Recommendation Tier:</strong> ' + report.recommendationTier + '</p>'
    + '<p><strong>Narrative Insight:</strong> ' + report.narrativeInsight + '</p>';

  if (includeViolations) {
    html += '<hr style="margin:16px 0; border:none; border-top:1px solid #e2e8f0;">'
      + '<p><strong>Integrity Signal:</strong> ' + report.violationCount + ' violation(s) logged during the attempt.</p>';
  }

  html += '</div>';
  return html;
}

function buildCandidateEmail(report) {
  // D-01/D-03/D-04: full report, no violation/integrity data, styled HTML
  return {
    subject: "Your Fraud Support Assessment Results",
    htmlBody: buildReportHtml(report, { includeViolations: false })
  };
}

function buildRecruiterEmail(report, integritySummary) {
  // D-02: same report plus a tier-highlighted violation/integrity summary section
  const violationCount = integritySummary && typeof integritySummary.violationCount === "number"
    ? integritySummary.violationCount
    : report.violationCount;

  const summaryHtml = ''
    + '<div style="font-family: Arial, sans-serif; max-width:600px; margin:16px auto 0; padding:12px; border:2px solid #f59e0b; border-radius:8px;">'
    + '<p style="margin:0 0 6px; font-size:16px;"><strong>Recommendation Tier: ' + report.recommendationTier + '</strong></p>'
    + '<p style="margin:0;"><strong>Integrity/Violation Summary:</strong> ' + violationCount + ' violation(s) logged.</p>'
    + '</div>';

  return {
    subject: "New Candidate Assessment Report -- " + report.name + " (" + report.recommendationTier + ")",
    htmlBody: buildReportHtml(report, { includeViolations: true }) + summaryHtml
  };
}

// --- QUEUE DRAIN WORKER ---

function readEligiblePendingRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pendingSheet = ss.getSheetByName("PendingGrading");
  const data = pendingSheet.getDataRange().getValues();

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const stage = data[i][3];
    if (stage === "queued" || stage === "graded") {
      rows.push({
        rowIndex: i + 1,
        attemptId: data[i][0],
        submittedAnswersJson: data[i][1],
        stage: stage,
        attemptsCount: data[i][4],
        candidateEmailStatus: data[i][7],
        recruiterEmailStatus: data[i][8]
      });
    }
  }
  return rows;
}

function processGradingQueue() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return;
  }

  try {
    const batch = readEligiblePendingRows().slice(0, 5);
    batch.forEach(function(row) {
      try {
        processQueueItem(row);
      } catch (err) {
        recordQueueItemFailure(row, "unexpected: " + err);
      }
    });
  } finally {
    lock.releaseLock();
  }
}

function processQueueItem(row) {
  let report;

  if (row.stage !== "graded") {
    try {
      report = gradeAndFinalizeAttempt(row.attemptId, row.submittedAnswersJson);
    } catch (err) {
      recordQueueItemFailure(row, "grading: " + err);
      return;
    }
    setPendingGradingStage(row.rowIndex, "graded");
  } else {
    report = buildReportFromAttemptsRow(row.attemptId);
  }

  const candidateResult = sendCandidateEmailIfNeeded(row, report);
  sendRecruiterEmailIfNeeded(row, report);

  if (candidateResult === "failed") {
    recordQueueItemFailure(row, "candidate email failed");
    return;
  }
  if (candidateResult === "deferred") {
    // MailApp quota exhausted -- retry next run with Stage still "graded", no wasted retry budget
    return;
  }
  if (candidateResult === "sent") {
    setAttemptsStatus(row.attemptId, "emailed");
    setPendingGradingStage(row.rowIndex, "done");
  }
}

function sendCandidateEmailIfNeeded(row, report) {
  if (row.candidateEmailStatus === "sent") {
    return "sent";
  }
  if (MailApp.getRemainingDailyQuota() < 1) {
    return "deferred";
  }

  const email = buildCandidateEmail(report);
  try {
    MailApp.sendEmail(report.email, email.subject, "", { htmlBody: email.htmlBody });
    setPendingGradingColumn(row.rowIndex, 8, "sent");
    return "sent";
  } catch (err) {
    setPendingGradingColumn(row.rowIndex, 8, "failed");
    return "failed";
  }
}

function sendRecruiterEmailIfNeeded(row, report) {
  if (row.recruiterEmailStatus === "sent") {
    return "sent";
  }

  // D-06: empty/misconfigured RECRUITER_EMAILS fails safe -- never blocks the candidate path
  const recipients = parseRecruiterEmails(RECRUITER_EMAILS_RAW);
  if (recipients.length === 0) {
    setPendingGradingColumn(row.rowIndex, 9, "failed");
    return "failed";
  }

  if (MailApp.getRemainingDailyQuota() < 1) {
    return "deferred";
  }

  const email = buildRecruiterEmail(report, { violationCount: report.violationCount });
  try {
    // D-07: one comma-joined "to", not a loop of individual sends. D-08: default MailApp sender.
    MailApp.sendEmail(recipients.join(","), email.subject, "", { htmlBody: email.htmlBody });
    setPendingGradingColumn(row.rowIndex, 9, "sent");
    return "sent";
  } catch (err) {
    setPendingGradingColumn(row.rowIndex, 9, "failed");
    return "failed";
  }
}

function recordQueueItemFailure(row, reason) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pendingSheet = ss.getSheetByName("PendingGrading");
  const newCount = row.attemptsCount + 1;

  pendingSheet.getRange(row.rowIndex, 5, 1, 3).setValues([[newCount, String(reason).slice(0, 500), new Date().toISOString()]]);

  // D-11/D-12: 3-attempt cap -- terminal state, never sends an alert email
  if (newCount >= 3) {
    pendingSheet.getRange(row.rowIndex, 4).setValue("permanently_failed");
    setAttemptsStatus(row.attemptId, "grading_failed");
  }
}

function setPendingGradingStage(rowIndex, stage) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheetByName("PendingGrading").getRange(rowIndex, 4).setValue(stage);
}

function setPendingGradingColumn(rowIndex, column, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheetByName("PendingGrading").getRange(rowIndex, column).setValue(value);
}

function setAttemptsStatus(attemptId, status) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const attemptsSheet = ss.getSheetByName("Attempts");
  const data = attemptsSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === attemptId) {
      attemptsSheet.getRange(i + 1, 6).setValue(status);
      break;
    }
  }
}

// --- TRIGGER INSTALLATION ---
// Not reachable from doPost/doGet/initSheets -- manual one-time run only (plan 09-06 checkpoint).

function installGradingTrigger() {
  const already = ScriptApp.getProjectTriggers().some(function(t) {
    return t.getHandlerFunction() === "processGradingQueue";
  });
  if (already) {
    return;
  }
  ScriptApp.newTrigger("processGradingQueue").timeBased().everyMinutes(5).create();
}
