# db_models.py
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Index, JSON, Float
from sqlalchemy.orm import relationship
import datetime
import uuid
from database import Base


class Note(Base):
    __tablename__ = "notes"

    __table_args__ = (
        Index('ix_patient_archived', 'patient_id', 'is_archived'),
    )

    is_archived = Column(Boolean, default=False)
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String, index=True, nullable=False)

    # [核心优化 1] 添加了 author_id 以记录确切身份，如 dr_smith, system
    author_role = Column(String, nullable=False)
    author_id = Column(String, nullable=False)

    type = Column(String, nullable=False)
    content = Column(JSON, nullable=False)
    is_patient_facing = Column(Boolean, default=False)

    conflicts = Column(JSON, default=list)
    provenance_pointer = Column(JSON, nullable=True)

    version = Column(Integer, default=1, nullable=False)
    resolved = Column(Boolean, default=False)
    importance_status = Column(String, default="pending")
    parent_id = Column(String, ForeignKey("notes.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    revisions = relationship("NoteRevision", back_populates="note")


class NoteRevision(Base):
    __tablename__ = "note_revisions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    note_id = Column(String, ForeignKey("notes.id"))
    content_snapshot = Column(JSON, nullable=False)
    version = Column(Integer, nullable=False)

    # [核心优化 1] 追踪版本的具体修改人 ID
    changed_by_role = Column(String, nullable=False)
    changed_by_id = Column(String, nullable=False)

    changed_at = Column(DateTime, default=datetime.datetime.utcnow)

    note = relationship("Note", back_populates="revisions")


class ClinicalEntityWeight(Base):
    __tablename__ = "clinical_entity_weights"

    entity_name = Column(String, primary_key=True, index=True)
    baseline_risk = Column(Float, default=0.0)
    learned_adjustment = Column(Float, default=0.0)
    interaction_count = Column(Integer, default=0)
    last_updated = Column(DateTime, default=datetime.datetime.utcnow)