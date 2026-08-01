# Phase 13 — Accessibility (F-05) & Remaining Polish

## Phase Scope

Four workstreams bundled into one phase (user decision: include ALL backlog items):

| # | Workstream | Source | Status |
|---|-----------|--------|--------|
| 1 | **BUG-04: ARIA landmarks on ReportScreen.tsx** | REQUIREMENTS.md | Pending |
| 2 | **999.1: Candidate UI/UX redesign** (7 items from manager review) | BACKLOG | Partial — items 2,3,4 already done |
| 3 | **999.2: Richer strength/weakness detail** in reports | BACKLOG | Pending (backend data exists) |
| 4 | **999.3: HTML email templates** | BACKLOG | Pending |

---

## Workstream 1: BUG-04 — ARIA Landmarks on ReportScreen.tsx

**Target file:** `src/components/ReportScreen.tsx` (240 lines)

**Current state:** Zero ARIA usage across the entire codebase. No `aria-*`, `role=`, or landmark elements in any `.tsx` file.

**ReportScreen.tsx sections:**
- Header (h2 "Assessment Complete")
- Candidate Info (name/email/attemptId/overallScore)
- Trait Scores (3 TraitBar components — color-coded progress bars, no `role="progressbar"`)
- Out-of-the-Box Thinking (blockquote narrative)
- Recommendation Tier (advisory badge)
- Ungraded Notice (conditional amber warning)
- Integrity Index (violation count)
- Exit button

**Key a11y gaps:**
1. No ARIA landmarks (main, section, region)
2. No heading hierarchy — only one h2, section labels are styled spans
3. TraitBar: no `role="progressbar"`, no aria-valuenow/min/max/label
4. 3 SVG icons (checkmark, shield, warning) — no aria-hidden or role="img"+aria-label
5. Color-only indicators (traitColor green/amber/red) — no text alternative
6. No semantic structure for screen reader navigation

---

## Workstream 2: 999.1 — Candidate UI/UX Redesign

### Items already done (no work needed):
- **Item 2 (zone instructions):** ZONE_CONFIG in TestScreen.tsx has detailed `whatToDo` arrays and `example` objects for all 8 zones
- **Item 3 (zone transitions):** Two-phase 'complete'/'brief' overlay system already exists (lines 229-232, 621-629)
- **Item 4 (EP Part 4 Macro pre-populate):** Lines 560-571 extract text from "Existing Macro:\n" marker and pre-fill textarea

### Items needing work:

**Item 1 — Light theme default + full-screen layout:**
- No theme system exists. All styling hardcoded dark (slate-900/950 backgrounds, white text)
- No CSS variables for theming, no dark/light toggle
- Layout constrained — needs expansion to full screen

**Item 5 — EP Part 6 Reading Comprehension:**
- Currently: reading questions show scenario in left panel via inline div (lines 1017-1035) with `max-h-[420px] overflow-y-auto`
- Two-column grid layout: `grid-cols-[1.6fr_1fr]` (scenario left, question right)
- Manager wants: remove card layout, present email directly, add re-review button
- Zone config says "re-open scenario any time" but implementation unclear

**Item 6 — AoD text overflow + collapsible cards:**
- DashboardCards.tsx `SectionShell` already has `collapsed` state toggle (line 37)
- Content area has `max-h-[360px] overflow-y-auto` (line 66)
- Cards ARE collapsible — but text overflow in collapsed state may need review
- Need to verify overflow behavior is clean

**Item 7 — CT case file always available:**
- Line 1017: Both `reading` section AND `critical` bank questions show case content
- CT questions with tabs render same scenario div as reading (not CaseDashboard)
- Line 1049: Warning shown when CT has no tabs: "Case file not yet available"
- Need to verify: do all CT questions have tabs? If not, case file needs persistent access

---

## Workstream 3: 999.2 — Richer Strength/Weakness Detail

**Backend data already exists (Phase 10 code deployed):**
- `evaluateWithRubric()` in AsyncGrading.gs (lines 514-612) produces `{verdict, criteriaMet[], rationale}` per question
- GradingTranscripts sheet stores: attemptId, qId, rubricVersion, verdict, criteriaMet (JSON), rationale, overrideVerdict, overrideAt, overrideTokenHash
- `criteriaMet` is an array of `{criterionName, met: boolean, score: number}`

**What's missing:**
- `Report` type in `src/types/index.ts` does NOT include transcript data
- `buildReportFromAttemptsRow()` does not fetch GradingTranscripts
- ReportScreen.tsx has no transcript/per-question breakdown display
- Admin panel (not in this codebase) also needs updating

**Dependency note:** ROADMAP says "design together with Phase 10." Phase 10 backend is done; Phase 10 frontend (transcript panel, override UI) is not started. 999.2 can proceed for the candidate report display independently.

---

## Workstream 4: 999.3 — HTML Email Templates

**Current state (AsyncGrading.gs lines 425-474):**
- `buildReportHtml()`: minimal — single div with inline styles, basic table for trait scores, plain text paragraphs
- `buildCandidateEmail()`: wraps buildReportHtml, no violations
- `buildRecruiterEmail()`: adds amber border-box with tier + violation count
- Emails sent via `MailApp.sendEmail(to, subject, "", { htmlBody: ... })` — plain text body is empty string

**Reference implementation exists:** `C:\Users\anoop\OneDrive\Desktop\apple\flagmail1\google-apps-script.js` — `buildResultsHtml()` pattern with table-based layout, 640px max-width, tier badge, per-zone score cards, footer, plain-text fallback

**Constraints:**
- Google Apps Script MailApp: only `htmlBody` option, no CSS classes (must inline everything)
- Email clients: table-based layout required (no flexbox/grid), 640px max-width
- Must maintain D-01 through D-12 email design decisions from Phase 09

---

## Codebase Architecture Notes

- **Frontend:** Next.js app in `assessment-app/` — React + Tailwind CSS + framer-motion
- **Backend:** Google Apps Script in `backend/` — Code.gs + AsyncGrading.gs (shared global scope)
- **Components:** 7 total — AssemblyScreen, WelcomeScreen, ThankYouScreen, TestScreen (1178 lines), ReportScreen (240 lines), CaseDashboard (63 lines), case-dashboard/DashboardCards (386 lines)
- **Types:** `src/types/index.ts` — Report, TranscriptEntry, TraitScores, Tab, TableContent, Question
- **No existing a11y infrastructure:** no axe-core, no jest-axe, no aria patterns anywhere
- **No existing theme system:** all colors hardcoded in Tailwind classes
