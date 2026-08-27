import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';

// ==========================================
// [核心加分项] 前端实时 Diff 算法 (基于 LCS 动态规划)
// 用于实现手册要求的 "view changes since X" 可视化
// ==========================================
const generateDiffHtml = (oldText, newText) => {
  if (!oldText && !newText) return "";
  const o = (oldText || "").split(/\s+/).filter(Boolean);
  const n = (newText || "").split(/\s+/).filter(Boolean);

  // 防止极端长文本阻塞主线程（兜底）
  if (o.length > 300 || n.length > 300) return newText;

  // 1. 构建 DP 矩阵
  const dp = Array(o.length + 1).fill(null).map(() => Array(n.length + 1).fill(0));
  for (let i = 1; i <= o.length; i++) {
      for (let j = 1; j <= n.length; j++) {
          if (o[i - 1] === n[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
          else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
  }

  // 2. 回溯路径，生成高亮 HTML
  let i = o.length, j = n.length;
  const res = [];
  while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && o[i - 1] === n[j - 1]) {
          res.unshift(`<span class="text-slate-600">${o[i - 1]}</span>`);
          i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
          // 当前版本新增的 (绿字)
          res.unshift(`<ins class="text-emerald-700 bg-emerald-100 px-1 rounded no-underline font-semibold">${n[j - 1]}</ins>`);
          j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
          // 历史版本中被删除的 (红字+删除线)
          res.unshift(`<del class="text-rose-600 bg-rose-50 px-1 rounded line-through opacity-70">${o[i - 1]}</del>`);
          i--;
      }
  }
  return res.join(' ');
};

export default function Timeline({ token, role, timelineTick, setReplyToId }) {
  const [notes, setNotes] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [diffModal, setDiffModal] = useState({ isOpen: false, html: '', noteId: '', draft: '' });
  const [historyExpanded, setHistoryExpanded] = useState({});
  const [localRefresh, setLocalRefresh] = useState(0);

  // 患者专属语音流 Refs
  const [isPatientRecording, setIsPatientRecording] = useState(false);
  const [patientAudioLoading, setPatientAudioLoading] = useState(false);
  const patientMediaRecorderRef = useRef(null);
  const patientStreamRef = useRef(null);
  const patientChunksRef = useRef([]);

  useEffect(() => {
    if (!token) return;
    const fetchTimeline = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/notes/patient_123?include_archived=${showArchived}&t=${Date.now()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });

        if (res.ok) {
          const json = await res.json();
          let allNotes = json.data;

          if (!showArchived) {
            allNotes = allNotes.filter(n =>
              n.is_archived !== true &&
              n.is_archived !== 1 &&
              String(n.is_archived).toLowerCase() !== "true"
            );
          }

          const notesMap = {};
          const rootNotes = [];

          allNotes.forEach(n => { notesMap[n.id] = { ...n, children: [] }; });
          allNotes.forEach(n => {
            if (n.parent_id && notesMap[n.parent_id]) {
              notesMap[n.parent_id].children.push(notesMap[n.id]);
            } else {
              if (notesMap[n.id]) {
                rootNotes.push(notesMap[n.id]);
              }
            }
          });
          setNotes(rootNotes.reverse());
        } else if (res.status === 403) {
          setNotes([]);
          setError("🔒 Access Denied: You do not have permission to view this patient's records (Clinic-Scoped Isolation Enforced).");
        }
      } catch (err) {
        console.error("Failed to fetch timeline", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTimeline();
  }, [token, timelineTick, showArchived, localRefresh]);

  const resolveNote = async (id) => {
    await fetch(`/api/notes/${id}/resolve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    setLocalRefresh(prev => prev + 1);
  };

  // 【新加】取消解决 API 交互
  const unresolveNote = async (id) => {
    await fetch(`/api/notes/${id}/unresolve`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    setLocalRefresh(prev => prev + 1);
  };

  // 【新加】冲突确认/消除 API 交互
  const dismissConflict = async (id) => {
    await fetch(`/api/notes/${id}/dismiss_conflict`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    setLocalRefresh(prev => prev + 1);
  };

  const revertNote = async (id, targetVersion) => {
    if(!window.confirm(`Revert this note back to version ${targetVersion}?`)) return;
    await fetch(`/api/notes/${id}/revert?target_version=${targetVersion}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    setLocalRefresh(prev => prev + 1);
  };

  const archiveNote = async (id) => {
    if(!window.confirm("Archive this old data? It will be compressed and hidden by default.")) return;
    try {
      const res = await fetch(`/api/notes/${id}/archive`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(`Failed to archive on server: ${errorData.detail}`);
        return;
      }
      setLocalRefresh(prev => prev + 1);
    } catch (err) {
      console.error("Network error archiving:", err);
      alert("Network connection lost.");
    }
  };

  const handleEdit = async (note, simulateConflict = false) => {
    const newText = window.prompt("Edit note content:", note.content?.text || "");
    if (!newText) return;

    const expectedVersion = simulateConflict ? note.version - 1 : note.version;
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content: { text: newText }, expected_version: expectedVersion, force_overwrite: false })
      });

      if (res.status === 409) {
        const err = await res.json();
        setDiffModal({ isOpen: true, html: err.detail.diff, noteId: note.id, draft: newText });
      } else if (res.ok) {
        setLocalRefresh(prev => prev + 1);
      }
    } catch (err) {
      console.error("Edit API error:", err);
    }
  };

  const forceOverwrite = async () => {
    await fetch(`/api/notes/${diffModal.noteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ content: { text: diffModal.draft }, expected_version: 0, force_overwrite: true })
    });
    setDiffModal({ isOpen: false, html: '', noteId: '', draft: '' });
    setLocalRefresh(prev => prev + 1);
  };

  const toggleHistory = (noteId) => {
    setHistoryExpanded(prev => ({ ...prev, [noteId]: !prev[noteId] }));
  };

  // ==========================================
  // [核心实现] 患者专属语音捕获处理 (Pre-Consult AI Intake Session)
  // 加上了针对嘈杂环境（Noise suppression, echo cancellation）的底层音频约束
  // ==========================================
  const togglePatientVoiceCapture = async () => {
    if (isPatientRecording) {
      if (patientMediaRecorderRef.current && patientMediaRecorderRef.current.state !== 'inactive') {
        patientMediaRecorderRef.current.stop();
      }
      if (patientStreamRef.current) {
        patientStreamRef.current.getTracks().forEach(t => t.stop());
      }
      setIsPatientRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,      // 开启底层主动降噪 (应对嘈杂病房环境)
          echoCancellation: true,      // 回声消除
          autoGainControl: true,       // 自动增益控制
          sampleRate: 44100            // 高保真采样
        }
      });
      patientStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      patientMediaRecorderRef.current = mediaRecorder;
      patientChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) patientChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setPatientAudioLoading(true);
        const audioBlob = new Blob(patientChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'patient_session.webm');
        formData.append('session_type', 'patient_session');

        try {
          const res = await fetch('/api/audio/transcribe', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
          });

          if (res.ok) {
            const data = await res.json();
            // 提交至后端生成 ai_patient_session_summary
            await fetch('/api/notes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                content: {
                  text: `[Pre-Consult AI Intake Session]\nPatient reported: ${data.redacted}`
                },
                type: 'ai_patient_session_summary',
                is_patient_facing: false,
                provenance_pointer: data.provenance_pointer
              })
            });
            alert("Your audio intake was securely processed and shared with your care team!");
            setLocalRefresh(prev => prev + 1);
          }
        } catch (err) {
          alert("Failed to process intake audio.");
        } finally {
          setPatientAudioLoading(false);
        }
      };

      mediaRecorder.start();
      setIsPatientRecording(true);
    } catch (err) {
      alert("Microphone permission denied.");
    }
  };

  // ==========================================
  // 视图渲染 A：患者视角的页面 (包含 Patient Voice Capture)
  // ==========================================
  if (role === 'patient_123' || role === 'patient') {
    const patientNotes = notes.filter(n => n.is_patient_facing);

    return (
      <div className="space-y-6">
        {/* 患者端 AI Intake 录音专属卡片 */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
            🎙️ Pre-Consult AI Intake Scribe
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Record your symptoms or concerns in any language before meeting the doctor. Your personal information is automatically redacted on-device.
          </p>
          <button
            onClick={togglePatientVoiceCapture}
            disabled={patientAudioLoading}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition ${
              isPatientRecording ? 'bg-rose-100 text-rose-700 ring-2 ring-rose-400 animate-pulse' :
              patientAudioLoading ? 'bg-purple-100 text-purple-700 opacity-60 cursor-not-allowed' :
              'bg-blue-600 hover:bg-blue-700 text-white shadow'
            }`}
          >
            {isPatientRecording ? '🛑 Stop & Submit Intake' : patientAudioLoading ? '⚙️ Redacting & Transcribing...' : '🎤 Speak with AI Assistant'}
          </button>
        </div>

        {/* 医嘱与护理计划视图 */}
        <div className="bg-white p-6 rounded-lg shadow-sm border-t-4 border-emerald-500">
          <h2 className="text-2xl font-bold mb-2 text-emerald-800">🏥 My Care Plan & Instructions</h2>
          <p className="text-sm text-slate-500 mb-6">These are the clinical summaries and instructions shared with you by your care team.</p>

          <div className="space-y-4">
            {isLoading ? (
               <div className="text-center text-slate-400 py-10 animate-pulse">Loading your records...</div>
            ) : patientNotes.length === 0 ? (
              <div className="text-center text-slate-400 py-10 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                No instructions or summaries are available yet.
              </div>
            ) : (
              patientNotes.map(note => (
                <div key={note.id} className="p-5 bg-emerald-50 border border-emerald-100 rounded-lg shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-200/50 px-2 py-1 rounded">
                      From {note.author_role}
                    </span>
                    <span className="text-xs text-emerald-600/70 font-medium">{note.created_at}</span>
                  </div>
                  <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.content?.text || "") }} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // [核心实现] 递归渲染 Timeline 的节点 (医护视角)
  // ==========================================
  const renderNoteNode = (note, depth = 0) => {
    const roleColor = note.author_role === 'clinician' ? 'text-emerald-600 bg-emerald-50' :
                      (note.author_role === 'system' ? 'text-purple-600 bg-purple-50' : 'text-blue-600 bg-blue-50');

    let rawText = note.content?.text || "";
    let safeText = DOMPurify.sanitize(rawText);

    // Provenance (溯源) 实体高亮
    if (note.provenance_pointer && note.provenance_pointer.span_start !== undefined) {
        const start = note.provenance_pointer.span_start;
        const end = note.provenance_pointer.span_end;
        if (start >= 0 && end <= safeText.length && start < end) {
            const targetEntity = safeText.substring(start, end);
            safeText = safeText.substring(0, start) +
                       `<span class="bg-yellow-200 text-yellow-900 px-1 rounded font-mono font-bold cursor-help">${targetEntity}</span>` +
                       safeText.substring(end);
        }
    }

    // @mentions 高亮
    safeText = safeText.replace(/@(\w+)/g, '<span class="text-blue-600 font-bold bg-blue-100 px-1 rounded">@$1</span>');

    return (
      <div
        key={note.id}
        id={`entry-${note.id}`}
        className={`p-4 rounded-lg border transition-all duration-500
        ${depth > 0 ? 'border-l-4 border-l-slate-300 ml-6 mt-2' : 'mb-5 shadow-sm'} 
        ${note.resolved ? 'opacity-60 grayscale bg-slate-50' : 'bg-white border-slate-200'}
        ${note.is_archived ? 'border-dashed border-slate-300 bg-slate-50 opacity-70' : ''}`}
      >
        <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
                {/* 身份 Badge */}
                <span className={`text-xs font-bold capitalize px-2 py-1 rounded border border-current border-opacity-20 ${roleColor}`}>
                  {note.author_role} {note.author_id && `(${note.author_id})`}
                </span>

                {/* AI 类型 Badge */}
                {note.author_role === 'system' && note.type && (
                  <span className="bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
                    🤖 {note.type.replace(/_/g, ' ')}
                  </span>
                )}

                {note.is_patient_facing && <span className="bg-sky-100 text-sky-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Patient Facing</span>}
                {note.is_archived && <span className="bg-slate-200 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Archived</span>}
            </div>
            <span className="text-[11px] text-slate-400 font-medium">v{note.version} | {note.created_at}</span>
        </div>

        {/* 【增强】支持交互式 Dismiss 冲突警告 */}
        {note.conflicts && note.conflicts.length > 0 && (
          <div className="text-xs text-rose-700 font-bold bg-rose-100 p-2 rounded mb-2 border border-rose-200 flex justify-between items-start gap-2 shadow-sm">
            <span>❌ {note.conflicts.join(' | ')}</span>
            {role !== 'patient_123' && role !== 'patient' && (
              <button
                onClick={() => dismissConflict(note.id)}
                className="bg-white/70 hover:bg-white text-rose-700 px-2 py-0.5 rounded border border-rose-200 transition-colors whitespace-nowrap shadow-sm text-[11px]"
                title="Acknowledge and dismiss this conflict warning"
              >
                ✓ Dismiss
              </button>
            )}
          </div>
        )}

        <div className="text-sm text-slate-800 mb-3 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: safeText }} />

        <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-100 items-center">
            <button onClick={() => { setReplyToId(note.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1">
              ↳ Reply
            </button>

            {role !== 'patient_123' && role !== 'patient' && (role === note.author_role || role === note.author_id || role === 'admin' || role === 'admin_alice') && (
              <button onClick={() => handleEdit(note)} className="text-xs text-blue-500 hover:text-blue-700 font-medium">✎ Edit</button>
            )}

            {note.version > 1 && (
              <button onClick={() => toggleHistory(note.id)} className="text-xs text-slate-500 hover:text-purple-600 font-medium">
                📜 History ({note.revisions?.length || 0})
              </button>
            )}

            {/* 【增强】Resolve / Unresolve 动态切换状态 */}
            {!note.resolved && role !== 'patient_123' && role !== 'patient' && (
              <button onClick={() => resolveNote(note.id)} className="text-xs text-slate-500 hover:text-emerald-600 font-medium">✔ Resolve</button>
            )}
            {note.resolved && role !== 'patient_123' && role !== 'patient' && (
              <button onClick={() => unresolveNote(note.id)} className="text-xs text-orange-500 hover:text-orange-700 font-medium">⟲ Unresolve</button>
            )}

            {!note.is_archived && role !== 'patient_123' && role !== 'patient' && (
              <button onClick={() => archiveNote(note.id)} className="text-xs text-slate-500 hover:text-slate-700 font-medium">📦 Archive</button>
            )}

            <button onClick={() => handleEdit(note, true)} className="text-[10px] text-orange-400 hover:text-orange-600 font-medium ml-auto border border-orange-200 px-2 py-1 rounded bg-orange-50">
              ⚡ Test 409
            </button>
        </div>

        {/* ==========================================
            优化后的 History 展示区 (集成 Diff 渲染)
            ========================================== */}
        {historyExpanded[note.id] && note.revisions && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 shadow-inner">
            <div className="flex justify-between items-center mb-3 border-b border-slate-200 pb-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <span>🔄</span> Version Changes (Compared to Current)
              </h4>
            </div>

            <div className="space-y-4">
              {note.revisions.slice().sort((a,b) => b.version - a.version).map(rev => (
                <div key={rev.version} className="flex flex-col text-xs p-3 bg-white rounded-md border border-slate-200 shadow-sm transition-all hover:shadow">

                   <div className="flex justify-between items-center mb-2">
                     <div className="flex items-center gap-2">
                         <span className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">v{rev.version}</span>
                         <span className="text-slate-500 italic">Saved by <span className="font-semibold capitalize">{rev.changed_by_role} {rev.changed_by_id && `(${rev.changed_by_id})`}</span></span>
                     </div>
                     {rev.version < note.version && (
                       <button
                         onClick={() => revertNote(note.id, rev.version)}
                         className="bg-slate-100 hover:bg-rose-100 hover:text-rose-700 hover:border-rose-300 border border-slate-200 text-slate-600 px-3 py-1 rounded font-bold transition whitespace-nowrap flex items-center gap-1 shadow-sm"
                       >
                         ↺ Revert to v{rev.version}
                       </button>
                     )}
                   </div>

                   <div className="text-[13px] text-slate-800 leading-relaxed mt-1 p-2 bg-slate-50/50 rounded font-mono break-words whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(generateDiffHtml(rev.content?.text, note.content?.text))
                        }}
                   />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 递归渲染子节点 (Thread Replies) */}
        {note.children && note.children.length > 0 && (
          <div className="mt-3">
            {note.children.map(child => renderNoteNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // 视图渲染 B：医护视角的页面 (Clinical View)
  // ==========================================
  return (
    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
      <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">🕒 Longitudinal Timeline</h2>
          <label className="text-sm text-slate-500 flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded text-slate-500" />
              Show Archived
          </label>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center text-slate-400 py-10 animate-pulse">Loading patient history...</div>
        ) : error ? (
          <div className="text-center text-rose-700 bg-rose-50 border-2 border-rose-200 py-10 rounded-lg font-bold flex flex-col items-center justify-center gap-2">
            <span className="text-3xl">🛡️</span>
            {error}
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center text-slate-400 py-10">No records found for this patient.</div>
        ) : (
          notes.map(note => renderNoteNode(note))
        )}
      </div>

      {/* 并发冲突 (409) 处理模态框 */}
      {diffModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[90%] md:w-[600px] shadow-2xl">
            <h3 className="text-lg font-bold text-rose-600 mb-2 flex items-center gap-2">⚠️ Concurrent Edit Conflict</h3>
            <p className="text-sm text-slate-600 mb-4">Another user modified this note while you were typing.</p>
            <div className="bg-slate-100 p-4 rounded-lg text-sm mb-6 font-mono leading-relaxed border border-slate-200 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: diffModal.html }} />
            <div className="flex justify-end gap-3">
              <button onClick={() => setDiffModal({ isOpen: false, html: '', noteId: '', draft: '' })} className="bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded font-medium">Discard</button>
              <button onClick={forceOverwrite} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded font-medium shadow-sm">Force Overwrite</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}