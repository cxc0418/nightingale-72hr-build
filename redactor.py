import re
import logging

try:
    import spacy

    nlp = spacy.load("en_core_web_sm")
    SPACY_AVAILABLE = True
except (ImportError, OSError):
    logging.warning("spaCy model 'en_core_web_sm' not found. Falling back to regex heuristics.")
    SPACY_AVAILABLE = False


class PHIRedactor:
    def __init__(self):
        # Strict pattern fallback (National IDs)
        self.ic_pattern = re.compile(r'\b[STFG]\d{7}[A-Z]\b', re.IGNORECASE)
        # Strict pattern fallback (Phone numbers e.g. +65)
        self.phone_pattern = re.compile(r'(?:\+?65[\s-]?)?[89]\d{3}[\s-]?\d{4}\b')
        # Heuristic context pattern fallback (e.g. "Patient Lim")
        self.context_name_pattern = re.compile(r'\b(Mr\.|Mrs\.|Ms\.|Dr\.|Patient)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b')

    def redact(self, text: str) -> str:
        if not text:
            return text

        redacted_text = text
        redacted_text = self.ic_pattern.sub("[ID_REDACTED]", redacted_text)
        redacted_text = self.phone_pattern.sub("[PHONE_REDACTED]", redacted_text)

        # NLP Named Entity Recognition
        if SPACY_AVAILABLE:
            doc = nlp(redacted_text)
            # Reverse iteration to prevent index shifting
            for ent in reversed(doc.ents):
                if ent.label_ == "PERSON":
                    redacted_text = redacted_text[:ent.start_char] + "[NAME_REDACTED]" + redacted_text[ent.end_char:]

        redacted_text = self.context_name_pattern.sub(r'\1 [NAME_REDACTED]', redacted_text)
        return redacted_text


phi_redactor = PHIRedactor()