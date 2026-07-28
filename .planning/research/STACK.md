# Stack Research

**Domain:** Gamified, auto-graded, browser-proctored hiring assessment web platform
**Researched:** 2026-07-29
**Confidence:** HIGH (core framework/version data verified directly against the npm/PyPI registries and official Next.js docs; architectural recommendations MEDIUM — synthesized from verified primitives, not a live comparative benchmark)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.2.12 | Full-stack framework (App Router) | One codebase serves the candidate quiz UI, the recruiter admin panel, and the grading API. Server Components + Server Actions run exclusively on the server — exactly the boundary this project needs, since the question bank's `isCorrect` flags and grading logic must never reach the browser. Verified via official docs: Server Components are the recommended place to "use API keys, tokens, and other secrets without exposing them to the client," and the `server-only` package throws a build-time error if server-only code is ever imported into a client bundle — a compile-time guardrail against the exact leak this project must prevent. |
| React | 19.2.8 | UI library (bundled with Next.js) | `useActionState` + `useFormStatus` (stable in React 19) map cleanly onto "submit an answer, get live score feedback" without hand-rolled fetch/loading state. |
| TypeScript | 7.0.2 | Type safety across ingestion → DB → API → UI | TS 7 is the native (Go-ported) compiler rewrite ("Corsa"), currently the stable `latest` tag — 5-10x faster typechecking, which matters as Prisma-generated types for a 375-question bank plus attempt/report models grow. Strict typing end-to-end also protects the "answer key must never leak" requirement: the client-facing DTO can be a distinct, narrower type than the server-side question type, turning a leak into a compile error. |
| Tailwind CSS | 4.3.3 | Styling, gamified UI (progress bars, level badges, timers) | Utility-first CSS is the fastest way to build the "level progression / points reveal" visual language without a hand-built design system; v4's CSS-first config removes the `tailwind.config.js` setup step. |
| PostgreSQL | 16+ (managed — Neon/Supabase/Railway) | Primary datastore | Needs real relational integrity (question → options → category/level, attempt → assigned-questions → candidate-answers) plus concurrent writes from the admin panel and integrity-event logging during live attempts. Managed serverless Postgres avoids ops overhead for an internal hiring tool while surviving a stateless/serverless deploy (SQLite's local file does not persist reliably across serverless instances). |
| Prisma ORM | 7.9.1 | Database access, migrations, seeding | Prisma 7 ships without the old Rust query-engine binary (replaced by TypeScript/WASM + driver adapters), removing the serverless cold-start / binary-mismatch problems that plagued Prisma on Vercel in earlier versions. `prisma db seed` is the natural landing spot for the ingested 375-question JSON. |
| Zustand | 5.0.14 | Client-side quiz UI state (current question, per-question countdown, level progress, integrity-event counters for display) | Minimal-boilerplate store, no Provider wrapping, trivial to split into slices (timer, navigation, violation-counter). Redux Toolkit's ceremony buys nothing here — this is transient UI state, not app-wide business state (score/correctness live server-side). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@mediapipe/tasks-vision` | 1.0.0 (published 2026-07-28 — actively maintained) | Free, on-device webcam face presence/count detection | Load the `FaceDetector` task with a bundled/self-hosted model; run inference against `<video>` frames entirely in-browser via WASM/WebGL. Report only aggregate signals to the server (`face_count`, `no_face_ms`, `multi_face_ms`) — never upload frames or video. Google's actively maintained, purpose-built replacement for the older `@mediapipe/face_detection` package; standard 2025/2026 choice for zero-cost, in-browser face detection. |
| `zod` | 4.4.3 | Runtime validation at every system boundary | Validate ingested question-bank JSON shape before seeding, validate candidate name/email on entry, validate every Server Action's `FormData` input server-side. |
| `iron-session` | 8.0.4 | Encrypted, stateless session cookie for candidate identification and admin login | No passwords, no OAuth, no multi-provider login needed — just "capture name + email, block a second official attempt" plus a handful of trusted recruiters. Explicitly recommended in Next.js's own authentication guide alongside `jose`; gives an httpOnly, signed/encrypted cookie in a few lines — far less surface area than a full auth framework for a flow with no candidate login screen at all. |
| `jose` | 6.2.4 | JWT/JWE signing for session payloads | Used per the Next.js guide's `SignJWT`/`jwtVerify` pattern; Edge-runtime compatible if middleware-level session checks are needed later. |
| `react-hook-form` | 7.83.0 | Candidate entry form (name + email), admin filters | Lightweight, uncontrolled-input form handling; pairs with `zod` via `@hookform/resolvers`. |
| `framer-motion` (also ships as `motion`) | 12.43.0 | Level-transition, points-reveal, progress-bar animations | The "gamified" layer — animating a level-complete badge, a ticking points counter, a filling progress bar. Skip for simple fades (plain CSS transitions suffice). |
| `nanoid` | 6.0.0 | Attempt IDs / short public-facing report links | Smaller/faster than `uuid` for URL-exposed identifiers. |
| `date-fns` | 4.4.0 | Timer/duration formatting, report date display | Formatting only — never the timer's source of truth (must be authoritative server-side). |
| `vitest` | 4.1.10 | Unit tests for the grading engine and randomized-assembly logic | The deterministic-grading requirement makes this the single most important thing to unit-test. |
| `playwright` | 1.62.0 | E2E tests: full attempt flow, tab-switch/blur simulation, admin review | Can dispatch real `visibilitychange`/`blur` events and simulate devtools-open heuristics — exactly the integrity-monitoring surface to regression-test. |
| `python-docx` | 1.2.0 (PyPI) | One-time ingestion script: parse the 3 `.docx` question banks | Paragraph/run-level access reliably detects the existing inline answer-key markers (checkmark for single-answer, checked/unchecked box glyphs for multi-select) as distinct characters/run formatting — more precise than a generic docx-to-HTML converter. |
| `openpyxl` | 3.1.5 (PyPI) | One-time ingestion script: parse `FS QB Pattern.xlsx` category/quota sheet | Reads the settled per-category "questions to be given" quotas driving randomized per-attempt assembly. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `prisma migrate` / `prisma db seed` | Schema migrations + one-shot load of ingested question-bank JSON into Postgres | Run the Python ingestion script first (offline, produces `questions.json` committed to repo), then `prisma db seed` reads it — keeps Python out of the production runtime entirely. |
| ESLint + `typescript-eslint` | Lint/type-check gate in CI | Enforce (via lint rule or review checklist) that any module touching `correctOptionIds`/`isCorrect` carries an `import "server-only"` guard. |
| `server-only` (npm package) | Compile-time guard against leaking server modules into client bundles | Import at the top of any file touching the answer key or grading logic — Next.js hard-fails the build if such a file is imported by a Client Component. Cheapest, highest-leverage control for this project's core security constraint. |

## Installation

```bash
# Core web app
npx create-next-app@latest fs-assessment --typescript --tailwind --app
cd fs-assessment
npm install zustand zod iron-session jose react-hook-form @hookform/resolvers
npm install framer-motion nanoid date-fns
npm install @mediapipe/tasks-vision
npm install server-only

# Database
npm install prisma --save-dev
npm install @prisma/client
npx prisma init

# Dev dependencies
npm install -D vitest @vitest/ui playwright @playwright/test typescript-eslint

# Ingestion (separate Python venv, not part of the web app's runtime deps)
pip install python-docx==1.2.0 openpyxl==3.1.5
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Prisma 7.9.1 | Drizzle ORM 0.45.2 | If the team is SQL-fluent and wants a thinner, edge-runtime-native query builder with less codegen magic. Either works for this project's simple relational shape; Prisma's schema-first DX and mature seed/studio tooling fit a small team building fast. |
| PostgreSQL (managed) | SQLite via `better-sqlite3` 13.0.1 | If deployed as a single long-running process on one fully-controlled VM/container (not serverless), with low candidate volume. Avoid combining with serverless hosting. |
| `iron-session` + `jose` | Auth.js/NextAuth (`next-auth` 4.24.15, `@auth/core` 0.41.3) | Only if the admin panel needs to grow into multi-provider SSO for many recruiters. Overkill for one-attempt-per-email candidates + a handful of admins. |
| `@mediapipe/tasks-vision` | `@vladmandic/human` 3.3.6 | Also actively maintained (last published 2025-08-26); superset of features (age/gesture/emotion, iris tracking) on TensorFlow.js. Use only if richer facial-analysis signals are needed later — heavier model download than this project's scope requires. |
| `python-docx` + `openpyxl` | `mammoth` 1.12.0 (Node, docx→HTML/Markdown) | Reasonable if the team wants a pure JS/TS toolchain with no Python step, and the answer-key markers survive an HTML conversion cleanly. `python-docx`'s direct run-level access is the more precise/controllable path given the specific inline symbol markers used. |
| Zustand | Redux Toolkit | Only if quiz state needs sharing across many independent modules with strict time-travel debugging — overkill for one self-contained quiz flow. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `face-api.js` | Latest npm version (0.22.2) published 2020-03-22 — over 6 years stale as of this research date, verified via npm registry timestamp. Wraps an old TensorFlow.js core with no active maintenance. | `@mediapipe/tasks-vision` (last release 2026-07-28) |
| Sending correct-answer flags to the browser (even "encoded"/obfuscated), grading in client JS | Directly violates the hard security constraint — any client-side value is readable via devtools regardless of obfuscation. | Server Actions/Route Handlers that accept only selected option IDs and check correctness server-side against the Prisma-modeled answer key |
| `localStorage`/`sessionStorage` as authoritative store of attempt progress, elapsed time, or score | Trivially editable via devtools, enabling fabricated scores or timer bypass. | Server-side periodic autosave of progress; server is source of truth for elapsed time and score |
| Paid cloud vision APIs (AWS Rekognition, Azure Face API, Google Cloud Vision) or full video-recording proctoring services | Explicitly out of scope per project constraints (cost, storage/privacy liability). | `@mediapipe/tasks-vision` FaceDetector on-device, aggregate signals only |
| Relying solely on `disable-devtool` (0.3.9) or similar devtools-blockers as a security control | Trivially bypassed; gives false sense of security. | Log devtools-open heuristics only as one more integrity signal alongside tab-blur/copy-paste; rely on the server-only answer-key architecture for actual security |
| Assuming npm's `xlsx` package tracks SheetJS's latest release | Npm-published `xlsx` has been stuck at 0.18.5 since 2022-03-24 (verified via registry timestamp) — SheetJS stopped publishing current releases to npm. | Pin `xlsx@0.18.5` deliberately as "good enough, verified," not expecting `npm update` to pull newer SheetJS builds |

## Stack Patterns by Variant

**If deploying to Vercel (recommended default):**
- Use managed serverless Postgres (Neon/Supabase) with Prisma driver adapters, not `better-sqlite3`
- Self-host MediaPipe WASM/model assets from `public/` rather than a third-party CDN, so the webcam check doesn't silently break mid-attempt

**If self-hosting on a single VM/container:**
- SQLite (`better-sqlite3`) becomes a legitimate simplification — no serverless cold-start/ephemeral-filesystem concern
- Enforce the server-only answer-key boundary identically regardless of hosting choice

**If the question bank grows past 375 items or gains multiple content owners:**
- Keep the Python ingestion script as the canonical docx/xlsx→JSON step, but add a JSON Schema (or reuse the `zod` schema) as a CI check on every content update

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `next@16.2.12` | `react@19.2.8`, `react-dom@19.2.8` | Next.js 16 requires React 19; both published within days of each other — no version-skew risk from `create-next-app@latest` today. |
| `prisma@7.9.1` | `@prisma/client@7.9.1` (must match) | Client/CLI must stay in lockstep; v7's removal of the Rust binary means driver adapters (e.g. `@prisma/adapter-pg`) are the recommended connection path for serverless deploys. |
| `typescript@7.0.2` | `next@16.2.12`, `zod@4.4.3` | TS 7 is a from-scratch native rewrite; as of this research, Next.js, Zod 4, and Prisma 7 all publish compatible types. Fallback to `typescript@~5.9` only if a niche dependency's hand-written `.d.ts` relies on old inference quirks. |
| `@mediapipe/tasks-vision@1.0.0` | Modern evergreen browsers (WASM+WebGL) | No support for very old browsers — acceptable, documented candidate-facing requirement for this internal tool. |

## Sources

- Next.js official docs (`nextjs.org/docs/app/getting-started/server-and-client-components`, `nextjs.org/docs/app/guides/authentication`) — fetched directly; version confirmed 16.2.12. Confidence: HIGH.
- npm registry (`registry.npmjs.org`) — queried directly for `next`, `react`, `react-dom`, `typescript`, `tailwindcss`, `prisma`, `drizzle-orm`, `better-sqlite3`, `pg`, `zustand`, `zod`, `iron-session`, `jose`, `react-hook-form`, `framer-motion`, `nanoid`, `date-fns`, `vitest`, `playwright`, `next-auth`, `@auth/core`, `mammoth`, `docx`, `@mediapipe/tasks-vision`, `@tensorflow/tfjs`, `@vladmandic/human`, `face-api.js`, `disable-devtool`, `xlsx`, including publish timestamps for maintenance-status verification. Confidence: HIGH.
- PyPI (`pypi.org/pypi/<package>/json`) — queried directly for `python-docx` (1.2.0) and `openpyxl` (3.1.5). Confidence: HIGH.
- Context7 MCP and general web search were unavailable in this session; architectural rationale is therefore MEDIUM confidence — grounded in the verified version/maintenance data above plus established ecosystem patterns, not cross-checked against a live comparison article this run.

---
*Stack research for: Gamified, auto-graded, browser-proctored hiring assessment platform*
*Researched: 2026-07-29*
