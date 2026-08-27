# Nightingale (72hr Build) 🦉

Nightingale is a lightweight, AI-powered Electronic Health Record (EHR) and clinical note-taking system, built rapidly within a 72-hour window. It enables real-time, longitudinal, role-based collaboration across clinicians, staff, and patients, integrating AI-scribed notes and patient-provided insights into one actionable record.

## 🚀 Core Features

* **Longitudinal Timeline**: A time-ordered, continuous feed of all patient context, including manual notes, system events, and AI summaries.


* **Glance View (Top Card)**: A highly scannable dashboard surfacing critical risks, clinical anomalies, and open action items in under 10 seconds.


* **Ambient AI Scribe**: Real-time audio transcription and diarization for clinical consults and patient intake, automatically generating structured summaries.


* **Smart Prioritization & Self-Learning**: The system adapts highlight weights based on clinician interactions (accepting/rejecting AI suggestions).


* **Cross-Role Collaboration**: Inline threaded comments, mentions, and deterministic concurrent edit resolution.



## 🛠️ Tech Stack

* **Frontend**: React, Vite, TailwindCSS (in `frontend-pwa`).


* **Backend**: Python, FastAPI, SQLite.


* **AI Integration**: OpenAI Whisper / LLM APIs.



## 📦 Quick Start

1. **Clone the repository:**
`git clone [https://github.com/cxc0418/nightingale-72hr-build.git](https://github.com/cxc0418/nightingale-72hr-build.git)`

2. **Start the Backend:**
Ensure your `.env` is configured with `OPENAI_API_KEY` (certificates not included in version control).


```bash
pip install -r requirements.txt
uvicorn main:app --reload

```


3. **Start the Frontend:**
```bash
cd frontend-pwa
npm install
npm run dev

```



## 🔒 Security & Privacy: No-PHI Redaction Pipeline

Patient Health Information (PHI) is strictly sanitized on-device/server **before** any data is transmitted to external LLM APIs.

* **Redaction Engine (`redactor.py`)**: Utilizes a multi-layered approach combining strict localized regex patterns (for IC numbers and phone numbers) and context-heuristic NLP (via spaCy) for named entity recognition (NER).


* **Pipeline Enforcement**: The `/api/audio/transcribe` endpoint intercepts raw audio transcripts, passes them through the `phi_redactor`, and only sends the sanitized payload to the LLM for clinical summarization.



## 🛡️ Role-Based Access Control (RBAC) & Clinic Isolation

Access controls are strictly enforced **server-side** via FastAPI dependencies, ensuring UI-level bypasses are impossible.

* **Enforcement Mechanism**: The `get_current_user` dependency validates JWT tokens, while `verify_clinic_access` enforces strict clinic-scoped isolation.


* **Patients**: Can only view notes explicitly flagged as `is_patient_facing`. They are blocked from accessing internal staff/clinician comments or raw AI-scribed notes.


* **Staff & Clinicians**: Staff cannot overwrite clinician notes, and clinicians cannot overwrite staff notes. Both roles are isolated to their specific `clinic_id`.


* **Admins**: Possess clinic-scoped oversight for auditing and clinic-wide overviews.



## 🧪 Required Micro-Tests

The system includes a comprehensive suite of automated tests verifying the integrity of RBAC, version control, data provenance, concurrency, and self-learning logic.

**How to run the tests:**
Ensure you are in the project root directory and have `pytest` installed.

```bash
python -m pytest tests/

```

*Note: The test suite uses a `conftest.py` fixture to spin up a fully isolated, in-memory SQLite database (`sqlite:///:memory:`) with a `StaticPool` to ensure tests do not corrupt the local development database*.

**Test Coverage Breakdown:**

1. **`test_rbac_scope.py`**: Asserts that staff and clinicians cannot overwrite each other's note types, verifies patients cannot access internal notes, and confirms strict cross-clinic isolation (e.g., Clinic B cannot access Clinic A's patients).


2. **`test_revision_history.py`**: Asserts that editing a note securely increments its version number, audits the metadata of the user making the change, and successfully reverts content to a prior state.


3. **`test_highlight_provenance.py`**: Asserts that AI-generated highlights possess a strictly valid `provenance_pointer` (containing `session_id` and span markers) that successfully resolves back to the original source text.


4. **`test_concurrent_edits.py`**: Demonstrates the deterministic conflict resolution strategy (HTTP 409 Conflict) when two users attempt to submit edits against the same `expected_version` of a note.


5. **`test_self_learning_importance.py` (Bonus)**: Simulates a clinician manually accepting an AI-generated highlight suggestion, asserting that the interaction dynamically increments the baseline weight for that specific clinical entity in future logic.



---

