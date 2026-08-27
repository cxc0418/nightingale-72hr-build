# models.py
from pydantic import BaseModel
from typing import Dict, Any, Optional, List

class NoteCreate(BaseModel):
    content: Dict[str, Any]
    # [核心优化 2] 明确声明所支持的枚举概念，特别是手册要求的三种 AI 场景
    type: str 
    is_patient_facing: bool = False
    # provenance_pointer 包含: {"session_id": "...", "span_start": 0, "span_end": 10}
    provenance_pointer: Optional[Dict[str, Any]] = None 
    created_at: str = None
    parent_id: Optional[str] = None

class NoteEdit(BaseModel):
    content: Dict[str, Any]
    expected_version: int
    force_overwrite: bool = False

class ImportanceUpdate(BaseModel):
    status: str
    keyword: str = None

class AIRequest(BaseModel):
    raw_transcript: str