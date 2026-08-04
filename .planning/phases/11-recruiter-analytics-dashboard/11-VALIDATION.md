---
phase: 11
slug: recruiter-analytics-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `11-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` (repo root) |
| **Quick run command** | `npm test -- tests/analytics/` (path pending; established Wave 0) |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10–20 seconds for analytics suite |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- tests/analytics/`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

Seeded from RESEARCH.md test map. Planner must assign Wave/task IDs and align each to the lockable per-signal thresholds in `11-CONTEXT.md` D-03.

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| ADMIN-06 | Score trend builds day-bucketed points from ≥N attempts | unit | `npm test -- tests/analytics/test_score_trend.ts -x` | ❌ Wave 0 | ⬜ pending |
| ADMIN-06 | Score trend returns `enough_data: false` at N<threshold (≥5 attempts across ≥3 days) | unit | same file | ❌ Wave 0 | ⬜ pending |
| ADMIN-07 | Question stats denominator matches `computeAggregatesForAttempt` A2 policy on fixture attempt (parity) | unit | `npm test -- tests/analytics/test_question_stats.ts -x` | ❌ Wave 0 | ⬜ pending |
| ADMIN-07 | Question stats returns `passRate: null` for questions below MIN sample size (≥5 graded) | unit | same file | ❌ Wave 0 | ⬜ pending |
| ADMIN-08 | Pearson r matches hand-computed reference on 20-point fixture (within 0.001) | unit | `npm test -- tests/analytics/test_correlation.ts -x` | ❌ Wave 0 | ⬜ pending |
| ADMIN-08 | Correlation returns `enough_data: false` below threshold (≥10 w/ violations OR ≥20 total) | unit | same file | ❌ Wave 0 | ⬜ pending |
| ADMIN-09 | Discrimination index flags anti-discriminating question in curated fixture; quartile-threshold (≥8 ready attempts) asserted | unit | `npm test -- tests/analytics/test_discrimination.ts -x` | ❌ Wave 0 | ⬜ pending |
| ADMIN-11 | Low-N fallback renders on each card when its signal is below its per-signal threshold (not a uniform 5) | component/UI | `npm test -- tests/admin/test_analytics_ui.ts -x` | ❌ Wave 0 | ⬜ pending |
| Auth invariant | Endpoint returns `{success:false,error:"Unauthorized"}` when token missing/wrong | unit | `npm test -- tests/analytics/test_analytics_auth.ts -x` | ❌ Wave 0 | ⬜ pending |
| Data-quality invariant | Ungraded count is surfaced (not zero-defaulted) in payload | unit | `npm test -- tests/analytics/test_ungraded_caveat.ts -x` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/analytics/` directory + shared fixture `fixtures/attempts_20.json` (mixed statuses, ungraded rows, at least one override)
- [ ] `tests/analytics/test_score_trend.ts` (≥5 attempts/≥3 days threshold assertion)
- [ ] `tests/analytics/test_question_stats.ts` — imports `effectiveVerdict` mirror/shared for A2 parity
- [ ] `tests/analytics/test_correlation.ts` — hand-computed reference values (≥10/≥20 gating, not uniform 5)
- [ ] `tests/analytics/test_discrimination.ts` — quartile-threshold (≥8 ready) assertion
- [ ] `tests/analytics/test_ungraded_caveat.ts`
- [ ] `tests/analytics/test_analytics_auth.ts`
- [ ] `tests/admin/test_analytics_ui.ts` — RTL low-N per-signal fallback
- [ ] `scripts/sync-check.ts` — likely no extension (no client-mirrored logic in Phase 11)

*These align to CONTEXT.md D-03 per-signal thresholds. Existing plan 11-02's uniform threshold of 5 must be widened to ≥10/≥20 (correlation), ≥15 (bias), ≥8 (discrimination quartile).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live `/admin/analytics` renders correctly against real attempt data under admin session | ADMIN-06..11 + D-12 | Requires real Apps Script deployment + recruiter session | Plan 11-04 Task — paste Analytics.gs, redeploy Next.js, open `/admin/analytics`, confirm 4 charts render, `meta.aggregationMs` visible, UngradedCaveat shows on cards, "Distribution Monitor" label present (Pitfall 3 / CONTEXT D-01) |
| `aggregationMs` < 2000ms live | D-12 (Pitfall 1) | Live timing against real sheet volume | Plan 11-04 Task — read `meta.aggregationMs` from response; if > 2000, file CacheService backlog line in SUMMARY |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < ~20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending