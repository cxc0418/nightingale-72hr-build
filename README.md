# Nightingale (72hr Build) 🦉

Nightingale is a lightweight, AI-powered Electronic Health Record (EHR) and clinical note-taking system, built rapidly within a 72-hour window.

## 🚀 Features
* **AI-Assisted Transcription**: Real-time audio transcription for clinical notes.
* **Smart Conflict Detection**: Automated cross-checking of medical records (e.g., allergies, medications).
* **Modern PWA Frontend**: Responsive and fluid UI built with React and Vite.
* **Robust Backend**: Asynchronous RESTful API powered by FastAPI.

## 🛠️ Tech Stack
* **Frontend**: React, Vite, TailwindCSS (in `frontend-pwa`)
* **Backend**: Python, FastAPI, SQLite
* **AI Integration**: OpenAI Whisper / LLM APIs

## 📦 Quick Start
1. **Clone the repo:**
   `git clone https://github.com/cxc0418/nightingale-72hr-build.git`
2. **Start the Backend:**
   Ensure you have your `.env` configured (certificates not included in version control).
   `uvicorn main:app --reload`
3. **Start the Frontend:**
   `cd frontend-pwa`
   `npm install`
   `npm run dev`