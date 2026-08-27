import { useState } from 'react';
import { useNightingale } from './hooks/useNightingale';
import ActionArea from './components/ActionArea';
import Timeline from './components/Timeline';
import GlanceView from './components/GlanceView';

export default function App() {
  const { token, role, setRole, timelineTick } = useNightingale();
  const [replyToId, setReplyToId] = useState(null);

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-lg font-bold text-slate-500 animate-pulse">
          Authenticating as {role}...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 p-6 font-sans text-slate-800 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* System Console */}
        <div className="bg-slate-900 text-white p-4 rounded-lg flex justify-between shadow-md items-center">
          <span className="font-bold flex items-center gap-2">
            System Console
            <span className="text-[10px] bg-green-500 text-slate-900 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Live
            </span>
          </span>

          <div className="flex items-center gap-4">
            <label htmlFor="role-selector" className="text-sm text-slate-300">
              View As:
            </label>
            <select
              id="role-selector"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="bg-slate-800 text-white border border-slate-700 text-sm rounded p-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {/* Note: value must match the username keys in auth.py */}
              <option value="dr_smith">Clinician (Dr. Smith)</option>
              <option value="nurse_joy">Staff (Nurse)</option>
              <option value="patient_123">Patient (Limited View)</option>

              {/* Test roles for RBAC and isolation */}
              <option value="admin_alice">Admin (Clinic Manager)</option>
              <option value="dr_jones">Clinician (Dr. Jones - Clinic B) [Test 403]</option>
            </select>
          </div>
        </div>

        {/* GlanceView rendered only for authorized roles */}
        {role !== 'patient_123' && (
          <GlanceView token={token} role={role} timelineTick={timelineTick} />
        )}

        {role !== 'patient_123' && (
          <ActionArea token={token} replyToId={replyToId} setReplyToId={setReplyToId} />
        )}

        <Timeline token={token} role={role} timelineTick={timelineTick} setReplyToId={setReplyToId} />

      </div>
    </div>
  );
}