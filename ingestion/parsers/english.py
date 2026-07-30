import os
import re
from docx import Document
from ingestion.parsers.markers import bold_correct_index, clean_option_text, MalformedItem
from ingestion.normalize import ResponseType, Option

BANK_ID = "english"
FILE_NAME = "FS Question Bank_English Proficiency V2.docx"

def parse(source_dir):
    path = os.path.join(source_dir, FILE_NAME)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Source file not found: {path}")
        
    doc = Document(path)
    paragraphs = doc.paragraphs
    total_paras = len(paragraphs)
    items = []
    
    # Locate parts using regex
    part_indices = {}
    for idx, p in enumerate(paragraphs):
        text = p.text.strip()
        if not text:
            continue
        # e.g., "Part 1 - Grammar MCQs", "Part 2: Sentence Correction", "PART 3: MACRO EDITING & PERSONALIZATION"
        part_match = re.match(r'(?i)^part\s+(\d+)\s*[:\-\u2013\u2014]?\s*(.*)$', text)
        if part_match:
            part_num = int(part_match.group(1))
            part_indices[part_num] = idx

    # Parse each part
    if 1 in part_indices:
        parse_part1(paragraphs, part_indices[1], part_indices.get(2, total_paras), items)
    if 2 in part_indices:
        parse_part2(paragraphs, part_indices[2], part_indices.get(3, total_paras), items)
    if 3 in part_indices:
        parse_part3(paragraphs, part_indices[3], part_indices.get(6, total_paras), items)
    if 6 in part_indices:
        parse_part6(paragraphs, part_indices[6], part_indices.get(7, total_paras), items)
    if 7 in part_indices:
        parse_part7(paragraphs, part_indices[7], total_paras, items)
        
    return items

def parse_part1(paragraphs, start_idx, end_idx, items):
    current_subcategory = None
    i = start_idx + 1
    while i < end_idx:
        p = paragraphs[i]
        text = p.text.strip()
        if not text:
            i += 1
            continue
            
        q_match = re.match(r'^Q(\d+)\.\s*(.*)$', text)
        if q_match:
            q_num = int(q_match.group(1))
            stem = q_match.group(2).strip()
            
            option_paras = []
            i += 1
            while i < end_idx:
                next_p = paragraphs[i]
                next_text = next_p.text.strip()
                if not next_text:
                    i += 1
                    continue
                if re.match(r'^[a-d]\)', next_text):
                    option_paras.append(next_p)
                    i += 1
                else:
                    break
                    
            if not option_paras:
                raise MalformedItem(FILE_NAME, "grammar", q_num, "No options found for question")
                
            correct_idx = bold_correct_index(option_paras, FILE_NAME, "grammar", q_num)
            
            options = []
            for idx, op_p in enumerate(option_paras):
                op_text, prefix = clean_option_text(op_p.text)
                is_correct = (idx == correct_idx)
                letter = prefix.replace(")", "").strip() if prefix else chr(ord('a') + idx)
                options.append(Option(
                    letter=letter,
                    text=op_text,
                    is_correct=is_correct
                ))
                
            items.append({
                "bank": BANK_ID,
                "section": "grammar",
                "level": None,
                "case_id": None,
                "case_title": None,
                "tabs": None,
                "tables": None,
                "response_type": ResponseType.mcq_single,
                "stem": stem,
                "options": options,
                "model_answer": None,
                "position": len(items) + 1,
                "subcategory": current_subcategory,
                "source": {
                    "file": FILE_NAME,
                    "section": "Part 1 - Grammar MCQs",
                    "number": q_num
                }
            })
            continue
        else:
            if not text.startswith("Instructions:"):
                current_subcategory = text
            i += 1

def parse_part2(paragraphs, start_idx, end_idx, items):
    i = start_idx + 1
    while i < end_idx:
        p = paragraphs[i]
        text = p.text.strip()
        if not text:
            i += 1
            continue
            
        # Matches e.g. "Q1. Customer didn’t sent..."
        q_match = re.match(r'^Q(\d+)\.\s*(.*)$', text, re.DOTALL)
        if q_match:
            q_num = int(q_match.group(1))
            body = q_match.group(2).strip()
            
            # Split body into stem and model answer by Model Answer:
            parts = re.split(r'\nModel Answer:\s*', body)
            if len(parts) != 2:
                # Fallback if no newline or slightly different casing/whitespace
                parts = re.split(r'(?i)Model Answer:\s*', body)
                
            if len(parts) != 2:
                raise MalformedItem(FILE_NAME, "sentence_correction", q_num, f"Could not split stem and Model Answer in paragraph: {repr(body)}")
                
            stem = parts[0].strip()
            model_answer = parts[1].strip()
            
            items.append({
                "bank": BANK_ID,
                "section": "sentence_correction",
                "level": None,
                "case_id": None,
                "case_title": None,
                "tabs": None,
                "tables": None,
                "response_type": ResponseType.open_text,
                "stem": stem,
                "options": [],
                "model_answer": model_answer,
                "position": len(items) + 1,
                "subcategory": None,
                "source": {
                    "file": FILE_NAME,
                    "section": "Part 2: Sentence Correction",
                    "number": q_num
                }
            })
        i += 1

def parse_part3(paragraphs, start_idx, end_idx, items):
    i = start_idx + 1
    while i < end_idx:
        p = paragraphs[i]
        text = p.text.strip()
        if not text:
            i += 1
            continue
            
        q_match = re.match(r'^Q(\d+)$', text)
        if q_match:
            q_num = int(q_match.group(1))
            
            # Read until Model Answer, collecting scenario and existing macro
            scenario_paras = []
            macro_paras = []
            state = "scenario" # can be scenario or macro
            
            i += 1
            while i < end_idx:
                text_next = paragraphs[i].text.strip()
                if not text_next:
                    i += 1
                    continue
                if text_next == "Customer Scenario":
                    state = "scenario"
                    i += 1
                    continue
                if text_next == "Existing Macro":
                    state = "macro"
                    i += 1
                    continue
                if text_next == "Model Answer":
                    break
                if re.match(r'^Q\d+$', text_next) or re.match(r'(?i)^part\s+\d+', text_next):
                    break
                    
                if state == "scenario":
                    scenario_paras.append(paragraphs[i].text)
                elif state == "macro":
                    macro_paras.append(paragraphs[i].text)
                i += 1
                
            scenario = "\n".join(scenario_paras).strip()
            existing_macro = "\n".join(macro_paras).strip()
            
            # Now we must be at "Model Answer"
            model_answer_paras = []
            if i < end_idx and paragraphs[i].text.strip() == "Model Answer":
                i += 1
                while i < end_idx:
                    text_next = paragraphs[i].text.strip()
                    if not text_next:
                        i += 1
                        continue
                    if re.match(r'^Q\d+$', text_next) or re.match(r'(?i)^part\s+\d+', text_next):
                        # Next question or part
                        break
                    model_answer_paras.append(paragraphs[i].text)
                    i += 1
                    
            model_answer = "\n".join(model_answer_paras).strip()
            
            stem = f"Customer Scenario:\n{scenario}\n\nExisting Macro:\n{existing_macro}"
            
            items.append({
                "bank": BANK_ID,
                "section": "macro",
                "level": None,
                "case_id": None,
                "case_title": None,
                "tabs": None,
                "tables": None,
                "response_type": ResponseType.open_text,
                "stem": stem,
                "options": [],
                "model_answer": model_answer,
                "position": len(items) + 1,
                "subcategory": None,
                "source": {
                    "file": FILE_NAME,
                    "section": "PART 3: MACRO EDITING & PERSONALIZATION",
                    "number": q_num
                }
            })
            continue
        i += 1

def parse_part6(paragraphs, start_idx, end_idx, items):
    i = start_idx + 1
    current_case_id = None
    current_case_title = None
    current_case_scenario = None
    
    while i < end_idx:
        p = paragraphs[i]
        text = p.text.strip()
        if not text:
            i += 1
            continue
            
        passage_match = re.match(r'^Passage\s+(\d+)\s*[:\-\u2013\u2014]?\s*(.*)$', text)
        if passage_match:
            passage_num = int(passage_match.group(1))
            current_case_title = passage_match.group(0).strip()
            current_case_id = f"eng-reading-passage-{passage_num}"
            
            # Read customer message
            msg_paras = []
            i += 1
            while i < end_idx:
                text_next = paragraphs[i].text.strip()
                if not text_next:
                    i += 1
                    continue
                if text_next == "Questions" or text_next == "Customer Message":
                    i += 1
                    continue
                if re.match(r'^\d+\.\s*', text_next):
                    break
                msg_paras.append(paragraphs[i].text)
                i += 1
            current_case_scenario = "\n".join(msg_paras).strip()
            continue
            
        q_match = re.match(r'^(\d+)\.\s*(.*)$', text)
        if q_match:
            q_num = int(q_match.group(1))
            stem = q_match.group(2).strip()
            
            option_paras = []
            i += 1
            while i < end_idx:
                next_p = paragraphs[i]
                next_text = next_p.text.strip()
                if not next_text:
                    i += 1
                    continue
                if re.match(r'^[a-d]\)', next_text):
                    option_paras.append(next_p)
                    i += 1
                else:
                    break
                    
            if not option_paras:
                raise MalformedItem(FILE_NAME, "reading", q_num, f"No options found for question {q_num} in {current_case_title}")
                
            options = []
            correct_count = 0
            for idx, op_p in enumerate(option_paras):
                op_text = op_p.text.strip()
                is_correct = op_text.endswith("✅")
                clean_text, prefix = clean_option_text(op_text)
                letter = prefix.replace(")", "").strip() if prefix else chr(ord('a') + idx)
                options.append(Option(
                    letter=letter,
                    text=clean_text,
                    is_correct=is_correct
                ))
                if is_correct:
                    correct_count += 1
                    
            if correct_count == 0:
                raise MalformedItem(FILE_NAME, "reading", q_num, f"No correct option found for question {q_num}")
                
            response_type = ResponseType.mcq_multi if correct_count > 1 else ResponseType.mcq_single
            
            items.append({
                "bank": BANK_ID,
                "section": "reading",
                "level": None,
                "case_id": current_case_id,
                "case_title": current_case_title,
                "tabs": [{"name": "Passage", "content": current_case_scenario, "position": 1}] if current_case_scenario else None,
                "tables": None,
                "response_type": response_type,
                "stem": stem,
                "options": options,
                "model_answer": None,
                "position": len(items) + 1,
                "subcategory": None,
                "source": {
                    "file": FILE_NAME,
                    "section": "PART 6: READING COMPREHENSION",
                    "number": q_num
                }
            })
            continue
        i += 1

def parse_part7(paragraphs, start_idx, end_idx, items):
    i = start_idx + 1
    while i < end_idx:
        p = paragraphs[i]
        text = p.text.strip()
        if not text:
            i += 1
            continue
            
        q_match = re.match(r'^Q(\d+)\s*[:\-\u2013\u2014]?\s*(.*)$', text)
        if q_match:
            q_num = int(q_match.group(1))
            q_title = q_match.group(2).strip()
            
            case_id = f"eng-closure-{q_num}"
            case_title = text
            
            scenario_paras = []
            option_paras = []
            model_answer_paras = []
            
            state = "scenario"
            
            i += 1
            while i < end_idx:
                text_next = paragraphs[i].text.strip()
                if not text_next:
                    i += 1
                    continue
                if text_next == "Scenario":
                    state = "scenario"
                    i += 1
                    continue
                if text_next == "Case Status":
                    state = "status"
                    i += 1
                    continue
                if text_next == "Case Closure Notes":
                    state = "notes"
                    i += 1
                    continue
                if text_next == "Model Answer":
                    state = "model_answer"
                    i += 1
                    continue
                if re.match(r'^Q\d+\s*[:\-\u2013\u2014]?', text_next) or re.match(r'(?i)^part\s+\d+', text_next):
                    break
                    
                if state == "scenario":
                    scenario_paras.append(paragraphs[i].text)
                elif state == "status":
                    if re.match(r'^[a-c]\)', text_next):
                        option_paras.append(paragraphs[i])
                elif state == "model_answer":
                    model_answer_paras.append(paragraphs[i].text)
                i += 1
                
            scenario = "\n".join(scenario_paras).strip()
            model_answer = "\n".join(model_answer_paras).strip()
            
            if not option_paras:
                raise MalformedItem(FILE_NAME, "closure", q_num, f"No options found for status in question {q_num}")
                
            options = []
            correct_count = 0
            for idx, op_p in enumerate(option_paras):
                op_text = op_p.text.strip()
                is_correct = op_text.endswith("✅")
                clean_text, prefix = clean_option_text(op_text)
                letter = prefix.replace(")", "").strip() if prefix else chr(ord('a') + idx)
                options.append(Option(
                    letter=letter,
                    text=clean_text,
                    is_correct=is_correct
                ))
                if is_correct:
                    correct_count += 1
                    
            if correct_count != 1:
                raise MalformedItem(FILE_NAME, "closure", q_num, f"Expected exactly 1 correct status, found {correct_count}")
                
            items.append({
                "bank": BANK_ID,
                "section": "closure",
                "level": None,
                "case_id": case_id,
                "case_title": case_title,
                "tabs": None,
                "tables": None,
                "response_type": ResponseType.hybrid,
                "stem": scenario,
                "options": options,
                "model_answer": model_answer,
                "position": len(items) + 1,
                "subcategory": None,
                "source": {
                    "file": FILE_NAME,
                    "section": "PART 7: CASE CLOSURE NOTES",
                    "number": q_num
                }
            })
            continue
        i += 1
