def test_revision_and_revert(client):
    # 1. Create v1
    res = client.post("/api/notes", headers={"x-user-role": "clinician"},
                      json={"content": {"text": "V1 data"}, "type": "clinician_note"})
    note_id = res.json()["data"]["id"]
    assert res.json()["data"]["version"] == 1

    # 2. Edit to v2
    res2 = client.put(f"/api/notes/{note_id}", headers={"x-user-role": "clinician"},
                      json={"content": {"text": "V2 data"}, "expected_version": 1})
    assert res2.json()["data"]["version"] == 2

    # 3. Revert to V1
    res3 = client.post(f"/api/notes/{note_id}/revert?target_version=1", headers={"x-user-role": "clinician"})
    assert res3.json()["data"]["version"] == 3
    assert res3.json()["data"]["content"]["text"] == "V1 data"