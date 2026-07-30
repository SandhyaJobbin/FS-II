import os
import json
import pytest
from ingestion.normalize import Item

def test_difficulty_tags_metadata_and_coverage():
    # Load tags file
    tags_path = os.path.join("content", "difficulty-tags.json")
    assert os.path.exists(tags_path)
    
    with open(tags_path, "r", encoding="utf-8") as f:
        tags_data = json.load(f)
        
    # Check _meta metadata block
    assert "_meta" in tags_data
    meta = tags_data["_meta"]
    assert "A-OQ1" in meta["provenance"]
    assert len(meta["rules"]) == 5
    assert meta["generated_by"] == "ingestion/difficulty_tags.py"

    # Load questions.json
    questions_path = os.path.join("content", "questions.json")
    assert os.path.exists(questions_path)
    
    with open(questions_path, "r", encoding="utf-8") as f:
        questions = json.load(f)
        
    # We should have exactly 385 questions
    assert len(questions) == 385
    
    # Check coverage and tier enum mapping
    allowed_tiers = {"straightforward", "moderate", "complex"}
    
    for q in questions:
        q_id = q["id"]
        # Assert tags file contains this ID
        assert q_id in tags_data, f"ID {q_id} missing from difficulty-tags.json"
        
        # Assert difficulty tier is assigned and in enum
        tier = q["difficulty_tier"]
        assert tier is not None, f"Question {q_id} has difficulty_tier = None"
        assert tier in allowed_tiers, f"Question {q_id} has invalid difficulty tier: {tier}"
        assert tags_data[q_id] == tier, f"Tier mismatch for {q_id}: questions.json has {tier}, difficulty-tags.json has {tags_data[q_id]}"

def test_items_structural_integrity():
    questions_path = os.path.join("content", "questions.json")
    assert os.path.exists(questions_path)
    
    with open(questions_path, "r", encoding="utf-8") as f:
        questions = json.load(f)
        
    for q in questions:
        # Every item must have bank and section
        assert q.get("bank") in {"english", "attention", "critical"}
        assert q.get("section") is not None
        
        # Case-based items (attention, critical, reading, closure) must have case_id
        if q["bank"] in {"attention", "critical"} or q["section"] in {"reading", "closure"}:
            assert q.get("case_id") is not None, f"Item {q['id']} in bank {q['bank']}, section {q['section']} is missing case_id"
        else:
            # English grammar and sentence correction do not have case_id
            assert q.get("case_id") is None
            
        # English grammar/sentence_correction/macro must have section grouping, and not have level or case_id
        if q["bank"] == "english" and q["section"] in {"grammar", "sentence_correction", "macro"}:
            assert q.get("level") is None
            assert q.get("case_id") is None
            assert q.get("section") in {"grammar", "sentence_correction", "macro"}
            
        # Ensure no item has BOTH level/case null AND section null
        assert not (q.get("level") is None and q.get("case_id") is None and q.get("section") is None)
