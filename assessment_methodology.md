# Gamified Fraud Support Assessment: Methodology, Scoring, & Proctoring Guide

This document provides a comprehensive overview of our gamified assessment platform for Fraud Support candidates. It details the structure of the assessment, how scoring and candidate recommendations are determined, what the proctoring system monitors, and how to interpret integrity events.

---

## 1. Core Competency Categories & The 8 Assessment Zones

The assessment is split into **8 distinct zones** that target three core competencies necessary for high-performance fraud support:

### A. Language & Communication (English)
Ensures the candidate can communicate clearly, grammatically, and professionally with customers while maintaining control of the tone.
*   **Zone 1: English - Grammar**
    *   *What it is:* Multiple-choice questions testing grammatical rules (e.g., subject-verb agreement, tenses, articles).
    *   *Time limit:* 60 seconds per question.
*   **Zone 2: English - Sentence Correction**
    *   *What it is:* Free-form typing exercise where candidates rewrite grammatically incorrect, poorly punctuated, or unprofessional sentences.
    *   *Time limit:* 60 seconds per question.
*   **Zone 3: English - Macro Editing**
    *   *What it is:* Practical editing where candidates refine pre-filled canned customer-service replies ("macros") to sound warm, empathetic, and professional instead of robotic.
    *   *Time limit:* 60 seconds per question.
*   **Zone 4: English - Reading Comprehension**
    *   *What it is:* Candidates read customer emails and cases, then answer questions testing their retention of critical details (dates, amounts, reference IDs).
    *   *Time limit:* 180 seconds per question.
*   **Zone 5: English - Case Closure Notes**
    *   *What it is:* Candidates select the final status of a completed case (e.g., Open, Pending, Solved) and write concise, professional summaries for internal records.
    *   *Time limit:* 60 seconds per question.

### B. Attention to Detail & Research (Attention)
Measures the candidate's ability to cross-reference multiple information sources, spot discrepancies, and catch subtle fraud flags.
*   **Zone 6: Attention to Detail (L1)**
    *   *What it is:* Candidates investigate a single-screen case dashboard. They click and expand cards (Transaction, Invoice, Customer Profile) to identify discrepancies or missing data.
    *   *Time limit:* 120 seconds per question.
*   **Zone 7: Attention to Detail (L2)**
    *   *What it is:* An advanced multi-tab interface (Customer Profile, Accounts, Notes, Transactions). Candidates must navigate between tabs to cross-reference name variations, matching reference numbers, or transaction timelines to spot inconsistencies.
    *   *Time limit:* 120 seconds per question.

### C. Decision Making & Logic (Critical Thinking)
Evaluates critical reasoning, risk assessment, and rule compliance under ambiguous scenarios.
*   **Zone 8: Critical Thinking Cases**
    *   *What it is:* Complex fraud-investigation scenarios. Candidates weigh risk signals (e.g., new login country + failed OTP + immediate password reset) and choose the best escalation, communication, or account-action pathway.
    *   *Time limit:* 180 seconds per question.

---

## 2. How Scoring & Tiering Works

### Scoring Calculations (A2 Grading Policy)
The platform uses the **A2 Grading Policy**, which guarantees that a candidate's score is fair and accurate:
1.  **Exclusion of Ungraded Items:** Any question that remains ungraded (e.g., awaiting manual review, skipped, or excluded) is removed from both the numerator and the denominator of the score.
2.  **Competency Percentages:**
    *   **English Score:** $\frac{\text{Correct English Items}}{\text{Graded English Items}} \times 100$
    *   **Research Score:** $\frac{\text{Correct Research (Attention) Items}}{\text{Graded Research Items}} \times 100$
    *   **Critical Score:** $\frac{\text{Correct Critical Thinking Items}}{\text{Graded Critical Thinking Items}} \times 100$
3.  **Overall Percentage Score:**
    $$\text{Overall Score} = \frac{\text{Total Correct Items across all banks}}{\text{Total Graded Items across all banks}} \times 100$$

### The Three Recommendation Tiers
After scoring, the system automatically assigns one of three advisory tiers based on the candidate's performance profile:

| Recommendation Tier | Minimum Overall Score | Specific Competency Hurdles | Description |
| :--- | :---: | :--- | :--- |
| **Strong Fit** | **$\ge$ 80%** | **$\ge$ 75%** in Critical Thinking AND **$\ge$ 75%** in Attention to Detail | Candidates with high overall accuracy who excel specifically at research and decision-making. Highly recommended for immediate onboarding. |
| **Consider** | **$\ge$ 60%** | None | Candidates with good baseline performance. May have some skill gaps in complex/ambiguous scenarios but show potential with coaching. |
| **Not Recommended** | **< 60%** | None | Candidates who fall below the baseline accuracy threshold. Significant coaching or foundational training would be required. |

### How the System Considers These Tiers
*   **Advisory Only (No Auto-Actions):** The recommendation tier is strictly advisory. The system **never auto-rejects** candidates. All candidates remain in the pipeline for final human recruiter validation.
*   **Narrative Insights:** The system automatically generates a qualitative text summary detailing candidate strengths and coaching opportunities based on their performance on **complex difficulty-tier** questions.
*   **Recruiter Override & Auto-Recalculation:** Recruiters can review specific candidate answers and manually override a graded verdict (e.g., changing an "Incorrect" to "Correct" for a creative but valid closure note). When a verdict is changed, the system automatically recalculates the overall score, competency scores, narrative insight, and recommendation tier in real-time.

---

## 3. Proctoring Capabilities (What is Captured)

To protect the integrity of the assessment, a suite of client-side sensors monitors candidate behavior during the test:

1.  **Tab Switching (Window Blur):** Tracks each time the candidate moves away from the assessment tab (e.g., switching tabs, opening another application, or clicking on another monitor). The system captures the timestamp and the exact duration of the tab switch in seconds.
2.  **Copy, Cut, and Paste Detection:** Monitors and logs any attempt to copy text out of the test environment or paste external text into the input fields (e.g., copying questions to search engines or pasting AI-generated text).
3.  **Developer Tools Detection:** Runs active heuristics measuring the difference between the browser window's outer and inner dimensions. If the difference exceeds 160 pixels, the system logs a potential developer-tools opening event.
4.  **Fullscreen Exit:** The assessment enforces fullscreen mode as a pre-flight condition. If a candidate exits fullscreen during the assessment, it is logged.
5.  **Webcam & Face Proctoring (TensorFlow BlazeFace):** When enabled, the system uses the candidate's webcam to perform client-side face recognition every 3 seconds. It logs:
    *   *No Face Detected:* The candidate has left the webcam frame or covered their camera.
    *   *Multiple Faces Detected:* Another person is visible in the frame assisting the candidate.

---

## 4. Guidelines for Evaluating Integrity Violations

All proctoring events are logged **silently** in the background. The candidate is never interrupted, warned, or locked out during the test, ensuring a stress-free environment. Recruiters can view the total **Violation Count** and detail logs in the Admin Dashboard.

### Interpretation Matrix for Recruiters & Management

| Violation Type | Risk Level | Common Benign Causes | When to Treat as a Red Flag |
| :--- | :---: | :--- | :--- |
| **Single / Brief Tab Switch** | **Low** | Clicking an OS system notification, system update prompt, or volume slider. | High frequency of switches (e.g., >10 times) or long cumulative blur durations (e.g., >60 seconds total) during complex questions. |
| **Fullscreen Exit** | **Low** | Accidental Esc key press, OS notifications, or browser pop-up. | Fullscreen exit immediately followed by a long tab-switch or copy-paste event. |
| **Copy / Cut / Paste** | **Medium** | Attempting to copy a text snippet to read/highlight it, or copying internal reference IDs provided inside a question. | Pasting long blocks of text into free-form boxes (indicates copy-pasting answers from external documents or translation engines). |
| **Dev Tools Check** | **Medium** | Resizing the browser window to fit a split-screen layout. | Recurrent resize events during critical thinking or research zones. |
| **Webcam: No Face** | **Medium** | Adjusting posture, picking up a pen, or leaning away to read notes. | Camera covered or face missing for extended periods (multiple consecutive 3-second logs). |
| **Webcam: Multiple Faces** | **High** | Family member walking in the background of a home environment. | Active conversation or multiple faces looking at the screen for prolonged periods. |

### Management Recommendation
Do not auto-reject candidates based on a non-zero violation count. Treat proctoring logs as **risk markers**. A candidate with a high violation count (e.g., 8+ events) combined with high-risk events (pasting, multiple face logs, long tab switches) should be flagged for a follow-up interview or manual review of their screen recordings (if available) or narrative answers.
