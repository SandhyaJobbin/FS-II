import os
import re
from docx import Document
from docx.text.paragraph import Paragraph
from docx.table import Table
from ingestion.parsers.blocks import iter_block_items
from ingestion.parsers.markers import checkbox_pair, trailing_check, clean_option_text, MalformedItem
from ingestion.normalize import ResponseType, Option

BANK_ID = "attention"
FILE_NAME = "FS Question Bank_Attention to Detail V2.docx"

def parse(source_dir):
    path = os.path.join(source_dir, FILE_NAME)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Source file not found: {path}")
        
    doc = Document(path)
    
    items = []
    
    current_level = None # 'L1' or 'L2'
    current_case_num = None
    current_case_title = None
    current_case_id = None
    state = "preamble"
    
    current_tab_name = None
    current_tab_pos = 0
    tabs_dict = {} # key: tab_name, val: {name, position, content_lines: []}
    tables_list = [] # list of table contents
    
    # To collect questions for the current case
    raw_questions = [] # list of {stem, option_lines: [], q_num}
    
    # Helper to flush current case's questions to items
    def flush_case():
        nonlocal raw_questions, tabs_dict, tables_list
        if not raw_questions:
            return
            
        # Format tabs for normalization
        formatted_tabs = []
        for name, t_info in tabs_dict.items():
            formatted_tabs.append({
                "name": name,
                "content": "\n".join(t_info["content_lines"]).strip(),
                "position": t_info["position"]
            })
        # Sort tabs by position
        formatted_tabs.sort(key=lambda x: x["position"])
        
        section_name = "level_1" if current_level == "L1" else "level_2"
        
        for rq in raw_questions:
            q_num = rq["q_num"]
            stem = rq["stem"]
            option_lines = rq["option_lines"]
            
            # Determine response type and correct options
            # If any line has checkbox (☑ or ☐)
            has_checkbox = any('☑' in line or '☐' in line for line in option_lines)
            
            if has_checkbox:
                correct_indices = checkbox_pair(option_lines, FILE_NAME, section_name, q_num)
                checked_count = len(correct_indices)
                if checked_count == 0:
                    raise MalformedItem(
                        FILE_NAME, section_name, q_num,
                        f"Multi-select question must contain at least 1 correct (☑) option"
                    )
                response_type = ResponseType.mcq_multi
            else:
                correct_idx = trailing_check(option_lines, FILE_NAME, section_name, q_num)
                correct_indices = [correct_idx]
                response_type = ResponseType.mcq_single
                
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
                
            # Create the item dict
            items.append({
                "bank": BANK_ID,
                "section": section_name,
                "level": current_level,
                "case_id": current_case_id,
                "case_title": current_case_title,
                "tabs": formatted_tabs if formatted_tabs else None,
                "tables": tables_list if tables_list else None,
                "response_type": response_type,
                "stem": stem,
                "options": options,
                "model_answer": None,
                "position": len(items) + 1,
                "source": {
                    "file": FILE_NAME,
                    "section": f"LEVEL {1 if current_level == 'L1' else 2} Case {current_case_num}",
                    "number": q_num
                }
            })
            
        # Reset case-level structures
        raw_questions = []
        tabs_dict = {}
        tables_list = []
        
    # Iterate block items in document order
    for block in iter_block_items(doc):
        if isinstance(block, Paragraph):
            text = block.text.strip()
            if not text:
                continue
                
            # Level detection
            if "LEVEL 1:" in text:
                flush_case()
                current_level = "L1"
                state = "level"
                continue
            elif "LEVEL 2:" in text:
                flush_case()
                current_level = "L2"
                state = "level"
                continue
                
            # Case detection
            case_match = re.match(r'^CASE\s+(\d+)\s*[:\-\u2013\u2014]?\s*(.+)$', text, re.IGNORECASE)
            if case_match:
                flush_case()
                current_case_num = int(case_match.group(1))
                current_case_title = case_match.group(2).strip()
                current_case_id = f"attn-l{1 if current_level == 'L1' else 2}-case-{current_case_num:02d}"
                state = "case"
                current_tab_name = None
                continue
                
            if text == "Candidate Dashboard":
                state = "dashboard"
                continue
            elif text == "Questions":
                state = "questions"
                continue
                
            if state == "dashboard":
                # Check for Tab line
                tab_match = re.match(r'^Tab\s+(\d+)\s*[:\-\u2013\u2014]?\s*(.+)$', text, re.IGNORECASE)
                if tab_match:
                    current_tab_pos = int(tab_match.group(1))
                    current_tab_name = tab_match.group(2).strip()
                    tabs_dict[current_tab_name] = {
                        "name": current_tab_name,
                        "position": current_tab_pos,
                        "content_lines": []
                    }
                else:
                    if current_tab_name in tabs_dict:
                        tabs_dict[current_tab_name]["content_lines"].append(block.text)
                        
            elif state == "questions":
                # Check for Question stem
                q_match = re.match(r'^Q(\d+)\.\s*(.+)$', text)
                if q_match:
                    q_num = int(q_match.group(1))
                    stem = q_match.group(2).strip()
                    raw_questions.append({
                        "q_num": q_num,
                        "stem": stem,
                        "option_lines": []
                    })
                else:
                    if raw_questions:
                        # Split paragraph text by newline
                        lines = [line.strip() for line in block.text.split('\n') if line.strip()]
                        for line in lines:
                            if re.match(r'^([☑☐]?\s*[A-D]\.)', line) or line.startswith('☑') or line.startswith('☐'):
                                raw_questions[-1]["option_lines"].append(line)
                            else:
                                if not raw_questions[-1]["option_lines"]:
                                    raw_questions[-1]["stem"] += "\n" + line
                                    
        elif isinstance(block, Table):
            headers = [cell.text.strip() for cell in block.rows[0].cells]
            rows = []
            for row in block.rows[1:]:
                rows.append([cell.text.strip() for cell in row.cells])
                
            table_pos = len(tables_list) + 1
            tables_list.append({
                "caption": current_tab_name,
                "headers": headers,
                "rows": rows,
                "position": table_pos
            })
            
    # Flush the last case
    flush_case()
    
    # Assert every table landed inside a case (exactly 5 tables across all cases)
    unique_tables = 0
    seen_cases = set()
    for item in items:
        if item["case_id"] not in seen_cases:
            seen_cases.add(item["case_id"])
            if item.get("tables"):
                unique_tables += len(item["tables"])
    if unique_tables != 5:
        raise ValueError(f"Table count verification failed: expected 5 tables, found {unique_tables}")
        
    return items
