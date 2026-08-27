import re
import logging

# 尝试加载 spaCy NLP 模型，提供优雅降级 (Graceful Degradation)
try:
    import spacy

    # 加载轻量级英文模型，速度极快，适合 API 实时调用
    nlp = spacy.load("en_core_web_sm")
    SPACY_AVAILABLE = True
except (ImportError, OSError):
    logging.warning("spaCy model 'en_core_web_sm' not found. Falling back to regex heuristics.")
    SPACY_AVAILABLE = False


class PHIRedactor:
    def __init__(self):
        # 1. 强化的新加坡本地化正则 (Regex for localized strict patterns)
        self.ic_pattern = re.compile(r'\b[STFG]\d{7}[A-Z]\b', re.IGNORECASE)
        # 覆盖带区号(+65)、带空格、带连字符的复杂电话格式
        self.phone_pattern = re.compile(r'(?:\+?65[\s-]?)?[89]\d{3}[\s-]?\d{4}\b')

        # 2. 医疗语境的启发式正则 (Heuristic Context fallback)
        # 捕获诸如 "Patient Lim", "Mr. Smith", "Dr. Tan" 等极度常见的临床口述前缀
        self.context_name_pattern = re.compile(r'\b(Mr\.|Mrs\.|Ms\.|Dr\.|Patient)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b')

    def redact(self, text: str) -> str:
        if not text:
            return text

        redacted_text = text

        # 第 1 步：高优先级正则替换 (确定性最高的本地化标识符)
        redacted_text = self.ic_pattern.sub("[ID_REDACTED]", redacted_text)
        redacted_text = self.phone_pattern.sub("[PHONE_REDACTED]", redacted_text)

        # 第 2 步：NLP 动态命名实体识别 (NER)
        if SPACY_AVAILABLE:
            doc = nlp(redacted_text)
            # 倒序遍历实体并替换，防止字符串长度变化导致索引偏移 (Index Shifting)
            for ent in reversed(doc.ents):
                if ent.label_ == "PERSON":
                    redacted_text = redacted_text[:ent.start_char] + "[NAME_REDACTED]" + redacted_text[ent.end_char:]

        # 第 3 步：上下文启发式兜底替换
        # 用于弥补小参数 NLP 模型可能漏掉的亚洲名字拼写
        # 例："Mr. Tan" -> "Mr. [NAME_REDACTED]"
        redacted_text = self.context_name_pattern.sub(r'\1 [NAME_REDACTED]', redacted_text)

        return redacted_text


phi_redactor = PHIRedactor()