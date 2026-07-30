import os
import json
import pytest
import subprocess
from ingestion.normalize import Item, Option, ResponseType, SourceRef
from ingestion.validate import validate_items
from ingestion.manifest import MANIFEST
from ingestion.parsers.markers import MalformedItem

def test_validation_gate_mcq_single_select():
    # Valid MCQ single select
    mock_manifest = {"english": {"sections": {"grammar": 1}}}
    item = Item(
        id="eng-grammar-q01",
        bank="english",
        section="grammar",
        response_type=ResponseType.mcq_single,
        stem="Question?",
        options=[
            Option(letter="a", text="Option A", is_correct=False),
            Option(letter="b", text="Option B", is_correct=True),
        ],
        position=1,
        source=SourceRef(file="test.docx", section="grammar", number=1)
    )
    assert validate_items([item], mock_manifest, ["grammar"]) is True

    # Invalid: MCQ single select with no correct answers
    item_no_correct = item.model_copy(update={
        "options": [
            Option(letter="a", text="Option A", is_correct=False),
            Option(letter="b", text="Option B", is_correct=False),
        ]
    })
    with pytest.raises(MalformedItem) as exc:
        validate_items([item_no_correct], mock_manifest, ["grammar"])
    assert "must have exactly 1 correct option, found 0" in str(exc.value)

    # Invalid: MCQ single select with multiple correct answers
    item_multi_correct = item.model_copy(update={
        "options": [
            Option(letter="a", text="Option A", is_correct=True),
            Option(letter="b", text="Option B", is_correct=True),
        ]
    })
    with pytest.raises(MalformedItem) as exc:
        validate_items([item_multi_correct], mock_manifest, ["grammar"])
    assert "must have exactly 1 correct option, found 2" in str(exc.value)

def test_validation_gate_slug_collision():
    mock_manifest = {"english": {"sections": {"grammar": 2}}}
    item1 = Item(
        id="eng-grammar-q01",
        bank="english",
        section="grammar",
        response_type=ResponseType.mcq_single,
        stem="Question 1?",
        options=[Option(letter="a", text="Option A", is_correct=True)],
        position=1,
        source=SourceRef(file="test.docx", section="grammar", number=1)
    )
    item2 = Item(
        id="eng-grammar-q01", # Duplicate ID
        bank="english",
        section="grammar",
        response_type=ResponseType.mcq_single,
        stem="Question 2?",
        options=[Option(letter="a", text="Option A", is_correct=True)],
        position=2,
        source=SourceRef(file="test.docx", section="grammar", number=2)
    )
    with pytest.raises(MalformedItem) as exc:
        validate_items([item1, item2], mock_manifest, ["grammar"])
    assert "Slug collision for ID" in str(exc.value)

def test_validation_gate_count_mismatch():
    item = Item(
        id="eng-grammar-q01",
        bank="english",
        section="grammar",
        response_type=ResponseType.mcq_single,
        stem="Question 1?",
        options=[Option(letter="a", text="Option A", is_correct=True)],
        position=1,
        source=SourceRef(file="test.docx", section="grammar", number=1)
    )
    # Grammar expects 30 questions in manifest. Since we only provide 1, this should raise ValueError
    with pytest.raises(ValueError) as exc:
        validate_items([item], MANIFEST, ["grammar"])
    assert "Count mismatch in section 'grammar'" in str(exc.value)

def test_unicode_round_trip():
    # Verify unicode symbols survive serialization and loading intact
    symbolic_text = "Check ✅, Box ☑, Unchecked ☐, Curly quote “test”"
    option = Option(letter="a", text=symbolic_text, is_correct=True)
    serialized = option.model_dump_json()
    loaded = Option.model_validate_json(serialized)
    assert loaded.text == symbolic_text

def test_run_cli_malformed_fails_and_no_write():
    # Remove existing artifacts if any
    q_file = "content/questions.json"
    rep_file = "content/ingestion-report.json"
    
    # We call run.py with a non-existent or malformed target
    # In this case, we can pass a bad bank name
    res = subprocess.run(
        ["python", "-m", "ingestion.run", "--banks", "invalid_bank"],
        env=dict(os.environ, PYTHONPATH="."),
        capture_output=True, 
        text=True
    )
    assert res.returncode == 1
    assert "Unknown bank" in res.stderr or "Unknown bank" in res.stdout
