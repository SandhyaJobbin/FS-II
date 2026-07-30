from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
import os
import json

# Try to load difficulty tags mapping if it exists
_tags_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "content", "difficulty-tags.json"))
DIFFICULTY_TAGS: Dict[str, str] = {}
if os.path.exists(_tags_path):
    try:
        with open(_tags_path, "r", encoding="utf-8") as f:
            _data = json.load(f)
            # Exclude _meta block
            DIFFICULTY_TAGS = {k: v for k, v in _data.items() if not k.startswith("_")}
    except Exception:
        pass

class ResponseType(str, Enum):
    mcq_single = "mcq_single"
    mcq_multi = "mcq_multi"
    open_text = "open_text"
    hybrid = "hybrid"

class Option(BaseModel):
    letter: str
    text: str
    is_correct: bool

class Tab(BaseModel):
    name: str
    content: str
    position: int

class TableContent(BaseModel):
    caption: Optional[str] = None
    headers: List[str]
    rows: List[List[Any]]
    position: int

class SourceRef(BaseModel):
    file: str
    section: str
    number: int

class Item(BaseModel):
    id: str
    bank: str
    section: str
    level: Optional[str] = None
    case_id: Optional[str] = None
    case_title: Optional[str] = None
    tabs: Optional[List[Tab]] = None
    tables: Optional[List[TableContent]] = None
    response_type: ResponseType
    stem: str
    options: List[Option] = []
    model_answer: Optional[str] = None
    position: int
    source: SourceRef
    difficulty_tier: Optional[str] = None

def generate_slug_id(bank: str, section: str, position: int) -> str:
    # Shorten bank and section for cleaner slugs
    bank_short = bank[:3].lower()
    sect_short = section.replace("_", "-").lower()
    return f"{bank_short}-{sect_short}-q{position:02d}"

