from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_concurrent_edits_conflict():
    # 模拟两人同时打开了 version 1 的页面进行编辑
    res = client.post("/api/notes", headers={"x-user-role": "staff"}, 
                      json={"content": {"text": "Base"}, "type": "staff_note"})
    note_id = res.json()["data"]["id"]

    # 护士A提交编辑，基于 expected_version=1 (成功)
    res_a = client.put(f"/api/notes/{note_id}", headers={"x-user-role": "staff"}, 
                       json={"content": {"text": "Nurse A Edit"}, "expected_version": 1})
    assert res_a.status_code == 200

    # 护士B几毫秒后提交编辑，依然基于 expected_version=1 (失败，产生冲突)
    res_b = client.put(f"/api/notes/{note_id}", headers={"x-user-role": "staff"}, 
                       json={"content": {"text": "Nurse B Edit"}, "expected_version": 1})
    # 断言：产生明确的冲突状态码
    assert res_b.status_code == 409
    assert "Conflict" in res_b.json()["detail"]