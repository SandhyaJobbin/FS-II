# Phase 13 — Discuss Summary

## Scope Decisions

### Included Workstreams (4)
1. **BUG-04 ARIA** — ReportScreen.tsx landmarks + roles + axe-core baseline
2. **999.1 Candidate UI/UX** — Light theme (single, no toggle), layout rethink (wider/breathing room), EP Part 6 re-review, AoD overflow fix, CT case file persistence, zone-wise numbering, mcq_multi indicator
3. **999.2 Richer narrative** — Per-question breakdown on ReportScreen from GradingTranscripts
4. **999.3 HTML email templates** — Table-based, 640px, tier badge, per-zone cards, plain-text fallback

### Already Satisfied (no work needed)
- 999.1 item 2 (zone instructions) — ZONE_CONFIG has whatToDo + examples
- 999.1 item 3 (zone transitions) — two-phase complete/brief overlay exists
- 999.1 item 4 (EP Part 4 macro pre-populate) — marker extraction already works

### Key User Decisions
- **Light theme only** — no toggle, no dark mode. Single light palette.
- **Layout rethink** — break out of cramped card, wider container, larger text, more breathing room
- **Zone-wise numbering** — "Question 3 of 12" instead of "Q1 of 105"
- **mcq_multi note** — "Select all that apply" visible indicator

## Assumptions Approved
A1–A10 + T1–T3 all confirmed.

## Codebase Findings
- ReportScreen.tsx: 240 lines, zero ARIA, no semantic headings
- TestScreen.tsx: 1178 lines, global numbering at line 981, isMulti flag at line 758 with no UI note
- AsyncGrading.gs: buildReportHtml minimal (lines 425-448), evaluateWithRubric produces criteriaMet/rationale
- DashboardCards.tsx: SectionShell already collapsible
- CaseDashboard.tsx: dark theme, 2-column grid
- No CSS variables, no theming system exists
