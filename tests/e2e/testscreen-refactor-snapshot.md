# Smoke Check: TestScreen Refactor Validation

This document verifies that the mechanical extraction of zone-config and presentation sub-components from `TestScreen.tsx` preserves all existing interactive behaviors.

## Manual Verification Checklist

Below are the 5 flows most at risk from the component split. Verify each flow is byte-identical and visually correct.

### Flow 1: MCQ & Timer Progression (English Grammar)
1. **Action:** Start the assessment.
2. **Action:** Observe the English: Grammar overlay. Click "Begin Zone".
3. **Action:** Answer 3 English Grammar MCQs by clicking options.
4. **Observation:**
   - Verify the progress bar at the top updates (e.g. `Q1 of 50` to `Q2 of 50`).
   - Verify that clicking an option highlights it (border and background color change).
   - Verify the countdown timer resets to `60s` on each new question and decrements correctly.
   - Verify clicking "Submit Answer" advances to the next question.

### Flow 2: EP Part 4 (Macro Editing) Pre-population
1. **Action:** Advance to the English Proficiency Part 4 (Macro Editing) zone.
2. **Observation:**
   - Verify the instructions overlay details are correct for Macro Editing. Click "Begin Zone".
   - Verify the text area is automatically pre-populated with the baseline macro text (extracted from the stem's `Existing Macro:\n` marker).
   - Verify editing the text in place works correctly, and the input retains the cursor focus.

### Flow 3: EP Part 6 (Reading Comprehension) Split Panel
1. **Action:** Advance to the Reading Comprehension zone.
2. **Observation:**
   - Verify the guidelines overlay indicates a reading comprehension scenario. Click "Begin Zone".
   - Verify the layout renders in two columns (scenario on the left, question and options on the right).
   - Verify the left scenario panel has correct scrollbars and limits height to the standard dashboard.

### Flow 4: Critical Thinking Case file & CaseDashboard
1. **Action:** Advance to the Critical Thinking Cases zone.
2. **Observation:**
   - Verify the guidelines overlay correctly outlines the Critical Thinking cases details. Click "Begin Zone".
   - Verify that the left panel displays the scenario text and the right panel displays the collapsible, interactive `CaseDashboard` tabs.
   - Verify clicking different tabs inside `CaseDashboard` switches the content correctly without resetting or disturbing the MCQ selection state on the right.

### Flow 5: Zone Completion celebration & Guideline Transition Overlay
1. **Action:** Finish any of the zones.
2. **Observation:**
   - Verify the overlay appears in two phases:
     - Phase 1: Shows a "Zone Complete" celebration message with a progress check (e.g., `1 of 8 zones done`) and progress bar.
     - Phase 2: Clicking "Continue to Next Zone" transitions the overlay to show the "Begin Zone" guidelines for the next zone.
   - Verify that the countdown timer is paused while the overlays are active and resumes immediately upon clicking "Begin Zone".
