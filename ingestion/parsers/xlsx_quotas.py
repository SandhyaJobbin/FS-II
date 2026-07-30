import os
import re
import openpyxl
from ingestion.manifest import MANIFEST

BANK_ID = "quotas"
FILE_NAME = "FS QB Pattern.xlsx"

def parse(source_dir):
    path = os.path.join(source_dir, FILE_NAME)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Source file not found: {path}")
        
    # Safeguard: reject FS QB Pattern(1).xlsx even if called with it
    if os.path.basename(path) != FILE_NAME:
        raise ValueError(f"Invalid quota source file: must be exactly '{FILE_NAME}'")
        
    wb = openpyxl.load_workbook(path, data_only=True)
    if "Sheet2" not in wb.sheetnames:
        raise ValueError("Decoy workbook: missing Sheet2")
        
    sheet = wb["Sheet2"]
    
    # Assert header row
    headers = [cell.value for cell in list(sheet.iter_rows())[0][:4]]
    expected_headers = ["Assessment Section", "Question Bank Category", "Volume", "Questions to be given"]
    if headers != expected_headers:
        raise ValueError(f"Header mismatch in Sheet2: expected {expected_headers}, found {headers}")
        
    category_manifest_map = {
        "Grammar": ("english", "sections", "grammar"),
        "Sentence Correction": ("english", "sections", "sentence_correction"),
        "Macro Editing & Personalization": ("english", "sections", "macro"),
        "Reading Comprehension": ("english", "sections", "reading_passages"),
        "Case Closure Notes": ("english", "sections", "closure"),
        "Level 1 \u2013 Review and Listing Accuracy Investigation": ("attention", "levels", "L1"),
        "Level 2 \u2013 Account & Fraud Pattern Investigation": ("attention", "levels", "L2"),
        "Risk Assessment & Business Decision": ("critical", "cases", None)
    }
    
    rows_data = []
    current_section = None
    
    # Read the 8 data rows verbatim (rows 2 to 9)
    for row in sheet.iter_rows(min_row=2, max_row=9):
        section_val = row[0].value
        if section_val is not None:
            current_section = section_val.strip()
            
        category_val = row[1].value
        if category_val is None:
            continue
        category = category_val.strip()
        
        volume_val = row[2].value
        if volume_val is None:
            continue
        volume_str = volume_val.strip()
        
        quota_val = row[3].value
        if quota_val is None:
            continue
        quota = int(quota_val)
        
        # Parse volume integer
        volume_match = re.match(r'^(\d+)', volume_str)
        if not volume_match:
            raise ValueError(f"Failed to parse volume number from '{volume_str}'")
        parsed_volume = int(volume_match.group(1))
        
        # Cross check volume against MANIFEST
        path_info = category_manifest_map.get(category)
        if not path_info:
            raise ValueError(f"Unknown category in Sheet2: '{category}'")
            
        bank_name, key1, key2 = path_info
        if key2 is None:
            expected_volume = MANIFEST[bank_name][key1]
        else:
            expected_volume = MANIFEST[bank_name][key1][key2]
            
        if parsed_volume != expected_volume:
            raise ValueError(
                f"Volume cross-check failed for Category '{category}': "
                f"Sheet2 has pool volume {parsed_volume}, but manifest expects {expected_volume}"
            )
            
        # Determine unit and volume_unit
        is_english = "English" in current_section
        unit = "questions" if is_english else "cases"
        volume_unit = "questions" if is_english else "cases"
        if category == "Reading Comprehension":
            volume_unit = "passages"
            
        rows_data.append({
            "assessment_section": current_section,
            "category": category,
            "volume": parsed_volume,
            "volume_unit": volume_unit,
            "quota": quota,
            "unit": unit
        })
        
    return rows_data
