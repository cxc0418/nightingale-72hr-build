from redactor import phi_redactor


def test_phi_redaction_engine_logic():
    raw = "Patient Lim Ah Beng called at +65 9123 4567. IC is S1234567A."
    safe = phi_redactor.redact(raw)

    assert "Lim Ah Beng" not in safe
    assert "9123 4567" not in safe
    assert "S1234567A" not in safe
    assert "[NAME_REDACTED]" in safe
    assert "[PHONE_REDACTED]" in safe
    assert "[ID_REDACTED]" in safe


def test_ai_endpoint_enforces_redaction(client):
    # Simulate audio payload to trigger AI scribe endpoint
    files = {'audio': ('test.webm', b'fake audio bytes', 'audio/webm')}
    data = {'session_type': 'doctor_consult'}

    res = client.post("/api/audio/transcribe", headers={"x-user-role": "clinician"}, files=files, data=data)
    assert res.status_code == 200

    sent_text = res.json()["redacted"]
    assert "Lim Ah Beng" not in sent_text
    assert "[NAME_REDACTED]" in sent_text