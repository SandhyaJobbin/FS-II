/**
 * Analytics.gs
 * 
 * Cross-attempt data aggregation reducers and handleAdminAnalytics endpoint handler.
 * Reuses effectiveVerdict, READY_STATUSES, checkAdminAuth, and sheet names from
 * Code.gs and AsyncGrading.gs via Google Apps Script global scope.
 */

// D-03 Locked thresholds
var MIN_QUESTION_SAMPLES = 5;
var MIN_TREND_ATTEMPTS = 5;
var MIN_TREND_DAYS = 3;
var MIN_CORR_VIOLATIONS = 10;
var MIN_CORR_TOTAL = 20;
var MIN_BIAS_ATTEMPTS = 15;
var MIN_DISCRIM_READY = 8;

// Helper: Coerce overall score to a clean number
function getScore(val) {
  if (val === null || val === undefined || val === '') return null;
  var num = Number(val);
  return isFinite(num) ? num : null;
}

function buildScoreTrend(attempts) {
  var readyAttempts = attempts.filter(function(row) {
    return READY_STATUSES.includes(row[5]);
  });
  var pointsMap = {};

  readyAttempts.forEach(function(row) {
    var endTime = row[4];
    var score = getScore(row[7]);
    if (!endTime || score === null) return;

    var dateStr = '';
    if (endTime instanceof Date) {
      dateStr = endTime.toISOString().split('T')[0];
    } else {
      var d = new Date(endTime);
      if (!isNaN(d.getTime())) {
        dateStr = d.toISOString().split('T')[0];
      } else {
        var match = String(endTime).match(/^\d{4}-\d{2}-\d{2}/);
        if (match) dateStr = match[0];
      }
    }

    if (!dateStr) return;

    if (!pointsMap[dateStr]) {
      pointsMap[dateStr] = { sum: 0, count: 0 };
    }
    pointsMap[dateStr].sum += score;
    pointsMap[dateStr].count += 1;
  });

  var points = Object.keys(pointsMap).map(function(date) {
    return {
      date: date,
      avgScore: Math.round(pointsMap[date].sum / pointsMap[date].count),
      n: pointsMap[date].count
    };
  }).sort(function(a, b) {
    return a.date.localeCompare(b.date);
  });

  var distinctDays = points.length;
  var scoredAttempts = points.reduce(function(acc, p) {
    return acc + p.n;
  }, 0);
  var enough_data = scoredAttempts >= MIN_TREND_ATTEMPTS && distinctDays >= MIN_TREND_DAYS;

  return {
    enough_data: enough_data,
    threshold: MIN_TREND_ATTEMPTS,
    samples: scoredAttempts,
    thresholdNote: 'Requires ≥' + MIN_TREND_ATTEMPTS + ' attempts spanning ≥' + MIN_TREND_DAYS + ' distinct calendar days.',
    points: points
  };
}

function buildQuestionStats(responses, transcripts) {
  var transcriptMap = {};
  transcripts.forEach(function(row) {
    transcriptMap[row[0] + '_' + row[1]] = row;
  });

  var statsMap = {};
  var totalGraded = 0;

  responses.forEach(function(row) {
    var attemptId = row[0];
    var qId = row[1];
    var tRow = transcriptMap[attemptId + '_' + qId];

    // Build standard argument objects for effectiveVerdict
    var tArg = tRow ? { Verdict: tRow[3], OverrideVerdict: tRow[6] } : null;
    var rArg = { IsCorrect: row[3] };
    var verdict = effectiveVerdict(tArg, rArg);

    if (!statsMap[qId]) {
      statsMap[qId] = { correct: 0, incorrect: 0, ungraded: 0 };
    }

    if (verdict === 'correct') {
      statsMap[qId].correct += 1;
      totalGraded += 1;
    } else if (verdict === 'incorrect') {
      statsMap[qId].incorrect += 1;
      totalGraded += 1;
    } else {
      statsMap[qId].ungraded += 1;
    }
  });

  var rows = Object.keys(statsMap).map(function(qId) {
    var s = statsMap[qId];
    var sampleSize = s.correct + s.incorrect;
    var enough_data = sampleSize >= MIN_QUESTION_SAMPLES;
    var passRate = enough_data ? Math.round((s.correct / sampleSize) * 100) : null;
    return {
      qId: qId,
      correct: s.correct,
      incorrect: s.incorrect,
      ungraded: s.ungraded,
      sampleSize: sampleSize,
      passRate: passRate,
      enough_data: enough_data
    };
  });

  return {
    enough_data: totalGraded >= 5,
    threshold: MIN_QUESTION_SAMPLES,
    samples: totalGraded,
    rows: rows
  };
}

function buildViolationCorrelation(attempts) {
  var readyAttempts = attempts.filter(function(row) {
    return READY_STATUSES.includes(row[5]);
  });
  var points = [];
  var violationsCount = 0;

  readyAttempts.forEach(function(row) {
    var score = getScore(row[7]);
    if (score === null) return;
    var v = Number(row[11]) || 0;
    points.push({ v: v, s: score });
    if (v > 0) violationsCount += 1;
  });

  var samples = points.length;
  var enough_data = violationsCount >= MIN_CORR_VIOLATIONS || samples >= MIN_CORR_TOTAL;

  var r = null;
  var interpretation = 'weak';

  if (enough_data && samples > 1) {
    var sumV = points.reduce(function(sum, p) { return sum + p.v; }, 0);
    var sumS = points.reduce(function(sum, p) { return sum + p.s; }, 0);
    var meanV = sumV / samples;
    var meanS = sumS / samples;

    var num = 0;
    var denV = 0;
    var denS = 0;

    points.forEach(function(p) {
      var diffV = p.v - meanV;
      var diffS = p.s - meanS;
      num += diffV * diffS;
      denV += diffV * diffV;
      denS += diffS * diffS;
    });

    var den = Math.sqrt(denV * denS);
    r = den === 0 ? 0 : Number((num / den).toFixed(3));
    
    var absR = Math.abs(r);
    if (absR >= 0.5) interpretation = 'strong';
    else if (absR >= 0.2) interpretation = 'moderate';
  }

  return {
    enough_data: enough_data,
    threshold: MIN_CORR_VIOLATIONS,
    samples: samples,
    violationsCount: violationsCount,
    thresholdNote: 'Requires ≥' + MIN_CORR_VIOLATIONS + ' attempts with violations OR ≥' + MIN_CORR_TOTAL + ' total attempts.',
    points: points,
    r: r,
    interpretation: interpretation
  };
}

function buildDiscriminationIndex(attempts, responses, transcripts) {
  var readyAttempts = attempts
    .filter(function(row) {
      return READY_STATUSES.includes(row[5]);
    })
    .map(function(row) {
      return { id: row[0], score: getScore(row[7]) };
    })
    .filter(function(a) {
      return a.score !== null;
    });

  var readyCount = readyAttempts.length;
  var enough_data = readyCount >= MIN_DISCRIM_READY;

  if (!enough_data) {
    return {
      enough_data: false,
      threshold: MIN_DISCRIM_READY,
      samples: readyCount,
      rows: []
    };
  }

  var sorted = readyAttempts.slice().sort(function(a, b) {
    return a.score - b.score;
  });
  var qSize = Math.max(1, Math.round(readyCount * 0.25));

  var bottomIds = new Set(sorted.slice(0, qSize).map(function(a) { return a.id; }));
  var topIds = new Set(sorted.slice(sorted.length - qSize).map(function(a) { return a.id; }));

  var transcriptMap = {};
  transcripts.forEach(function(row) {
    transcriptMap[row[0] + '_' + row[1]] = row;
  });

  var questionGroupMap = {};

  responses.forEach(function(row) {
    var attemptId = row[0];
    var qId = row[1];
    var isTop = topIds.has(attemptId);
    var isBottom = bottomIds.has(attemptId);

    if (!isTop && !isBottom) return;

    var tRow = transcriptMap[attemptId + '_' + qId];
    var tArg = tRow ? { Verdict: tRow[3], OverrideVerdict: tRow[6] } : null;
    var rArg = { IsCorrect: row[3] };
    var verdict = effectiveVerdict(tArg, rArg);

    if (!questionGroupMap[qId]) {
      questionGroupMap[qId] = { topCorrect: 0, topTotal: 0, bottomCorrect: 0, bottomTotal: 0 };
    }

    if (verdict === 'correct') {
      if (isTop) {
        questionGroupMap[qId].topCorrect += 1;
        questionGroupMap[qId].topTotal += 1;
      } else {
        questionGroupMap[qId].bottomCorrect += 1;
        questionGroupMap[qId].bottomTotal += 1;
      }
    } else if (verdict === 'incorrect') {
      if (isTop) {
        questionGroupMap[qId].topTotal += 1;
      } else {
        questionGroupMap[qId].bottomTotal += 1;
      }
    }
  });

  var rows = Object.keys(questionGroupMap)
    .map(function(qId) {
      var g = questionGroupMap[qId];
      var sampleTop = g.topTotal;
      var sampleBottom = g.bottomTotal;
      
      var enoughTop = sampleTop >= MIN_QUESTION_SAMPLES;
      var enoughBottom = sampleBottom >= MIN_QUESTION_SAMPLES;
      
      var passTop = enoughTop ? Math.round((g.topCorrect / sampleTop) * 100) : 0;
      var passBottom = enoughBottom ? Math.round((g.bottomCorrect / sampleBottom) * 100) : 0;
      var delta = passTop - passBottom;

      return {
        qId: qId,
        passTop: passTop,
        passBottom: passBottom,
        delta: delta,
        sampleTop: sampleTop,
        sampleBottom: sampleBottom,
        enough_data: enoughTop && enoughBottom
      };
    })
    .filter(function(row) {
      return row.enough_data;
    })
    .sort(function(a, b) {
      return a.delta - b.delta;
    });

  return {
    enough_data: rows.length > 0,
    threshold: MIN_DISCRIM_READY,
    samples: readyCount,
    rows: rows
  };
}

function buildBiasSignals(attempts) {
  var readyAttempts = attempts.filter(function(row) {
    return READY_STATUSES.includes(row[5]);
  });
  var samples = readyAttempts.length;
  var enough_data = samples >= MIN_BIAS_ATTEMPTS;

  var getDist = function(arr, windowName) {
    var strong = 0, consider = 0, recommend = 0;
    arr.forEach(function(row) {
      var tier = row[12];
      if (tier === 'Strong Fit') strong += 1;
      else if (tier === 'Consider') consider += 1;
      else recommend += 1;
    });
    var total = arr.length || 1;
    return [
      { tier: 'Strong Fit', pct: Math.round((strong / total) * 100), n: strong, window: windowName },
      { tier: 'Consider', pct: Math.round((consider / total) * 100), n: consider, window: windowName },
      { tier: 'Not Recommended', pct: Math.round((recommend / total) * 100), n: recommend, window: windowName }
    ];
  };

  var allTime = getDist(readyAttempts, 'allTime');
  var last20Attempts = readyAttempts.slice(-20);
  var last20 = getDist(last20Attempts, 'last20');

  return {
    enough_data: enough_data,
    threshold: MIN_BIAS_ATTEMPTS,
    samples: samples,
    tierDistribution: last20.concat(allTime)
  };
}

function handleAdminAnalytics(token) {
  if (!checkAdminAuth(token)) {
    return { success: false, error: 'Unauthorized' };
  }

  var t0 = Date.now();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var attemptsSheet = ss.getSheetByName('Attempts');
  var responsesSheet = ss.getSheetByName('Responses');
  var transcriptsSheet = ss.getSheetByName('GradingTranscripts');

  if (!attemptsSheet || !responsesSheet || !transcriptsSheet) {
    return {
      success: false,
      error: 'One or more required sheets missing',
      meta: { totalAttempts: 0, ungradedTotal: 0, aggregationMs: Date.now() - t0 }
    };
  }

  var attemptsData = attemptsSheet.getDataRange().getValues().slice(1);
  var responsesData = responsesSheet.getDataRange().getValues().slice(1);
  var transcriptsData = transcriptsSheet.getDataRange().getValues().slice(1);

  var readyAttempts = attemptsData.filter(function(row) {
    return READY_STATUSES.includes(row[5]);
  });

  var ungradedTotal = readyAttempts.reduce(function(sum, row) {
    return sum + (Number(row[14]) || 0);
  }, 0);

  var scoreTrend = buildScoreTrend(attemptsData);
  var questionStats = buildQuestionStats(responsesData, transcriptsData);
  var violationCorrelation = buildViolationCorrelation(attemptsData);
  var discriminationIndex = buildDiscriminationIndex(attemptsData, responsesData, transcriptsData);
  var biasSignals = buildBiasSignals(attemptsData);

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    meta: {
      totalAttempts: readyAttempts.length,
      ungradedTotal: ungradedTotal,
      aggregationMs: Date.now() - t0
    },
    scoreTrend: scoreTrend,
    questionStats: questionStats,
    violationCorrelation: violationCorrelation,
    discriminationIndex: discriminationIndex,
    biasSignals: biasSignals
  };
}
