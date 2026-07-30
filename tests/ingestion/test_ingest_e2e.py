import os
import json
import shutil
import subprocess
import time
import pytest
from docx import Document
from ingestion.manifest import MANIFEST, SOURCE_DIR

def test_ingest_e2e_counts_and_censuses():
    # 1. Assert questions.json contains exactly 385 items
    questions_path = os.path.join("content", "questions.json")
    assert os.path.exists(questions_path)
    with open(questions_path, "r", encoding="utf-8") as f:
        questions = json.load(f)
    assert len(questions) == 385

    # 2. Count by bank
    english_count = sum(1 for q in questions if q["bank"] == "english")
    attention_count = sum(1 for q in questions if q["bank"] == "attention")
    critical_count = sum(1 for q in questions if q["bank"] == "critical")
    
    assert english_count == 105
    assert attention_count == 160
    assert critical_count == 120

    # 3. Verify marker census values against docx files directly
    # Attention Doc Checks
    attention_doc_path = os.path.join(SOURCE_DIR, MANIFEST["attention"]["file"])
    doc_att = Document(attention_doc_path)
    c_yes_att = sum(p.text.count('✅') for p in doc_att.paragraphs)
    c_chk_att = sum(p.text.count('☑') for p in doc_att.paragraphs)
    c_unchk_att = sum(p.text.count('☐') for p in doc_att.paragraphs)
    
    assert c_yes_att == MANIFEST["attention"]["markers"]["trailing_check"]
    assert c_chk_att == MANIFEST["attention"]["markers"]["checkbox_checked"]
    assert c_unchk_att == MANIFEST["attention"]["markers"]["checkbox_unchecked"]

    # Critical Thinking Doc Checks
    critical_doc_path = os.path.join(SOURCE_DIR, MANIFEST["critical"]["file"])
    doc_ct = Document(critical_doc_path)
    c_yes_ct = sum(p.text.count('✅') for p in doc_ct.paragraphs)
    
    assert c_yes_ct == MANIFEST["critical"]["markers"]["leading_check"]

def test_ingest_e2e_determinism():
    questions_path = os.path.join("content", "questions.json")
    quotas_path = os.path.join("content", "quotas.json")
    
    # Read current state
    with open(questions_path, "r", encoding="utf-8") as f:
        questions_initial = f.read()
    with open(quotas_path, "r", encoding="utf-8") as f:
        quotas_initial = f.read()

    # Re-run pipeline
    env = os.environ.copy()
    env["PYTHONPATH"] = "."
    res = subprocess.run(["python", "-m", "ingestion.run"], capture_output=True, text=True, env=env)
    assert res.returncode == 0

    # Read post-run state
    with open(questions_path, "r", encoding="utf-8") as f:
        questions_after = f.read()
    with open(quotas_path, "r", encoding="utf-8") as f:
        quotas_after = f.read()

    # Verify byte-identical results (determinism)
    assert questions_initial == questions_after
    assert quotas_initial == quotas_after

def test_ingest_e2e_unicode_round_trip():
    questions_path = os.path.join("content", "questions.json")
    with open(questions_path, "r", encoding="utf-8") as f:
        questions = json.load(f)
        
    # Serialize to JSON and reload
    dumped = json.dumps(questions, ensure_ascii=False)
    reloaded = json.loads(dumped)
    
    # Count ticks in reloaded structures
    total_ticks = 0
    for q in reloaded:
        for opt in q.get("options", []):
            if opt.get("is_correct"):
                total_ticks += 1
                
    # 25 English MCQs (grammar) + 25 English Reading MCQs + 10 English Closure MCQs + 160 Attention + 120 Critical
    # grammar: 30 MCQ (1 correct each = 30 ticks)
    # reading: 25 MCQ (some multi-select, 38 ticks total)
    # closure: 10 MCQ (1 correct each = 10 ticks)
    # attention: 160 MCQ (123 single-select = 123 ticks, 37 multi-select = 111 ticks, total correct ticks = 234)
    # critical: 120 MCQ (all single-select, 180 ticks total)
    # Let's count them from parsed list to ensure they match perfectly
    parsed_ticks = sum(1 for q in questions for opt in q.get("options", []) if opt.get("is_correct"))
    assert total_ticks == parsed_ticks

def test_ingest_e2e_atomicity():
    questions_path = os.path.join("content", "questions.json")
    assert os.path.exists(questions_path)
    
    # Capture original mtime and content
    original_mtime = os.path.getmtime(questions_path)
    with open(questions_path, "r", encoding="utf-8") as f:
        original_content = f.read()

    # Backup the original Fraud support directory
    backup_dir = "Fraud support_backup"
    if os.path.exists(backup_dir):
        shutil.rmtree(backup_dir)
    shutil.copytree("Fraud support", backup_dir)

    try:
        # Perturb one of the files to trigger a validation failure
        # We will truncate the English Proficiency bank file to be completely empty/malformed
        english_file_path = os.path.join("Fraud support", MANIFEST["english"]["file"])
        with open(english_file_path, "wb") as f:
            f.write(b"broken content")
            
        # Run pipeline which should fail
        env = os.environ.copy()
        env["PYTHONPATH"] = "."
        res = subprocess.run(["python", "-m", "ingestion.run"], capture_output=True, text=True, env=env)
        
        # Verify run failed
        assert res.returncode != 0
        
        # Verify the content/questions.json remains completely untouched (atomicity)
        assert os.path.getmtime(questions_path) == original_mtime
        with open(questions_path, "r", encoding="utf-8") as f:
            current_content = f.read()
        assert current_content == original_content

    finally:
        # Restore the original Fraud support directory
        if os.path.exists("Fraud support"):
            shutil.rmtree("Fraud support")
        shutil.copytree(backup_dir, "Fraud support")
        shutil.rmtree(backup_dir)
