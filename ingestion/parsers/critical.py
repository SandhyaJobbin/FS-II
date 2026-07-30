import os
import re
from docx import Document
from ingestion.parsers.blocks import iter_block_items
from ingestion.parsers.markers import leading_check, clean_option_text, MalformedItem
from ingestion.normalize import ResponseType, Option

BANK_ID = "critical"
FILE_NAME = "FS Question Bank_Critical Thinking V2.docx"

def parse(source_dir):
    path = os.path.join(source_dir, FILE_NAME)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Source file not found: {path}")
        
    doc = Document(path)
    items = []
    
    current_case_num = None
    current_case_title = None
    current_case_id = None
    state = "preamble"
    
    # Structures for current case
    scenario_paragraphs = []
    raw_questions = [] # list of {q_num, stem, option_lines: []}
    
    def flush_case():
        nonlocal raw_questions, scenario_paragraphs
        if not raw_questions:
            return
            
        scenario = "\n".join(scenario_paragraphs).strip()
        
        for rq in raw_questions:
            q_num = rq["q_num"]
            stem = rq["stem"].strip()
            option_lines = rq["option_lines"]
            
            if not option_lines:
                raise MalformedItem(
                    FILE_NAME, "risk_assessment", q_num,
                    "No options found for question"
                )
                
            correct_indices = leading_check(option_lines, FILE_NAME, "risk_assessment", q_num)
            correct_count = len(correct_indices)
            
            if correct_count == 1:
                response_type = ResponseType.mcq_single
            else:
                response_type = ResponseType.mcq_multi
                
            options = []
            for idx, op_line in enumerate(option_lines):
                clean_text, prefix = clean_option_text(op_line)
                letter = prefix.replace(".", "").strip() if prefix else chr(ord('A') + idx)
                is_correct = (idx in correct_indices)
                options.append(Option(
                    letter=letter,
                    text=clean_text,
                    is_correct=is_correct
                ))
                
            items.append({
                "bank": BANK_ID,
                "section": "risk_assessment",
                "level": None,
                "case_id": current_case_id,
                "case_title": current_case_title,
                "tabs": None,
                "tables": None,
                "response_type": response_type,
                "stem": stem,
                "options": options,
                "model_answer": None,
                "position": len(items) + 1,
                "source": {
                    "file": FILE_NAME,
                    "section": f"CASE {current_case_num}",
                    "number": q_num
                }
            })
            
        raw_questions.clear()
        scenario_paragraphs.clear()
        
    for block in iter_block_items(doc):
        # We only care about Paragraphs for Critical Thinking (0 tables)
        if not hasattr(block, "text"):
            continue
            
        text = block.text.strip()
        if not text:
            continue
            
        # Preamble guard + case heading detection
        # Match "CASE 1 – High-Risk Coordinated Activity" (en-dash, hyphen, etc.)
        case_match = re.match(r'^CASE\s+(\d+)\s*[\u2013-]\s*(.+)$', text, re.IGNORECASE)
        if case_match:
            flush_case()
            current_case_num = int(case_match.group(1))
            current_case_title = case_match.group(2).strip()
            current_case_id = f"ct-case-{current_case_num:02d}"
            state = "case"
            continue
            
        if state == "preamble":
            continue
            
        if text == "Case File":
            state = "scenario"
            continue
            
        q_match = re.match(r'^Question\s+(\d+)', text, re.IGNORECASE)
        if q_match:
            state = "question_header"
            q_num = int(q_match.group(1))
            raw_questions.append({
                "q_num": q_num,
                "stem": "",
                "option_lines": []
            })
            continue
            
        if state == "scenario":
            scenario_paragraphs.append(text)
        elif state == "question_header":
            raw_questions[-1]["stem"] = text
            state = "options"
        elif state == "options":
            # Determine if this paragraph is part of the options
            lines = [l.strip() for l in text.split("\n") if l.strip()]
            for line in lines:
                clean_line = line.replace("✅", "").strip()
                if re.match(r'^[A-D]\.', clean_line):
                    raw_questions[-1]["option_lines"].append(line)
                else:
                    # If we don't have option lines yet, append to stem
                    if not raw_questions[-1]["option_lines"]:
                        raw_questions[-1]["stem"] += "\n" + line
                    else:
                        # Append to the last option line
                        raw_questions[-1]["option_lines"][-1] += "\n" + line
                        
    # Flush the last case
    flush_case()
    
    return items
