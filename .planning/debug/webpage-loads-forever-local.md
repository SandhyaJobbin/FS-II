---
slug: webpage-loads-forever-local
status: resolved
trigger: the webpage keep loading but nothing opens up when I deploy locally.
created: 2026-07-29
updated: 2026-07-29
---

# Debug Session: webpage-loads-forever-local

## Trigger

DATA_START
the webpage keep loading but nothing opens up when I deploy locally.
DATA_END

## Symptoms

- **Expected behavior:** Dev server starts, page loads in browser
- **Actual behavior:** Browser tab spins forever, blank page
- **Error messages:** No errors anywhere (terminal clean, browser console clean)
- **Timeline:** Never worked locally (first local deploy attempts)
- **Reproduction:** `npm run dev` → open localhost:3000

## Current Focus

- hypothesis: turbopack.root set to monorepo parent (inside OneDrive) → filesystem watch/scan of huge tree hangs request-triggered compile silently
- test: set root to app dir, clear .next, restart dev, curl /
- expecting: HTTP 200 instead of indefinite hang
- next_action: done — verified

## Evidence

- timestamp: 2026-07-29 — App code clean: `src/app/page.tsx` is client component, no server awaits, no DB; fetch only on user action. No middleware, no instrumentation. `.env` has only harmless `NEXT_PUBLIC_GAS_URL`.
- timestamp: 2026-07-29 — `next.config.ts` had `turbopack.root: path.resolve(__dirname, "..")` → project root = monorepo parent containing parent `node_modules/`, `.git/`, `Fraud support/` dirs, `ruvector.db`, stray dirs — all inside OneDrive sync folder.
- timestamp: 2026-07-29 — Next docs (`turbopack.md`): root expands "filesystem watching overhead"; should only point outside project for linked deps.
- timestamp: 2026-07-29 — Ports 3000/3001 free before test → port conflict eliminated.
- timestamp: 2026-07-29 — REPRODUCED: dev server "Ready in 1470ms", listens on 3000, but `Invoke-WebRequest http://localhost:3000` timed out after 60s. Log showed NO compile line, NO error → silent hang confirmed.
- timestamp: 2026-07-29 — After `root: __dirname`: first retry 500 `Cannot find module 'framer-motion'` from STALE `.next` chunk (module exists in app node_modules). Deleted `.next` → GET / 200 in 5.9s, 15.7KB HTML.
- timestamp: 2026-07-29 — Verified: GET /admin 200 (1.6s), GET / cached 200 (150ms).

## Eliminated

- Port conflict (3000 was free)
- Server-component await / blocking module-level await (all client code)
- Missing env vars (only NEXT_PUBLIC_GAS_URL, non-blocking)
- Middleware hang (no middleware file)
- next/font/google network hang (not needed — fix landed without touching fonts)
- framer-motion missing (installed; error was stale .next cache)

## Resolution

- root_cause: `turbopack.root` in `next.config.ts` pointed at the monorepo parent directory (inside OneDrive); Turbopack's filesystem watching/resolution over that huge synced tree made request-triggered compilation hang forever with zero output. Stale `.next` cache from the broken config then masked the fix with a spurious MODULE_NOT_FOUND until cleared.
- fix: `next.config.ts` → `turbopack.root: __dirname` (app dir); removed now-unused `path` import; deleted stale `.next` cache.
- verification: `Invoke-WebRequest http://localhost:3000` → 200 (5.9s cold, 150ms warm); `/admin` → 200. Previously timed out at 60s.
- files_changed: assessment-app/next.config.ts (+ deleted assessment-app/.next cache)
- prevention: why not caught: none (no gate existed for this class) — config one-liner copied from monorepo doc example. guard: keep turbopack.root at app dir unless linking external deps; if dev server "Ready" but page spins forever, test with curl/Invoke-WebRequest and check `.next` staleness + project-root scope (especially under OneDrive/Dropbox sync folders).
