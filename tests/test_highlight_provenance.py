def test_highlight_provenance_resolution(client):
    # Simulate a highlight generated from the audio pipeline
    hl_res = client.post("/api/notes", headers={"x-user-role": "system"},
                         json={
                             "content": {"text": "Penicillin Allergy Detected"},
                             "type": "highlight",
                             "provenance_pointer": {
                                 "session_id": "session_a1b2c3d4",
                                 "source_type": "ambient_audio_capture",
                                 "span_start": 12,
                                 "span_end": 30
                             }
                         })

    pointer = hl_res.json()["data"]["provenance_pointer"]

    # Assert provenance pointer resolves correctly
    assert pointer["source_type"] == "ambient_audio_capture"
    assert "session_id" in pointer