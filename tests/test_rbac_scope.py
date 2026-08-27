def test_rbac_staff_cannot_write_clinician_note(client):
    # Clinician creates a note
    res_create = client.post("/api/notes", headers={"x-user-role": "clinician"},
                             json={"content": {"text": "diagnosed"}, "type": "clinician_note"})
    note_id = res_create.json()["data"]["id"]

    # Staff attempts to overwrite the clinician's note
    res_edit = client.put(f"/api/notes/{note_id}", headers={"x-user-role": "staff"},
                          json={"content": {"text": "staff overwrite"}, "expected_version": 1})
    assert res_edit.status_code == 403


def test_patient_cannot_access_internal_notes(client):
    # Clinician creates internal and patient-facing notes
    client.post("/api/notes", headers={"x-user-role": "clinician"},
                json={"content": {"text": "internal only"}, "type": "clinician_note", "is_patient_facing": False})
    client.post("/api/notes", headers={"x-user-role": "clinician"},
                json={"content": {"text": "for patient"}, "type": "ai_patient_session_summary",
                      "is_patient_facing": True})

    # Patient pulls timeline data
    res = client.get("/api/notes/patient_123", headers={"x-user-role": "patient"})
    assert res.status_code == 200
    for note in res.json()["data"]:
        assert note["is_patient_facing"] is True


def test_clinic_isolation(client):
    # Foreign clinician from clinic_B attempts to access clinic_A patient
    res = client.get("/api/notes/patient_123", headers={"x-user-role": "foreign_clinician"})
    assert res.status_code == 403
    assert "SECURITY VIOLATION" in res.json()["detail"]