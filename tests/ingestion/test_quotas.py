import os
import pytest
import openpyxl
from ingestion.parsers.xlsx_quotas import parse, FILE_NAME

REAL_DIR = "Fraud support"

def test_quotas_loading_e2e():
    rows = parse(REAL_DIR)
    
    assert len(rows) == 8
    
    # Verify literal rows verbatim matching the Sheet2 expectations
    expected_rows = [
        ("English Proficiency Question Bank", "Grammar", 30, "questions", 8, "questions"),
        ("English Proficiency Question Bank", "Sentence Correction", 30, "questions", 5, "questions"),
        ("English Proficiency Question Bank", "Macro Editing & Personalization", 10, "questions", 2, "questions"),
        ("English Proficiency Question Bank", "Reading Comprehension", 5, "passages", 5, "questions"),
        ("English Proficiency Question Bank", "Case Closure Notes", 10, "questions", 5, "questions"),
        ("Attention to Detail Question Bank", "Level 1 – Review and Listing Accuracy Investigation", 20, "cases", 5, "cases"),
        ("Attention to Detail Question Bank", "Level 2 – Account & Fraud Pattern Investigation", 20, "cases", 5, "cases"),
        ("Critical Thinking Question Bank", "Risk Assessment & Business Decision", 30, "cases", 10, "cases")
    ]
    
    for idx, row in enumerate(rows):
        exp = expected_rows[idx]
        assert row["assessment_section"] == exp[0]
        assert row["category"] == exp[1]
        assert row["volume"] == exp[2]
        assert row["volume_unit"] == exp[3]
        assert row["quota"] == exp[4]
        assert row["unit"] == exp[5]

def test_quotas_negative_invalid_filename(tmp_path):
    # Pass a directory where FILE_NAME does not exist but a decoy does
    decoy_name = "FS QB Pattern(1).xlsx"
    decoy_file = tmp_path / decoy_name
    
    wb = openpyxl.Workbook()
    wb.save(decoy_file)
    
    # We should raise FileNotFoundError or ValueError if we request parsing from a file path that doesn't end with FILE_NAME
    # Wait, the parser joins the directory path with FILE_NAME, so requesting parse(tmp_path) where FILE_NAME doesn't exist raises FileNotFoundError.
    with pytest.raises(FileNotFoundError):
        parse(str(tmp_path))

def test_quotas_negative_missing_sheet2(tmp_path):
    # Create a workbook with only Sheet1
    file_path = tmp_path / FILE_NAME
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sheet1"
    wb.save(file_path)
    
    with pytest.raises(ValueError) as exc:
        parse(str(tmp_path))
    assert "missing Sheet2" in str(exc.value)

def test_quotas_negative_perturbed_manifest_volume(tmp_path, monkeypatch):
    # Perturb manifest expectation using monkeypatch to trigger volume mismatch
    import ingestion.parsers.xlsx_quotas
    
    # Modify MANIFEST english.grammar expectation to 31
    monkeypatch.setitem(ingestion.parsers.xlsx_quotas.MANIFEST["english"]["sections"], "grammar", 31)
    
    with pytest.raises(ValueError) as exc:
        parse(REAL_DIR)
        
    assert "Volume cross-check failed" in str(exc.value)
    assert "Category 'Grammar'" in str(exc.value)
