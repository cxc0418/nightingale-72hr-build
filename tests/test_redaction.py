from fastapi.testclient import TestClient
from main import app
from redactor import phi_redactor

client = TestClient(app)


def test_phi_redaction_engine_logic():
    # 测试底层引擎的准确性
    raw = "Patient Lim Ah Beng called at +65 9123 4567. IC is S1234567A."
    safe = phi_redactor.redact(raw)

    assert "Lim Ah Beng" not in safe
    assert "9123 4567" not in safe
    assert "S1234567A" not in safe
    assert "[NAME_REDACTED]" in safe
    assert "[PHONE_REDACTED]" in safe
    assert "[ID_REDACTED]" in safe


def test_ai_endpoint_enforces_redaction():
    # 测试 API 端点在发给 LLM 之前是否强制执行了脱敏
    payload = {"raw_transcript": "Hello, my name is Alice and my number is 81234567."}
    res = client.post("/api/ai/generate-summary", headers={"x-user-role": "clinician"}, json=payload)

    assert res.status_code == 200
    sent_text = res.json()["redacted_payload_sent_to_llm"]

    assert "Alice" not in sent_text
    assert "81234567" not in sent_text
    assert "[NAME_REDACTED]" in sent_text