import os
import json
import sys

# Add the project root to python path if not present
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ingestion.manifest import MANIFEST, SOURCE_DIR
from ingestion.normalize import generate_slug_id

# Import parsers
import ingestion.parsers.english as english_parser
import ingestion.parsers.attention as attention_parser
import ingestion.parsers.critical as critical_parser

PARSERS = {
    "english": english_parser,
    "attention": attention_parser,
    "critical": critical_parser
}

RULES = [
    "1. response_type == mcq_multi -> complex",
    "2. response_type == hybrid -> moderate",
    "3. english section in {macro, reading, closure} -> moderate",
    "4. english section in {grammar, sentence_correction} -> straightforward",
    "5. attention/critical mcq_single -> straightforward"
]

def determine_tier(bank: str, section: str, response_type: str) -> str:
    # 1. response_type == mcq_multi -> complex
    if response_type == "mcq_multi":
        return "complex"
    # 2. response_type == hybrid -> moderate
    if response_type == "hybrid":
        return "moderate"
    # 3. english section in {macro, reading, closure} -> moderate
    if bank == "english" and section in {"macro", "reading", "closure"}:
        return "moderate"
    # 4. english section in {grammar, sentence_correction} -> straightforward
    if bank == "english" and section in {"grammar", "sentence_correction"}:
        return "straightforward"
    # 5. attention/critical mcq_single -> straightforward
    return "straightforward"

def main():
    targets = [
        ("english", "grammar"),
        ("english", "sentence_correction"),
        ("english", "macro"),
        ("english", "reading"),
        ("english", "closure"),
        ("attention", None),
        ("critical", None)
    ]

    tags = {}
    
    # Process each target
    for bank, section in targets:
        parser_module = PARSERS[bank]
        parsed_data = parser_module.parse(SOURCE_DIR)
        
        for raw in parsed_data:
            if section is None or raw["section"] == section:
                slug = generate_slug_id(raw["bank"], raw["section"], raw["position"])
                tier = determine_tier(raw["bank"], raw["section"], raw["response_type"])
                tags[slug] = tier

    # Build final dictionary with _meta block and sorted keys
    output_data = {
        "_meta": {
            "provenance": "provisional heuristic per A-OQ1 — pending SME review",
            "rules": RULES,
            "generated_by": "ingestion/difficulty_tags.py"
        }
    }
    
    # Sort keys to ensure byte-identical output across runs
    for slug in sorted(tags.keys()):
        output_data[slug] = tags[slug]

    os.makedirs("content", exist_ok=True)
    out_path = os.path.join("content", "difficulty-tags.json")
    
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Generated {len(tags)} difficulty tags in {out_path}")

if __name__ == "__main__":
    main()
