import { useState, useEffect, useRef } from 'react';

export default function GlanceView({ token, role, timelineTick }) {
  const [risks, setRisks] = useState([]);
  const [openTasks, setOpenTasks] = useState([]);
  const [error, setError] = useState(false);

  // Tracks card IDs that have been Accepted/Rejected during the current session
  const actedRiskIds = useRef(new Set());

  useEffect(() => {
    if (!token) return;

    const fetchHighlights = async () => {
      setError(false);
      try {
        const res = await fetch(`/api/notes/patient_123?t=${Date.now()}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });

        if (res.ok) {
          const json = await res.json();
          const allNotes = json.data;

          const currentRisks = allNotes.filter(n =>
            // Core intercept: Filter out cards that were just acted upon, regardless of backend response
            !actedRiskIds.current.has(n.id) &&
            ((n.author_role === 'system' && n.importance_status === 'pending') ||
            (n.conflicts && n.conflicts.length > 0 && n.importance_status === 'pending'))
          );

          const currentTasks = allNotes.filter(n => {
            if (n.resolved) return false;
            const assignees = n.content?.assignees || [];
            const text = n.content?.text?.toLowerCase() || "";
            const hasTask = assignees.length > 0 || text.includes('@');
            if (!hasTask) return false;

            if (role === 'admin_alice' || role === 'admin') return true;
            if (role === 'staff' || role === 'nurse_joy') {
              return assignees.includes('staff') || assignees.includes('nurse') || text.includes('@staff');
            }
            if (role === 'clinician' || role === 'dr_smith') {
              return assignees.includes('clinician') || assignees.includes('dr') || text.includes('@clinician');
            }
            return false;
          });

          setRisks(currentRisks);
          setOpenTasks(currentTasks);
        } else if (res.status === 403) {
          setRisks([]);
          setOpenTasks([]);
          setError(true);
        }
      } catch (err) {
        console.error("Failed to fetch highlights", err);
      }
    };

    fetchHighlights();
  }, [token, role, timelineTick]); // Re-run filtering when timelineTick triggers a reload

  const handleHighlightAction = async (e, action, noteId, keyword) => {
    e.preventDefault();
    e.stopPropagation();

    // Record that this card has been processed
    actedRiskIds.current.add(noteId);

    // Optimistically update the UI
    setRisks(prevRisks => prevRisks.filter(risk => risk.id !== noteId));

    try {
      const res = await fetch(`/api/notes/${noteId}/importance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: action, keyword })
      });
      if (!res.ok) console.error("Backend refused update");
    } catch (err) {
      console.error("Network error while updating importance:", err);
    }
  };

  const scrollToProvenance = (id) => {
    const el = document.getElementById(`entry-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-yellow-100', 'ring-4', 'ring-yellow-400', 'scale-[1.02]', 'z-10');
      setTimeout(() => {
        el.classList.remove('bg-yellow-100', 'ring-4', 'ring-yellow-400', 'scale-[1.02]', 'z-10');
      }, 2000);
    }
  };

  if (error) {
    return (
      <div className="bg-slate-100 p-5 rounded-lg border-2 border-dashed border-slate-300 text-center opacity-70 transition-all">
        <p className="text-slate-500 font-bold flex justify-center items-center gap-2">
          <span>🔒</span> Glance View Disabled (Access Restricted)
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-blue-600 transition-all" aria-live="polite">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        ⚡ Glance View
        <span className="text-xs font-normal text-slate-500 border border-slate-200 px-2 py-0.5 rounded">Scannable in &lt; 10s</span>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ========================================================= */}
        {/* Core optimization area: Dynamic risk rendering (Risk Reason & Provenance Pointer) */}
        {/* ========================================================= */}
        <div className="space-y-3 flex flex-col justify-start" aria-live="assertive" role="alert">
          <span className="text-rose-800 font-bold mb-1 flex items-center gap-2">
            🚨 Critical Insights ({risks.length})
          </span>

          {risks.length === 0 ? (
             <div className="text-sm text-slate-400 italic p-4 border border-dashed border-slate-200 rounded text-center bg-slate-50">
               No active clinical risks flagged by AI.
             </div>
          ) : (
            risks.map(risk => {
              // Attempt to extract the dynamic risk reason from various data structure levels
              const riskReason = risk.content?.risk_reason || (risk.conflicts && risk.conflicts[0]) || "Clinical anomaly detected in recent entries.";

              // Extract the triggered clinical entity keyword to feed back into the Self-Learning logic
              const targetEntity = risk.content?.target_entity || "general risk";

              return (
                <div
                  key={risk.id}
                  onClick={() => scrollToProvenance(risk.id)}
                  className="flex flex-col gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg shadow-sm cursor-pointer hover:shadow-md hover:border-rose-300 transition-all group"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-rose-700 font-bold text-sm leading-tight flex-1">
                      ⚠️ {riskReason}
                    </span>
                    <span className="bg-rose-100 text-rose-800 text-[10px] px-2 py-0.5 rounded ml-2 whitespace-nowrap">
                      Weight: {risk.ai_weight || 1}
                    </span>
                  </div>

                  {/* Explicit UI: Provenance Pointer */}
                  <div className="text-[10px] text-rose-500/80 font-mono flex items-center gap-1 mt-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
                    Source Pointer: {risk.provenance_pointer?.session_id ? `Session ${risk.provenance_pointer.session_id.substring(0,6)}` : `Timeline Entry v${risk.version}`}
                    <span className="italic ml-1">(Click to trace)</span>
                  </div>

                  <p className="text-xs text-rose-900 line-clamp-2 mt-1 border-t border-rose-100 pt-2">
                    {risk.content?.text || "See timeline for full context."}
                  </p>

                  <div className="flex gap-2 mt-2">
                    <button onClick={(e) => handleHighlightAction(e, 'accepted', risk.id, targetEntity)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded text-xs font-bold transition shadow-sm flex-1">
                      Accept
                    </button>
                    <button onClick={(e) => handleHighlightAction(e, 'rejected', risk.id, targetEntity)} className="bg-slate-400 hover:bg-slate-500 text-white px-3 py-1 rounded text-xs font-bold transition shadow-sm flex-1">
                      Reject
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Action Board */}
        <div className="bg-blue-50/50 p-4 rounded-md border border-blue-100 h-full">
          <span className="text-blue-800 font-bold mb-3 flex items-center gap-2">📋 Action Board ({openTasks.length})</span>
          <ul className="text-sm text-blue-900 space-y-3">
            {openTasks.length === 0 ? (
              <li className="text-slate-400 italic">All caught up! No pending tasks assigned to you.</li>
            ) : (
              openTasks.map(task => (
                <li
                  key={task.id}
                  onClick={() => scrollToProvenance(task.id)}
                  className="flex items-start gap-2 border-b border-blue-100/50 pb-2 last:border-0 cursor-pointer hover:text-blue-700 transition-colors"
                >
                  <span className="text-blue-400 mt-0.5">•</span>
                  <div className="flex-1">
                    <span className="capitalize font-semibold text-xs bg-white border border-blue-200 px-1 rounded mr-1">
                      {task.author_role}
                    </span>
                    <span className="line-clamp-2 text-slate-700">{task.content?.text}</span>
                  </div>
                  <div className="text-[10px] text-blue-400 whitespace-nowrap mt-1">Trace ↗</div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}