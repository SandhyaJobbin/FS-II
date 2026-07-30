import os

SOURCE_DIR = "Fraud support"

ALLOWED_FILES = {
    "FS Question Bank_English Proficiency V2.docx",
    "FS Question Bank_Attention to Detail V2.docx",
    "FS Question Bank_Critical Thinking V2.docx",
    "FS QB Pattern.xlsx"
}

MANIFEST = {
    "english": {
        "file": "FS Question Bank_English Proficiency V2.docx",
        "sections": {
            "grammar": 30,
            "sentence_correction": 30,
            "macro": 10,
            "reading": 25,
            "reading_passages": 5,
            "closure": 10
        },
        "total_questions": 105,
        "tables": 0
    },
    "attention": {
        "file": "FS Question Bank_Attention to Detail V2.docx",
        "levels": {
            "L1": 20,
            "L2": 20
        },
        "cases_total": 40,
        "questions_total": 160,
        "tables": 5,
        "markers": {
            "trailing_check": 125,
            "checkbox_checked": 111,
            "checkbox_unchecked": 49
        }
    },
    "critical": {
        "file": "FS Question Bank_Critical Thinking V2.docx",
        "sections": {
            "risk_assessment": 120
        },
        "cases": 30,
        "questions_total": 120,
        "markers": {
            "leading_check": 180
        }
    },
    "quotas": {
        "file": "FS QB Pattern.xlsx"
    }
}
