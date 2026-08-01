# Phase 13 — Assumptions

## Critical Assumptions (need user confirmation)

### A1: 999.1 Items 2, 3, 4 are already satisfied
Zone instructions (item 2), zone transitions (item 3), and EP Part 4 macro pre-populate (item 4) are already implemented in TestScreen.tsx. **Assume no further work needed on these three items.**

### A2: Light theme + layout rethink (item 1)
User wants: single light theme only (no toggle, no dark mode), break out of the cramped single-card layout, more breathing room, larger text. Assume:
- Replace all dark theme colors with a single light palette (no CSS variable toggle system)
- Rethink the question card layout — wider container, larger font sizes, more padding/margin
- English Proficiency sections especially need more spacious presentation
- "Expand to full screen" = remove max-width constraints, use full viewport width with comfortable margins
- This is a visual redesign, not just a color swap

### A3: EP Part 6 Reading Comprehension (item 5)
Manager says "remove card layout, present email directly, add re-review button." Assume:
- The current two-column layout (scenario left, question right) is acceptable
- "Present email directly" means the scenario content should render as a plain email-style block, not inside a dashboard card
- "Re-review button" = a button that re-opens/focuses the scenario panel while answering questions
- Do NOT restructure the question rendering — only the scenario display

### A4: AoD collapsible cards (item 6)
DashboardCards.tsx already has collapsible sections. Assume:
- The existing collapse/expand behavior is sufficient
- "Fix text overflow" means ensuring `max-h-[360px]` content scrolls cleanly without clipping
- No structural redesign of the card system needed

### A5: CT case file always available (item 7)
Currently CT questions with tabs show the scenario; CT questions without tabs show a warning. Assume:
- The issue is that some CT questions may not have `tabs` data, leaving the candidate without case access
- Fix: ensure the case file panel is always rendered for CT questions (even if minimal data)
- If no tabs exist, show a "Case file not available for this question" message (already exists at line 1049)

### A6: 999.2 scope — candidate report only
Phase 10 frontend (transcript panel, override UI) is NOT in this phase. Assume:
- 999.2 = add a per-question breakdown section to ReportScreen.tsx showing criteriaMet/rationale from GradingTranscripts
- Extend the `Report` type to include transcript data
- Extend `buildReportFromAttemptsRow()` in AsyncGrading.gs to fetch and return GradingTranscripts rows
- Admin panel changes are out of scope

### A7: 999.3 email template approach
Assume:
- Use table-based HTML layout (email client compatible), 640px max-width
- Follow the reference implementation pattern: tier badge, per-zone score cards, footer
- Include plain-text fallback body (currently empty string)
- Maintain all D-01 through D-12 email design decisions from Phase 09
- Both candidate and recruiter emails get redesigned

### A8: ARIA scope
BUG-04 targets ReportScreen.tsx only. Assume:
- Other components (TestScreen, WelcomeScreen, etc.) are out of scope for ARIA
- axe-core testing: use `@axe-core/react` runtime warnings in dev mode (lighter than full jest-axe test suite)
- Pass axe-core baseline = zero critical/serious violations on ReportScreen

### A9: Zone-wise question numbering
Currently shows global "Q1 of 105". User wants zone-relative progress like "Question 3 of 12" within the current zone. Assume:
- Track position within each zone (not just global currentIdx)
- Display format: "Question {zonePosition} of {zoneQuestionCount}"
- Zone progress bar remains (already shows zonesDoneCount/totalZones)
- The zoneQuestionCount is already calculated in the zone transition code (line 540)

### A10: Multi-select indicator for mcq_multi
Currently no visual cue that multiple answers are allowed. Assume:
- Add "Select all that apply" note above/below the options list when `response_type === 'mcq_multi'`
- Use clear, accessible styling (not just small text)
- This is a UX clarity fix, not a functional change

---

## Technical Assumptions

### T1: No new dependencies for theming
Use CSS custom properties + Tailwind's existing dark: prefix pattern. No additional theming library.

### T2: GradingTranscripts sheet exists
Phase 10 backend code creates and writes to GradingTranscripts. Assume the sheet exists in production with data.

### T3: Email HTML is in Apps Script only
Email template changes are in `backend/AsyncGrading.gs` only. No frontend email preview needed.
