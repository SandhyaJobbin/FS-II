---
phase: 1
slug: content-ingestion-question-bank
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-29
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x (Python ingestion pipeline; per 01-RESEARCH.md stack findings) |
| **Config file** | none — Wave 0 installs (`pytest.ini` / `pyproject.toml`) |
| **Quick run command** | `pytest tests/ingestion -x -q` |
| **Full suite command** | `pytest -q` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/ingestion -x -q`
- **After every plan wave:** Run `pytest -q`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | INGEST-01 | — | N/A | unit | `pytest tests/ingestion/test_manifest.py -q` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | INGEST-01 | — | N/A | unit | `pytest tests/ingestion/test_extractors.py -q` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | INGEST-03 | — | Reject malformed item loudly (all-or-nothing) | unit | `pytest tests/ingestion/test_validation_gate.py -q` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | INGEST-04 | — | N/A | unit | `pytest tests/ingestion/test_quotas.py -q` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | INGEST-02 | — | N/A | integration | `pytest tests/ingestion/test_ingest_e2e.py -q` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs provisional — planner may renumber; map updates at plan-check time.*

---

## Wave 0 Requirements

- [ ] `tests/ingestion/` — test package skeleton
- [ ] `tests/conftest.py` — fixtures: sample docx excerpts per marker convention (trailing ✅, leading ✅, ☑/☐, bold-run), malformed-item corpus
- [ ] `pip install pytest python-docx openpyxl` — per RESEARCH.md verified stack

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Spot-check imported questions against source docs | INGEST-01 | Human fidelity check of answer-key correctness on sample | Random 10 items/category; compare stem, options, keyed answer to source docx |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
