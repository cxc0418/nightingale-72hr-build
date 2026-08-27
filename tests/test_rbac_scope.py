from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_rbac_staff_cannot_write_clinician_note():
    # 断言：员工和医生不能互相写入彼此类型的笔记
    res = client.post("/api/notes", headers={"x-user-role": "staff"}, 
                      json={"content": {"text": "diagnosed"}, "type": "clinician_note"})
    assert res.status_code == 403

def test_patient_cannot_access_internal_notes():
    # 准备：医生创建一条内部笔记和一条面向患者的笔记
    client.post("/api/notes", headers={"x-user-role": "clinician"}, 
                json={"content": {"text": "internal only"}, "type": "clinician_note", "is_patient_facing": False})
    client.post("/api/notes", headers={"x-user-role": "clinician"}, 
                json={"content": {"text": "for patient"}, "type": "ai_patient_session_summary", "is_patient_facing": True})
    
    # 断言：患者只能拉取到面向患者的笔记
    res = client.get("/api/notes/patient_123", headers={"x-user-role": "patient"})
    assert res.status_code == 200
    for note in res.json()["data"]:
        assert note["is_patient_facing"] is True