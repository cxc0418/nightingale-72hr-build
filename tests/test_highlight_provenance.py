from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_highlight_provenance_resolution():
    # 1. 模拟底层存在一段 AI 转录原始文本
    source_res = client.post("/api/notes", headers={"x-user-role": "system"}, 
                             json={"content": {"text": "Patient has penicillin allergy."}, "type": "system_event"})
    source_id = source_res.json()["data"]["id"]

    # 2. 生成一个高亮卡片，强制带有 provenance_pointer 指向原文
    hl_res = client.post("/api/notes", headers={"x-user-role": "system"}, 
                         json={
                             "content": {"text": "Penicillin Allergy Detected"}, 
                             "type": "highlight",
                             "provenance_pointer": {"source_entry_id": source_id, "span_start": 12, "span_end": 30}
                         })
    
    pointer = hl_res.json()["data"]["provenance_pointer"]
    
    # 3. 断言：溯源指针能成功解析回原始记录库
    timeline_res = client.get("/api/notes/patient_123", headers={"x-user-role": "clinician"})
    all_ids = [n["id"] for n in timeline_res.json()["data"]]
    assert pointer["source_entry_id"] in all_ids