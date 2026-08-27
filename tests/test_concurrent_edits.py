def test_concurrent_edits_conflict(client):
    # Simulate users opening version 1 for editing
    res = client.post("/api/notes", headers={"x-user-role": "staff"},
                      json={"content": {"text": "Base"}, "type": "staff_note"})
    note_id = res.json()["data"]["id"]

    # Nurse A submits edit based on expected_version=1 (Success)
    res_a = client.put(f"/api/notes/{note_id}", headers={"x-user-role": "staff"},
                       json={"content": {"text": "Nurse A Edit"}, "expected_version": 1})
    assert res_a.status_code == 200

    # Nurse B submits edit based on expected_version=1 (Failure / Conflict)
    res_b = client.put(f"/api/notes/{note_id}", headers={"x-user-role": "staff"},
                       json={"content": {"text": "Nurse B Edit"}, "expected_version": 1})

    assert res_b.status_code == 409
    assert res_b.json()["detail"]["msg"] == "Concurrent edit detected"
    assert "diff" in res_b.json()["detail"]