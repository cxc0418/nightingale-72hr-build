// ActionArea.jsx
import { useState, useRef } from 'react';

export default function ActionArea({ token, role, replyToId, setReplyToId }) {
  const [noteText, setNoteText] = useState("");
  const [isPatientFacing, setIsPatientFacing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const [transcriptData, setTranscriptData] = useState(null);
  const [redactionStep, setRedactionStep] = useState('transcribing'); // transcribing | done | error

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const extractAssignees = (text) => {
    const matches = text.match(/@(\w+)/g);
    return matches ? [...new Set(matches.map(m => m.substring(1).toLowerCase()))] : [];
  };

  const submitNote = async (
    textToSubmit = noteText,
    type = (role === 'staff' ? 'staff_note' : 'clinician_note'),
    provenancePointer = null
  ) => {
    if (!textToSubmit.trim()) return;
    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          content: {
            text: textToSubmit,
            assignees: extractAssignees(textToSubmit)
          },
          type: type,
          is_patient_facing: isPatientFacing,
          provenance_pointer: provenancePointer,
          parent_id: replyToId || null
        })
      });
      setNoteText("");
      setIsPatientFacing(false);
      setReplyToId(null);
    } catch (err) {
      console.error("Submit failed:", err);
    }
  };

  const toggleVoiceCapture = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,      // 开启底层主动降噪
          echoCancellation: true,      // 回声消除 (防止外放声音被再次录入)
          autoGainControl: true,       // 自动增益控制 (处理医生走动时声音忽大忽小)
          sampleRate: 44100            // 保证医疗语音的高保真采样
        }
      });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setShowTranscriptModal(true);
        setRedactionStep('transcribing');

        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'consult_recording.webm');
        formData.append('session_type', role === 'staff' ? 'nurse_consult' : 'doctor_consult');

        try {
          const res = await fetch('/api/audio/transcribe', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
          });

          if (res.ok) {
            const data = await res.json();
            setTranscriptData(data);
            setRedactionStep('done');
          } else {
            setRedactionStep('error');
          }
        } catch (err) {
          setRedactionStep('error');
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Microphone access denied or audio recording not supported.");
    }
  };

  const confirmAndSubmitTranscript = async () => {
    if (!transcriptData) return;
    setIsProcessing(true);
    setShowTranscriptModal(false);

    // 将脱敏后的语音及结构化总结提交至时间线，带有完整 Provenance 指针与 System 标记
    const formattedContent = `${transcriptData.summary}\n\n[Diarized Transcript]\n${transcriptData.redacted}`;
    await submitNote(
      formattedContent,
      transcriptData.note_type,
      transcriptData.provenance_pointer
    );
    setIsProcessing(false);
    setTranscriptData(null);
  };

  return (
    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 transition-all relative">
      {replyToId && (
        <div className="mb-3 flex justify-between items-center bg-indigo-50 text-indigo-700 px-3 py-2 rounded-md text-sm font-bold border border-indigo-100 shadow-inner">
          <span className="flex items-center gap-2">↳ Replying to thread: {replyToId.split('-')[0]}...</span>
          <button onClick={() => setReplyToId(null)} className="hover:text-rose-600 bg-indigo-100 hover:bg-rose-100 px-2 py-0.5 rounded transition-colors">✕ Cancel</button>
        </div>
      )}

      <textarea
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        className={`w-full border rounded-md p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y ${replyToId ? 'border-indigo-300 ring-1 ring-indigo-100' : 'border-slate-300'}`}
        rows="3"
        placeholder="Document clinical plan, observations, or tag members (@staff, @clinician)..."
      />

      <div className="flex gap-2 mt-2 px-1">
        <span className="text-xs text-slate-400 font-bold uppercase tracking-wide flex items-center mr-2">⚡ Quick Assign:</span>
        <button onClick={() => setNoteText(prev => prev + " @staff ")} className="text-xs bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 font-medium px-2 py-1 rounded transition border border-slate-200 hover:border-blue-300">@staff</button>
        <button onClick={() => setNoteText(prev => prev + " @clinician ")} className="text-xs bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 font-medium px-2 py-1 rounded transition border border-slate-200 hover:border-emerald-300">@clinician</button>
      </div>

      <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100">
        <label className="text-sm text-slate-600 flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={isPatientFacing} onChange={(e) => setIsPatientFacing(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
          Visible to Patient
        </label>

        <div className="space-x-3 flex">
          <button
            onClick={toggleVoiceCapture}
            disabled={isProcessing}
            className={`transition px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 ${
              isRecording ? 'animate-pulse text-red-700 bg-red-100 ring-2 ring-red-400' :
              isProcessing ? 'text-purple-700 bg-purple-100 opacity-70 cursor-not-allowed' :
              'bg-purple-100 text-purple-700 hover:bg-purple-200 shadow-sm'
            }`}
          >
            {isRecording ? '🛑 Stop Recording...' : isProcessing ? '⚙️ Processing...' : '🎤 Ambient Consult Scribe'}
          </button>

          <button
            onClick={() => submitNote()}
            disabled={isRecording || isProcessing || !noteText.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition text-white px-5 py-2 rounded-md text-sm font-bold shadow-sm"
          >
            Commit Note
          </button>
        </div>
      </div>

      {/* 转写与脱敏模态框 */}
      {showTranscriptModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col justify-center items-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl border border-slate-200 shadow-2xl p-6 flex flex-col animate-in fade-in duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="flex items-center gap-2">🛡️ Ambient AI Scribe Pipeline (PWA Capture)</span>
              {transcriptData && (
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full">
                  Confidence: {transcriptData.confidence}%
                </span>
              )}
            </h3>

            <div className="w-full space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  1. Raw Audio Diarized Feed
                </span>
                <p className={`text-xs font-mono whitespace-pre-wrap ${redactionStep === 'transcribing' ? 'blur-sm select-none' : 'text-slate-700'}`}>
                  {transcriptData?.raw || "Transcribing audio..."}
                </p>
              </div>

              <div className="bg-emerald-50/50 p-3.5 rounded-lg border border-emerald-200">
                <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                  2. Redacted & Verified Output (No PHI to Cloud)
                </span>
                <p className={`text-xs font-mono whitespace-pre-wrap ${redactionStep === 'done' ? 'text-emerald-900 font-medium' : 'text-slate-400 italic'}`}>
                  {transcriptData?.redacted || "Running regex & entity mask..."}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-100">
              <button
                onClick={() => setShowTranscriptModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-md font-medium transition"
              >
                Discard
              </button>
              <button
                onClick={confirmAndSubmitTranscript}
                disabled={redactionStep !== 'done'}
                className="px-5 py-2 text-sm bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-md font-bold shadow transition"
              >
                Confirm & Scribe to Timeline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}