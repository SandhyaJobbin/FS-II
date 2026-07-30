document.addEventListener("DOMContentLoaded", () => {
  const entryScreen = document.getElementById("entry-screen");
  const assemblyScreen = document.getElementById("assembly-screen");
  const testScreen = document.getElementById("test-screen");
  const form = document.getElementById("registration-form");
  const startBtn = document.getElementById("start-btn");
  const errorMessage = document.getElementById("error-message");
  const gasUrlInput = document.getElementById("gas-url");

  // Display elements on assembly screen
  const displayName = document.getElementById("display-name");
  const displayAttemptId = document.getElementById("display-attempt-id");
  const displayQCount = document.getElementById("display-q-count");
  const breakdownList = document.getElementById("breakdown-list");
  const resetSessionBtn = document.getElementById("reset-session-btn");
  const proceedBtn = document.getElementById("proceed-btn");

  // Test screen components
  const levelIndicator = document.getElementById("level-indicator");
  const progressBarFill = document.getElementById("progress-bar-fill");
  const progressText = document.getElementById("progress-text");
  const xpDisplay = document.getElementById("xp-display");
  const timerDisplay = document.getElementById("timer-display");
  const timerBadge = document.getElementById("timer-badge");
  const caseDashboard = document.getElementById("case-dashboard");
  const tabNavigation = document.getElementById("tab-navigation");
  const tabContent = document.getElementById("tab-content");
  const questionStem = document.getElementById("question-stem");
  const optionsContainer = document.getElementById("options-container");
  const optionsForm = document.getElementById("options-form");
  const testError = document.getElementById("test-error");
  const container = document.querySelector(".container");

  // Zone guidelines overlay elements
  const zoneOverlay = document.getElementById("zone-guidelines-overlay");
  const zoneIcon = document.getElementById("zone-guidelines-icon");
  const zoneBadge = document.getElementById("zone-guidelines-badge");
  const zoneTitle = document.getElementById("zone-guidelines-title");
  const zoneDesc = document.getElementById("zone-guidelines-desc");
  const zoneQCount = document.getElementById("zone-guidelines-qcount");
  const zoneTimer = document.getElementById("zone-guidelines-timer");
  const zoneBeginBtn = document.getElementById("zone-begin-btn");

  // Open-text and hybrid elements
  const openTextContainer = document.getElementById("open-text-container");
  const openTextInput = document.getElementById("open-text-input");
  const hybridTextContainer = document.getElementById("hybrid-text-container");
  const hybridTextInput = document.getElementById("hybrid-text-input");

  // State Variables
  let questions = [];
  let currentQuestionIndex = 0;
  let userAnswers = {};
  let timerVal = 0;
  let timerInterval = null;
  let cosmeticXp = 0;
  let lastZoneKey = null; // tracks current zone to detect transitions

  // --- Zone Configuration ---
  const ZONE_CONFIG = {
    "english/grammar": {
      badge: "Zone 1 of 8",
      title: "English: Grammar",
      desc: "Select the grammatically correct option for each question. Focus on subject-verb agreement, tense consistency, and proper usage.",
      timerLabel: "60s per question",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'
    },
    "english/sentence_correction": {
      badge: "Zone 2 of 8",
      title: "English: Sentence Correction",
      desc: "You will see a poorly written sentence. Rewrite it with correct grammar, punctuation, and professional tone. Type your corrected version in the text box.",
      timerLabel: "60s per question",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
    },
    "english/macro": {
      badge: "Zone 3 of 8",
      title: "English: Macro Editing",
      desc: "You will see a customer-service macro with grammar and tone issues. Rewrite the entire macro to fix errors and personalize the response. Type your improved version.",
      timerLabel: "60s per question",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'
    },
    "english/reading": {
      badge: "Zone 4 of 8",
      title: "English: Reading Comprehension",
      desc: "Read the passage carefully, then answer the multiple-choice questions that follow. Pay attention to details, main ideas, and implied meaning.",
      timerLabel: "180s per question",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>'
    },
    "english/closure": {
      badge: "Zone 5 of 8",
      title: "English: Case Closure Notes",
      desc: "Read the case scenario, select the correct case status (Open / Pending / Solved), then write a professional closure note summarizing the resolution.",
      timerLabel: "60s per question",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    },
    "attention/L1": {
      badge: "Zone 6 of 8",
      title: "Attention to Detail (L1)",
      desc: "Review the case dashboard on the left panel and answer questions about data consistency, missing information, and discrepancies.",
      timerLabel: "120s per question",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
    },
    "attention/L2": {
      badge: "Zone 7 of 8",
      title: "Attention to Detail (L2)",
      desc: "More complex case dashboards with multiple data tabs. Cross-reference information across tabs to find inconsistencies and answer accurately.",
      timerLabel: "120s per question",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>'
    },
    "critical/": {
      badge: "Zone 8 of 8",
      title: "Critical Thinking Cases",
      desc: "Analyze fraud investigation scenarios and select the best course of action. Consider risk factors, evidence quality, and proper escalation procedures.",
      timerLabel: "180s per question",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>'
    }
  };

  // Load configuration from local storage
  const savedGasUrl = localStorage.getItem("fs_gas_url");
  if (savedGasUrl) {
    gasUrlInput.value = savedGasUrl;
  }

  // Check if session is already active in this browser
  const savedAttemptId = localStorage.getItem("fs_attempt_id");
  const savedQuestions = localStorage.getItem("fs_questions");
  const savedName = localStorage.getItem("fs_name");
  const savedEmail = localStorage.getItem("fs_email");
  const savedTestActive = localStorage.getItem("fs_test_active");

  if (savedAttemptId && savedQuestions && savedName) {
    questions = JSON.parse(savedQuestions);
    
    // Enable Proceed button
    proceedBtn.disabled = false;
    proceedBtn.classList.remove("disabled");

    if (savedTestActive === "true") {
      // Jump straight into the test if already active
      startTest();
    } else {
      showAssemblyDetails(savedName, savedAttemptId, questions);
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorMessage.classList.add("hidden");
    
    const name = document.getElementById("candidate-name").value.trim();
    const email = document.getElementById("candidate-email").value.trim();
    const gasUrl = gasUrlInput.value.trim();

    if (!name || !email || !gasUrl) {
      showError("Please fill out all required fields.");
      return;
    }

    localStorage.setItem("fs_gas_url", gasUrl);

    startBtn.disabled = true;
    const btnText = startBtn.querySelector("span");
    const originalText = btnText.textContent;
    btnText.textContent = "Registering & Assembling...";

    try {
      const res = await fetch(gasUrl, {
        method: "POST",
        redirect: "follow",
        body: JSON.stringify({
          action: "startAttempt",
          name: name,
          email: email
        })
      });

      const result = await res.json();

      if (!result.success) {
        showError(result.error || "Failed to start assessment.");
        resetButton(originalText);
        return;
      }

      questions = result.questions;
      localStorage.setItem("fs_attempt_id", result.attemptId);
      localStorage.setItem("fs_name", name);
      localStorage.setItem("fs_email", email);
      localStorage.setItem("fs_questions", JSON.stringify(questions));

      // Reset test state variables
      currentQuestionIndex = 0;
      userAnswers = {};
      cosmeticXp = 0;
      localStorage.setItem("fs_current_index", 0);
      localStorage.setItem("fs_answers", JSON.stringify({}));
      localStorage.setItem("fs_xp", 0);

      // Enable proceed
      proceedBtn.disabled = false;
      proceedBtn.classList.remove("disabled");

      showAssemblyDetails(name, result.attemptId, questions);
    } catch (err) {
      console.error(err);
      showError("Connection failed. Check your Apps Script URL, make sure it is deployed as Web App to 'Anyone'.");
      resetButton(originalText);
    }
  });

  proceedBtn.addEventListener("click", () => {
    startTest();
  });

  resetSessionBtn.addEventListener("click", () => {
    clearTestSession();
    
    assemblyScreen.classList.add("hidden");
    entryScreen.classList.remove("hidden");
    resetButton("Begin Assessment");
  });

  function clearTestSession() {
    localStorage.removeItem("fs_attempt_id");
    localStorage.removeItem("fs_questions");
    localStorage.removeItem("fs_name");
    localStorage.removeItem("fs_email");
    localStorage.removeItem("fs_test_active");
    localStorage.removeItem("fs_current_index");
    localStorage.removeItem("fs_answers");
    localStorage.removeItem("fs_xp");
    localStorage.removeItem("fs_zone_resumed");

    document.getElementById("candidate-name").value = "";
    document.getElementById("candidate-email").value = "";
    
    proceedBtn.disabled = true;
    proceedBtn.classList.add("disabled");
    container.classList.remove("wide");
    clearInterval(timerInterval);
    lastZoneKey = null;
  }

  function resetButton(originalText) {
    startBtn.disabled = false;
    startBtn.querySelector("span").textContent = originalText;
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove("hidden");
  }

  function showAssemblyDetails(name, attemptId, qs) {
    entryScreen.classList.add("hidden");
    assemblyScreen.classList.remove("hidden");

    displayName.textContent = name;
    displayAttemptId.textContent = attemptId;
    displayQCount.textContent = `${qs.length} Questions`;

    // Calculate section counts
    const counts = {};
    qs.forEach(q => {
      const label = formatSectionName(q.bank, q.section, q.level);
      counts[label] = (counts[label] || 0) + 1;
    });

    // Populate breakdown list
    breakdownList.innerHTML = "";
    Object.keys(counts).forEach(label => {
      const li = document.createElement("li");
      
      const categorySpan = document.createElement("span");
      categorySpan.className = "category";
      categorySpan.textContent = label;

      const quotaSpan = document.createElement("span");
      quotaSpan.className = "quota";
      quotaSpan.textContent = `${counts[label]} Qs`;

      li.appendChild(categorySpan);
      li.appendChild(quotaSpan);
      breakdownList.appendChild(li);
    });
  }

  function formatSectionName(bank, section, level) {
    if (bank === "english") {
      switch (section) {
        case "grammar": return "English: Grammar";
        case "sentence_correction": return "English: Sentence Correction";
        case "macro": return "English: Macro Editing";
        case "reading": return "English: Reading Comprehension";
        case "closure": return "English: Case Closure Notes";
        default: return "English Section";
      }
    } else if (bank === "attention") {
      return `Attention to Detail (${level})`;
    } else if (bank === "critical") {
      return "Critical Thinking Cases";
    }
    return `${bank} - ${section}`;
  }

  // --- ACTIVE TEST ENGINE ---

  function startTest() {
    entryScreen.classList.add("hidden");
    assemblyScreen.classList.add("hidden");
    testScreen.classList.remove("hidden");
    localStorage.setItem("fs_test_active", "true");

    // Load saved question index / answers / XP if any
    const savedIdx = localStorage.getItem("fs_current_index");
    if (savedIdx !== null) {
      currentQuestionIndex = parseInt(savedIdx);
    }
    const savedAns = localStorage.getItem("fs_answers");
    if (savedAns !== null) {
      userAnswers = JSON.parse(savedAns);
    }
    const savedXp = localStorage.getItem("fs_xp");
    if (savedXp !== null) {
      cosmeticXp = parseInt(savedXp);
      xpDisplay.textContent = `${cosmeticXp} XP`;
    }

    // If resuming mid-test, skip zone guidelines overlay for the current zone
    if (currentQuestionIndex > 0) {
      localStorage.setItem("fs_zone_resumed", "true");
      // Pre-set lastZoneKey so we don't trigger zone overlay on resume
      const resumeQ = questions[currentQuestionIndex];
      if (resumeQ) {
        lastZoneKey = getZoneKey(resumeQ);
      }
    }

    // Disable right-click
    document.addEventListener("contextmenu", preventDefaultAction);

    // Setup window blur (integrity log)
    window.addEventListener("blur", logWindowBlur);

    loadQuestion(currentQuestionIndex);
  }

  function preventDefaultAction(e) {
    e.preventDefault();
  }

  function logWindowBlur() {
    const attemptId = localStorage.getItem("fs_attempt_id");
    const gasUrl = localStorage.getItem("fs_gas_url");
    if (!attemptId || !gasUrl) return;

    // Silent logging
    fetch(gasUrl, {
      method: "POST",
      body: JSON.stringify({
        action: "logIntegrity",
        attemptId: attemptId,
        logType: "tab_switch",
        details: {
          timestamp: new Date().toISOString(),
          description: "Candidate switched tab or window blurred"
        }
      })
    }).catch(err => console.error("Silent log failed", err));
  }

  function loadQuestion(index) {
    testError.classList.add("hidden");
    if (index >= questions.length) {
      finishTest();
      return;
    }

    currentQuestionIndex = index;
    localStorage.setItem("fs_current_index", index);

    const q = questions[index];

    // 1. Level progress update
    updateHeaderProgress(q, index);

    // 2. Check for zone transition → show guidelines overlay
    const zoneKey = getZoneKey(q);
    if (zoneKey !== lastZoneKey) {
      lastZoneKey = zoneKey;
      // Only show overlay on fresh navigation (not on resume from localStorage)
      const isResuming = localStorage.getItem("fs_zone_resumed") === "true";
      if (!isResuming) {
        showZoneGuidelines(zoneKey, index, () => {
          // After user clicks "Begin Zone", render the actual question
          renderQuestionContent(q, index);
        });
        return; // Don't render question yet — wait for overlay dismiss
      }
      // Clear the resume flag after the first question loads on resume
      localStorage.removeItem("fs_zone_resumed");
    }

    // Render the question content directly (no zone transition)
    renderQuestionContent(q, index);
  }

  function updateHeaderProgress(q, index) {
    // Determine level name
    let levelName = "Level 1: English Proficiency";
    if (q.bank === "attention") {
      levelName = "Level 2: Attention to Detail";
    } else if (q.bank === "critical") {
      levelName = "Level 3: Critical Thinking";
    }
    levelIndicator.textContent = levelName;

    const pct = Math.round((index / questions.length) * 100);
    progressBarFill.style.width = `${pct}%`;
    progressText.textContent = `Q${index + 1} of ${questions.length}`;
  }

  function renderQuestionContent(q, index) {
    // 2b. Setup Case Tabs if present
    setupCaseTabs(q);

    // 3. Render Question Stem
    questionStem.textContent = q.stem;

    // 4. Render Options / Textarea
    renderOptions(q);

    // 5. Setup Timer
    startQuestionTimer(q);
  }

  function getZoneKey(q) {
    if (q.bank === "english") return "english/" + q.section;
    if (q.bank === "attention") return "attention/" + q.level;
    if (q.bank === "critical") return "critical/";
    return q.bank + "/" + (q.section || "");
  }

  function showZoneGuidelines(zoneKey, index, onBegin) {
    const config = ZONE_CONFIG[zoneKey];
    if (!config) {
      // Unknown zone — skip overlay
      onBegin();
      return;
    }

    // Count questions in this zone
    let zoneCount = 0;
    for (let i = index; i < questions.length; i++) {
      if (getZoneKey(questions[i]) === zoneKey) zoneCount++;
      else break;
    }

    // Populate overlay
    zoneIcon.innerHTML = config.icon;
    zoneBadge.textContent = config.badge;
    zoneTitle.textContent = config.title;
    zoneDesc.textContent = config.desc;
    zoneQCount.textContent = zoneCount + " question" + (zoneCount !== 1 ? "s" : "");
    zoneTimer.textContent = config.timerLabel;

    // Show overlay (hide test body)
    zoneOverlay.classList.remove("hidden");

    // Handle Begin button
    const handler = () => {
      zoneBeginBtn.removeEventListener("click", handler);
      zoneOverlay.classList.add("hidden");
      onBegin();
    };
    zoneBeginBtn.addEventListener("click", handler);
  }

  function setupCaseTabs(q) {
    if (q.tabs && Object.keys(q.tabs).length > 0) {
      container.classList.add("wide");
      caseDashboard.classList.remove("hidden");

      tabNavigation.innerHTML = "";
      const keys = Object.keys(q.tabs);
      
      keys.forEach((key, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tab-btn" + (idx === 0 ? " active" : "");
        btn.textContent = key;
        btn.addEventListener("click", () => {
          document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          tabContent.textContent = q.tabs[key];
        });
        tabNavigation.appendChild(btn);
      });

      // Default load first tab content
      tabContent.textContent = q.tabs[keys[0]];
    } else {
      container.classList.remove("wide");
      caseDashboard.classList.add("hidden");
    }
  }

  function renderOptions(q) {
    optionsContainer.innerHTML = "";
    openTextContainer.classList.add("hidden");
    hybridTextContainer.classList.add("hidden");
    openTextInput.value = "";
    hybridTextInput.value = "";

    // Check if we have pre-saved answer
    const savedAns = userAnswers[q.id] || null;

    if (q.response_type === "open_text") {
      // --- Open Text: show textarea only, hide MCQ ---
      openTextContainer.classList.remove("hidden");
      if (savedAns && typeof savedAns === "string") {
        openTextInput.value = savedAns;
      }
      return;
    }

    if (q.response_type === "hybrid") {
      // --- Hybrid: show MCQ options + closure note textarea ---
      hybridTextContainer.classList.remove("hidden");
      if (savedAns && typeof savedAns === "object" && savedAns.text) {
        hybridTextInput.value = savedAns.text;
      }
      // Fall through to render MCQ options below
    }

    // --- MCQ rendering (for mcq_single, mcq_multi, hybrid) ---
    const isMulti = q.response_type === "mcq_multi";

    q.options.forEach(opt => {
      const label = document.createElement("label");
      label.className = "option-card";

      const input = document.createElement("input");
      input.name = "option-select";
      input.value = opt.letter;
      input.type = isMulti ? "checkbox" : "radio";

      // Restore checked status
      if (savedAns) {
        if (q.response_type === "hybrid" && typeof savedAns === "object") {
          // Hybrid: savedAns is { selected: "c", text: "..." }
          if (savedAns.selected === opt.letter) {
            input.checked = true;
            label.classList.add("selected");
          }
        } else if (isMulti && Array.isArray(savedAns)) {
          if (savedAns.includes(opt.letter)) {
            input.checked = true;
            label.classList.add("selected");
          }
        } else if (savedAns === opt.letter) {
          input.checked = true;
          label.classList.add("selected");
        }
      }

      input.addEventListener("change", () => {
        if (!isMulti) {
          document.querySelectorAll(".option-card").forEach(c => c.classList.remove("selected"));
        }
        if (input.checked) {
          label.classList.add("selected");
        } else {
          label.classList.remove("selected");
        }
      });

      const letterSpan = document.createElement("span");
      letterSpan.className = "option-letter";
      letterSpan.textContent = opt.letter + ".";

      const textSpan = document.createElement("span");
      textSpan.className = "option-text";
      textSpan.textContent = opt.text;

      label.appendChild(input);
      label.appendChild(letterSpan);
      label.appendChild(textSpan);
      optionsContainer.appendChild(label);
    });
  }

  function startQuestionTimer(q) {
    clearInterval(timerInterval);

    // Dynamic duration mapping
    if (q.bank === "english") {
      timerVal = q.section === "reading" ? 180 : 60;
    } else if (q.bank === "attention") {
      timerVal = 120;
    } else if (q.bank === "critical") {
      timerVal = 180;
    } else {
      timerVal = 60;
    }

    updateTimerDisplay();

    timerInterval = setInterval(() => {
      timerVal--;
      updateTimerDisplay();

      if (timerVal <= 0) {
        clearInterval(timerInterval);
        autoSubmitAnswer();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    timerDisplay.textContent = `${timerVal}s`;
    
    // Clear styles
    timerBadge.className = "metric-badge timer-badge";

    if (timerVal <= 10) {
      timerBadge.classList.add("danger");
    } else if (timerVal <= 20) {
      timerBadge.classList.add("warning");
    }
  }

  optionsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    testError.classList.add("hidden");

    const q = questions[currentQuestionIndex];

    // Validation based on response type
    if (q.response_type === "open_text") {
      const textVal = openTextInput.value.trim();
      if (!textVal) {
        testError.textContent = "Please type your corrected answer to proceed.";
        testError.classList.remove("hidden");
        return;
      }
    } else if (q.response_type === "hybrid") {
      const inputs = document.querySelectorAll('input[name="option-select"]:checked');
      const textVal = hybridTextInput.value.trim();
      if (inputs.length === 0) {
        testError.textContent = "Please select a case status to proceed.";
        testError.classList.remove("hidden");
        return;
      }
      if (!textVal) {
        testError.textContent = "Please write a closure note to proceed.";
        testError.classList.remove("hidden");
        return;
      }
    } else {
      // MCQ validation
      const inputs = document.querySelectorAll('input[name="option-select"]:checked');
      if (inputs.length === 0) {
        testError.textContent = "Please select an answer to proceed.";
        testError.classList.remove("hidden");
        return;
      }
    }

    saveCurrentAnswer(q);

    // Animate XP badge
    cosmeticXp += 100;
    xpDisplay.textContent = `${cosmeticXp} XP`;
    localStorage.setItem("fs_xp", cosmeticXp);
    
    const xpBadge = document.querySelector(".cosmetic-xp");
    xpBadge.style.transform = "scale(1.15)";
    setTimeout(() => {
      xpBadge.style.transform = "scale(1)";
    }, 200);

    // Next question
    loadQuestion(currentQuestionIndex + 1);
  });

  function saveCurrentAnswer(q) {
    if (q.response_type === "open_text") {
      userAnswers[q.id] = openTextInput.value.trim();
    } else if (q.response_type === "hybrid") {
      const inputs = document.querySelectorAll('input[name="option-select"]:checked');
      const selectedLetter = inputs.length > 0 ? inputs[0].value : "";
      userAnswers[q.id] = {
        selected: selectedLetter,
        text: hybridTextInput.value.trim()
      };
    } else if (q.response_type === "mcq_multi") {
      const inputs = document.querySelectorAll('input[name="option-select"]:checked');
      const vals = Array.from(inputs).map(i => i.value);
      userAnswers[q.id] = vals;
    } else {
      const inputs = document.querySelectorAll('input[name="option-select"]:checked');
      userAnswers[q.id] = inputs.length > 0 ? inputs[0].value : "";
    }
    localStorage.setItem("fs_answers", JSON.stringify(userAnswers));
  }

  function autoSubmitAnswer() {
    const q = questions[currentQuestionIndex];
    saveCurrentAnswer(q);
    
    // Auto-advance
    loadQuestion(currentQuestionIndex + 1);
  }

  // --- TEST TERMINATION & GRADING REPORT ---

  async function finishTest() {
    clearInterval(timerInterval);
    document.removeEventListener("contextmenu", preventDefaultAction);
    window.removeEventListener("blur", logWindowBlur);
    container.classList.remove("wide");

    // Show submitting state
    testScreen.innerHTML = `
      <div class="success-header" style="margin: 40px 0;">
        <div class="success-icon" style="animation: pulse 1.5s infinite alternate;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="22 4 12 14 9 11"/>
          </svg>
        </div>
        <h2>Submitting Answers...</h2>
        <p class="subtitle" style="margin-top: 12px;">Evaluating responses and calculating integrity indexes.</p>
      </div>
    `;

    const attemptId = localStorage.getItem("fs_attempt_id");
    const gasUrl = localStorage.getItem("fs_gas_url");

    try {
      const res = await fetch(gasUrl, {
        method: "POST",
        redirect: "follow",
        body: JSON.stringify({
          action: "submitAnswers",
          attemptId: attemptId,
          answers: userAnswers
        })
      });

      const result = await res.json();

      if (!result.success) {
        showFinalError(result.error || "Submission failed.");
        return;
      }

      // Display detailed report
      renderReportScreen(result.report);
      
      // Clean up localStorage
      localStorage.removeItem("fs_attempt_id");
      localStorage.removeItem("fs_questions");
      localStorage.removeItem("fs_name");
      localStorage.removeItem("fs_email");
      localStorage.removeItem("fs_test_active");
      localStorage.removeItem("fs_current_index");
      localStorage.removeItem("fs_answers");
      localStorage.removeItem("fs_xp");
    } catch (err) {
      console.error(err);
      showFinalError("Submission failed. Connection lost or invalid Apps Script backend configuration.");
    }
  }

  function showFinalError(msg) {
    testScreen.innerHTML = `
      <div class="success-header" style="margin: 40px 0;">
        <div class="success-icon" style="background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.2); color: var(--error);">
          <span>!</span>
        </div>
        <h2>Submission Interrupted</h2>
        <p class="subtitle" style="margin-top: 12px; color: var(--error);">${msg}</p>
        <button id="retry-submit-btn" class="btn btn-primary" style="margin-top: 24px;">Retry Submission</button>
      </div>
    `;
    
    document.getElementById("retry-submit-btn").addEventListener("click", () => {
      finishTest();
    });
  }

  function renderReportScreen(report) {
    const recommendationColors = {
      "Strong Fit": "var(--success)",
      "Consider": "#fbbf24",
      "Not Recommended": "var(--error)"
    };
    
    const recBgColors = {
      "Strong Fit": "rgba(16, 185, 129, 0.1)",
      "Consider": "rgba(251, 191, 36, 0.1)",
      "Not Recommended": "rgba(239, 68, 68, 0.1)"
    };

    const color = recommendationColors[report.recommendationTier] || "var(--text-secondary)";
    const bg = recBgColors[report.recommendationTier] || "rgba(255,255,255,0.05)";

    testScreen.innerHTML = `
      <div class="success-header">
        <div class="success-icon" style="background: ${bg}; border-color: ${color}; color: ${color};">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <h2>Assessment Complete</h2>
        <p class="subtitle">Thank you for completing the Fraud Support hiring assessment.</p>
      </div>

      <div class="session-info" style="margin-top: 20px;">
        <div class="info-row">
          <span class="label">Name:</span>
          <span class="value">${report.name}</span>
        </div>
        <div class="info-row">
          <span class="label">Email:</span>
          <span class="value">${report.email}</span>
        </div>
        <div class="info-row">
          <span class="label">Attempt ID:</span>
          <span class="value font-mono">${report.attemptId}</span>
        </div>
        <div class="info-row" style="border-top: 1px solid var(--card-border); padding-top: 12px; margin-top: 4px;">
          <span class="label" style="font-weight: 600; color: var(--text-primary);">Overall Score:</span>
          <span class="value highlight" style="font-size: 16px; color: ${color};">${report.overallScore}%</span>
        </div>
      </div>

      <div class="bank-breakdown" style="margin-top: 20px;">
        <h3>Trait Metrics:</h3>
        <ul>
          <li>
            <span class="category">Language Expertise</span>
            <span class="quota">${report.traitScores.language}%</span>
          </li>
          <li>
            <span class="category">Attention to Detail & Research</span>
            <span class="quota">${report.traitScores.research}%</span>
          </li>
          <li>
            <span class="category">Logical & Critical Thinking</span>
            <span class="quota">${report.traitScores.critical}%</span>
          </li>
        </ul>
      </div>

      <div class="session-info" style="margin-top: 20px; border-left: 3px solid ${color}; background: rgba(255,255,255,0.01);">
        <h4 style="font-size: 13px; font-weight: 600; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 6px; letter-spacing: 0.5px;">Recommendation Action:</h4>
        <div style="font-size: 16px; font-weight: 700; color: ${color}; display: inline-block; padding: 4px 10px; border-radius: 4px; background: ${bg}; border: 1px solid ${color}44;">
          ${report.recommendationTier}
        </div>
        <p class="subtitle" style="margin-top: 10px; font-style: italic; font-size: 13px;">
          "${report.narrativeInsight}"
        </p>
      </div>

      <div class="session-info" style="margin-top: 20px; border-color: rgba(255, 255, 255, 0.05);">
        <div class="info-row">
          <span class="label">Integrity Index (Alerts):</span>
          <span class="value font-mono" style="color: ${report.violationCount > 2 ? 'var(--error)' : 'var(--text-secondary)'};">
            ${report.violationCount} warning event(s)
          </span>
        </div>
      </div>

      <div class="action-footer" style="margin-top: 24px;">
        <button id="exit-btn" class="btn btn-secondary" style="width: 100%;">Exit Assessment</button>
      </div>
    `;

    document.getElementById("exit-btn").addEventListener("click", () => {
      clearTestSession();
      // Reload page to start clean
      window.location.reload();
    });
  }
});
