# Phase 1: Content Ingestion & Question Bank - Research

**Researched:** 2026-07-29
**Domain:** docx/xlsx content ingestion, structured question-bank storage, ingestion-time validation
**Confidence:** HIGH — every structural claim below was verified by directly parsing the actual source files with python-docx 1.2.0 / openpyxl 3.1.5 in this session (not inferred from PROJECT.md summaries)

## Summary

The three authored docx banks and the quota xlsx were parsed directly this session. The source material is real, consistently structured, and answer-keyed — but it differs from the project's stated assumptions in three material ways. **(1) The actual item count is ~385, not ~375**: English Proficiency V2 contains 105 items (30 Grammar + 30 Sentence Correction + 10 Macro + 25 Reading [5 passages × 5] + 10 Case Closure), not the 95 recorded in PROJECT.md/REQUIREMENTS.md (95 was the pre-revision number). Attention to Detail (40 cases × 4 = 160) and Critical Thinking (30 cases × 4 = 120) match expectations. **(2) Not all content is MCQ/multi-select**: 50 English items (Sentence Correction ×30, Macro Editing ×10, plus the written portion of Case Closure ×10) are open-ended "produce text, compare to Model Answer" items. This directly conflicts with the REQUIREMENTS.md out-of-scope rationale ("all existing content is already MCQ/multi-select") and puts ~12 open-ended items into every assembled attempt per the settled quotas — a decision the user must make before Phase 2/3 planning. **(3) Difficulty/ambiguity tiers are NOT authored anywhere**: the CT doc explicitly says difficulty is a "natural mix... candidates are not informed," with no per-item tier markings. INGEST-02's tier tag has no source data and needs a derivation/assignment decision.

Four distinct answer-marking conventions exist across the docs (trailing ✅, leading ✅, ☑/☐ pairs, and **bold-run** for English Grammar), all paragraphs use style `Normal` (no heading styles — structure is regex-on-text only), options sometimes share one paragraph separated by embedded newlines, the Attention doc uses 28 distinct dashboard tab names (not the 5 fixed names UI-04 assumes), and 5 real docx tables carry dashboard data inside cases. All are parseable with python-docx, but a naive text dump will silently corrupt items — the validation layer is the heart of this phase.

**Primary recommendation:** Python offline pipeline (python-docx + openpyxl, both already installed and verified) → normalized `questions.json` + `quotas.json` artifacts validated by a strict schema (fail-loud, all-or-nothing) → Prisma seed into Postgres. Treat count-reconciliation against doc-derived expected counts (not the stale "375") as the phase gate.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INGEST-01 | All ~375 questions from 3 authored docx banks parsed into structured, queryable store with embedded answer keys | Actual structures fully mapped (see "Source Document Anatomy"); real count is ~385 — reconcile against doc-derived manifest, not 375. python-docx handles all 4 marker conventions. |
| INGEST-02 | Each question tagged with category, level/case grouping, difficulty/ambiguity tier | Category + level/case grouping are derivable from doc structure. **Difficulty tier is NOT authored — see Open Question OQ-1; blocked on user decision.** |
| INGEST-03 | Ingestion validates completeness, fails loudly on malformed items | Validation strategy in "Validation Strategy" section: 5-layer checks (structural manifest, item invariants, marker census, quota cross-check, atomic load) + malformed-fixture tests. |
| INGEST-04 | Per-category quotas loaded from settled `FS QB Pattern.xlsx` | Settled values live in **Sheet2** of `FS QB Pattern.xlsx` (Sheet1 and `(1).xlsx` are pre-revision). All literal values, no formulas. Quota unit semantics (cases vs questions) ambiguous — see OQ-2. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| docx/xlsx parsing | Offline CLI (Python) | — | One-time/rare transform; never in request path. Python stays out of production runtime (STACK.md decision). |
| Normalization + validation | Offline CLI (Python) | Node seed (zod re-check) | Validation must fail loudly before any DB write; double-check at seed boundary is cheap insurance. |
| Question-bank storage | Database (Postgres via Prisma) | — | Queryable content store is INGEST-01's deliverable; relational shape (banks→sections→cases→questions→options) fits Postgres. |
| Answer-key custody | Database / server-only | — | Keys ingested into DB columns that downstream phases must never serialize to client (GRADE-05 boundary starts here: schema must physically separate `is_correct`). |
| Quota config | Database (seeded from xlsx) | JSON artifact in repo | INGEST-04 requires queryable quotas; seed verbatim values with unit annotation. |
| Difficulty tier assignment | Offline data file / DB column | — | Not authored in sources; whatever derivation is chosen, it lands as data in this phase (see OQ-1). |

## Source Document Anatomy (VERIFIED this session via python-docx/openpyxl)

Files live in `Fraud support/` (workspace root). The duplicate folder `Fraud support-20260728T181933Z-1-001/` is an **empty husk** — ignore. `*_dump.txt` files are prior exploration artifacts — not canonical. `file.xps` is the superseded draft blueprint — do not parse.

### `FS Question Bank_English Proficiency V2.docx` — 105 items, 624 paragraphs, 0 tables
- All paragraphs style `Normal`. Part headings are plain text: `Part 1 – Grammar MCQs`, `Part 2: Sentence Correction`, `PART 3: MACRO EDITING & PERSONALIZATION`, `PART 6: READING COMPREHENSION`, `PART 7: CASE CLOSURE NOTES`. **Part numbers skip 4–5** (revision residue — do not assert contiguous numbering).
- **Part 1 Grammar (30 MCQ):** `Qn. text`, options `a) x`–`d) x` (lowercase + paren). **Correct answer = bold run** (`run.bold is True`), zero ✅ glyphs. Parser must read run-level bold, exactly-1-bold-option invariant per question. Sub-topic headers ("Subject-Verb Agreement", "Verb Tenses", "Passive Voice") interleave as plain lines — safe to ignore or capture as sub-category.
- **Part 2 Sentence Correction (30 items): OPEN-ENDED.** Shape: `Qn. <faulty sentence>\nModel Answer: <corrected sentence>` — question and model answer share **one paragraph, newline-separated**. No options at all.
- **Part 3 Macro Editing (10 items): OPEN-ENDED.** Blocks: `Qn` / `Customer Scenario` / `Existing Macro` / `Model Answer`. Contains template placeholders `{{ticket.requester.first_name}}` — preserve verbatim.
- **Part 6 Reading (5 passages × 5 = 25 MCQ):** `Passage N – Title` / `Customer Message` / passage body / `Questions` / items numbered `1.`–`5.` (**not** `Q1.`), options `a) x` with **trailing ✅** on correct ones; some are Select-ALL with multiple ✅. 38 ✅ total across 25 questions.
- **Part 7 Case Closure (10 items): HYBRID.** `Qn – Title` / `Scenario` / `Case Status` with 3 MCQ options (`a) Open b) Pending c) Solved ✅`) **plus** open-ended `Case Closure Notes` with `Candidate Response:` blank and `Model Answer`. Ingest as one item with an MCQ part AND an open-text part.

### `FS Question Bank_Attention to Detail V2.docx` — 160 items (40 cases × 4), 1477 paragraphs, 5 tables
- `LEVEL 1: REVIEW & LISTING ACCURACY INVESTIGATION` (cases 1–20), `LEVEL 2: ACCOUNT & FRAUD PATTERN INVESTIGATION` (cases 1–20). Confirms merged-level revision.
- Case shape: `CASE N: TITLE` / `Candidate Dashboard` / `Tab K: <name>` blocks / `Questions` / `Q1.`–`Q4.`.
- **28 distinct tab names** (Review Information ×13, Account Profile ×21, Review Activity ×19, Booking Details ×13, Connected Information ×11, Customer Complaint ×7, …). UI-04's five tab names are a generalization — the store must keep per-case tab names verbatim, and Phase 4 must render arbitrary tab sets (typically 2–3 per case), not a fixed five.
- Single-answer options: `A. text ✅` (trailing marker, uppercase + period). Multi-select: **leading** `☑ A. text` (correct) / `☐ D. text` (incorrect). Verified census: 125 ✅, 111 ☑, 49 ☐ — consistent with ~123 single-answer + ~37 multi-select questions.
- **Multi-line paragraphs exist:** some options share one paragraph separated by `\n` (e.g. options A and B in one paragraph). Split paragraph text on newlines before applying option regex.
- **5 real docx tables** (Room Type|View, Room Type|Details, Room Type|Breakfast, Account|Created, Account|Created Date) carry dashboard data inside specific cases. Must iterate `doc.element.body` in document order to bind tables to their enclosing case/tab; `doc.paragraphs` alone misses them.

### `FS Question Bank_Critical Thinking V2.docx` — 120 items (30 cases × 4), 875 paragraphs, 0 tables
- **Preamble (paragraphs 0–58) is NOT content**: title, objective, instructions, question-type lists, "Difficulty Approach" note, and — critically — **LLM-authoring chatter at paragraphs 47–58** ("Understood. I'll avoid questions like: …"). Parser must begin at first `CASE \d+ –` heading.
- Case shape: `CASE N – Title` (en-dash) / `Case File` / scenario paragraph / `Question 1` (heading line) / question text (next line) / options `A. text` with **leading ✅** on each correct option (single-answer = 1 ✅; Select-ALL = multiple ✅). Census: 180 ✅ across 120 questions.
- No dashboard tabs — cases are single scenario paragraphs.
- **Difficulty note (verbatim):** "The assessment includes a natural mix of straightforward, moderate, and complex scenarios. Candidates are not informed of the difficulty level." → tiers exist conceptually but are NOT marked per item. Same is true for the other two docs (English has per-part mark values — 1/1/2/5/2.5 marks — usable as at most a coarse proxy).

### `FS QB Pattern.xlsx` — settled quotas in **Sheet2** (VERIFIED)
- `Sheet1` = pre-revision table with editorial notes in column F ("Merge these 2 sections", "Scrap level 1 and 2", …) — matches PROJECT.md's description of resolved notes. Do not use.
- **`Sheet2` = the settled post-revision quotas** (matches PROJECT.md pointer). All literal values, no formulas, one merged range (`A2:A6`). Verbatim contents:

| Section | Category | Volume (pool) | Questions to be given |
|---------|----------|---------------|----------------------|
| English | Grammar | 30 Questions | **8** |
| English | Sentence Correction | 30 Questions | **5** |
| English | Macro Editing & Personalization | 10 questions | **2** |
| English | Reading Comprehension | 5 Passages (5 each) | **5** |
| English | Case Closure Notes | 10 Questions | **5** |
| Attention | Level 1 – Review & Listing Accuracy | 20 Cases (4/case) | **5** |
| Attention | Level 2 – Account & Fraud Pattern | 20 Cases (4/case) | **5** |
| Critical Thinking | Risk Assessment & Business Decision | 30 Cases (4/case) | **10** |

- English quotas sum to 25 questions. Case-bank rows are denominated in **cases** in the Volume column; reading the D column as cases gives 10 attention cases (40 Q) + 10 CT cases (40 Q) → **105 total items per attempt**, contradicting ASSM-01's "~50-item subset". Reading D as *questions* makes case-atomic sampling (ASSM-03) non-integer (5 questions = 1.25 cases). **Unit semantics unresolved — OQ-2.** INGEST-04 (load + queryable) is satisfiable either way; interpretation belongs to the user / Phase 2.
- `FS QB Pattern(1).xlsx` = older copy, Sheet1-only, no Sheet2. **Do not use.**

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| python-docx | 1.2.0 | Parse 3 docx banks | Only tool giving run-level formatting access (required for bold-run answer keys in English Part 1) plus table iteration in document order. [VERIFIED: PyPI + installed/imported locally this session] |
| openpyxl | 3.1.5 | Parse quota xlsx | Reads merged cells, distinguishes formula vs cached value (all values here are literal — verified). [VERIFIED: PyPI + installed/imported locally this session] |
| PostgreSQL | 16+ (managed) | Content store | Per STACK.md; relational integrity for bank→section→case→question→option. [CITED: .planning/research/STACK.md] |
| Prisma | 7.9.1 | Schema, migrations, seed | `prisma db seed` is the landing spot for the validated JSON artifacts. [CITED: .planning/research/STACK.md] |
| zod | 4.4.3 | Schema validation of JSON artifacts at seed boundary | Second validation gate in the Node runtime; keeps the Python-produced artifact honest before DB writes. [CITED: .planning/research/STACK.md] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pytest | (env) | Parser unit + golden-file + malformed-fixture tests | Python-side test runner for the pipeline. [ASSUMED — standard for Python] |
| pydantic | 2.x | Python-side schema validation of normalized items | Strongest fail-loud validation in the pipeline itself; alternative: hand-rolled asserts (don't). [ASSUMED — standard pairing with python-docx pipelines; confirm version at install] |
| vitest | 4.1.10 | Seed-script / zod-schema tests | Node-side validation tests. [CITED: .planning/research/STACK.md] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| python-docx | mammoth 1.12.0 (Node, docx→HTML) | Pure-TS toolchain, but loses run-level bold detection and precise table-in-document-order binding; the bold-run answer key in English Part 1 makes python-docx the safer choice. [CITED: STACK.md] |
| pydantic (Python) | zod-only validation | Skips a Python dep but the first validation gate then happens after JSON serialization — later than ideal. Fail-loud wants validation at parse time. |

**Installation:**
```bash
# Ingestion venv (NOT part of web-app runtime deps)
pip install python-docx==1.2.0 openpyxl==3.1.5 pydantic pytest
# Web app side (seed + validation)
npm install zod prisma @prisma/client
```

**Version verification:** python-docx 1.2.0 and openpyxl 3.1.5 confirmed installed locally (Python 3.13.14) and functional against the real files this session. Node v26.1.0 / npm 12.0.1 available.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| python-docx | PyPI | 10+ yrs | millions/mo | github.com/python-openxml/python-docx | OK | Approved — installed 1.2.0 verified working against real files |
| openpyxl | PyPI | 10+ yrs | millions/mo | foss.heptapod.net/openpyxl/openpyxl | OK | Approved — installed 3.1.5 verified working against real files |
| pydantic | PyPI | 8+ yrs | hundreds of millions/mo | github.com/pydantic/pydantic | OK | Approved |
| zod | npm | 5+ yrs | tens of millions/wk | github.com/colinhacks/zod | OK | Approved [CITED: STACK.md registry check] |
| prisma / @prisma/client | npm | 5+ yrs | millions/wk | github.com/prisma/prisma | OK | Approved [CITED: STACK.md registry check] |
| pytest | PyPI | 15+ yrs | hundreds of millions/mo | github.com/pytest-dev/pytest | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
SOURCE FILES (Fraud support/)
  3x .docx banks          FS QB Pattern.xlsx (Sheet2 only)
       |                         |
       v                         v
+-----------------------------------------------------------+
| OFFLINE PYTHON PIPELINE (CLI, never in request path)      |
|  parse_docx.py   — regex-on-text structure walker;        |
|                    run-level bold detection; newline split;|
|                    doc-order table binding                 |
|  parse_quotas.py — Sheet2 reader (verbatim values + unit) |
|  normalize.py    — 4 marker conventions -> correctOptionIds|
|                    category/level/case tagging; slug IDs  |
|  validate.py     — pydantic item schema + manifest counts |
|                    + marker census + quota cross-check    |
|                    (ALL-OR-NOTHING: any error -> exit 1)  |
+-----------------------------------------------------------+
       |  writes on success only
       v
ARTIFACTS (committed to repo)
  content/questions.json   content/quotas.json   content/ingestion-report.json
       |
       v
+-----------------------------------------------------------+
| NODE SEED (prisma db seed)                                |
|  zod schema re-validation -> Prisma transaction (atomic)  |
+-----------------------------------------------------------+
       |
       v
POSTGRES  banks / sections / cases / case_tabs / case_tables
          questions / options(is_correct SERVER-ONLY) / quota_config / ingestion_runs
```

### Recommended Project Structure
```
ingestion/                  # Python pipeline (offline; own venv)
  parsers/docx_bank.py        # structure walker (parts/levels/cases/questions)
  parsers/markers.py          # 4 marker-convention extractors
  parsers/xlsx_quotas.py      # Sheet2 reader
  normalize.py                # canonical item model + stable IDs
  validate.py                 # pydantic schema + manifest reconciliation
  manifest.py                 # expected per-doc structure (counts, sections)
  run.py                      # CLI entry: parse -> normalize -> validate -> emit
  tests/                      # pytest: golden fixtures + malformed fixtures
content/                    # emitted artifacts (committed)
  questions.json
  quotas.json
  ingestion-report.json       # counts, censuses, warnings, source hashes
prisma/
  schema.prisma               # content-store models
  seed.ts                     # zod re-check + atomic load
```

### Pattern 1: Structural Manifest with Count Reconciliation
**What:** A hand-written (but doc-verified) manifest declares the expected structure of each source: per-part/level question counts, case counts, marker censuses, table counts. Validation compares parsed reality against the manifest and fails on any mismatch.
**When to use:** Any ingestion of human-authored documents where silent drift (a deleted question, a broken marker) must surface as a loud failure rather than bad data.
**Example:**
```python
# ingestion/manifest.py — values VERIFIED by parsing this session
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

### Pattern 2: Marker-Normalization Strategy (one extractor per convention)
**What:** Encapsulate each answer-marking convention behind a single function returning `correct_option_indices: list[int]`, selected by (doc, section) context — never a global "find the checkmark" heuristic.
**Conventions (all verified):**
| Convention | Where | Rule |
|-----------|-------|------|
| Bold run | English Part 1 | exactly 1 option paragraph with `run.bold is True` |
| Trailing ✅ | English Part 6/7, Attention single-answer | option text ends with ✅; exactly 1 per question |
| Leading ✅ | Critical Thinking (all) | option text starts with ✅; ≥1 per question |
| ☑/☐ pair | Attention multi-select | leading ☑ = correct, ☐ = incorrect; ≥1 of each |

### Pattern 3: All-or-Nothing Atomic Load
**What:** The pipeline either emits a complete, fully validated artifact set or exits non-zero and writes nothing (except the error report). The Prisma seed wraps the entire load in one transaction.
**Why:** Success criterion 3 demands malformed input fails loudly; a partial bank is worse than no bank because downstream quota sampling would silently misbehave.

### Anti-Patterns to Avoid
- **Style-based parsing:** every paragraph is `Normal` — heading detection must be regex-on-text, and must tolerate non-contiguous part numbers (4–5 missing) and both `CASE 1:` / `CASE 1 –` forms.
- **Paragraph-per-line assumption:** options share paragraphs via embedded `\n` — split before regexing options.
- **`doc.paragraphs`-only traversal:** misses the 5 dashboard tables; iterate `doc.element.body` children in document order to interleave paragraphs and tables.
- **Using Sheet1 or `(1).xlsx`:** pre-revision data. Canonical quotas = `FS QB Pattern.xlsx` **Sheet2** only.
- **Hard-coding 375:** expected counts come from the manifest (real total ≈ 385); the "~375" in requirements is the stale pre-revision figure.
- **Skipping the CT preamble guard:** paragraphs 47–58 contain LLM-authoring chatter that would parse as phantom content.
- **Unicode destruction:** preserve curly quotes/dashes and ✅/☑/☐ glyphs in raw text; normalize only for keying/matching, never for stored display text. Windows console needs `PYTHONIOENCODING=utf-8` when running the pipeline locally.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| docx XML traversal (runs, bold, tables) | Custom `zipfile` + `lxml` walker of `word/document.xml` | python-docx | docx run-splitting is erratic (Word splits runs mid-word); python-docx already normalizes paragraph/run access. Bold detection via raw XML is days of edge-case work. |
| xlsx parsing | Custom sheet XML reader | openpyxl | Merged cells, shared strings, formula-vs-value — all handled. |
| Item schema validation | Hand-rolled `if` chains | pydantic (Python) + zod (Node) | Declarative, exhaustive error reporting (field path + reason) — exactly what "fail loudly" needs. |
| DB seeding transactions | Hand-written SQL inserts | Prisma `$transaction` in seed | Type-safe, rollback-on-error, generated types keep DTOs honest downstream. |

**Key insight:** the genuinely custom code in this phase is the *structure walker* (part/case/question segmentation) and the *marker extractors* — everything else (parsing primitives, validation, persistence) is a solved problem.

## Common Pitfalls

### Pitfall 1: Silent marker loss on one of the four conventions
**What goes wrong:** Parser handles ✅ but misses bold-run answers in English Grammar → 30 questions import with no correct answer, or worse, `correctOptionIds: []` passes a weak validator.
**Why it happens:** Bold is formatting, not text; any text-dump-based parse (including the existing `*_dump.txt` artifacts) is blind to it.
**How to avoid:** Marker census per section (expected counts in manifest) compared against extracted counts; item invariant "every MCQ has ≥1 correct option" enforced with zero exceptions; golden-file test on English Q1–Q5 asserting `correct = [1]` (b) for Q1 (verified: bold is on option b).
**Warning signs:** Any MCQ with 0 or >expected correct options; census mismatch.

### Pitfall 2: Answer-marker ambiguity in mixed paragraphs
**What goes wrong:** Options sharing one paragraph (`A. ...\nB. ... ✅`) get treated as one option "A..." carrying a ✅ — the key lands on the wrong option.
**Why it happens:** python-docx `paragraph.text` joins runs; embedded newlines survive.
**How to avoid:** Always `text.split("\n")` then apply option regex per line; unit-test with the verified Attention L2 Case 1 Q1 shape (para 759: two options in one paragraph).

### Pitfall 3: Multi-select polarity inversion
**What goes wrong:** `☐` (unchecked = incorrect) misread as a marker glyph and stripped, or `☑`/`☐` treated as interchangeable — importing wrong keys for ~37 Attention questions.
**How to avoid:** Explicit two-glyph mapping; invariant "multi-select has ≥1 ☑ AND ≥1 ☐" (a question where everything is correct is almost certainly a parse bug).

### Pitfall 4: Open-ended items silently forced into the MCQ model
**What goes wrong:** Sentence Correction / Macro / Closure-notes items (50 of 385) have no options — a schema that demands options either drops them (losing content) or fabricates options (corrupting content).
**Why it happens:** The stale assumption "everything is MCQ" in REQUIREMENTS.md.
**How to avoid:** Item model has explicit `response_type: mcq_single | mcq_multi | open_text` (+ `hybrid` for Case Closure: mcq_single status + open_text notes). Model answers stored as `model_answer` (server-only, like keys). **Grading policy for open_text is a user decision (OQ-3) — ingestion must not silently pick one.**

### Pitfall 5: Quota sheet misuse (wrong sheet, wrong file, wrong units)
**What goes wrong:** Loading Sheet1 / `(1).xlsx` (pre-revision), or reading case-row quotas as question counts.
**How to avoid:** Loader asserts `sheet.title == "Sheet2"` and expected header row; stores each quota with `unit: "questions" | "cases"` annotation (English rows = questions; case-bank rows = cases, matching their Volume denomination); cross-check pool volumes vs parsed bank volumes (Grammar 30 = parsed 30, etc.). Loud error on any mismatch. Unit semantics → OQ-2.

### Pitfall 6: Encoding/Unicode corruption on Windows
**What goes wrong:** ✅/☑/☐ and curly quotes mangled (`cp1252` console encoding throws `UnicodeEncodeError` — hit verbatim during this research), or stored text mojibake'd.
**How to avoid:** All file I/O explicit `encoding="utf-8"`; `PYTHONIOENCODING=utf-8` in pipeline runner; round-trip test asserting marker census survives JSON serialization.

### Pitfall 7: Tables detached from their cases
**What goes wrong:** The 5 dashboard tables (room types, account creation dates) are skipped or dumped at document end, stripping cases of evidence needed to answer their questions.
**How to avoid:** Document-order body iteration binding tables to the current case/tab context; manifest asserts `tables: 5` for the Attention doc and every table lands inside a case.

## Code Examples

### Document-order traversal (paragraphs + tables interleaved)
```python
# Source: python-docx official docs pattern (document.element.body iteration)
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

### Bold-run answer extraction (English Grammar)
```python
# Verified against Part 1 Q1: correct option 'b) asked' has run.bold == True
def bold_correct_index(option_paragraphs):
    hits = [i for i, p in enumerate(option_paragraphs)
            if any(r.bold for r in p.runs if r.text.strip())]
    if len(hits) != 1:
        raise MalformedItem(f"expected exactly 1 bold option, got {len(hits)}")
    return hits[0]
```

### Multi-line option splitting + marker extraction (Attention)
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

### Sheet2 quota read with guards
```python
wb = openpyxl.load_workbook(path, data_only=True)
assert "Sheet2" in wb.sheetnames, "settled quotas sheet missing"
ws = wb["Sheet2"]
assert [c.value for c in ws[1][:4]] == ["Assessment Section", "Question Bank Category",
                                        "Volume", "Questions to be given"]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pre-revision 3-level banks (split doc, Sheet1) | Revised merged levels: Attn L1+L2, CT flat 30 cases, Reading 5 passages | Reflected in V2 docs + Sheet2 | Parser targets V2 docs + Sheet2 only; 375→385 count drift explained |
| npm `xlsx` for quota parsing | openpyxl (Python pipeline) | STACK.md research | npm xlsx frozen at 0.18.5 since 2022 (STACK.md verified); Python pipeline already needs python-docx, so one language for all parsing |

**Deprecated/outdated:**
- `*_dump.txt` artifacts in `Fraud support/`: stale partial text dumps (no bold info, no tables) — do not use as parse reference or validation ground truth.
- "95 English items / 375 total": pre-revision figures still quoted in PROJECT.md and REQUIREMENTS.md. Update docs after ingestion (385 = 105 + 160 + 120, subject to final parse confirmation).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | pytest + pydantic are acceptable Python test/validation choices (versions not pinned/verified) | Standard Stack | Low — both are ecosystem defaults; swap cost trivial |
| A2 | The three V2 docx files in `Fraud support/` are the final authored sources (no newer revision exists elsewhere) | Source Document Anatomy | Medium — if a V3 exists, manifest must be re-derived |
| A3 | Answer-key JSON artifacts may be committed to the repo (repo is private; keys already live in docx in the same repo) | Architecture | Low — but flag to user; alternative is gitignored artifact + secure store |
| A4 | Postgres + Prisma per STACK.md is the storage target (no infrastructure provisioned yet) | Standard Stack | Medium — Phase 1 needs a dev Postgres instance; none exists yet |
| A5 | `FS QB Pattern.xlsx` Sheet2 is the settled quota source (PROJECT.md says so; values verified present) | xlsx anatomy | Low |

## Open Questions

1. **OQ-1: Difficulty/ambiguity tier source (blocks INGEST-02 fully, GRADE-03 downstream)**
   - What we know: no per-item tier markings exist in any doc; CT doc says difficulty mix is deliberate but hidden from candidates; English has per-part mark values (1/1/2/5/2.5).
   - What's unclear: who/what assigns straightforward/moderate/complex per item.
   - Recommendation: decide in discuss-phase. Options: (a) SME/manual tagging pass captured as `content/difficulty-tags.json` keyed by question ID (auditable, ~385 entries, one-time effort); (b) deterministic heuristic at ingestion (e.g., multi-select + conflicting-evidence phrasing → complex) — cheap but unvalidated; (c) mark-value proxy for English only + default moderate elsewhere. Do NOT silently default everything to "moderate" — GRADE-03's "out-of-the-box" insight would have no signal.

2. **OQ-2: Quota unit semantics for case-bank rows (blocks Phase 2 assembly, not INGEST-04 loading)**
   - What we know: Sheet2 D-column for Attn/CT rows reads naturally as *cases* (matching Volume denomination), yielding 105 items/attempt — contradicting ASSM-01's "~50-item subset".
   - What's unclear: intended per-attempt length (25 English + how many case questions?).
   - Recommendation: load verbatim with unit annotation now; user confirms intended interpretation before Phase 2 planning (STATE.md already carries this blocker).

3. **OQ-3: Grading/assembly policy for 50 open-ended English items (blocks Phase 2/3, shapes INGEST-01's schema)**
   - What we know: Sentence Correction (30), Macro Editing (10), Closure-notes portion (10) are open text with model answers; quotas put 12 of them in every attempt; REQUIREMENTS.md's "all MCQ" assumption is factually wrong.
   - What's unclear: serve-and-grade policy (deterministic fuzzy match? exclude from assembly? convert to MCQ?).
   - Recommendation: ingest faithfully with `response_type` + `model_answer` (schema supports all options); user picks policy in discuss-phase. Note any deterministic text-match grading is brittle — excluding or MCQ-ifying is cleaner but changes content/quota commitments.

4. **OQ-4: Answer-key artifact custody**
   - What we know: source docx with inline keys already sit in the repo; a `content/questions.json` with structured keys is equivalent exposure.
   - Recommendation: commit (consistent with current practice) unless user objects; note that production DB becomes the true key store in later phases with `server-only` guards.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python | Ingestion pipeline | ✓ | 3.13.14 | — |
| python-docx | docx parsing | ✓ | 1.2.0 (verified against real files) | — |
| openpyxl | xlsx parsing | ✓ | 3.1.5 (verified against real files) | — |
| Node.js | Seed script / zod / Prisma | ✓ | 26.1.0 | — |
| npm | Package installs | ✓ | 12.0.1 | — |
| PostgreSQL | Content store | ✗ | — | Docker `postgres:16` locally, or Neon/Supabase free tier (STACK.md) |
| Prisma | ORM/seed | not yet installed | — | `npm install` in Phase 1 Wave 0 |

**Missing dependencies with no fallback:**
- PostgreSQL instance — required for the queryable content store deliverable. Planner must include a Wave 0 provisioning step (Docker container or managed free tier) or descope the DB load to artifact-only (NOT recommended — INGEST-01 says "queryable content store").

**Missing dependencies with fallback:**
- pytest/pydantic — installable via pip in Wave 0.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (Python pipeline) + vitest (Node seed/zod) |
| Config file | none yet — Wave 0 (`pytest.ini` / pyproject section; `vitest.config.ts`) |
| Quick run command | `pytest ingestion/tests -x -q` |
| Full suite command | `pytest ingestion/tests -q && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INGEST-01 | All items parsed w/ options + keys, spot-checkable vs source | golden-file integration | `pytest ingestion/tests/test_golden.py -x` | ❌ Wave 0 |
| INGEST-01 | Counts reconcile to manifest (105/160/120) | unit | `pytest ingestion/tests/test_manifest.py -x` | ❌ Wave 0 |
| INGEST-02 | Every item has category + level/case-grouping tag | schema/property | `pytest ingestion/tests/test_tags.py -x` | ❌ Wave 0 |
| INGEST-02 | Difficulty tier present per item | schema | same file (asserts tag source chosen per OQ-1) | ❌ Wave 0 — **blocked on OQ-1 decision** |
| INGEST-03 | Malformed item (missing option) → pipeline exits non-zero, names item | negative fixture | `pytest ingestion/tests/test_malformed.py -x` | ❌ Wave 0 |
| INGEST-03 | Malformed item (no/ambiguous answer marker) → loud failure | negative fixture | same file | ❌ Wave 0 |
| INGEST-03 | Partial DB state impossible (single transaction) | integration | `npx vitest run seed.test.ts` | ❌ Wave 0 |
| INGEST-04 | Quotas queryable + equal Sheet2 verbatim values | integration | `pytest ingestion/tests/test_quotas.py -x` | ❌ Wave 0 |
| INGEST-04 | Loader rejects Sheet1/(1).xlsx | negative fixture | same file | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest ingestion/tests -x -q`
- **Per wave merge:** `pytest ingestion/tests -q && npx vitest run`
- **Phase gate:** Full suite green + `content/ingestion-report.json` shows zero unresolved errors + manual spot-check of ≥5 random items per doc against source docx before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `ingestion/tests/` — full pytest suite (golden, manifest, tags, malformed, quotas)
- [ ] `ingestion/tests/fixtures/` — golden excerpts + deliberately malformed docx variants (constructed by copying a real docx and corrupting one item)
- [ ] `prisma/seed.ts` + `vitest.config.ts` — seed-side validation tests
- [ ] Framework install: `pip install pydantic pytest`; `npm install zod prisma @prisma/client`
- [ ] Postgres dev instance provisioning (Docker or managed)

## Security Domain

### Applicable ASVS Categories (Level 1, security_enforcement: true)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth in this phase) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | pydantic/zod schema validation on all parsed content; docx/xlsx treated as untrusted input (zip-bomb-safe parsers: python-docx/openpyxl are the standard, widely audited choices) |
| V6 Cryptography | no | — |
| V8 Data Protection | yes | Answer keys are sensitive-at-rest: JSON artifacts committed to private repo (consistent with existing docx custody — OQ-4); DB keys must live in columns never selected into client-facing queries (schema design: separate `is_correct` on options, no denormalized key blobs on question rows) |
| V12 Files & Resources | yes | Only the three known V2 docx + one xlsx are parsed; loader whitelists exact filenames, rejects `(1).xlsx` and Sheet1 |

### Known Threat Patterns for docx/xlsx ingestion

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/weaponized office file crashes or hangs parser | DoS | Parse offline in CLI (never request path); subprocess timeout; all-or-nothing failure |
| Silent bad-data import (wrong/missing keys) | Tampering | 5-layer validation + count reconciliation + atomic load (this phase's core control) |
| Answer keys leak into version control beyond existing exposure | Info Disclosure | Repo already contains keyed docx; keep artifacts in same repo (OQ-4) or gitignore + document; never log key material in CI output |
| Dependency confusion on pip install | Tampering | Pin versions (`python-docx==1.2.0`, `openpyxl==3.1.5`); both already installed/verified |

## Sources

### Primary (HIGH confidence — verified this session)
- Direct parse of `Fraud support/FS Question Bank_English Proficiency V2.docx` (python-docx 1.2.0): style census (all Normal), 48 ✅, bold-run answers in Part 1 (verified Q1 option b), part structure and counts, Part 2/3 Model-Answer shapes, 5 reading passages, Part 7 hybrid shape.
- Direct parse of `Fraud support/FS Question Bank_Attention to Detail V2.docx`: 2 levels × 20 cases, marker census (125 ✅ / 111 ☑ / 49 ☐), 28 tab-name census, 5 tables (headers verified), multi-line option paragraphs (L2 Case 1).
- Direct parse of `Fraud support/FS Question Bank_Critical Thinking V2.docx`: 30 cases × 4 questions, 180 ✅, preamble chatter at paras 47–58, difficulty note verbatim.
- Direct read of `FS QB Pattern.xlsx` Sheet1+Sheet2 and `FS QB Pattern(1).xlsx` (openpyxl 3.1.5): full cell dumps, merged ranges, no formulas; Sheet2 quota values verbatim.
- Local environment probes: Python 3.13.14, python-docx 1.2.0, openpyxl 3.1.5, Node 26.1.0, npm 12.0.1; empty duplicate folder confirmed.

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` — Prisma 7.9.1, zod 4.4.3, Postgres 16+ choices and registry verification (its own npm/PyPI checks); mammoth alternative analysis.
- `.planning/research/ARCHITECTURE.md` — ingestion pipeline isolation pattern, content-store component responsibilities.
- `.planning/research/PITFALLS.md` — ingestion gotchas (marker inconsistency), answer-key custody.

### Tertiary (LOW confidence)
- pydantic/pytest as specific Python choices — ecosystem-standard but not separately registry-verified this session ([ASSUMED] A1).

## Metadata

**Confidence breakdown:**
- Source document anatomy: HIGH — everything parsed and counted live this session
- Standard stack (Python side): HIGH — installed and exercised against real files
- Storage/seed stack: MEDIUM — inherited from STACK.md, not yet provisioned
- Pitfalls: HIGH — each grounded in a verified structural quirk (bold keys, multi-line options, 4 marker conventions, Sheet1/Sheet2 split)
- Open questions: HIGH confidence they are genuinely unresolved (tier source, quota units, open-ended policy)

**Research date:** 2026-07-29
**Valid until:** 2026-08-28 (stable — source documents are frozen authored assets; re-verify only if V3 docs appear)
