import os
import sys
import json
import argparse
import hashlib
import tempfile
from ingestion.manifest import MANIFEST, SOURCE_DIR
from ingestion.normalize import Item, generate_slug_id, DIFFICULTY_TAGS
from ingestion.validate import validate_items
import ingestion.parsers.english as english_parser
import ingestion.parsers.attention as attention_parser
import ingestion.parsers.critical as critical_parser
import ingestion.parsers.xlsx_quotas as quotas_parser

PARSERS = {
    "english": english_parser,
    "attention": attention_parser,
    "critical": critical_parser,
    "quotas": quotas_parser
}

def get_file_sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        while True:
            chunk = f.read(8192)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()

def update_apps_script(questions_data, quotas_data):
    gs_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "Code.gs"))
    if not os.path.exists(gs_path):
        print(f"Apps Script backend not found at {gs_path}, skipping update.")
        return

    with open(gs_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update QUESTIONS array
    start_marker = "const QUESTIONS = ["
    start_idx = content.find(start_marker)
    if start_idx == -1:
        print("Error: could not find 'const QUESTIONS = [' in Code.gs")
        return

    end_idx = content.find("];", start_idx)
    if end_idx == -1:
        print("Error: could not find end of QUESTIONS array in Code.gs")
        return
    end_idx += len("];")

    questions_js = json.dumps(questions_data, indent=2, ensure_ascii=False)
    new_questions_block = f"const QUESTIONS = {questions_js};"
    content = content[:start_idx] + new_questions_block + content[end_idx:]

    # 2. Update QUOTAS config
    quotas_start_marker = "const QUOTAS = {"
    q_start = content.find(quotas_start_marker)
    if q_start != -1:
        q_end = content.find("};", q_start)
        if q_end != -1:
            category_mapping = {
                "Grammar": "grammar",
                "Sentence Correction": "sentence_correction",
                "Macro Editing & Personalization": "macro",
                "Reading Comprehension": "reading",
                "Case Closure Notes": "closure",
                "Level 1 – Review and Listing Accuracy Investigation": "attention_l1",
                "Level 2 – Account & Fraud Pattern Investigation": "attention_l2",
                "Risk Assessment & Business Decision": "critical"
            }
            
            new_quotas = {}
            for row in quotas_data:
                cat = row["category"]
                if cat in category_mapping:
                    key = category_mapping[cat]
                    quota_val = row["quota"]
                    unit = row["unit"]
                    if key == "reading":
                        new_quotas[key] = { "count": 1, "unit": "passages" }
                    else:
                        new_quotas[key] = { "count": quota_val, "unit": unit }
            
            quotas_js = json.dumps(new_quotas, indent=2, ensure_ascii=False)
            new_quotas_block = f"const QUOTAS = {quotas_js};"
            content = content[:q_start] + new_quotas_block + content[q_end + len("};"):]

    with open(gs_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Successfully updated backend/Code.gs with questions and quotas!")

def main():
    parser = argparse.ArgumentParser(description="Ingest Fraud Support assessment question banks.")
    parser.add_argument("--banks", type=str, help="Comma-separated bank.section targets (e.g., 'english.grammar')")
    args = parser.parse_args()

    # Determine targets
    targets = []
    if args.banks:
        for t in args.banks.split(","):
            parts = t.strip().split(".")
            if len(parts) == 1:
                targets.append((parts[0], None))
            elif len(parts) == 2:
                targets.append((parts[0], parts[1]))
    else:
        # Run all supported banks
        targets = [
            ("english", "grammar"),
            ("english", "sentence_correction"),
            ("english", "macro"),
            ("english", "reading"),
            ("english", "closure"),
            ("attention", None),
            ("critical", None),
            ("quotas", None)
        ]

    # Parse and accumulate items
    all_raw_items = []
    sections_run = set()
    source_hashes = {}
    quotas_data = None

    for bank, section in targets:
        if bank not in PARSERS:
            print(f"Error: Unknown bank '{bank}'", file=sys.stderr)
            sys.exit(1)
            
        parser_module = PARSERS[bank]
        
        # Calculate file hash of source document
        source_file = MANIFEST[bank]["file"]
        source_path = os.path.join(SOURCE_DIR, source_file)
        if os.path.exists(source_path):
            source_hashes[source_file] = get_file_sha256(source_path)
            
        try:
            parsed_data = parser_module.parse(SOURCE_DIR)
        except Exception as e:
            print(f"Error during parsing of bank '{bank}': {e}", file=sys.stderr)
            sys.exit(1)
            
        if bank == "quotas":
            quotas_data = parsed_data
        else:
            # Filter by section if specified
            for item_data in parsed_data:
                if section is None or item_data["section"] == section:
                    all_raw_items.append(item_data)
                    sections_run.add(item_data["section"])

    # Normalize to Item Pydantic models
    normalized_items = []
    for idx, raw in enumerate(all_raw_items):
        # Generate slug ID
        slug = generate_slug_id(raw["bank"], raw["section"], raw["position"])
        item = Item(
            id=slug,
            bank=raw["bank"],
            section=raw["section"],
            level=raw["level"],
            case_id=raw["case_id"],
            case_title=raw["case_title"],
            tabs=raw["tabs"],
            tables=raw["tables"],
            response_type=raw["response_type"],
            stem=raw["stem"],
            options=raw["options"],
            model_answer=raw["model_answer"],
            position=raw["position"],
            source=raw["source"],
            difficulty_tier=DIFFICULTY_TAGS.get(slug)
        )
        normalized_items.append(item)


    # Validate all items
    if normalized_items:
        try:
            validate_items(normalized_items, MANIFEST, list(sections_run))
        except Exception as e:
            print(f"Validation failed: {e}", file=sys.stderr)
            sys.exit(1)

    # Ensure output directories exist
    os.makedirs("content", exist_ok=True)

    # Write output files atomically
    questions_path = os.path.join("content", "questions.json")
    quotas_path = os.path.join("content", "quotas.json")
    report_path = os.path.join("content", "ingestion-report.json")

    has_questions_targets = any(bank != "quotas" for bank, _ in targets)

    # Generate ingestion report
    counts = {}
    for item in normalized_items:
        counts[item.section] = counts.get(item.section, 0) + 1

    report_data = {
        "status": "success",
        "counts": counts,
        "source_hashes": source_hashes,
        "total_items": len(normalized_items),
        "errors": []
    }
    report_json = json.dumps(report_data, indent=2, ensure_ascii=False)

    try:
        # Atomic write questions.json (only if questions targets were run)
        if has_questions_targets:
            questions_data = [item.model_dump() for item in normalized_items]
            questions_json = json.dumps(questions_data, indent=2, ensure_ascii=False)
            with tempfile.NamedTemporaryFile('w', dir="content", delete=False, encoding='utf-8') as f:
                f.write(questions_json)
                temp_q = f.name
            os.replace(temp_q, questions_path)

        # Atomic write quotas.json
        if quotas_data is not None:
            quotas_json_data = {
                "unit_semantics": "unresolved — see A-OQ2",
                "rows": quotas_data
            }
            quotas_json_str = json.dumps(quotas_json_data, indent=2, ensure_ascii=False)
            with tempfile.NamedTemporaryFile('w', dir="content", delete=False, encoding='utf-8') as f:
                f.write(quotas_json_str)
                temp_q_quota = f.name
            os.replace(temp_q_quota, quotas_path)

        # Atomic write ingestion-report.json
        with tempfile.NamedTemporaryFile('w', dir="content", delete=False, encoding='utf-8') as f:
            f.write(report_json)
            temp_r = f.name
        os.replace(temp_r, report_path)

        # Update Google Apps Script backend on a full run
        if not args.banks:
            q_data = [item.model_dump() for item in normalized_items]
            update_apps_script(q_data, quotas_data)

    except Exception as e:
        print(f"Failed to write output files: {e}", file=sys.stderr)
        sys.exit(1)

    if has_questions_targets:
        print(f"Ingestion successful! Wrote {len(normalized_items)} items to {questions_path}")
    if quotas_data is not None:
        print(f"Ingestion successful! Wrote {len(quotas_data)} quota rows to {quotas_path}")


if __name__ == "__main__":
    main()
