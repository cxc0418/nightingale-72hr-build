from pydantic import BaseModel
from typing import Dict, Any, Optional

class NoteCreate(BaseModel):
    content: Dict[str, Any]
    type: str
    is_patient_facing: bool = False
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