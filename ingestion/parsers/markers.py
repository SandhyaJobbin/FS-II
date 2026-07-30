import re

class MalformedItem(Exception):
    def __init__(self, file_name, section, question_ref, reason):
        self.file_name = file_name
        self.section = section
        self.question_ref = question_ref
        self.reason = reason
        super().__init__(f"Malformed item in {file_name} [{section}], Question {question_ref}: {reason}")

def split_lines(text):
    if not text:
        return []
    return [line.strip() for line in text.split('\n') if line.strip()]

def bold_correct_index(paragraphs, file_name, section, question_ref):
    correct_indices = []
    for idx, p in enumerate(paragraphs):
        is_bold = False
        # Concatenate text from all bold runs in this paragraph
        bold_text = ""
        for run in p.runs:
            if run.bold:
                bold_text += run.text
        if bold_text.strip():
            is_bold = True
        if is_bold:
            correct_indices.append(idx)
    
    if len(correct_indices) != 1:
        raise MalformedItem(
            file_name, section, question_ref, 
            f"Expected exactly 1 bold correct option, found {len(correct_indices)}"
        )
    return correct_indices[0]

def trailing_check(lines, file_name, section, question_ref):
    correct_indices = []
    for idx, line in enumerate(lines):
        if line.strip().endswith("✅"):
            correct_indices.append(idx)
    if len(correct_indices) != 1:
        raise MalformedItem(
            file_name, section, question_ref, 
            f"Expected exactly 1 trailing checkmark, found {len(correct_indices)}"
        )
    return correct_indices[0]

def leading_check(lines, file_name, section, question_ref):
    correct_indices = []
    for idx, line in enumerate(lines):
        if line.strip().startswith("✅"):
            correct_indices.append(idx)
    if not correct_indices:
        raise MalformedItem(
            file_name, section, question_ref, 
            "Expected at least 1 leading checkmark, found 0"
        )
    return correct_indices

def checkbox_pair(lines, file_name, section, question_ref):
    correct_indices = []
    checked_count = 0
    unchecked_count = 0
    for idx, line in enumerate(lines):
        clean_line = line.strip()
        if clean_line.startswith("☑"):
            correct_indices.append(idx)
            checked_count += 1
        elif clean_line.startswith("☐"):
            unchecked_count += 1
            
    if checked_count == 0:
        raise MalformedItem(
            file_name, section, question_ref, 
            f"No checked checkboxes (☑) found, unchecked: {unchecked_count}"
        )
    return correct_indices

# Regex helpers for standard options cleaning
# e.g., a) Option, A. Option, 1) Option, etc.
OPTION_PREFIX_RE = re.compile(r'^([a-zA-Z0-9]{1,2}[\.\)\-\:])\s*(.*)$')

def clean_option_text(text):
    text = text.strip()
    # Remove markers
    text = text.replace("✅", "").replace("☑", "").replace("☐", "").strip()
    match = OPTION_PREFIX_RE.match(text)
    if match:
        # returns option prefix letter/number and clean option text
        prefix, content = match.groups()
        return content.strip(), prefix.strip()
    return text, ""
