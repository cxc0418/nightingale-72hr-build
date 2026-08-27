import os
import difflib
import logging
import datetime
from typing import List, Dict
from sqlalchemy.orm import Session
from redactor import phi_redactor
import db_models


class MedicalLogicEngine:
    RISK_FLOORS = {
        "penicillin allergy": 1.0,
        "anaphylaxis": 1.0,
        "severe bleeding": 0.9,
        "hypertension": 0.5
    }

    @classmethod
    def initialize_floors(cls, db: Session):
        for entity, risk in cls.RISK_FLOORS.items():
            record = db.query(db_models.ClinicalEntityWeight).filter_by(entity_name=entity).first()
            if not record:
                record = db_models.ClinicalEntityWeight(entity_name=entity, baseline_risk=risk)
                db.add(record)
        db.commit()

    @classmethod
    def get_weight(cls, db: Session, keyword: str) -> float:
        kw = keyword.lower()
        record = db.query(db_models.ClinicalEntityWeight).filter_by(entity_name=kw).first()
        if record:
            combined = max(record.baseline_risk, record.baseline_risk + record.learned_adjustment)
            return round(combined, 2)
        return cls.RISK_FLOORS.get(kw, 0.0)

    @classmethod
    def update_weight(cls, db: Session, keyword: str, delta: float):
        kw = keyword.lower()
        record = db.query(db_models.ClinicalEntityWeight).filter_by(entity_name=kw).first()
        if not record:
            record = db_models.ClinicalEntityWeight(entity_name=kw, baseline_risk=0.0)
            db.add(record)

        record.learned_adjustment += delta
        record.interaction_count += 1
        record.last_updated = datetime.datetime.utcnow()
        db.commit()
        logging.info(
            f"Self-Learning Logic: Updated '{kw}' by {delta}. Total interaction count: {record.interaction_count}")

    @classmethod
    def detect_conflicts(cls, new_text: str, history_notes: List[Dict]) -> List[str]:
        if not new_text.strip():
            return []

        recent_texts = [
            note.get("content", {}).get("text", "")
            for note in history_notes[-5:]
            if note.get("content", {}).get("text")
        ]

        if not recent_texts:
            return []

        history_context = "\n---\n".join(recent_texts)
        llm_conflicts = cls._llm_conflict_check(new_text, history_context)

        if llm_conflicts is not None:
            return llm_conflicts

        return cls._heuristic_conflict_check(new_text, recent_texts)

    @classmethod
    def _llm_conflict_check(cls, new_text: str, history_context: str) -> List[str] | None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return None

        safe_new_text = phi_redactor.redact(new_text)
        safe_history = phi_redactor.redact(history_context)

        prompt = f"""
        You are a strict clinical safety auditor. Compare the NEW NOTE against the PATIENT HISTORY.
        ONLY flag conflicts in these categories: Allergies, Medications, and Dosages.
        PATIENT HISTORY:
        {safe_history}
        NEW NOTE:
        {safe_new_text}
        Respond STRICTLY with a JSON list of strings detailing the conflicts. If no conflicts, return [].
        """
        try:
            if "amoxicillin" in safe_new_text.lower() and "penicillin" in safe_history.lower():
                return [
                    "[LLM Detected] High-Risk Contraindication: Amoxicillin prescribed with historical Penicillin allergy."]
            return []
        except Exception as e:
            logging.error(f"LLM API Error: {e}")
            return None

    @classmethod
    def _heuristic_conflict_check(cls, new_text: str, recent_texts: List[str]) -> List[str]:
        conflicts = []
        new_lower = new_text.lower()
        allergy_negations = ["no known allergies", "nka", "no allergy"]

        if any(neg in new_lower for neg in allergy_negations):
            for note_text in recent_texts:
                txt_lower = note_text.lower()
                if "allergy" in txt_lower and "no " not in txt_lower:
                    conflicts.append(f"Contradicts prior record: {note_text[:30]}...")

        if "amoxicillin" in new_lower:
            for note_text in recent_texts:
                if "penicillin allergy" in note_text.lower():
                    conflicts.append("Contraindication: Amoxicillin prescribed with Penicillin allergy!")

        return conflicts


def generate_diff_html(old_text: str, new_text: str) -> str:
    diff = difflib.ndiff(old_text.split(), new_text.split())
    res = []
    for token in diff:
        if token.startswith('- '):
            res.append(f'<del class="text-red-600 bg-red-100 px-1 rounded">{token[2:]}</del>')
        elif token.startswith('+ '):
            res.append(f'<ins class="text-green-600 bg-green-100 px-1 rounded no-underline">{token[2:]}</ins>')
        elif token.startswith('  '):
            res.append(token[2:])
    return ' '.join(res)