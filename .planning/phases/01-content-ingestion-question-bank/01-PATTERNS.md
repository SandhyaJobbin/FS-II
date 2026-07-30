# Phase 1: Content Ingestion & Question Bank - Pattern Map

**Mapped:** 2026-07-29
**Files analyzed:** 15 planned files
**Analogs found:** 0 / 15 — **GREENFIELD PROJECT**

## Greenfield Declaration

**No source code exists in this workspace.** Verified via directory listing and glob:
- No `src/`, `ingestion/`, `prisma/`, `content/` directories
- No `package.json`, `*.ts`, `*.py`, `*.prisma` files anywhere in repo
- Workspace contains only: `.planning/` docs, `Fraud support/` source docx/xlsx, config dotfolders, `CLAUDE.md`

**Consequence:** every planned file below is marked `no analog — greenfield`. No codebase patterns exist to copy. Instead, this document records:
1. **Canonical reference patterns** — code excerpts from `01-RESEARCH.md` and `.planning/research/` docs, verified live against the real source files this session. Planner should treat these as the authoritative starting implementations, not loose guidance.
2. **Conventions** — binding rules extracted from STACK.md / ARCHITECTURE.md / RESEARCH.md that all new files must follow.

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `ingestion/parsers/docx_bank.py` | parser (service) | file-I/O, transform | none | no analog — greenfield |
| `ingestion/parsers/markers.py` | utility (extractors) | transform | none | no analog — greenfield |
| `ingestion/parsers/xlsx_quotas.py` | parser (service) | file-I/O, transform | none | no analog — greenfield |
| `ingestion/normalize.py` | service | transform | none | no analog — greenfield |
| `ingestion/validate.py` | service (validation) | transform, batch | none | no analog — greenfield |
| `ingestion/manifest.py` | config (declarative data) | batch | none | no analog — greenfield |
| `ingestion/run.py` | CLI entry (controller) | batch, file-I/O | none | no analog — greenfield |
| `ingestion/tests/test_*.py` + fixtures | test | batch | none | no analog — greenfield |
| `content/questions.json` | data artifact | — (emitted) | none | no analog — greenfield |
| `content/quotas.json` | data artifact | — (emitted) | none | no analog — greenfield |
| `content/ingestion-report.json` | data artifact | — (emitted) | none | no analog — greenfield |
| `prisma/schema.prisma` | model/config | CRUD (schema) | none | no analog — greenfield |
| `prisma/seed.ts` | service (seed) | batch, CRUD | none | no analog — greenfield |
| `vitest.config.ts` | config | — | none | no analog — greenfield |
| `pytest.ini` (or pyproject section) | config | — | none | no analog — greenfield |

## Pattern Assignments (Reference Implementations from Verified Research)

No codebase analogs exist. Patterns below are quoted from `01-RESEARCH.md` — every one was executed against the real source files this session (HIGH confidence). Planner: copy these as implementation seeds, do not re-derive.

### `ingestion/parsers/docx_bank.py` (parser, file-I/O / transform)

**Reference: document-order traversal** (RESEARCH.md lines 277–289). Mandatory — `doc.paragraphs` alone misses the 5 dashboard tables in the Attention doc:
```python
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

def iter_block_items(doc):
    for child in doc.element.body.iterchildren():
        if child.tag.endswith('}p'):
            yield Paragraph(child, doc)
        elif child.tag.endswith('}tbl'):
            yield Table(child, doc)
```

**Structure-walker rules** (RESEARCH.md "Anti-Patterns", lines 220–227):
- All paragraphs are style `Normal` → heading detection is **regex-on-text only**; never style-based
- Tolerate non-contiguous part numbers (English skips Parts 4–5) and both `CASE 1:` / `CASE 1 –` (en-dash) heading forms
- Critical Thinking doc: skip paragraphs 0–58 (preamble contains LLM-authoring chatter at paras 47–58); begin at first `CASE \d+ –` heading
- Split paragraph text on `\n` before applying option regex (options share paragraphs, e.g. Attention L2 Case 1 Q1)
- Preserve `{{ticket.requester.first_name}}` template placeholders verbatim (Macro items)
- Preserve unicode (curly quotes, ✅/☑/☐) in stored display text; normalize only for matching

### `ingestion/parsers/markers.py` (utility, transform)

**Pattern: one extractor per marker convention, selected by (doc, section) context — never a global checkmark hunt** (RESEARCH.md Pattern 2, lines 206–214).

| Convention | Where | Rule |
|-----------|-------|------|
| Bold run | English Part 1 (Grammar) | exactly 1 option paragraph with `run.bold is True` |
| Trailing ✅ | English Part 6/7, Attention single-answer | option text ends with ✅; exactly 1 per question |
| Leading ✅ | Critical Thinking (all) | option text starts with ✅; ≥1 per question |
| ☑/☐ pair | Attention multi-select | leading ☑ = correct, ☐ = incorrect; ≥1 of each |

**Reference: bold-run extraction** (RESEARCH.md lines 292–300, verified against Part 1 Q1 where option b is bold):
```python
def bold_correct_index(option_paragraphs):
    hits = [i for i, p in enumerate(option_paragraphs)
            if any(r.bold for r in p.runs if r.text.strip())]
    if len(hits) != 1:
        raise MalformedItem(f"expected exactly 1 bold option, got {len(hits)}")
    return hits[0]
```

**Reference: multi-line option splitting + marker extraction** (RESEARCH.md lines 303–317):
```python
import re
OPT = re.compile(r"^([☑☐✅]?)\s*([A-D])\.\s*(.+?)\s*(✅)?$")

def parse_options(paragraph_text):
    options = []
    for line in paragraph_text.split("\n"):
        m = OPT.match(line.strip())
        if not m:
            continue
        lead, letter, text, trail = m.groups()
        correct = (lead == "☑") or (trail == "✅") or (lead == "✅")
        options.append({"letter": letter, "text": text.strip(), "correct": correct})
    return options
```
Note: English Grammar options use lowercase `a)`–`d)`; Attention/CT use uppercase `A.`–`D.` — extractor must be told which alphabet form per section.

### `ingestion/parsers/xlsx_quotas.py` (parser, file-I/O)

**Reference: Sheet2 read with guards** (RESEARCH.md lines 320–326):
```python
wb = openpyxl.load_workbook(path, data_only=True)
assert "Sheet2" in wb.sheetnames, "settled quotas sheet missing"
ws = wb["Sheet2"]
assert [c.value for c in ws[1][:4]] == ["Assessment Section", "Question Bank Category",
                                        "Volume", "Questions to be given"]
```

**Guards (RESEARCH.md Pitfall 5, lines 262–264):** loader must whitelist exact filename `FS QB Pattern.xlsx`, assert sheet is `Sheet2` (Sheet1 = pre-revision), reject `FS QB Pattern(1).xlsx`, and annotate each quota row with `unit: "questions" | "cases"` (English rows = questions; Attention/CT rows = cases, matching Volume denomination). Cross-check pool volumes vs parsed bank volumes (e.g. Grammar 30 = parsed 30); loud error on mismatch.

### `ingestion/manifest.py` (config, declarative)

**Reference: verified expected-structure manifest** (RESEARCH.md Pattern 1, lines 190–204 — all values verified by live parse):
```python
MANIFEST = {
  "english":  {"file": "FS Question Bank_English Proficiency V2.docx",
               "parts": {"grammar": 30, "sentence_correction": 30, "macro": 10,
                          "reading_passages": 5, "reading_questions": 25, "closure": 10},
               "total": 105, "tables": 0},
  "attention": {"file": "FS Question Bank_Attention to Detail V2.docx",
                "levels": {"L1": 20, "L2": 20}, "cases_total": 40,
                "questions_total": 160, "tables": 5,
                "markers": {"✅": 125, "☑": 111, "☐": 49}},
  "critical": {"file": "FS Question Bank_Critical Thinking V2.docx",
               "cases": 30, "questions_total": 120, "markers": {"✅": 180}},
}
```
**Convention:** reconcile against this manifest, NEVER the stale "375" figure (real total ≈ 385).

### `ingestion/normalize.py` (service, transform)

**Conventions (RESEARCH.md Pitfall 4, lines 257–260):**
- Item model requires explicit `response_type: mcq_single | mcq_multi | open_text | hybrid` — 50 of 385 items are open-ended (Sentence Correction ×30, Macro ×10, Closure-notes ×10); Case Closure is hybrid (mcq_single status + open_text notes)
- Model answers stored as `model_answer` field, server-only custody like answer keys
- Tags per item: `category` + `level/case grouping` (derivable from doc structure); `difficulty tier` has NO source data — blocked on OQ-1 user decision, do not fabricate a default
- Stable slug IDs per question; source hash recorded in ingestion report

### `ingestion/validate.py` + `ingestion/run.py` (validation + CLI, batch)

**Pattern: all-or-nothing atomic load** (RESEARCH.md Pattern 3, lines 216–218): pipeline emits complete validated artifacts or exits 1 and writes nothing but the error report.

**5-layer validation** (RESEARCH.md line 22):
1. Structural manifest reconciliation (counts per doc/section)
2. Item invariants (every MCQ has ≥1 correct option; multi-select has ≥1 ☑ AND ≥1 ☐ — RESEARCH.md Pitfall 3, line 255)
3. Marker census vs manifest (125/111/49 ✅/☑/☐ Attention; 180 ✅ CT; 38 ✅ English reading)
4. Quota cross-check (pool volumes match parsed volumes)
5. Atomic emit (write artifacts only on full pass)

**pydantic for item schema** (RESEARCH.md "Don't Hand-Roll", line 235): declarative model, exhaustive error reporting (field path + reason) — this is what "fail loudly" requires. No hand-rolled if-chains.

**run.py orchestration:** `parse → normalize → validate → emit` (RESEARCH.md line 175); CLI only, never in request path; subprocess-timeout-friendly.

### `content/*.json` (artifacts)

Conventions: committed to repo (OQ-4, consistent with keyed docx already in repo); explicit `encoding="utf-8"` on all I/O; round-trip test asserting marker census survives JSON serialization (RESEARCH.md Pitfall 6, lines 266–268). `ingestion-report.json` carries counts, censuses, warnings, source hashes.

### `prisma/schema.prisma` (model)

**Conventions (RESEARCH.md lines 33, 162–163, 434):**
- Relational shape: `banks → sections → cases → case_tabs → case_tables → questions → options → quota_config → ingestion_runs`
- **`is_correct` physically separated on `options` rows** — never a denormalized key blob on question rows (GRADE-05 boundary starts at schema design)
- Per-case tab names stored verbatim (28 distinct names exist; no fixed five-tab assumption)
- `response_type` enum on questions (mcq_single / mcq_multi / open_text / hybrid); `model_answer` column server-only
- `quota_config` stores verbatim Sheet2 values WITH `unit` annotation (cases vs questions unresolved — OQ-2)

### `prisma/seed.ts` (service, batch)

**Pattern: zod re-validation → single Prisma `$transaction`** (RESEARCH.md lines 157–163, 236):
- zod 4.4.3 schema re-checks the Python-produced JSON at the seed boundary (second gate — cheap insurance, keeps artifact honest)
- Entire load wrapped in ONE transaction (rollback on any error; partial bank is worse than no bank — quota sampling would silently misbehave)
- `prisma db seed` is the landing spot (STACK.md line 42)
- No hand-written SQL inserts (RESEARCH.md "Don't Hand-Roll", line 236)

### Tests (`ingestion/tests/`, vitest)

**Test map** (RESEARCH.md lines 398–409) — all files Wave 0, none exist:

| Test | Type | Command |
|------|------|---------|
| `test_golden.py` — items spot-checkable vs source (golden fixtures) | integration | `pytest ingestion/tests/test_golden.py -x` |
| `test_manifest.py` — counts reconcile 105/160/120 | unit | `pytest ingestion/tests/test_manifest.py -x` |
| `test_tags.py` — category + level/case tags present | schema/property | `pytest ingestion/tests/test_tags.py -x` |
| `test_malformed.py` — missing option / ambiguous marker → exit non-zero, names item | negative fixture | `pytest ingestion/tests/test_malformed.py -x` |
| `test_quotas.py` — verbatim Sheet2 values; rejects Sheet1/`(1).xlsx` | integration + negative | `pytest ingestion/tests/test_quotas.py -x` |
| `seed.test.ts` — single-transaction guarantee | integration | `npx vitest run seed.test.ts` |

Golden-file anchor: English Part 1 Q1–Q5 must assert `correct = [1]` (option b) for Q1 (verified). Malformed fixtures built by copying a real docx and corrupting one item.

## Shared Patterns (apply to ALL new files)

### Fail-Loud Validation
**Source:** RESEARCH.md Validation Strategy / Don't-Hand-Roll
**Apply to:** every parser, normalizer, validator, seed
- pydantic (Python) + zod (Node), never hand-rolled if-chains
- Any invariant violation raises with item identity (file, section, question number) — no silent skips, no warnings-only paths for structural failures
- Pipeline exit code: 0 only on complete success; artifacts written only on success

### UTF-8 / Unicode Preservation
**Source:** RESEARCH.md Pitfall 6 (lines 266–268)
**Apply to:** all Python file I/O, JSON emit, pipeline runner
- Explicit `encoding="utf-8"` on every open()
- `PYTHONIOENCODING=utf-8` when running pipeline on Windows (cp1252 console throws `UnicodeEncodeError` — hit verbatim during research)
- ✅/☑/☐ and curly quotes preserved in stored text; normalization only for matching keys

### Answer-Key Custody
**Source:** RESEARCH.md Security Domain (line 434) + STACK.md server-only pattern
**Apply to:** schema.prisma, seed.ts, normalize.py, all artifacts
- `is_correct` only on `options` rows; `model_answer` server-only
- No key material in logs/CI output
- JSON artifacts committed to private repo (same exposure as existing keyed docx — OQ-4); production DB becomes true key store with server-only guards in later phases

### Source-File Whitelisting
**Source:** RESEARCH.md V12 (line 432) + Pitfall 5
**Apply to:** docx_bank.py, xlsx_quotas.py, run.py
- Parse ONLY the three V2 docx + `FS QB Pattern.xlsx` Sheet2
- Reject: `FS QB Pattern(1).xlsx`, Sheet1, `*_dump.txt` (stale), `file.xps` (superseded), `Fraud support-20260728T181933Z-1-001/` (empty husk)

### Dependency Pinning
**Source:** RESEARCH.md Security (line 444) + STACK.md installation
**Apply to:** Wave 0 setup
- `pip install python-docx==1.2.0 openpyxl==3.1.5 pydantic pytest` (first two verified installed/working)
- `npm install zod prisma @prisma/client` (zod 4.4.3, prisma 7.9.1 per STACK.md; client/CLI must match)

## Conventions from STACK.md / ARCHITECTURE.md (binding for planner)

1. **Python stays out of production runtime** (STACK.md line 42): ingestion is a separate venv + CLI; web app consumes only the committed JSON artifacts via `prisma db seed`.
2. **Ingestion isolated from request path** (ARCHITECTURE.md line 103): `ingestion/` never imported by runtime code.
3. **Prisma 7 / driver adapters** (STACK.md line 109): no Rust binary; `@prisma/adapter-pg` recommended for serverless later — schema should not assume engine-specific features.
4. **zod at every boundary** (STACK.md line 26): seed re-validates artifacts; same zod schema reusable as CI check on content updates (STACK.md line 102).
5. **Correctness over throughput** (ARCHITECTURE.md line 196): 0–1k attempt scale; single monolith + single Postgres. No queuing/microservices in this phase.
6. **Postgres 16+ required; none provisioned yet** (RESEARCH.md line 379–383): planner MUST include Wave 0 provisioning step (Docker `postgres:16` or Neon/Supabase free tier). Do NOT descope to artifact-only — INGEST-01 demands a queryable store.
7. **Files under 500 lines** (project CLAUDE.md): split parsers if a module grows past this.
8. **Directory layout** (RESEARCH.md lines 167–184): `ingestion/` at repo root (own venv), `content/` at repo root, `prisma/` at repo root — NOT under `src/` since no Next.js app exists yet; the web app scaffold (`create-next-app`) is a later-phase concern.

## Blocked Items (decisions required before/during planning)

| Item | Blocks | Reference |
|------|--------|-----------|
| OQ-1: difficulty tier source (no authored data) | INGEST-02 fully; test_tags tier assertion | RESEARCH.md lines 351–354 |
| OQ-2: quota unit semantics (cases vs questions) | Phase 2 assembly only — INGEST-04 loads verbatim with unit annotation now | RESEARCH.md lines 356–359 |
| OQ-3: open-ended grading policy | Phase 2/3 — schema already supports all options via `response_type` | RESEARCH.md lines 361–364 |
| OQ-4: artifact custody | Recommend commit (status quo exposure); flag to user | RESEARCH.md lines 366–368 |

## No Analog Found

All 15 planned files — see File Classification table. Reason for every row: **greenfield project; no source code exists to pattern-match against.** Planner must use the reference patterns above (from verified research) instead of codebase analogs. Do not fabricate analogs.

## Metadata

**Analog search scope:** entire workspace root — directory listing + globs for `**/*.{ts,js,py,prisma,json}`, `**/package.json`, `.planning/**/*.md`
**Files scanned:** 0 source files found (only `.planning/` markdown + `Fraud support/` binary docs)
**Pattern sources:** `01-RESEARCH.md` (verified live parse), `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`
**Pattern extraction date:** 2026-07-29
