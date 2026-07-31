---
slug: case-dashboard-object-child
status: resolved
trigger: "Runtime Error: Objects are not valid as a React child (found: object with keys {name, content, position}) at CaseDashboard.tsx:54 (motion.div) via TestScreen → Home. Next.js 16.2.12 (Turbopack)"
created: 2026-07-29
updated: 2026-07-29
---

# Debug Session: case-dashboard-object-child

## Trigger

DATA_START
## Error Type
Runtime Error

## Error Message
Objects are not valid as a React child (found: object with keys {name, content, position}). If you meant to render a collection of children, use an array instead.

    at CaseDashboard (src/components/CaseDashboard.tsx:54:11)
    at TestScreen (src/components/TestScreen.tsx:473:17)
    at Home (src/app/page.tsx:185:9)

## Code Frame
  52 |       <div className="p-6 overflow-y-auto flex-1 text-sm leading-relaxed text-slate-300 fo...
  53 |         <AnimatePresence mode="wait">
 > 54 |           <motion.div
     |           ^
  55 |             key={activeTab}
  56 |             initial={{ opacity: 0, y: 4 }}
  57 |             animate={{ opacity: 1, y: 0 }}

Next.js version: 16.2.12 (Turbopack)
DATA_END

## Symptoms

- **Expected behavior:** Case dashboard tab content renders (case briefing view inside test flow)
- **Actual behavior:** React runtime crash — object `{name, content, position}` rendered as child inside `motion.div` keyed by `activeTab`
- **Error messages:** See Trigger block (verbatim paste)
- **Timeline:** Surfaced immediately after BlazeFace/webcam fixes (sessions webpage-loads-forever-local, blazeface-load-undefined) unblocked navigation to this screen — likely pre-existing, previously unreachable
- **Reproduction:** `npm run dev` → localhost:3000 → proceed through test screen to case dashboard

## Initial Hypothesis Seeds

- Something inside the `motion.div` (tab content for `activeTab`) renders an object shaped `{name, content, position}` directly instead of a string/element — likely tab config, case section, or field where `content` holds the renderable string but the whole object is interpolated (e.g. `{section}` instead of `{section.content}`). Shape suggests domain object: suspect case data (section/person/note with name+content+position) or tab definition array.

## Current Focus

- hypothesis: CONFIRMED — schema drift: server sends `tabs: Tab[]`, frontend assumed `Record<string, string>`
- next_action: none — resolved

## Evidence

- timestamp: 2026-07-29 — CaseDashboard.tsx was clean internally: typed `Record<string, string>`, rendered `{tabs[activeTab]}`. Crash meant runtime value violated type.
- timestamp: 2026-07-29 — `content/questions.json`: 160 of 385 questions carry `tabs` as ARRAY of `{name, content, position}` (verified via node: `typeof tabs: array`).
- timestamp: 2026-07-29 — `ingestion/normalize.py` canonical schema: `tabs: Optional[List[Tab]]` where `Tab{name:str, content:str, position:int}`. `ingestion/parsers/attention.py` emits exactly this shape, sorted by position.
- timestamp: 2026-07-29 — `backend/Code.gs` embedded question bank: 160 questions with `"tabs": [` array-form, 0 object-form. Served raw via `tabs: q.tabs` (line 219) — no transform at boundary.
- timestamp: 2026-07-29 — Crash mechanics: `Object.keys(tabs)` on array → keys `"0","1","2"` → tab buttons mislabeled with indices; `tabs["0"]` → full `{name, content, position}` object → React object-as-child crash in motion.div.
- timestamp: 2026-07-29 — Three data stores agree on array shape (normalize.py, questions.json, Code.gs); only frontend consumers (assessment-app types + CaseDashboard, legacy frontend/app.js) and tests/assembly fixtures assumed keyed-object. Data model = canonical; consumers wrong.
- timestamp: 2026-07-31 — Legacy `frontend/` directory deleted (Phase 8 F-06). `frontend/app.js` no longer exists.
- timestamp: 2026-07-29 — Adjacent drift (same class, latent): `tables` typed `Record<string, string[][]>` in frontend but ingestion emits `List[TableContent]` `{caption, headers, rows, position}`. Not rendered anywhere in app → no crash today; type corrected preventively.

## Eliminated

- Bug inside CaseDashboard render logic itself — component matched its declared type; type was the lie.
- Fix at GAS boundary (transform array → record server-side) — rejected: 3 canonical stores use array shape; position ordering is explicit data; GAS redeploy not hot-reloadable. Consumer-side fix is the root-cause fix.

## Resolution

- root_cause: Schema drift between ingestion pipeline and frontend contract. Server payload sends `tabs` as `Tab[]` (`{name, content, position}[]`, per normalize.py `List[Tab]` and Code.gs embedded bank), but `Question.tabs` was typed `Record<string, string>` and CaseDashboard consumed it via `Object.keys`/`tabs[key]` — turning array indices into tab labels and rendering a whole tab object as a React child.
- fix: Aligned frontend contract with canonical data model. (1) `src/types/index.ts`: added `Tab` and `TableContent` interfaces matching ingestion models; `tabs?: Tab[] | null`, `tables?: TableContent[] | null`. (2) `src/components/CaseDashboard.tsx`: accepts `Tab[]`, sorts by `position` (useMemo), keys/labels buttons by `tab.name`, renders `tab.content` only. (3) `src/components/TestScreen.tsx`: `hasTabs` check now array-length based. No band-aids (no JSON.stringify, no dual-shape shim — no record-shape data exists in any store or cache).
- verification: `npx tsc --noEmit` clean. Sanity scan: CaseDashboard has a single render path for all tabs → every tab panel fixed by same change; grep confirms no other `tabs`/`tables` render sites in src. Awaiting user visual confirm on localhost:3000 (hot reload) — navigate to case dashboard, tab labels should read e.g. "Review Information" / "Booking Details" with correct body text.
- files_changed: assessment-app/src/types/index.ts; assessment-app/src/components/CaseDashboard.tsx; assessment-app/src/components/TestScreen.tsx

## Postmortem (blameless)

- why_not_caught: none — no contract check between ingestion output schema and frontend types; screen unreachable until two prior runtime errors fixed, so crash never executed in dev.
- guard: frontend types now mirror ingestion pydantic models verbatim (Tab, TableContent); `tsc --noEmit` passes. Legacy `frontend/app.js` deleted (Phase 8 F-06). `tests/assembly` fixtures use Record shape — flagged for follow-up, out of scope for this flow.
- followups: tests/assembly fixture shape vs canonical List[Tab] (legacy frontend/app.js resolved — directory removed).
