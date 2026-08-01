# Phase 13: Accessibility (F-05) & Remaining Polish — Research

**Researched:** 2026-08-01
**Domain:** Frontend accessibility (WCAG 2.2 AA / ARIA), Tailwind v4 theming, React 19 patterns, Google Apps Script HTML email templates
**Confidence:** HIGH on ARIA/theming/email HTML; MEDIUM on axe-core tooling (React 19 compat gap discovered); MEDIUM on cross-workstream sequencing (Phase 10 backend liveness dependency)

---

## User Constraints (from CONTEXT.md)

### Locked Decisions
1. **Scope: 4 workstreams bundled into Phase 13**
   - BUG-04: ARIA on ReportScreen.tsx
   - 999.1: Candidate UI/UX redesign (only items 1, 5, 6, 7, plus zone-wise numbering and mcq_multi indicator; items 2, 3, 4 already shipped)
   - 999.2: Richer per-question strength/weakness detail on candidate ReportScreen from GradingTranscripts
   - 999.3: HTML email templates for both candidate and recruiter emails
2. **Light theme only — no toggle, no dark mode, single light palette (A2)**
3. **Layout rethink — remove `max-w-*` constraint, wider container, larger text, more breathing room (A2)**
4. **Zone-wise numbering — "Question 3 of 12" (A9) replacing global "Q1 of 105"**
5. **mcq_multi UX cue — "Select all that apply" indicator (A10)**
6. **EP Part 6 (item 5) — scenario becomes email-style block + re-review button (A3)**
7. **AoD (item 6) — verify existing `SectionShell` collapsible + `max-h-[360px]` scrolling is clean (A4)**
8. **CT case file (item 7) — ensure it renders even when tabs is empty; existing "Case file not yet available" line 1049 warning covers the fallback (A5)**
9. **ARIA scope — ReportScreen.tsx only. Other components out of scope for ARIA (A8)**
10. **999.3 — Table-based HTML email, 640px max-width, tier badge, per-zone score cards, plain-text fallback, preserve D-01…D-12 (A7)**

### Claude's Discretion
- Exact ARIA landmark structure on ReportScreen (main vs. article vs. region choice per section)
- Whether per-question breakdown on ReportScreen is one giant list or grouped-by-section collapsible (recommend the latter)
- File extraction strategy for TestScreen.tsx (already 1178 lines, adding item 5/mcq_multi/numbering pushes it further past 500-line CLAUDE.md cap)
- Light palette exact hex values (recommend WCAG AA-contrast slate on white)
- Email template exact hex per tier badge (must follow same tier→color mapping as ReportScreen)

### Deferred Ideas (OUT OF SCOPE)
- ARIA remediation of TestScreen.tsx, WelcomeScreen.tsx, ThankYouScreen.tsx, CaseDashboard.tsx, DashboardCards.tsx (A8 limits BUG-04 to ReportScreen only)
- Dark mode toggle / theme switcher (A2 explicit — light only)
- Admin panel changes for richer transcripts (Phase 10 backend flow only — A6)
- Zone-wise numbering elsewhere; only inside test-taking screen
- Automated a11y CI (jest-axe full suite) — A8 downscopes to runtime dev warnings only
- PDF export of report — v2 (ADMIN2-03)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| F-05 / BUG-04 | ARIA landmarks + roles on ReportScreen.tsx; passes axe-core baseline (0 critical/serious) | See §Workstream 1 — landmark plan + role plan + SVG icon strategy + progress-bar recipe |
| **New: A11Y-01** (recommend) | Zero critical/serious axe-core violations on ReportScreen | Wave 3 verification |
| **New: UX-01** (recommend) | Single light theme replaces hardcoded dark palette across TestScreen/ReportScreen/CaseDashboard/DashboardCards | §Workstream 2 Item 1 |
| **New: UX-02** (recommend) | Layout expands beyond `max-w-*` constraint with comfortable margins | §Workstream 2 Item 1 |
| **New: UX-03** (recommend) | EP Part 6 scenario renders as email-style block; re-review button re-focuses scenario | §Workstream 2 Item 5 |
| **New: UX-04** (recommend) | CT case file always accessible; existing empty-case fallback preserved | §Workstream 2 Item 7 |
| **New: UX-05** (recommend) | Zone-wise question numbering ("Question 3 of 12") replaces global count | §Workstream 2 Item 9 |
| **New: UX-06** (recommend) | Visible "Select all that apply" indicator on mcq_multi questions | §Workstream 2 Item 10 |
| **New: REPORT-03** (recommend) | Candidate ReportScreen surfaces per-question criteriaMet breakdown from GradingTranscripts (rationale withheld — see Tension §Workstream 3) | §Workstream 3 |
| **New: EMAIL-01** (recommend) | Table-based 640px HTML email for candidates & recruiters with tier badge, per-trait cards, plain-text fallback | §Workstream 4 |

*(All new IDs are recommended additions to REQUIREMENTS.md v1.1. F-05 is the only ID currently allocated. Planner should update the v1.1 Requirements section during the plan set and mirror them into ROADMAP Phase 13.)*

---

## Summary

Phase 13 bundles four independent workstreams that touch every candidate-facing surface: (1) BUG-04 ARIA remediation of ReportScreen.tsx (the only file explicitly required by REQUIREMENTS.md line 107); (2) 999.1's remaining UI/UX items that require a light-theme rewrite of hardcoded dark styles across TestScreen (1178 lines), ReportScreen (240 lines), CaseDashboard (63 lines), and DashboardCards (386 lines); (3) 999.2's richer per-question strength/weakness section on the candidate report, wiring `GradingTranscripts` sheet data (produced by Phase 10 already-deployed backend) into `buildReportFromAttemptsRow()` and the ReportScreen; (4) 999.3's HTML email redesign in AsyncGrading.gs following the flagmail1 reference implementation's table-based `buildResultsHtml` pattern.

Three tensions demand user resolution before planning: (a) **Phase 10 vs. Phase 13 disagreement on rationale exposure** — Phase 10 RESEARCH.md explicitly says "Never ship rationale to the candidate" (line 502) while Phase 13 A6 says "add per-question breakdown showing criteriaMet/rationale." Recommend showing `criteriaMet[]` to candidates but withholding the free-form `rationale` string; (b) **`@axe-core/react` does NOT support React 18+** — the assumption A8 to use `@axe-core/react` runtime warnings is invalid for this React 19 project; recommend either `axe-core` (core library, browser-invoked in dev via a useEffect wrapper) or Deque's `axe DevTools browser extension` for manual verification instead; (c) **CLAUDE.md 500-line cap** — TestScreen.tsx is 1178 lines and this phase adds material; recommend an extraction plan (see §Component Extraction Strategy).

Two operational risks: (i) 999.2 backend extension depends on `GradingTranscripts` being live in production — Phase 10 Task 10-07 (live deployment + verification) has not closed; Wave 3 of this phase cannot deploy until either 10-07 lands or a defensive fallback returns an empty transcripts array; (ii) ROADMAP.md Phase 13 entry (line 269–277) still says "small independent a11y remediation, no ordering constraint" and lists TBD requirements — this is now materially wrong. The planner must update ROADMAP.md as part of the plan set (analogous to how 11-04 rewrote the Phase 11 entry).

**Primary recommendation:** Split Phase 13 into 5 plans across 3 waves. Wave 0 (10-13-01): shared foundation — extract a light-theme palette into `globals.css` and create shared a11y utility patterns. Wave 1 (10-13-02 parallel with 10-13-03 parallel with 10-13-04): BUG-04 ARIA on ReportScreen; 999.1 light-theme + layout + zone-numbering + mcq_multi across TestScreen/CaseDashboard/DashboardCards (with a TestScreen extraction pass); 999.3 HTML emails in AsyncGrading.gs. Wave 2 (10-13-05): 999.2 backend + frontend transcript wiring (blocked on 10-07 verification OR defensive fallback). Wave 3 (10-13-06): deploy + verify + REQUIREMENTS/ROADMAP finalization.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| ARIA landmarks/roles | Browser (React JSX) | — | ReportScreen renders in-browser; semantics are DOM-level |
| Theme tokens (CSS vars) | Browser (CSS `@theme` block) | — | Tailwind v4 `@theme inline` in `globals.css` — no runtime toggle so no build step needed |
| Layout constraints (`max-w-*` removal) | Browser (React + Tailwind) | — | Purely presentational |
| Zone-wise numbering | Browser (TestScreen state) | — | Already computed in TestScreen (zone_position derivable from `activeZoneKey`) |
| "Select all that apply" indicator | Browser (TestScreen JSX conditional) | — | Trivial JSX guard `{isMulti && ...}` |
| Case-file always-available | Browser (TestScreen JSX) | — | Existing `hasTabs` guard already handles fallback (line 1049) |
| EP Part 6 email-style block + re-review | Browser (TestScreen) | — | Section-scoped conditional render |
| Per-question transcript data on ReportScreen | Backend (Apps Script) → Browser (React) | — | Backend must fetch GradingTranscripts rows; frontend renders |
| HTML email template | Backend (Apps Script `buildReportHtml`) | — | Runs in Apps Script V8; string concatenation only, no build step |
| Plain-text email fallback | Backend (Apps Script `MailApp.sendEmail`) | — | Currently empty string arg to sendEmail |
| axe-core runtime verification | Browser (dev-mode only) | — | Should NOT execute in production build |

---

## Standard Stack

### Core (already present — no install needed)
| Library | Version (verified) | Purpose | Why Standard |
|---------|--------------------|---------|--------------|
| React | 19.2.4 | JSX, ARIA idioms | Verified `assessment-app/package.json` |
| Next.js | 16.2.12 | App shell | Verified `assessment-app/package.json`; **note `assessment-app/AGENTS.md` warning: "This is NOT the Next.js you know" — read `node_modules/next/dist/docs/` before writing Next.js-specific code** |
| Tailwind CSS | ^4 (v4.x) | Styling | Verified via `@tailwindcss/postcss ^4` in devDeps; `@import "tailwindcss"` + `@theme inline {}` block already used in `globals.css` |
| framer-motion | ^12.43.0 | Animations already used on ReportScreen | Verified; keep as-is, ensure animations respect `prefers-reduced-motion` |
| @phosphor-icons/react | ^2.1.10 | Icon system | Available but ReportScreen currently uses inline SVG — mixed usage is fine |
| Google Apps Script MailApp | Built-in (V8 runtime) | Email delivery | Verified used at AsyncGrading.gs; only `htmlBody` + subject + plain body args supported |

### Supporting (only install if actively used — see §Package Legitimacy Audit)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `axe-core` | ^4.10.x (verify at plan time) | Runtime a11y auditing in dev | Use INSTEAD of `@axe-core/react` because the latter does not support React 18+ (see Pitfall 1). Wrap `axe.run(document, ...)` in a `useEffect` gated on `process.env.NODE_ENV !== 'production'` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `axe-core` runtime + manual browser check | Deque `axe DevTools` browser extension | Extension is zero-install for the codebase but a manual step; runtime library gives dev-console warnings automatically. **Recommend both — extension for one-shot verification, runtime as passive dev catch** |
| `jest-axe` full test suite | axe-core runtime only | jest-axe requires jsdom + a test harness; A8 downscopes to runtime warnings only. Skip jest-axe this phase |
| Tailwind `dark:` prefix + toggle | Single light palette in `:root` `--*` vars | User decision (A2) — no toggle. Simpler; also aligns with T1 that says no new theming lib |
| CSS-in-JS runtime theme | CSS variables in `globals.css` | CSS vars are already the project's pattern (see `--card-bg`, `--card-border`, `--accent`, `--text-secondary` in globals.css); reuse that pattern |
| MJML compilation for email HTML | Hand-written table HTML | MJML requires a build tool; Apps Script has none. Hand-write table HTML using Cerberus/Litmus patterns |
| React Email (`@react-email/*`) | Hand-written table HTML | React Email templates render to HTML but require a Node.js build step external to Apps Script — mismatch with T3 (Apps-Script-only). Skip |

**Installation:**
```bash
# From repo root (only if using runtime axe-core option)
cd assessment-app
npm install --save-dev axe-core
```

**Version verification:**
```bash
npm view axe-core version    # Expect ^4.10.x (Deque publishes regularly)
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `axe-core` | npm | ~10 yrs | ~15M+/wk | github.com/dequelabs/axe-core | [ASSUMED — verify at plan time via `npm view axe-core`] | Approved (Deque flagship; canonical a11y engine used by Lighthouse) |
| `@axe-core/react` | npm | ~7 yrs | ~500K/wk | github.com/dequelabs/axe-core-npm | REJECTED | REMOVED — does NOT support React 18+ per [Deque docs](https://www.npmjs.com/package/@axe-core/react) |

**Packages removed due to compat gap:** `@axe-core/react` (A8's specified tool is invalid for React 19).
**Packages flagged as suspicious [SUS]:** none.

*Because `axe-core` was not fetched via Context7 in this session, the exact version is tagged `[ASSUMED]`. The planner should run `npm view axe-core version` and pin the exact version in the install plan, and gate the install behind a `checkpoint:human-verify` if the CLAUDE.md rule "do not add dependencies without approval" applies (it doesn't in this project — no such rule — but confirm the user is OK with a devDep addition).*

---

## Architecture Patterns

### System Architecture Diagram

```
                 ┌─────────────────────────────────────────────────┐
                 │                CANDIDATE BROWSER                │
                 │                                                 │
     start ─────►│ WelcomeScreen ──► AssemblyScreen ──► TestScreen │
                 │       │                                 │       │
                 │       │                                 │       │
                 │       ▼                                 ▼       │
                 │  [light theme       ┌──────────────────────┐    │
                 │   tokens from       │ ZONE OVERLAY (exist) │    │
                 │   :root CSS vars]   │ QUESTION VIEW        │    │
                 │       │             │  · zone-wise number  │    │
                 │       │             │  · "Select all" cue  │    │
                 │       │             │  · EP6 email block   │    │
                 │       │             │  · CT case always    │    │
                 │       │             │  · AoD scroll verify │    │
                 │       │             └──────────────────────┘    │
                 │       │                                 │       │
                 │       ▼                                 ▼       │
                 │  ThankYouScreen ◄────── submit ──── (empty)     │
                 │       │                                         │
                 │       │ (later, from email link or admin)       │
                 │       ▼                                         │
                 │  ReportScreen (BUG-04 ARIA + 999.2 breakdown)   │
                 │   role=main                                     │
                 │   ├─ section "candidate info"                   │
                 │   ├─ section "trait scores" (progressbars)      │
                 │   ├─ section "insight"                          │
                 │   ├─ section "recommendation"                   │
                 │   ├─ section "ungraded notice" (conditional)    │
                 │   ├─ section "integrity"                        │
                 │   └─ section "per-question detail" (999.2 NEW)  │
                 │           ↑                                     │
                 │           │ Report.transcripts[]  (999.2 NEW)   │
                 │           │                                     │
                 └───────────┼─────────────────────────────────────┘
                             │
                             │ handleGetAttemptReport (GET)
                             ▼
                 ┌─────────────────────────────────────────────────┐
                 │        GOOGLE APPS SCRIPT (backend)             │
                 │                                                 │
                 │  Code.gs::doGet ──► handleGetAttemptReport      │
                 │                          │                      │
                 │                          ▼                      │
                 │  AsyncGrading.gs::                              │
                 │    buildReportFromAttemptsRow (extend)          │
                 │           │                                     │
                 │           ├── read Attempts row (existing)      │
                 │           └── read GradingTranscripts rows      │
                 │                for this attemptId (NEW)         │
                 │                                                 │
                 │                                                 │
                 │  processGradingQueue (existing) ──► after grade │
                 │           │                                     │
                 │           ▼                                     │
                 │  buildCandidateEmail / buildRecruiterEmail      │
                 │           │                                     │
                 │           ▼                                     │
                 │  buildReportHtml (999.3 REWRITE)                │
                 │    ├── table wrapper 640px                      │
                 │    ├── header + tier badge                      │
                 │    ├── trait score cards                        │
                 │    ├── insight block                            │
                 │    ├── (recruiter) violation summary            │
                 │    └── footer                                   │
                 │           │                                     │
                 │           ▼                                     │
                 │  MailApp.sendEmail(to, subj, plainText, {htmlBody})
                 │                                                 │
                 └─────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
assessment-app/
├── src/
│   ├── app/
│   │   ├── globals.css               # ADD light-theme :root vars (replace dark vars)
│   │   └── ...
│   ├── components/
│   │   ├── ReportScreen.tsx          # MODIFY — ARIA + light theme + per-question section
│   │   ├── TestScreen.tsx            # MODIFY — light theme + zone-numbering + mcq_multi cue + EP6 + CT
│   │   ├── CaseDashboard.tsx         # MODIFY — light theme
│   │   ├── case-dashboard/
│   │   │   └── DashboardCards.tsx    # VERIFY scroll behavior; MODIFY light theme
│   │   └── test-screen/              # RECOMMEND EXTRACT (see §Component Extraction)
│   │       ├── QuestionHeader.tsx    # NEW — extract lines ~970-1010 (header + timer)
│   │       ├── ScenarioBlock.tsx     # NEW — extract EP6 reading + CT case scenario
│   │       ├── OptionsList.tsx       # NEW — extract MCQ/multi/hybrid options render
│   │       └── ZoneOverlay.tsx       # NEW — extract lines ~780-870 (already dual-phase)
│   └── types/
│       └── index.ts                  # EXTEND Report with transcripts?: TranscriptEntry[]
└── ...

backend/
├── AsyncGrading.gs                   # EXTEND buildReportFromAttemptsRow (fetch transcripts)
│                                     # REWRITE buildReportHtml (table HTML)
│                                     # UPDATE MailApp.sendEmail plainText arg (was "")
```

### Pattern 1: ARIA Landmarks on ReportScreen
**What:** Wrap the report in a single `<main>` with named `<section>`s using `aria-labelledby`.
**When to use:** ReportScreen root and each conceptual block.
**Example:**
```tsx
// Source: WAI-ARIA Authoring Practices Guide (recall from training) — verify against W3C-WAI docs at plan time
export default function ReportScreen({ report, onExit }: ReportScreenProps) {
  return (
    <main
      role="main"
      aria-labelledby="report-title"
      className="w-full max-w-[900px] mx-auto animate-fade-in"  // widened per A2
    >
      <div className="bg-card border ...">
        <header>
          <h1 id="report-title" className="text-2xl font-bold ...">
            Assessment Complete
          </h1>
          <p>Thank you for completing the Fraud Support hiring assessment.</p>
        </header>

        <section aria-labelledby="candidate-info-h">
          <h2 id="candidate-info-h" className="sr-only">Candidate Information</h2>
          {/* dl/dt/dd is more semantic than div-based key/value pairs */}
          <dl>
            <dt>Name</dt><dd>{report.name}</dd>
            <dt>Email</dt><dd>{report.email}</dd>
            <dt>Attempt ID</dt><dd>{report.attemptId}</dd>
            <dt>Overall Score</dt>
            <dd aria-live="polite">
              <span className="sr-only">Score:</span>{report.overallScore} percent
            </dd>
          </dl>
        </section>

        <section aria-labelledby="trait-scores-h">
          <h2 id="trait-scores-h">Trait Scores</h2>
          <TraitBar label="Language Expertise" value={language} color={...} />
          <TraitBar label="Attention to Detail & Research" value={research} color={...} />
          <TraitBar label="Logical & Critical Thinking" value={critical} color={...} />
        </section>

        {/* etc. */}
      </div>
    </main>
  );
}
```

### Pattern 2: Progress Bar (TraitBar)
**What:** `role="progressbar"` with the full ARIA state attributes.
**When to use:** Each of the three `<TraitBar>` instances.
**Example:**
```tsx
// Source: WAI-ARIA — progressbar role (verify against https://www.w3.org/WAI/ARIA/apg/patterns/meter/)
function TraitBar({ label, value, color }: { label: string; value: number; color: string }) {
  const bandLabel = value >= 70 ? 'strong' : value >= 50 ? 'moderate' : 'developing';
  const labelId = `trait-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center text-xs">
        <span id={labelId} className="font-semibold">{label}</span>
        <span className="font-bold tabular-nums" style={{ color }}>
          {value}%
          {/* text alternative for color-only band; screen-reader-only */}
          <span className="sr-only"> — {bandLabel}</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${value} percent, ${bandLabel}`}
        className="h-1.5 bg-slate-200 rounded-full overflow-hidden"  // light-theme swap
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}
```

### Pattern 3: SVG Icon Handling
**What:** Decorative SVGs → `aria-hidden="true"`. Meaningful icons → `role="img"` + `aria-label`.
**When to use:** Each of the 3 SVG icons on ReportScreen (checkmark, shield, warning-circle).
**Example:**
```tsx
// Checkmark next to "Assessment Complete" — decorative
<svg aria-hidden="true" focusable="false" className="w-7 h-7" ...>
  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
  <polyline points="22 4 12 14.01 9 11.01"/>
</svg>

// Warning icon on ungraded notice — meaningful (conveys "warning")
<svg role="img" aria-label="Warning" className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" ...>
  <circle cx="12" cy="12" r="10"/>
  <line x1="12" y1="8" x2="12" y2="12"/>
  <line x1="12" y1="16" x2="12.01" y2="16"/>
</svg>

// Shield icon next to "Integrity Events Logged" — decorative (text label carries meaning)
<svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" ...>...</svg>
```

### Pattern 4: Light Theme via CSS Variables
**What:** Replace dark `:root` vars in `globals.css` with light-mode values; drop `--card-bg: rgba(13, 21, 39, 0.65)` in favor of white/off-white; keep the variable NAMES so component classes don't need renaming.
**When to use:** `globals.css` — single edit that cascades to all components using `var(--card-bg)`, `var(--text-secondary)` etc. Components that hardcode `slate-9*` classes need per-component swaps.
**Example:**
```css
/* Source: existing globals.css pattern (verified via file read) — light-mode replacement */
:root {
  --background: #f8fafc;              /* was #070a13 */
  --foreground: #0f172a;              /* was #f8fafc */

  --bg-primary: #f8fafc;
  --card-bg: rgba(255, 255, 255, 0.9);
  --card-border: rgba(15, 23, 42, 0.08);

  --accent: #0891b2;                  /* darkened cyan for AA contrast on white */
  --accent-glow: rgba(8, 145, 178, 0.15);

  --text-primary: #0f172a;
  --text-secondary: #475569;          /* AA 4.5:1 on white */
  --text-muted: #64748b;

  --success: #059669;                 /* darkened for AA */
  --error: #dc2626;
  --error-bg: rgba(220, 38, 38, 0.06);

  --border-radius: 16px;
  --transition-speed: 0.3s;
}
```

Then in components, replace hardcoded dark classes:
- `bg-slate-900/70` → `bg-slate-100` (or `bg-[var(--card-bg)]`)
- `text-slate-300` → `text-slate-700`
- `text-white` → `text-slate-900`
- `border-slate-800/60` → `border-slate-200`
- `bg-slate-950/40` → `bg-white` or `bg-slate-50`

### Pattern 5: Zone-Wise Question Numbering
**What:** Derive `zonePosition` and `zoneQuestionCount` from `questions[]` + `activeZoneKey`.
**When to use:** TestScreen line 981 replacement.
**Example:**
```tsx
// Zone position derivation
const zoneKeyForQuestion = (q: Question): ZoneKey => {
  if (q.bank === 'english') return 'english';
  if (q.bank === 'attention') return 'attention';
  return 'critical';
};

const currentZoneKey = zoneKeyForQuestion(currentQuestion);
const zoneQuestions = questions.filter(q => zoneKeyForQuestion(q) === currentZoneKey);
const zonePosition = zoneQuestions.findIndex(q => q.id === currentQuestion.id) + 1;
const zoneQuestionCount = zoneQuestions.length;

// Render
<span className="text-[11px] font-semibold whitespace-nowrap">
  Question {zonePosition} of {zoneQuestionCount}
</span>
```

### Pattern 6: mcq_multi "Select all that apply" Cue
**What:** JSX conditional guard rendering a visible pill above the options.
**When to use:** TestScreen options block, guarded on `isMulti` (line 758 already defines this).
**Example:**
```tsx
{isMulti && (
  <div
    role="note"
    aria-live="polite"
    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md
               bg-cyan-50 border border-cyan-200 text-cyan-800
               text-xs font-semibold mb-2"
  >
    <svg aria-hidden="true" className="w-3.5 h-3.5" ...>
      {/* checklist icon */}
    </svg>
    Select all that apply
  </div>
)}
```

### Pattern 7: EP Part 6 Email-Style Scenario Block + Re-Review Button
**What:** Replace the card-wrapped scenario div (TestScreen lines 1017–1035) with an "email letterhead" simulacrum, then add a "Re-review scenario" button that scrolls-and-focuses the scenario block.
**When to use:** When `currentQuestion.section === 'reading'` only (do NOT affect CT branch which uses the same code path — split the two).
**Example:**
```tsx
// Split the shared render branch first — CT uses CaseDashboard now (item 7 fix), reading gets email block
const scenarioRef = useRef<HTMLDivElement>(null);

const focusScenario = () => {
  scenarioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  scenarioRef.current?.focus();
};

{currentQuestion.section === 'reading' && currentQuestion.tabs?.[0] && (
  <article
    ref={scenarioRef}
    tabIndex={-1}
    aria-label="Customer email scenario"
    className="border border-slate-200 rounded-lg bg-white shadow-sm"
  >
    {/* Email letterhead simulacrum */}
    <header className="border-b border-slate-200 px-6 py-3 text-xs text-slate-600 space-y-0.5">
      <div><span className="font-semibold">From:</span> customer@example.com</div>
      <div><span className="font-semibold">To:</span> support@fraud-support.com</div>
      <div><span className="font-semibold">Subject:</span> {currentQuestion.case_title || 'Customer Inquiry'}</div>
    </header>
    <div className="px-6 py-5 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-serif">
      {currentQuestion.tabs[0].content}
    </div>
  </article>
)}

{/* Re-review button rendered alongside options */}
{currentQuestion.section === 'reading' && (
  <button
    type="button"
    onClick={focusScenario}
    className="self-start inline-flex items-center gap-2 text-xs font-semibold
               text-cyan-800 hover:underline"
  >
    <svg aria-hidden="true" className="w-3.5 h-3.5" ...>
      {/* eye/refresh icon */}
    </svg>
    Re-review the email
  </button>
)}
```

### Pattern 8: CT Case File Always Rendered
**What:** In the CT branch (`currentQuestion.bank === 'critical'`), always render the scenario column. When `tabs` is empty, render the existing "Case file not yet available" warning inside the same column so the layout is stable.
**When to use:** Line 1015–1045 restructure — CT should NOT share render code with reading (see Pattern 7 split).
**Example:**
```tsx
{currentQuestion.bank === 'critical' && (
  <aside aria-label="Case file" className="animate-fade-in w-full sticky top-6">
    {currentQuestion.tabs && currentQuestion.tabs.length > 0 ? (
      <CaseDashboard
        tabs={currentQuestion.tabs}
        tables={currentQuestion.tables}
        caseTitle={currentQuestion.case_title}
        caseId={currentQuestion.case_id}
      />
    ) : (
      <div role="note" className="border border-amber-300 bg-amber-50 rounded-lg p-4 text-sm text-amber-900">
        Case file not available for this question. Answer based on the question text alone.
      </div>
    )}
  </aside>
)}
```

### Pattern 9: 999.2 — Per-Question Breakdown on ReportScreen (criteriaMet only)
**What:** New collapsible section grouped by trait, showing per-question criterion pass/fail. **Withhold `rationale` string (Phase 10 A6 tension — see §Open Questions).**
**When to use:** ReportScreen new section, only if `report.transcripts?.length > 0`.
**Example:**
```tsx
{report.transcripts && report.transcripts.length > 0 && (
  <section aria-labelledby="detail-h" className="rounded-lg border p-4">
    <h2 id="detail-h" className="text-sm font-semibold mb-3">
      Answer Detail
    </h2>
    <ul className="space-y-3">
      {report.transcripts.map((t, i) => {
        const criteria: Array<{criterionName: string; met: boolean; score: number}> =
          typeof t.criteriaMet === 'string' ? JSON.parse(t.criteriaMet) : t.criteriaMet;

        return (
          <li key={t.qId} className="border-b last:border-b-0 pb-3">
            <details>
              <summary className="cursor-pointer flex items-center justify-between text-sm">
                <span className="font-medium">{t.questionStem.slice(0, 80)}…</span>
                <VerdictPill verdict={t.overrideVerdict || t.verdict} />
              </summary>
              <ul className="mt-2 ml-4 space-y-1 text-xs">
                {criteria.map(c => (
                  <li key={c.criterionName} className="flex items-start gap-2">
                    <span aria-hidden="true">{c.met ? '✓' : '✗'}</span>
                    <span className="sr-only">{c.met ? 'Met' : 'Not met'}:</span>
                    <span>{c.criterionName}</span>
                  </li>
                ))}
              </ul>
              {/* NOTE: rationale string DELIBERATELY NOT rendered — see §Open Questions */}
            </details>
          </li>
        );
      })}
    </ul>
  </section>
)}
```

### Pattern 10: 999.3 — Table-Based Email HTML
**What:** Rewrite `buildReportHtml()` in AsyncGrading.gs following the flagmail1 reference (`buildResultsHtml`) — table wrapper at 640px max-width, all styles inlined.
**When to use:** Complete rewrite of AsyncGrading.gs lines 425–448.
**Example:**
```javascript
// Source: flagmail1/google-apps-script.js buildResultsHtml pattern
//         (SUMMARY at .planning/quick/260525-sfa-build-html-email-template-in-google-apps/260525-sfa-SUMMARY.md)
// Email-safe: table layout, inline styles, 640px max-width, no CSS classes, no flexbox/grid.
function buildReportHtml(report, options) {
  var includeViolations = !!(options && options.includeViolations);

  var tierColor = report.recommendationTier === 'Strong Fit' ? '#10b981'
                : report.recommendationTier === 'Consider'   ? '#f59e0b'
                : '#ef4444';

  var html = ''
    + '<!DOCTYPE html>'
    + '<html><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>Fraud Support Assessment Report</title>'
    + '</head>'
    + '<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;">'
    + '<tr><td align="center" style="padding:24px 12px;">'
    +   '<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;">'

    // Header
    +     '<tr><td style="padding:32px 32px 20px;text-align:center;border-bottom:3px solid ' + tierColor + ';">'
    +       '<h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Your Assessment Report</h1>'
    +       '<p style="margin:0;font-size:14px;color:#475569;">Fraud Support hiring assessment</p>'
    +     '</td></tr>'

    // Candidate + overall score
    +     '<tr><td style="padding:24px 32px 8px;">'
    +       '<p style="margin:0 0 4px;font-size:14px;color:#475569;">Candidate</p>'
    +       '<p style="margin:0 0 20px;font-size:18px;color:#0f172a;font-weight:600;">' + escape(report.name) + '</p>'
    +       '<div style="text-align:center;background:#f8fafc;border-radius:8px;padding:20px;">'
    +         '<div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Overall Score</div>'
    +         '<div style="font-size:40px;color:' + tierColor + ';font-weight:700;line-height:1;margin-top:8px;">' + report.overallScore + '%</div>'
    +       '</div>'
    +     '</td></tr>'

    // Trait score cards (3-column table)
    +     '<tr><td style="padding:16px 32px;">'
    +       '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">'
    +         '<tr>'
    +           _traitCell('Language', report.traitScores.language)
    +           _traitCell('Research', report.traitScores.research)
    +           _traitCell('Critical', report.traitScores.critical)
    +         '</tr>'
    +       '</table>'
    +     '</td></tr>'

    // Tier badge
    +     '<tr><td style="padding:8px 32px 16px;text-align:center;">'
    +       '<span style="display:inline-block;padding:6px 16px;border-radius:999px;background:' + tierColor + '22;color:' + tierColor + ';font-weight:700;font-size:13px;">'
    +         report.recommendationTier
    +       '</span>'
    +     '</td></tr>'

    // Narrative insight
    +     '<tr><td style="padding:16px 32px;">'
    +       '<div style="border-left:3px solid ' + tierColor + ';padding-left:12px;color:#334155;font-style:italic;font-size:14px;line-height:1.6;">'
    +         escape(report.narrativeInsight)
    +       '</div>'
    +     '</td></tr>';

  if (includeViolations) {
    html += '<tr><td style="padding:16px 32px;">'
      +      '<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px;font-size:13px;color:#78350f;">'
      +        '<strong>Integrity signal:</strong> ' + report.violationCount + ' event(s) logged.'
      +      '</div>'
      +    '</td></tr>';
  }

  html += ''
    // Footer
    +     '<tr><td style="padding:20px 32px;background:#f8fafc;font-size:11px;color:#94a3b8;text-align:center;">'
    +       'Fraud Support Assessment · This report is advisory input for the recruiting team.'
    +     '</td></tr>'
    +   '</table>'
    + '</td></tr></table>'
    + '</body></html>';

  return html;
}

function _traitCell(label, value) {
  var color = value >= 70 ? '#10b981' : value >= 50 ? '#f59e0b' : '#ef4444';
  return '<td width="33%" style="padding:0 4px;">'
    +      '<div style="background:#f8fafc;border-radius:8px;padding:12px;text-align:center;">'
    +        '<div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">' + label + '</div>'
    +        '<div style="font-size:22px;color:' + color + ';font-weight:700;margin-top:4px;">' + value + '%</div>'
    +      '</div>'
    +    '</td>';
}

function escape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

And update the send call to include a plain-text fallback:
```javascript
function buildCandidateEmail(report) {
  return {
    subject: "Your Fraud Support Assessment Results",
    plainBody: 'Your assessment results — Overall Score: ' + report.overallScore + '%\n'
             + 'Language: ' + report.traitScores.language + '%\n'
             + 'Research: ' + report.traitScores.research + '%\n'
             + 'Critical: ' + report.traitScores.critical + '%\n'
             + 'Tier: ' + report.recommendationTier + '\n\n'
             + report.narrativeInsight,
    htmlBody: buildReportHtml(report, { includeViolations: false })
  };
}

// At send site:
MailApp.sendEmail(toAddr, email.subject, email.plainBody, { htmlBody: email.htmlBody });
```

### Anti-Patterns to Avoid
- **DO NOT** use `@axe-core/react` — incompatible with React 18+. Use `axe-core` directly wrapped in a dev-gated `useEffect`.
- **DO NOT** hand-roll a color-contrast checker in JS. Set the palette in `:root` vars once and validate with axe-core or a browser extension.
- **DO NOT** add a dark-mode toggle "just in case." A2 is explicit: light only.
- **DO NOT** use CSS Grid or flexbox in email HTML. Gmail-on-Android, Outlook, and older Apple Mail all fall back badly. Use `<table>` with `role="presentation"`.
- **DO NOT** rely on `<link rel="stylesheet">` in email HTML — inline all styles.
- **DO NOT** show `rationale` text to the candidate on ReportScreen (see Phase 10 A6 tension in §Open Questions).
- **DO NOT** modify TestScreen line 981 in isolation — the zone-position calculation depends on knowing which questions belong to the current zone; use the pattern in §Pattern 5.
- **DO NOT** merge the CT branch and the reading branch into one code path (line 1017 currently does this). Split them cleanly per Pattern 7 + Pattern 8.
- **DO NOT** commit `axe-core` as a runtime `dependency` — it must be `devDependency` and gated on `process.env.NODE_ENV !== 'production'` at the import site.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessibility rule engine | Custom "check landmarks / progressbars / labels" script | `axe-core` (Deque) | Battle-tested rule set matching WCAG 2.2 AA; also what Lighthouse uses under the hood |
| Color contrast calculation | JS function computing sRGB → luminance | Use axe-core's `color-contrast` rule OR Chrome DevTools contrast picker at design time | Contrast math has edge cases (semitransparent bg over gradient) that trip hand-rolled solutions |
| Focus trap for potential modal | Custom keydown handlers | `focus-trap` or React `focus-trap-react` — but **not needed this phase** (no modals in scope) | If you find yourself needing one later, don't hand-roll it |
| HTML sanitization for email content | Regex-based escape | The four-replace escape (`&`, `<`, `>`, `"`) in Pattern 10 is sufficient for the strictly known-shape fields (name, insight) | Report fields come from server-controlled data (candidate name from Registration, insight from deterministic backend), NOT user-authored rich text; a full HTML sanitizer (DOMPurify) is overkill and cannot run in Apps Script anyway |
| Email HTML compilation | MJML build pipeline / React Email | Hand-written table HTML in Apps Script | T3: no frontend tooling for emails; MJML requires a build step |

**Key insight:** ARIA is a spec, not a library. The library work is (a) axe-core to catch violations and (b) semantic HTML choices. There is no "framework" for a11y — you write correct HTML.

---

## Runtime State Inventory

*(Not applicable — this phase does not rename or migrate stored data.)*

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 13 does not rename any DB keys, sheet columns, or IDs | None |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | Adding `axe-core` to `devDependencies` in `assessment-app/package.json` will change `package-lock.json`. Standard `npm install` covers it. | None (routine) |

**Category outcome:** No runtime migrations needed.

---

## Common Pitfalls

### Pitfall 1: `@axe-core/react` does not support React 18+
**What goes wrong:** A8 assumes `@axe-core/react` is the runtime a11y tool. Installing it in this project (React 19.2.4) either fails at import or silently does nothing.
**Why it happens:** Deque discontinued the React-specific wrapper when React 18 shipped concurrent-mode changes that broke the render-hook injection. Their new offering is the paid "axe Developer Hub" for React 18/19.
**How to avoid:** Use `axe-core` directly (framework-agnostic). Wrap it in a dev-gated `useEffect` at the app root or on the specific page you're auditing. Alternative: use the "axe DevTools" browser extension as a manual verification step in the deploy plan.
**Warning signs:** Docs recommending `@axe-core/react` are pre-2023.

### Pitfall 2: Sharing the reading + CT code path
**What goes wrong:** TestScreen line 1017 uses a single ternary — `(section === 'reading' || bank === 'critical') ? scenarioDiv : <CaseDashboard/>`. Item 5 (email block) and item 7 (case-file-always) require different renders. Modifying the shared branch will break the other case.
**Why it happens:** Copy-paste convergence during Phase 4 UI work.
**How to avoid:** Split the two into separate `{condition && <Component/>}` blocks before Pattern 7/8 modifications.
**Warning signs:** A single change to the "scenario" render breaks both EP6 layouts.

### Pitfall 3: CSS variable name churn
**What goes wrong:** Renaming CSS vars (`--card-bg` → `--surface-primary`) forces a repo-wide search-replace and risks missing string-interpolated occurrences.
**Why it happens:** Well-intentioned tidying during a light-mode migration.
**How to avoid:** Keep variable NAMES; only change VALUES. `var(--card-bg)` in a component is now white instead of dark blue — components don't need edits unless they hardcoded `slate-9*` or hex.
**Warning signs:** git diff shows 40+ component files changed just for theme swap.

### Pitfall 4: Email HTML looks fine in Gmail preview, breaks in Outlook
**What goes wrong:** Outlook (desktop, Windows) uses the Word rendering engine — no flexbox, limited CSS, `<div>`-based layouts collapse.
**Why it happens:** Testing only in one client.
**How to avoid:** Use tables everywhere with `role="presentation"`. Send test emails to a Gmail + Outlook + Apple Mail set during verification (Wave 3). Reference Litmus/Cerberus templates.
**Warning signs:** Uses flexbox, uses CSS Grid, uses `<div>` for layout structure.

### Pitfall 5: GradingTranscripts data not yet live
**What goes wrong:** 999.2 (Workstream 3) assumes `GradingTranscripts` sheet has rows for existing attempts. Phase 10 Task 10-07 (live deployment + verification) is not closed. Attempts created before 10-07 lands have NO transcript rows — `buildReportFromAttemptsRow()` returns an empty array — ReportScreen sees `transcripts: []` and (if unhandled) crashes on `.map()`.
**Why it happens:** Cross-phase data dependency without a defensive fallback.
**How to avoid:** Backend: extend `buildReportFromAttemptsRow()` to return `transcripts: []` if the sheet is missing or empty (never throw). Frontend: guard the render on `report.transcripts && report.transcripts.length > 0` (Pattern 9 already does this). Plan Wave 3 (deploy) as blocked-on-either-10-07-close OR defensive fallback.
**Warning signs:** ReportScreen crashes for pre-Phase-10 attempts.

### Pitfall 6: TestScreen.tsx growing past 1200 lines
**What goes wrong:** CLAUDE.md caps files at 500 lines. TestScreen is already 1178. Adding zone-numbering (small), mcq_multi cue (small), EP6 email block (medium), CT case-always split (medium), and light-theme swap (many small edits) will push it well past 1300.
**Why it happens:** All the changes touch the same file.
**How to avoid:** Extract sub-components as part of Wave 1 (see §Component Extraction Strategy). Recommend splitting into `test-screen/QuestionHeader.tsx`, `ScenarioBlock.tsx`, `OptionsList.tsx`, `ZoneOverlay.tsx`. Post-extraction target: TestScreen.tsx ≤ 400 lines.
**Warning signs:** git diff on TestScreen.tsx shows +300 net additions in a single plan.

### Pitfall 7: axe-core color-contrast rule against gradient buttons
**What goes wrong:** The "Continue to Next Zone" button uses `bg-gradient-to-br from-[#4facfe] to-[#00f2fe]`. axe-core cannot compute contrast against a gradient — it may report "cannot determine" or false-positive.
**Why it happens:** Contrast checkers pick one background pixel.
**How to avoid:** Either (a) pick a solid fallback bg-color as the axe-testable baseline, or (b) manually verify at design time using DevTools contrast picker on both endpoint colors and add `aria-hidden` false negatives to the axe run config. Document the exception.
**Warning signs:** axe run for TestScreen returns "incomplete" (needs review) rather than "pass".

### Pitfall 8: Framer Motion animations triggering vestibular issues
**What goes wrong:** Sliding, scaling, fade-up transitions in ReportScreen and TestScreen can trigger nausea/dizziness for users with vestibular disorders. WCAG 2.3.3 requires respecting `prefers-reduced-motion`.
**Why it happens:** Motion is enabled by default with no OS-preference guard.
**How to avoid:** Wrap `<motion.*>` variants in a check on `useReducedMotion()` from framer-motion, or add a `@media (prefers-reduced-motion: reduce)` block that disables the CSS animations in `globals.css`. The latter is simpler and repo-wide.
**Warning signs:** axe-core doesn't flag this — it's a WCAG rule that requires manual awareness.

---

## Code Examples

*(All patterns above serve as examples. See §Architecture Patterns 1–10.)*

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@axe-core/react` for React dev warnings | `axe-core` core lib + dev-only `useEffect` OR `axe DevTools` browser extension | 2023 (React 18 breaking change) | A8 assumption invalidated — use replacement |
| `dark:` prefix with toggle | Single palette in `:root` CSS vars via Tailwind v4 `@theme inline` | Tailwind v4 (2024) | Cleaner for no-toggle scenarios (A2) |
| Manual color-contrast checking | Chrome DevTools contrast picker + axe-core `color-contrast` rule | 2020+ | Zero-cost design-time verification |
| Hand-rolled HTML email tags | Cerberus / Litmus template patterns | Long-standing (2015+) | Just apply the patterns |
| Blanket `aria-label` on every element | Native semantics (`<main>`, `<section>`, `<header>`, `<dl>`, `<article>`, `<aside>`) + `aria-labelledby` for cross-references | WAI-ARIA APG modernization (2021+) | Native HTML wins — less to maintain |
| MJML or React Email for GAS mails | Direct table HTML strings | Constant (Apps Script has no build tooling) | Match the environment |

**Deprecated/outdated:**
- `@axe-core/react` for React 18+ — replaced by axe Developer Hub (paid) or direct `axe-core` (free)
- `role="main"` explicitly on `<main>` — redundant (native `<main>` already has role); include it only if IE11 support matters (we don't care)
- Table-based layouts in general web pages — but STILL correct for emails

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `axe-core` ^4.10.x is current on npm | §Standard Stack | Wrong version pinned; user re-runs `npm view axe-core version` |
| A2 | Deque's `axe DevTools` browser extension is available for manual verification | §Standard Stack Alternatives | Verification step in Wave 3 needs a different tool; falls back to axe-core runtime only |
| A3 | WAI-ARIA APG progressbar pattern requires `aria-valuenow`/`min`/`max`/`labelledby`/`valuetext` | §Pattern 2 | Screen readers may announce nothing meaningful; verify against W3C-WAI docs at plan time |
| A4 | Gmail's mobile app, Outlook (desktop), and Apple Mail all render `<table role="presentation">` with inline styles correctly | §Pattern 10 | Some clients break; discovered in Wave 3 send-test — mitigation is Litmus/Cerberus refinement |
| A5 | Tailwind v4 `@theme inline` block reads from `:root` CSS vars at runtime (no rebuild required) | §Pattern 4 | If wrong, palette change requires a Next.js rebuild — inconvenient but not blocking |
| A6 | `GradingTranscripts` sheet columns are: attemptId, qId, rubricVersion, verdict, criteriaMet (JSON), rationale, overrideVerdict, overrideAt, overrideTokenHash | §Workstream 3 | Wrong columns → `buildReportFromAttemptsRow` reads wrong indices; verify against `backend/AsyncGrading.gs` and Phase 10 SUMMARY at plan time |
| A7 | Phase 10 has not deployed its live-verification (task 10-07 open) | §Pitfall 5 | If closed, defensive fallback is still fine; if open, Wave 3 needs the fallback |
| A8 | Candidate `Report` type currently has no `transcripts` field | §Types | Verified — reads `src/types/index.ts` lines 58–74 do not include transcripts |
| A9 | The four HTML entity escapes (`&`, `<`, `>`, `"`) are sufficient because report field values are server-controlled (from Attempts sheet, not raw user rich-text) | §Don't Hand-Roll | If a candidate name field ever accepts HTML input, we need real sanitization. Verify Registration validation strips HTML. |
| A10 | The reference implementation at `C:\Users\anoop\OneDrive\Desktop\apple\flagmail1\google-apps-script.js` follows the SUMMARY.md pattern (verified summary read, not the code) | §Pattern 10 | If the file diverged from SUMMARY, our template may miss the tier-colors / plain-text-fallback conventions; recommend reading the file end-to-end during plan authoring |

*(A1–A10 flagged for the planner. A3, A6, A10 have concrete verification commands the planner can run.)*

---

## Open Questions

1. **PHASE 10 vs. PHASE 13 CONTRADICTION on rationale exposure — REQUIRES USER RESOLUTION**
   - What we know: Phase 10 RESEARCH.md line 502 explicitly says: *"Never ship rationale to the candidate. Candidate-facing report shows ungradedCount and a 'answers pending review' notice if any; recruiter-only sees full transcripts."* Phase 13 A6 says: *"add per-question breakdown to ReportScreen.tsx showing criteriaMet/rationale."*
   - What's unclear: These directly contradict.
   - Recommendation: Show `criteriaMet[]` (list of criteria with pass/fail — high-signal, low risk) to candidates but **withhold the free-form `rationale` text** — rationale is LLM-generated, may contain traces of the candidate's own answer text, may hallucinate, and may leak grading heuristics that let future candidates game the assessment. The planner MUST bounce this to the user via `/gsd-discuss-phase` addendum or an explicit checkpoint before implementing Workstream 3.

2. **Which components need light-theme edits, exactly?**
   - What we know: grep hits — TestScreen 20 occurrences, ReportScreen 19, DashboardCards 31. Plus CaseDashboard.tsx (not counted, but CONTEXT.md confirms dark-theme).
   - What's unclear: Whether WelcomeScreen.tsx, AssemblyScreen.tsx, ThankYouScreen.tsx also have hardcoded dark styles.
   - Recommendation: During plan authoring, run `grep -l "slate-[89]\|bg-slate\|bg-\[#0" assessment-app/src/components/*.tsx` for a complete list. Include ALL matching files in the light-theme plan.

3. **"Wider container" — how wide?**
   - What we know: ReportScreen currently `max-w-[580px]`. TestScreen `max-w-[650px]` (no-tabs) / `max-w-[1560px]` (with-tabs).
   - What's unclear: Whether user wants "full viewport with 5% margins" or "wider but still bounded (e.g. 1024px)."
   - Recommendation: Default to 900px for ReportScreen, keep TestScreen widths as-is but drop the no-tabs 650px to 800px. Ask user in discuss if the exact number matters; otherwise pick.

4. **EP Part 6 "email letterhead" content**
   - What we know: A3 says "present email directly." Currently the scenario is just the raw content of `tabs[0].content` inside a card wrapper.
   - What's unclear: Does the scenario data include `From:` / `To:` / `Subject:` headers, or are those props of the case we'd need to synthesize?
   - Recommendation: Check `INGEST-01` output for the reading-section cases. If headers aren't stored, synthesize plausible dummies (e.g. "customer@example.com" → "support@fraud-support.com") from `case_title`.

5. **Extract-first vs. modify-first for TestScreen**
   - What we know: TestScreen is 1178 lines. Multiple Workstream 2 items touch it.
   - What's unclear: Whether to do the extraction refactor as its own plan (safer) or interleave with feature work (faster).
   - Recommendation: Extract as its own plan (10-13-02-extract or similar) BEFORE the light-theme + item-work plans. Refactor with zero behavior change first, then feature-work. Otherwise diff review is unreadable.

6. **Do candidates who took the test BEFORE Phase 10 backend deployed still get the per-question breakdown?**
   - What we know: Attempts pre-Phase-10 have no GradingTranscripts rows. Attempts post-Phase-10 do.
   - What's unclear: Whether to backfill or gracefully hide the section for older attempts.
   - Recommendation: Hide the section (Pattern 9 already guards on `transcripts?.length > 0`). No backfill needed. Note this in RELEASE notes.

7. **REQUIREMENTS.md doesn't have IDs for the new workstreams**
   - What we know: F-05 is the only ID; the requirements table lists Phase 13 as "TBD (F-05)".
   - What's unclear: Whether the planner should mint new IDs (A11Y-01, UX-01…UX-06, REPORT-03, EMAIL-01) or reuse existing IDs.
   - Recommendation: Mint new IDs (proposed in §Phase Requirements). Add them to REQUIREMENTS.md v1.1 as part of Wave 3 finalization (analogous to how 11-04 wrote back to REQUIREMENTS/ROADMAP).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend build/test | ✓ (project already builds) | (per project) | — |
| npm | Install axe-core | ✓ | (per project) | — |
| Google Apps Script MailApp | 999.3 email delivery | ✓ (used already at AsyncGrading.gs L473) | Built-in V8 runtime | — |
| Google Sheets (GradingTranscripts sheet) | 999.2 transcript fetch | UNKNOWN in prod (Phase 10 not live-verified) | — | Defensive `transcripts: []` fallback if sheet missing/empty |
| Chrome / Firefox with axe DevTools extension | Wave 3 manual a11y verification | User-installed | Latest | axe-core runtime warnings in dev console |
| Gmail + Outlook + Apple Mail test accounts | Wave 3 email render verification | UNKNOWN — no test send infrastructure | — | Send to `ak22021990@gmail.com` (Gmail confirmed) + one work Outlook if available |

**Missing dependencies with no fallback:** None blocking.
**Missing dependencies with fallback:**
- GradingTranscripts sheet in prod — mitigated by defensive empty-array fallback in backend.
- Multi-client email test rig — mitigated by Litmus-pattern conformance + Gmail-only smoke test acceptable for v1.1.

---

## Validation Architecture

*(workflow.nyquist_validation is `true` in `.planning/config.json` — include this section.)*

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (per repo `vitest.config.ts`) + Playwright for a11y browser assertions (RECOMMEND adding — see Wave 0 gaps) |
| Config file | `vitest.config.ts` at repo root |
| Quick run command | `npm test` (repo root — currently runs the pure grading mirror tests) |
| Full suite command | `npm test` + manual axe DevTools sweep on ReportScreen + email render inspection |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| F-05 / A11Y-01 | ReportScreen has ARIA main, sections, progressbar roles | manual + axe DevTools | Open dev build, run axe extension on `/report/[attemptId]` → 0 critical/serious | ❌ Wave 0 (manual step in Wave 3) |
| A11Y-01 | `axe-core` runtime warns on ReportScreen violations in dev | dev-mode runtime | `npm run dev` and open browser console | ❌ Wave 0 (dev-only hook to add) |
| UX-01 | Light theme applied (no dark bg colors in ReportScreen render) | integration/visual | Manual screenshot compare; OR Playwright + jest-image-snapshot (out of scope this phase) | ❌ Wave 3 (manual) |
| UX-02 | ReportScreen width > 580px | manual | Open report, inspect | ❌ Wave 3 (manual) |
| UX-03 | EP Part 6 renders email letterhead + Re-review button focuses scenario | manual UAT | Take assessment, reach EP6, click Re-review, verify focus shift | ❌ Wave 3 (manual) |
| UX-04 | CT question with no tabs shows fallback message | integration/unit | vitest with a CT-no-tabs fixture; assert fallback text renders | ❌ Wave 0 (new spec file) |
| UX-05 | Zone-wise counter reads "Question X of Y" not "Q X of 105" | manual + potential unit | vitest snapshot of TestScreen header for mid-zone state | ❌ Wave 0 |
| UX-06 | mcq_multi shows "Select all that apply" pill | integration/unit | vitest on a mcq_multi fixture; assert `getByText('Select all that apply')` | ❌ Wave 0 |
| REPORT-03 | ReportScreen renders per-question breakdown when transcripts present | integration/unit | vitest on ReportScreen with a `transcripts` prop fixture; assert `getAllByRole('list')` | ❌ Wave 0 |
| REPORT-03 | ReportScreen hides breakdown when transcripts empty (backward-compat pre-Phase-10 attempts) | integration/unit | vitest with `transcripts: []` fixture; assert breakdown not in document | ❌ Wave 0 |
| REPORT-03 | ReportScreen does NOT render `rationale` text (per §Open Questions Q1 resolution) | integration/unit | vitest with a transcript containing rationale; assert rationale text NOT in document | ❌ Wave 0 |
| REPORT-03 | Backend `buildReportFromAttemptsRow` returns `transcripts: []` when GradingTranscripts sheet is missing | unit (Apps-Script mirror) | vitest on a mirror function in `tests/report/build-report.ts` (new mirror) | ❌ Wave 0 |
| EMAIL-01 | `buildReportHtml` output contains a table with role=presentation | unit | vitest on GAS mirror; assert string includes `<table role="presentation"` | ❌ Wave 0 (new mirror or extend existing) |
| EMAIL-01 | Plain-text body is non-empty on send | unit | vitest on candidate + recruiter builders; assert `plainBody.length > 0` | ❌ Wave 0 |
| EMAIL-01 | Tier badge color matches recommendation tier | unit | vitest with all 3 tiers; assert color hex in HTML | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --run` (targeted spec)
- **Per wave merge:** `npm test` (full suite) + `npm run build` (Next.js type-check)
- **Phase gate:** Full suite green + Wave 3 manual axe DevTools sweep + Wave 3 test email send to Gmail

### Wave 0 Gaps
- [ ] `tests/report/build-report.ts` — pure JS mirror of `buildReportFromAttemptsRow` transcript-fetch logic (parallels existing `tests/grading/grading-engine.ts` mirror pattern)
- [ ] `tests/report/test_build_report.ts` — vitest specs including no-sheet fallback + populated transcripts
- [ ] `tests/email/email-html.ts` — mirror of `buildReportHtml` + `buildCandidateEmail` + `buildRecruiterEmail`
- [ ] `tests/email/test_email_html.ts` — vitest specs for table structure, tier color, plain-text fallback
- [ ] `assessment-app/src/components/__tests__/ReportScreen.test.tsx` — vitest+testing-library specs for transcript-present, transcript-absent, rationale-not-rendered
- [ ] `assessment-app/src/components/__tests__/TestScreen.test.tsx` (or focused subset) — mcq_multi cue, zone-wise numbering, CT no-tabs fallback
- [ ] `assessment-app/scripts/dev-axe.ts` (or inline in `layout.tsx`) — dev-only `axe.run()` invoker gated on `process.env.NODE_ENV !== 'production'`
- [ ] `scripts/sync-check.ts` extension — assert `tests/report/build-report.ts` matches `backend/AsyncGrading.gs::buildReportFromAttemptsRow` (parallels existing drift assertions per plan 09-05 / 10-04)
- [ ] Framework install: `npm install --save-dev axe-core @testing-library/react @testing-library/jest-dom vitest-environment-jsdom` (verify each — some may already be present)

*(This is a materially larger Wave 0 than Phase 11's, because Phase 13 introduces both frontend component tests and email HTML mirror tests for the first time.)*

---

## Security Domain

*(config.workflow.security_enforcement is `true`; ASVS L1.)*

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | This phase adds no auth surfaces |
| V3 Session Management | no | No session changes |
| V4 Access Control | yes | `handleGetAttemptReport` already requires attempt ID; ensure the extended payload doesn't leak richer data to unauthenticated URL guessers than the old payload did. Since the endpoint was already accepting attemptId and returning report (F-01 status was fixed in Phase 9), this phase just extends the same authorization boundary. |
| V5 Input Validation | yes | Email HTML: escape all report field values that become HTML content (see Pattern 10 `escape()` helper). Transcript rationale text from Gemini could contain HTML — even though we've decided not to render it to candidates, escape defensively wherever it does render (e.g. recruiter admin panel). |
| V6 Cryptography | no | No new crypto |
| V7 Error Handling | yes | `buildReportFromAttemptsRow` extension must return empty transcripts on missing-sheet (Pitfall 5), not throw — matches the existing "return default report" pattern |
| V11 API | yes | `handleGetAttemptReport` response schema change (adds `transcripts` field) — treat as additive-only, don't break any admin panel client still consuming the old shape |
| V14 Config | yes | axe-core dev import MUST be tree-shaken out of production build. Verify with `next build` output — `axe-core` should not appear in a production chunk. |

### Known Threat Patterns for React + Apps Script + Email

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via unescaped candidate name in email HTML | Tampering | `escape()` helper on all string-interpolated fields |
| XSS via unescaped `narrativeInsight` in email or ReportScreen | Tampering | `escape()` in email builders; React auto-escapes JSX children so ReportScreen is safe for text nodes |
| XSS via `rationale` (LLM-generated, may include HTML fragments) leaking to candidate | Tampering | DO NOT RENDER rationale to candidates (Open Question 1); on admin panel render, use React text nodes (auto-escaped) not `dangerouslySetInnerHTML` |
| Attempt ID enumeration / IDOR expanding the report leak | Information Disclosure | Already mitigated by Phase 9 F-01 fix; this phase doesn't widen it |
| axe-core shipping to production, exposing a11y engine or bundle bloat | Repudiation / Availability | Dev-gate with `process.env.NODE_ENV !== 'production'` — verify with build inspection |
| Email HTML injection via malformed narrativeInsight breaking the layout | Tampering | Escape + do not permit `<style>` / `<script>` tags |

---

## Project Constraints (from CLAUDE.md)

- **File-size cap: 500 lines** — TestScreen.tsx (1178 lines) already violates; this phase MUST include an extraction refactor (see §Component Extraction Strategy). ReportScreen.tsx (240 lines) is fine even after Workstream 1 + Workstream 3 additions if kept tight.
- **No new documentation files unless requested** — this RESEARCH.md is invoked by `/gsd-plan-phase` so is permitted.
- **No working files in root** — new component files go under `assessment-app/src/components/test-screen/`; new tests under `tests/report/`, `tests/email/`, `assessment-app/src/components/__tests__/`.
- **Read files before editing** — planner tasks must read source files before Edit calls.
- **Never commit secrets** — no secrets in this phase; email content only uses server-controlled report fields.
- **Validate input at system boundaries** — the escape helper in Pattern 10 covers the email boundary. React auto-escapes JSX so component boundary is safe.
- **Co-Authored-By trailer** — controlled by `.claude/settings.json` (project-specific); planner should not add unless configured.

---

## Component Extraction Strategy (TestScreen.tsx)

Given TestScreen is 1178 lines and CLAUDE.md caps at 500, plus this phase adds material, recommend the following pre-work extraction (as its own plan or Wave 0):

| New File | Extracts (approx lines) | Purpose |
|----------|------------------------|---------|
| `src/components/test-screen/QuestionHeader.tsx` | ~40 lines (current 970–1010) | Level indicator + progress bar + XP + timer |
| `src/components/test-screen/ZoneOverlays.tsx` | ~140 lines (current 780–920) | Zone-complete + zone-brief overlay pair |
| `src/components/test-screen/ScenarioBlock.tsx` | ~30 lines (current 1015–1045, split reading vs. CT) | EP6 email letterhead OR reading-branch scenario |
| `src/components/test-screen/CaseFilePanel.tsx` | ~30 lines | CT case-file wrapper with fallback (item 7) |
| `src/components/test-screen/OptionsList.tsx` | ~120 lines (current MCQ/multi/hybrid render) | Options rendering with mcq_multi cue |
| `src/components/test-screen/ZoneConfig.ts` | ~350 lines (current ZONE_CONFIG constant) | Move zone config data to its own module (no JSX) |
| `src/components/TestScreen.tsx` | ≤ 400 lines after extraction | Orchestrator only |

Do this refactor with **zero behavior change first** (Wave 0 or its own plan), then do the feature edits on the smaller files.

---

## Cross-Phase & Roadmap Drift Notes

### ROADMAP.md drift
The current Phase 13 entry (lines 269–277) says:
> **Goal**: ARIA landmarks/roles added to ReportScreen.tsx; small independent a11y remediation, no ordering constraint on rest of milestone.
> **Requirements**: TBD (F-05)
> **Success Criteria**: 1. ReportScreen.tsx has ARIA landmarks + roles; passes axe-core baseline 2. Touches only in-browser report render, separate from Phase 9 email template

This is materially wrong now. Actual scope is 4 workstreams touching TestScreen, ReportScreen, CaseDashboard, DashboardCards, AsyncGrading.gs, and types. The planner should update ROADMAP.md Phase 13 entry as part of Wave 3 (analogous to 11-04's ROADMAP finalization). Rewrite:
- **Goal:** ARIA landmarks/roles on ReportScreen; single light theme replacing dark palette; UX polish per manager review (zone-wise numbering, mcq_multi cue, EP6 email block, CT case always available); richer per-question strength/weakness detail on candidate report; table-based HTML email templates for candidate + recruiter emails.
- **Requirements:** F-05, A11Y-01, UX-01…UX-06, REPORT-03, EMAIL-01 (all new IDs — REQUIREMENTS.md update needed)
- **Success Criteria:** (list all 4 workstreams' acceptance conditions)

### Phase 10 dependency risk
- Task 10-07 (live deploy + verification) is **open** as of research date.
- Workstream 3 (999.2) reads from GradingTranscripts sheet.
- Wave 3 (deploy) cannot verify richer-detail rendering until either 10-07 closes OR the defensive fallback (Pattern's Pitfall 5 mitigation) is in place.
- **Recommendation:** Implement defensive fallback in the backend extension (Wave 2). Wave 3 verification can then proceed even if 10-07 is still open — richer detail simply won't appear for older attempts, which is correct behavior anyway.

### CLAUDE.md 500-line cap violation
TestScreen.tsx currently 1178 lines — pre-existing violation. This phase adds material; recommend extraction plan as first ordered plan (Wave 0 or 10-13-02).

---

## Sources

### Primary (HIGH confidence)
- `assessment-app/package.json` — [VERIFIED: file read] React 19.2.4, Next.js 16.2.12, Tailwind ^4, framer-motion ^12.43.0
- `assessment-app/src/components/ReportScreen.tsx` — [VERIFIED: file read] 240 lines, zero ARIA, hardcoded dark palette
- `assessment-app/src/types/index.ts` — [VERIFIED: file read] Report interface lines 58–74, TranscriptEntry interface lines 45–55 already exists
- `assessment-app/src/app/globals.css` — [VERIFIED: file read] Tailwind v4 `@import "tailwindcss"` + `@theme inline` block; CSS var pattern established
- `backend/AsyncGrading.gs` — [VERIFIED: file read] `buildReportHtml` lines 425–448, `buildCandidateEmail` L450, `buildRecruiterEmail` L458, `MailApp.sendEmail` L473 with empty plaintext arg, `buildReportFromAttemptsRow` L400+ with column indices, `evaluateWithRubric` producing `{verdict, criteriaMet, rationale}`
- `assessment-app/src/components/TestScreen.tsx` — [VERIFIED: file read] 1178 lines, line 758 `isMulti`, line 981 global numbering, lines 1017–1035 shared reading+CT scenario render
- `assessment-app/AGENTS.md` — [VERIFIED: file read via system reminder] "This is NOT the Next.js you know — read node_modules/next/dist/docs/ before writing"
- `.planning/phases/10-.../10-RESEARCH.md` line 502 — [VERIFIED: grep + file read] "Never ship rationale to the candidate"
- `.planning/phases/13-.../CONTEXT.md`, `ASSUMPTIONS.md`, `DISCUSS-SUMMARY.md` — [VERIFIED: file read] scope + assumptions
- `.planning/REQUIREMENTS.md` line 107 — [VERIFIED: file read] BUG-04 is the only ID; F-05 tag
- `.planning/ROADMAP.md` lines 269–277 — [VERIFIED: file read] Phase 13 entry drift
- `.planning/config.json` — [VERIFIED: file read] `nyquist_validation: true`, `security_enforcement: true`, `security_asvs_level: 1`
- `C:\Users\anoop\OneDrive\Desktop\apple\flagmail1\.planning\quick\260525-sfa-.../260525-sfa-SUMMARY.md` — [VERIFIED: file read] `buildResultsHtml` pattern: table 640px, tier badge, zone cards, plain-text fallback preserved

### Secondary (MEDIUM confidence)
- Deque `@axe-core/react` npm compat gap for React 18+ — [CITED: WebSearch → npmjs.com/package/@axe-core/react and dequelabs/axe-core-npm#103] — retrieved during research
- Tailwind v4 CSS-first theme pattern via `@theme` block — [CITED: WebSearch → tailwindlabs discussion #15083, bryananthonio.com/blog/configuring-tailwind-css-v4] — matches project's existing usage in `globals.css`
- Email HTML best practices (Cerberus/Litmus patterns) — [ASSUMED: standard industry knowledge; verify via WebSearch at plan time if planner wants updated 2026 client-compat matrix]

### Tertiary (LOW confidence)
- WAI-ARIA APG progressbar pattern exact attribute set — [ASSUMED: from training; verify against https://www.w3.org/WAI/ARIA/apg/patterns/meter/ at plan time]
- axe-core current version — [ASSUMED: ^4.10.x; run `npm view axe-core version` at plan time]

---

## Metadata

**Confidence breakdown:**
- ARIA patterns (Workstream 1): HIGH — WAI-ARIA is a stable spec, ReportScreen structure is small and well-understood
- Light theme migration (Workstream 2 item 1): HIGH — Tailwind v4 pattern already used in project; palette swap is mechanical
- Zone-numbering / mcq_multi / EP6 / CT items: HIGH — implementation is JSX-local
- 999.2 transcript wiring (Workstream 3): MEDIUM — depends on live GradingTranscripts data; Phase 10 A6 rationale-exposure contradiction must be resolved by user
- 999.3 HTML email (Workstream 4): HIGH — reference implementation exists and is verified; only risk is email-client compatibility surprises
- axe-core tooling choice: MEDIUM — A8's specified `@axe-core/react` is invalid for React 19; recommendation to substitute is confident but the exact runtime pattern may need iteration
- Component extraction strategy: MEDIUM — extraction is safe but recommendations on file structure are opinion, not requirement
- Cross-workstream sequencing: MEDIUM — Phase 10 liveness is unknown; defensive fallback is the pragmatic hedge

**Research date:** 2026-08-01
**Valid until:** ~2026-09-01 (30 days for stable tech; sooner if axe-core / React / Tailwind ships a breaking change; check `npm view axe-core version` at plan time)
