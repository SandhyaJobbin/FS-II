import os
import pytest
from docx import Document
from ingestion.parsers.critical import parse, BANK_ID, FILE_NAME
from ingestion.parsers.markers import MalformedItem
from ingestion.normalize import ResponseType

REAL_DOC_PATH = "Fraud support/FS Question Bank_Critical Thinking V2.docx"

def test_critical_parser_e2e():
    items = parse("Fraud support")
    
    # Assert counts
    assert len(items) == 120
    
    # Cases count
    case_ids = {item["case_id"] for item in items}
    assert len(case_ids) == 30
    
    # Verify cases naming: ct-case-01 to 30
    for case_num in range(1, 31):
        assert f"ct-case-{case_num:02d}" in case_ids
        
    # Check preamble exclusion
    preamble_leak_keywords = ["Understood", "Difficulty Approach", "Question Design Principles"]
    for item in items:
        assert item["bank"] == BANK_ID
        assert item["section"] == "risk_assessment"
        assert item["case_title"]
        assert item["stem"]
        
        # Verify that no item text contains preamble words
        for kw in preamble_leak_keywords:
            assert kw not in item["stem"]
            assert kw not in item["case_title"]
            
        # Verify correct options census
        correct_count = sum(1 for opt in item["options"] if opt.is_correct)
        if item["response_type"] == ResponseType.mcq_single:
            assert correct_count == 1
        elif item["response_type"] == ResponseType.mcq_multi:
            assert correct_count >= 2
            
    # Verify total correct count is exactly 180
    total_correct = sum(
        sum(1 for opt in item["options"] if opt.is_correct)
        for item in items
    )
    assert total_correct == 180

def test_malformed_critical_document_no_correct_options(tmp_path):
    # Corrupt a question to have no leading checkmarks (no ✅)
    malformed_path = tmp_path / FILE_NAME
    
    doc = Document(REAL_DOC_PATH)
    corrupted = False
    for p in doc.paragraphs:
        # Corrupt CASE 1 Question 1 options (change ✅ B. to B.)
        if "✅ B. Multiple accounts" in p.text:
            p.text = p.text.replace("✅ B. Multiple accounts", "B. Multiple accounts")
            corrupted = True
            break
            
    assert corrupted, "Could not find option to corrupt"
    doc.save(malformed_path)
    
    with pytest.raises(MalformedItem) as exc:
        parse(str(tmp_path))
    assert "risk_assessment" in str(exc.value)
    assert "Question 1" in str(exc.value)
    assert "Expected at least 1 leading checkmark" in str(exc.value)
