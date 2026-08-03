# Phase 11: Recruiter Analytics Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-03
**Phase:** 11-recruiter-analytics-dashboard
**Areas discussed:** Plans-existing gate, gray-area selection (all deferred to Claude)

---

## Plans exist (workflow gate)

| Option | Description | Selected |
|--------|-------------|----------|
| Continue and replan after | Capture decisions in CONTEXT.md, then replan the 4 plans to fold them in | ✓ |
| View existing plans | Print what the 4 written plans locked for the 5 research open questions before deciding | |
| Cancel | Stop | |

**User's choice:** Continue and replan after
**Notes:** Plans 11-01..04 were written without user CONTEXT. User wants decisions captured now and the 4 plans replanned to absorb them.

---

## Gray-area selection (present_gray_areas)

| Option | Description | Selected |
|--------|-------------|----------|
| Bias-direction: label & what it shows | Semantics of the fourth signal given no demographic data; research recommends "Distribution Monitor" label + ADMIN-09 discrimination-index pairing; route true adverse-impact to v2 ADMIN2-04 | |
| Low-N thresholds (5/5/10/15) | Per-signal "not enough data yet" thresholds; research draft defaults | |
| ADMIN-10 LLM digest scope | In v1 or defer to Phase 11.5/backlog | |
| Date-range filter in v1 | Ship without (research rec) or include Last 30/90/all now | |

**User's choice:** "decide for me" (free-text through Other)
**Notes:** User deferred all four to research recommendations. Claude locked each to its 11-RESEARCH.md recommendation verbatim and recorded the per-signal low-N thresholds explicitly because current plan 11-02 appears to use a uniform threshold of 5, which diverges from the research draft on violation-correlation (≥10/≥20) and biasSignals (≥15). Replan must align.

---

## Claude's Discretion

All four gray areas were deferred to Claude by the user ("decide for me"). Claude locked each to its 11-RESEARCH.md recommendation. Additional discretionary latitude recorded: Analytics.gs module split, exact recharts dark-theme tokens, discrimination-index reducer placement, vitest fixture specifics.

## Deferred Ideas

- ADMIN-10 LLM narrative digest → Phase 11.5 / backlog (D-04)
- Date-range filter ("Last 30 / 90 / all" toggle) → v1.1 additive `?range=` param (D-05)
- CacheService TTL materialized-view upgrade → trigger only if live aggregationMs > 2000ms (D-12)
- Broad `?token=` → `Authorization: Bearer` header refactor for all `/admin/*` endpoints → separate backlog (Pitfall 5)
- True demographic adverse-impact monitoring (ADMIN2-04) → v2, explicitly OOS