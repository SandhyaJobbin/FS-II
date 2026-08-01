# Phase 13 — Accessibility (F-05) & Remaining Polish — Pattern Map

**Mapped:** 2026-08-01
**Workstreams analyzed:** 4 (BUG-04, 999.1, 999.2, 999.3)
**In-repo analogs found:** 8 / 9  (WS4 partial — see §WS4 caveat)

---

## File Classification

| New / Modified File | Workstream | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|-----------|------|-----------|----------------|---------------|
| `assessment-app/src/components/ReportScreen.tsx` | BUG-04, 999.2 | component | request-response (render) | Self (in-file amber-notice block lines 181-204) | exact |
| `assessment-app/src/components/TestScreen.tsx` (extract-first refactor) | 999.1 | component | request-response | `assessment-app/src/components/case-dashboard/DashboardCards.tsx` (SectionShell sub-component pattern) | role-match |
| `assessment-app/src/components/test-screen/QuestionHeader.tsx` (new) | 999.1 | component (sub) | prop-forwarding | `DashboardCards.tsx:33-72` (SectionShell) | role-match |
| `assessment-app/src/components/test-screen/ScenarioBlock.tsx` (new) | 999.1 | component (sub) | prop-forwarding | `DashboardCards.tsx:33-72` (SectionShell) | role-match |
| `assessment-app/src/components/test-screen/OptionsList.tsx` (new) | 999.1 | component (sub) | prop-forwarding | `DashboardCards.tsx:33-72` (SectionShell) | role-match |
| `assessment-app/src/components/test-screen/ZoneOverlays.tsx` (new) | 999.1 | component (sub) | prop-forwarding | `DashboardCards.tsx:33-72` (SectionShell) | role-match |
| `assessment-app/src/components/test-screen/CaseFilePanel.tsx` (new) | 999.1 CT item 7 | component (sub) | prop-forwarding | `assessment-app/src/components/CaseDashboard.tsx` (existing wrapper) | exact |
| `assessment-app/src/components/test-screen/zoneConfig.ts` (new — data extract) | 999.1 refactor | config (data) | static | `TestScreen.tsx:38` (ZONE_CONFIG object literal) | exact |
| `assessment-app/src/app/globals.css` | 999.1 item 1 | config | static tokens | Self (`:root` block lines 3-20, `@theme inline` lines 22-30) | exact |
| `assessment-app/src/app/layout.tsx` | 999.1 item 1 (dev axe) | provider | boot-time | Self (RootLayout lines 20-33) | exact |
| `assessment-app/src/components/AxeDevReporter.tsx` (new, dev-only) | BUG-04 | provider | dev-only side-effect | `layout.tsx` (client boot pattern; no direct analog for axe) | no analog |
| `assessment-app/src/types/index.ts` (extend `Report`) | 999.2 | model | static | `TranscriptEntry` type already present (referenced by admin `TranscriptPanel`) | exact |
| `backend/AsyncGrading.gs` (extend `buildReportFromAttemptsRow`, redesign `buildReportHtml`/`buildCandidateEmail`/`buildRecruiterEmail`) | 999.2 + 999.3 | service | CRUD + transform | Read pattern: `backend/Code.gs:476-500` (`handleGetAttemptTranscript`); email "before": self lines 425-474 | exact (read) / no-analog (HTML redesign — see WS4 caveat) |
| `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (traceability + backlog close) | Phase-close | docs | static | `.planning/phases/11-recruiter-analytics-dashboard/11-04-PLAN.md` Task 4 (lines 175-190) | exact |

---

## Workstream 1 — BUG-04: ARIA landmarks + roles on ReportScreen.tsx

### File: `assessment-app/src/components/ReportScreen.tsx`

**Closest analog (in-file, just-committed Phase 10-05 amber notice):**
`ReportScreen.tsx:181-204` — the `motion.div` conditional block that renders when `report.ungradedCount > 0`.

**Extracted pattern — motion + role + icon-with-aria wrapper:**

```tsx
// Current shape at ReportScreen.tsx:183-204 — copy the framer wrapper +
// palette convention (border-amber-400/30 bg-amber-400/10) for any NEW
// role="region"/role="status" block. New landmarks add role + aria-label
// on the SAME element that holds the framer motion props.
<motion.div
  custom={5}
  variants={fadeUp}
  initial="hidden"
  animate="visible"
  className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 flex items-start gap-3"
>
  <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0"
       viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    ...
  </svg>
  <div className="flex flex-col gap-1">
    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
      Pending Review
    </span>
    <p className="text-slate-300 text-xs leading-relaxed">...</p>
  </div>
</motion.div>
```

**ARIA additions to layer on (planner instructions — no existing analog in codebase; codebase has zero ARIA today):**

| Element | Add | Rationale |
|---------|-----|-----------|
| Outer wrapper `<div className="w-full max-w-[580px]…">` (line 68) | `role="main"` + `aria-labelledby="report-heading"` | Landmark |
| Header `motion.div` (line 74) — put `id="report-heading"` on the `<h2>` (line 90) | — | Anchors main label |
| Each `motion.div` block (lines 99, 127, 143, 162, 183, 207) | `role="region"` + `aria-labelledby="<slug>-label"` — put the id on the existing `<span className="text-[10px] font-bold uppercase…">` label | Section landmark, reuses existing label text |
| `TraitBar` (lines 21-39) | `role="progressbar"`, `aria-valuenow={value}`, `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-label={`${label}: ${value}%`}` | WCAG progress bar |
| All decorative `<svg>` (lines 85, 190, 215) | `aria-hidden="true"` | Icon = decoration |
| Trait color indicators (lines 41-45) | Screen-reader text: append " (Strong / Moderate / Needs improvement)" — invisible span with `sr-only` | Color-only fix |

### New file: `assessment-app/src/components/AxeDevReporter.tsx` (dev-only)

**No in-repo analog for axe-core.** Closest boot-time pattern is `assessment-app/src/app/layout.tsx:20-33` (RootLayout server component that wraps `{children}` in `<body>`).

**Constraint (AGENTS.md, `assessment-app/AGENTS.md`):** "This is NOT the Next.js you know" — planner MUST read `node_modules/next/dist/docs/` before adding a client boundary. Use existing pattern: create `AxeDevReporter` as a `'use client'` component with `useEffect(() => { if (process.env.NODE_ENV === 'development') import('@axe-core/react').then(...) }, [])`, then render `<AxeDevReporter />` inside `<body>` in `layout.tsx`. Zero prod-bundle cost only if dynamic import is guarded.

---

## Workstream 2 — 999.1: Light theme + full-screen + EP Part 6 + CT case-file + zone-relative numbering + multi-select cue

### 2a. Extract-first refactor on `TestScreen.tsx` (1178 lines → split, zero behavior change)

**No in-repo analog for a component split.** The project has never done this pattern. Closest sub-component composition pattern:

**Analog:** `assessment-app/src/components/case-dashboard/DashboardCards.tsx:33-72` — `SectionShell` sub-component used by six sibling exports (`IdentityCard`, `ReviewCard`, `BookingCard`, `PropertyCard`, `ConnectedCard`, `ReportsCard`).

**Extracted pattern — sub-component with typed inline prop object + `useState` co-located:**

```tsx
// DashboardCards.tsx:33-72 — the exact prop-forwarding shape to mirror
function SectionShell({ icon, iconBg, iconColor, title, sourceTabs, empty, emptyText, children }: {
  icon: React.ReactNode; iconBg: string; iconColor: string; title: string;
  sourceTabs: string[]; empty: boolean; emptyText: string; children?: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={`bg-slate-900/60 border rounded-xl p-5 …`}>
      {/* header + body */}
      {!collapsed && (
        <div className="max-h-[360px] overflow-y-auto pr-1">{children}</div>
      )}
    </div>
  );
}

// Consumer: IdentityCard passes only the props the shell needs
export function IdentityCard({ section }: { section: SectionData }) {
  return (
    <SectionShell icon={<User />} iconBg="…" iconColor="…" title="…"
      sourceTabs={section.tabNames} empty={empty} emptyText="…">
      {/* children */}
    </SectionShell>
  );
}
```

**Apply to TestScreen split:** each new sub-component (`QuestionHeader`, `ScenarioBlock`, `OptionsList`, `ZoneOverlays`, `CaseFilePanel`) uses this exact shape — inline object-literal prop type, `useState` co-located ONLY if state is purely local, children pass-through for composition. Parent `TestScreen.tsx` keeps all shared state (answers, currentIdx, zone state) and passes props down.

**ZONE_CONFIG-as-data extract:** move the `ZONE_CONFIG: Record<string, ZoneConfig>` object (currently `TestScreen.tsx:38-…` — 8 zone entries with JSX icons) into `assessment-app/src/components/test-screen/zoneConfig.ts`. The `icon: React.ReactNode` field means the data file must import React — precedent: `DashboardCards.tsx:1-5` imports `React` alongside `@phosphor-icons/react`.

**Hard constraint (`assessment-app/AGENTS.md`):** breaking Next.js changes exist — planner MUST verify `node_modules/next/dist/docs/` before introducing client/server split, dynamic imports, or `'use client'` directive placement. TestScreen is already `'use client'` (line 1) so keeping sub-components in the same client boundary avoids the trap.

### 2b. Light theme migration — `assessment-app/src/app/globals.css`

**Analog: SAME FILE**, `globals.css:3-30` — CSS custom properties in `:root` + Tailwind v4 `@theme inline` block that aliases them to Tailwind color tokens.

**Current dark-value definitions (lines 3-20) — the palette that must swap:**

```css
:root {
  --background: #070a13;              /* → light e.g. #f8fafc */
  --foreground: #f8fafc;              /* → dark e.g. #0f172a */
  --bg-primary: #070a13;              /* → light */
  --card-bg: rgba(13, 21, 39, 0.65);  /* → e.g. rgba(255,255,255,0.85) */
  --card-border: rgba(255, 255, 255, 0.06); /* → rgba(15,23,42,0.08) */
  --accent: #00f2fe;                  /* keep or dim */
  --accent-glow: rgba(0, 242, 254, 0.25);
  --text-primary: #f8fafc;            /* → #0f172a */
  --text-secondary: #94a3b8;          /* → #475569 */
  --text-muted: #475569;              /* → #94a3b8 */
  --success: #10b981;                 /* keep */
  --error: #ef4444;                   /* keep */
  --error-bg: rgba(239, 68, 68, 0.08);
  --border-radius: 16px;
  --transition-speed: 0.3s;
}

@theme inline {                        /* Tailwind v4 — variables become bg-card, text-accent, etc. */
  --color-background: var(--background);
  --color-card:       var(--card-bg);
  --color-accent:     var(--accent);
  …
}
```

**Mechanical swap NOT sufficient.** Prior observation (951 1:41p) flags **70 hardcoded Tailwind classes** (`slate-900`, `slate-950`, `bg-slate-900/60`, `text-white`, `border-slate-800/60`, `text-slate-300`, etc.) directly in `.tsx` files across ReportScreen, TestScreen, DashboardCards, admin/page.tsx. Palette swap must be paired with per-component Tailwind class replacement OR migration to `bg-card` / `text-[var(--text-primary)]` tokens (some already partially adopted — see `ReportScreen.tsx:70` `bg-card`, `border-[var(--card-border)]`).

### 2c. Zone-relative numbering + multi-select cue

**In-file analog:** `TestScreen.tsx:540` (per assumption A9, `zoneQuestionCount` already computed at zone transition). Reuse the value in the header render. Multi-select cue: add label above OptionsList when `question.response_type === 'mcq_multi'`; no existing analog — treat as fresh code following the local Tailwind convention from `ReportScreen.tsx:172` badge pattern:

```tsx
<span className={`self-start inline-block font-bold text-sm px-3.5 py-1.5 rounded-md border ${tierClass}`}>
  Select all that apply
</span>
```

### 2d. CT case-file always available (item 7) + EP Part 6 rework (item 5)

**Analog:** existing `CaseDashboard.tsx` wrapper (63 lines) + `DashboardCards.tsx` `SectionShell` collapse behavior. For "always available" — render `<CaseFilePanel>` unconditionally for CT bank questions, fallback to the existing "Case file not yet available" message (`TestScreen.tsx:1049`).

---

## Workstream 3 — 999.2: Per-question breakdown on ReportScreen + backend transcript fetch

### 3a. Frontend: ReportScreen per-question breakdown

**Analog:** `assessment-app/src/app/admin/page.tsx:586-644` — the recruiter `TranscriptPanel` map over `transcriptEntries`. Cite lines 586-644 excerpt (verdict color/bg tokens, per-entry card):

```tsx
// admin/page.tsx:586-644 — the SHAPE to mirror on candidate side
{transcriptEntries.map((entry, idx) => {
  const verdictColor = entry.verdict === 'correct' ? 'text-emerald-400' :
    entry.verdict === 'incorrect' ? 'text-red-400' : 'text-amber-400';
  const verdictBg = entry.verdict === 'correct' ? 'bg-emerald-400/10 border-emerald-400/20' :
    entry.verdict === 'incorrect' ? 'bg-red-400/10 border-red-400/20' : 'bg-amber-400/10 border-amber-400/20';
  return (
    <div key={`${entry.qId}-${idx}`}
         className={`bg-slate-900/50 border rounded-lg p-3 text-xs`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="font-mono text-[10px] text-slate-500">{entry.qId}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${verdictBg} ${verdictColor}`}>
          {entry.verdict}
        </span>
      </div>
      {/* admin ONLY: rationale, override controls */}
      {entry.rationale && (
        <p className="text-slate-400 text-[10px] leading-relaxed mt-1 italic">
          {entry.rationale}
        </p>
      )}
    </div>
  );
})}
```

**LOCKED CONTRACT — candidate side (planner must enforce):**
- SHOW: `qId`, `verdict`, `criteriaMet[]` (checkbox-style list of `{criterionName, met}` with checkmark/x icons)
- WITHHOLD: `rationale`, `overrideVerdict`, override buttons, `overrideAt` — these are recruiter-only per Phase 10 contract
- Rendering guard: `{report.transcripts && report.transcripts.length > 0 && <BreakdownSection …/>}` — defensive fallback if backend returns `transcripts: []`

### 3b. Backend: `buildReportFromAttemptsRow` extension

**Existing function to extend:** `backend/AsyncGrading.gs:394-421` — currently reads only the `Attempts` sheet row and returns 12 fields (attemptId, name, email, overallScore, traitScores, recommendationTier, narrativeInsight, violationCount, ungradedCount).

**Read pattern analog:** `backend/Code.gs:476-500` — `handleGetAttemptTranscript(attemptId, token)`. Same sheet-scan idiom (linear scan of `getDataRange().getValues()`), same defensive missing-sheet guard, and identical row → object mapping. Copy this shape into `AsyncGrading.gs` (inline; no cross-file call needed since both files share global Apps Script scope):

```javascript
// backend/Code.gs:481-499 — copy this scan-and-map shape into
// buildReportFromAttemptsRow. NOTE the two defensive fallbacks:
//   1. transcriptsSheet == null  → return { success: true, transcript: [] }
//   2. JSON.parse(criteriaMet || "[]")  → never throw on empty cell
const transcriptsSheet = ss.getSheetByName("GradingTranscripts");
if (!transcriptsSheet) return { success: true, transcript: [] };

const data = transcriptsSheet.getDataRange().getValues();
const transcript = [];
for (let i = 1; i < data.length; i++) {
  if (data[i][0] === attemptId) {
    transcript.push({
      questionId: data[i][1],
      rubricVersion: data[i][2],
      verdict: data[i][3],
      criteriaMet: JSON.parse(data[i][4] || "[]"),
      rationale: data[i][5] || "",
      overrideVerdict: data[i][6] || null,
      overrideAt: data[i][7] || null
    });
  }
}
```

**Defensive fallback (locked decision):** `buildReportFromAttemptsRow` wraps this scan in try/catch and returns `transcripts: []` on any failure — ReportScreen renders conditionally. Planner must ensure the transcript payload sent to CANDIDATE strips `rationale` server-side too (defense-in-depth vs. frontend-only stripping).

**Type extension:** `assessment-app/src/types/index.ts` — `Report` interface gains `transcripts?: TranscriptEntry[]`. The `TranscriptEntry` type already exists in this file (used by admin panel today).

---

## Workstream 4 — 999.3: HTML email templates (candidate + recruiter)

### "Before" state in-repo

**File:** `backend/AsyncGrading.gs:425-474` — `buildReportHtml`, `buildCandidateEmail`, `buildRecruiterEmail`. Current shape (all inline string concat, `max-width: 600px`, `font-family: Arial, sans-serif`, `<table>` for trait scores, `<hr>` separator, `border:2px solid #f59e0b` amber-tier box):

```javascript
// backend/AsyncGrading.gs:428-447 — the "before" template shape.
// Redesign target: 640px, richer palette, per-zone score cards, tier badge,
// footer, plain-text fallback.  Table-based (no flexbox/grid) — the ONE
// invariant that MUST be preserved.
let html = ''
  + '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">'
  + '<h2 style="color:#1e293b;">Fraud Support Assessment Report</h2>'
  + '<p>Candidate: <strong>' + report.name + '</strong> (' + report.email + ')</p>'
  + '<p style="font-size:20px;"><strong>Overall Score: ' + report.overallScore + '%</strong></p>'
  + '<table style="width:100%; border-collapse:collapse; margin:12px 0;">'
  + '<tr><td style="padding:6px; border:1px solid #e2e8f0;">Language Ability</td>'
  +   '<td style="padding:6px; border:1px solid #e2e8f0;">' + report.traitScores.language + '%</td></tr>'
  + '</table>' … ;
```

**Send-call shape (do NOT change unless plain-text body is added):**
```javascript
MailApp.sendEmail(to, subject, "", { htmlBody: html });   // 4th-arg options; body="" → today's fallback is empty
```
Planner must populate the 3rd argument (plain-text body) — this is the "plain-text fallback" line item in 999.3.

### Reference implementation (out-of-repo)

**Referenced by CONTEXT.md:** `C:\Users\anoop\OneDrive\Desktop\apple\flagmail1\google-apps-script.js` — `buildResultsHtml()` pattern.

**⚠ WS4 CAVEAT — reference file VERIFIED PRESENT but does NOT contain `buildResultsHtml()`:**
- File exists at the cited path (401 lines).
- Grep for `buildResultsHtml`, `htmlBody`, `<div`, `<table`, `max-width`, `font-family`, `border-radius`, `sendEmail` in the file returned **zero hits** for `buildResultsHtml` and only one hit for `sendEmail` (in a comment).
- The reusable pattern was previously captured to user memory at `~/.claude/projects/…/memory/reference_flagmail1_html_email.md` (memory entry 938 references it as "reusable Apps Script HTML report-email pattern for backlog 999.3").
- **Planner action:** Before writing WS4 tasks, READ `reference_flagmail1_html_email.md` from user memory (it is the canonical template source, NOT the `google-apps-script.js` file). If that memory file is unavailable, planner falls back to designing WS4 from D-01…D-12 email decisions + the AsyncGrading.gs "before" shape above.

---

## Workstream 5 (cross-cutting) — REQUIREMENTS.md + ROADMAP.md close-out

**Analog:** `.planning/phases/11-recruiter-analytics-dashboard/11-04-PLAN.md` Task 4 (lines 175-190) — the exact traceability + backlog-entry update pattern used at Phase 11 close.

**Reuse verbatim:**
- Update `.planning/REQUIREMENTS.md` traceability rows (BUG-04, plus per-workstream traceability rows for 999.1/999.2/999.3 → Phase 13) — one scoped Edit per row.
- Update `.planning/ROADMAP.md` Phase 13 block: Requirements line, Plans line, plan checklist marked complete, and close out 999.1/999.2/999.3 backlog entries (mark shipped or file follow-up).
- Pattern shape reference: `11-04-PLAN.md:184-190` "For each of ADMIN-06…ADMIN-11 in the traceability table: …" — copy the loop shape, substitute Phase 13 IDs.

---

## Shared Patterns (cross-cutting)

### Framer motion + palette convention (frontend)
**Source:** `ReportScreen.tsx:74-94, 181-204`
**Apply to:** every new `motion.div` block in ReportScreen (WS1, WS3a). Cadence: `custom={n}` sequential 0..N, shared `fadeUp` variants (defined `ReportScreen.tsx:12-19`), `initial="hidden" animate="visible"`. Palette tier: amber for pending/warning, emerald for pass, red for fail.

### CSS variable + Tailwind v4 `@theme inline` (frontend theming)
**Source:** `assessment-app/src/app/globals.css:3-30`
**Apply to:** WS 2b. Change VALUES in `:root`, keep the `@theme inline` aliases. Downstream `.tsx` files that reference `bg-card`, `text-[var(--text-secondary)]` etc. get the new palette free; hardcoded Tailwind slate classes (70 occurrences flagged) must be migrated individually.

### Sheet-scan + defensive missing-sheet guard (Apps Script backend)
**Source:** `backend/Code.gs:476-500` (`handleGetAttemptTranscript`)
**Apply to:** WS 3b `buildReportFromAttemptsRow` GradingTranscripts read. The `if (!sheet) return […]` early-return + `JSON.parse(cell || "[]")` defensive parse are load-bearing.

### `assessment-app/AGENTS.md` Next.js caveat
**Constraint:** "This is NOT the Next.js you know" (`assessment-app/AGENTS.md:1-3`). Applies to:
- WS1 axe-core dev component (client-side dynamic import)
- WS 2a TestScreen extract (any new `'use client'` boundary or file-system routing change)
Planner MUST cite `node_modules/next/dist/docs/` reads before writing code that touches client boundaries, dynamic imports, metadata, or route conventions.

### File-size cap (project rule)
**Source:** `CLAUDE.md` "Keep files under 500 lines" (both root `CLAUDE.md` and user `~/CLAUDE.md`).
**Current violators — planner must reduce, not extend:**
- `assessment-app/src/components/TestScreen.tsx`: **1178 lines** — WS 2a extract-first refactor addresses this
- `backend/AsyncGrading.gs`: **760 lines** — WS 3b + WS4 will grow it further; planner should consider extracting email builders into a separate `.gs` file (Apps Script global scope allows) to stay under the cap
- `backend/Code.gs`: **20472 lines** — far above cap; not in Phase 13 scope but note for future

---

## No Analog Found

| File / Concern | Reason |
|----------------|--------|
| `AxeDevReporter.tsx` | Codebase has never used axe-core, jest-axe, or any a11y tooling. Closest boot-time pattern is bare `layout.tsx` — planner designs fresh. |
| WS4 email HTML redesign | Referenced external template (`flagmail1/google-apps-script.js`) does not contain `buildResultsHtml()`. Canonical pattern lives at user-memory file `reference_flagmail1_html_email.md` — planner must load that OR design from D-01…D-12 + AsyncGrading.gs current shape. |
| Zone-relative numbering + multi-select cue | Small-surface additions; use in-file Tailwind conventions (`ReportScreen.tsx:172` badge). |

---

## Files NOT To Touch (out-of-scope guardrail)

- `assessment-app/src/components/case-dashboard/DashboardCards.tsx` (Phase 4 territory; use as PATTERN source only — no edits)
- `assessment-app/src/components/CaseDashboard.tsx` (Phase 4 territory; wrapping-only reuse)
- `backend/Code.gs` handleOverrideVerdict / handleGetAttemptTranscript (Phase 10 recruiter contract — locked)
- Admin panel `TranscriptPanel` block (`assessment-app/src/app/admin/page.tsx:580-644`) — reuse SHAPE only for candidate breakdown; admin behavior unchanged
- `backend/AsyncGrading.gs:34-392` evaluateWithRubric + GradingTranscripts write path (Phase 10 backend — locked)
- Phase 9 scoring / tier logic (deterministic trait calc, narrative by complexity-difficulty — MUST remain unchanged; prior observation 737)

---

## Metadata

- **Analog search scope:** `assessment-app/src/`, `backend/`, `.planning/phases/11-*/`, user memory dir
- **Files scanned:** 8 primary + 3 reference
- **Pattern extraction date:** 2026-08-01

## PATTERN MAPPING COMPLETE
