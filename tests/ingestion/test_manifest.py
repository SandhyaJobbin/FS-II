from ingestion.manifest import MANIFEST, SOURCE_DIR, ALLOWED_FILES

def test_manifest_keys():
    assert "english" in MANIFEST
    assert "attention" in MANIFEST
    assert "critical" in MANIFEST

def test_manifest_counts():
    assert MANIFEST["english"]["total_questions"] == 105
    assert MANIFEST["attention"]["questions_total"] == 160
    assert MANIFEST["critical"]["questions_total"] == 120

def test_source_dir_and_allowed_files():
    assert SOURCE_DIR == "Fraud support"
    assert "FS Question Bank_English Proficiency V2.docx" in ALLOWED_FILES
    assert "FS Question Bank_Attention to Detail V2.docx" in ALLOWED_FILES
    assert "FS Question Bank_Critical Thinking V2.docx" in ALLOWED_FILES
    assert "FS QB Pattern.xlsx" in ALLOWED_FILES
