from logic import MedicalLogicEngine


def test_self_learning_weight_adaptation(client, db_session):
    keyword = "hypertension"

    # 1. Retrieve initial baseline weight
    initial_weight = MedicalLogicEngine.get_weight(db_session, keyword)

    # 2. Create a note to acquire a valid note_id
    res_create = client.post("/api/notes", headers={"x-user-role": "clinician"},
                             json={"content": {"text": "Patient has hypertension"}, "type": "clinician_note"})
    note_id = res_create.json()["data"]["id"]

    # 3. Simulate clinician manually accepting the highlight
    res_update = client.post(f"/api/notes/{note_id}/importance",
                             headers={"x-user-role": "clinician"},
                             json={"status": "accepted", "keyword": keyword})
    assert res_update.status_code == 200

    # 4. Assert dynamic weight increase via self-learning adaptation
    new_weight = MedicalLogicEngine.get_weight(db_session, keyword)
    assert new_weight > initial_weight