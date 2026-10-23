'use client';
import { useEffect, useState } from 'react';
import api from '@/app/api/api';
import { isVideoFile } from './StepTwo';

const STAGES = [
  { key: 'request_submitted', label: 'Request submitted', statuses: ['request_submitted', 'pending', 'open'] },
  { key: 'under_review', label: 'Under review', statuses: ['under_review'] },
  { key: 'request_acknowledged', label: 'Request acknowledged', statuses: ['request_acknowledged'] },
  { key: 'maintenance_team_assigned', label: 'Maintenance Team Assigned', statuses: ['maintenance_team_assigned', 'assigned'] },
  { key: 'access_confirmation_required', label: 'Access confirmation Required', statuses: ['access_confirmation_required'] },
  { key: 'appointment_confirmed', label: 'Appointment confirmed', statuses: ['appointment_confirmed'] },
  { key: 'maintenance_visit_underway', label: 'Maintenance Visit Underway', statuses: ['maintenance_visit_underway'] },
  { key: 'work_in_progress', label: 'Work in progress', statuses: ['work_in_progress', 'in_progress', 'awaiting_response', 'on_hold'] },
  { key: 'work_completed', label: 'Work completed', statuses: ['work_completed'] },
  { key: 'resolution_confirmation_required', label: 'Resolution Confirmation Required', statuses: ['resolution_confirmation_required'] },
  { key: 'ticket_closed', label: 'Ticket Closed', statuses: ['ticket_closed', 'sorted', 'closed'] },
];
const stageIndex = (status) => Math.max(0, STAGES.findIndex((stage) => stage.statuses.includes(status)));
const PAUSE_NOTE = {
  awaiting_response: 'We are waiting on a reply, possibly from you, a contractor or the landlord.',
  on_hold: 'This job is on hold for now. We will update you when it moves again.',
};
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const stageDates = (r) => {
  const dates = {};
  for (const ev of r.statusHistory || []) {
    const key = STAGES[stageIndex(ev.status)].key;
    if (!dates[key]) dates[key] = ev.at;
  }
  if (!dates.request_submitted) dates.request_submitted = r.createdAt;
  return dates;
};

function Tracker({ r }) {
  const current = stageIndex(r.status);
  const dates = stageDates(r);
  return (
    <div className="mt-5" aria-label={`Maintenance progress: ${STAGES[current].label}`}>
      <div className="flex gap-1" role="img" aria-label={`${current + 1} of ${STAGES.length} steps reached`}>
        {STAGES.map((stage, i) => <span key={stage.key} title={stage.label} className={`h-2.5 flex-1 rounded-full ${i <= current ? 'bg-[#18A34A]' : 'bg-gray-200'}`} />)}
      </div>
      <div className="mt-3 flex justify-between gap-3 text-xs md:text-sm text-gray-500">
        <span>{STAGES[0].label}</span><span className="text-right">{STAGES[STAGES.length - 1].label}</span>
      </div>
      <p className="mt-4 text-sm md:text-base font-semibold text-[#0F253B]">Current update: <span className="font-medium">{STAGES[current].label}</span></p>
      {dates[STAGES[current].key] && <p className="mt-1 text-xs text-gray-400">Updated {fmt(dates[STAGES[current].key])}</p>}
    </div>
  );
}

export default function MyRequests({ onReport }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmingId, setConfirmingId] = useState('');
  const [actionErrors, setActionErrors] = useState({});

  const confirmStep = async (request, confirmation) => {
    setConfirmingId(request._id);
    setActionErrors((prev) => ({ ...prev, [request._id]: '' }));
    try {
      const res = await api.post(`/maintenance/${request._id}/tenant-confirmation`, { confirmation });
      setRequests((prev) => prev.map((item) => item._id === request._id ? res.data.data : item));
    } catch (err) {
      setActionErrors((prev) => ({ ...prev, [request._id]: err.response?.data?.message || 'Could not confirm this update. Please try again.' }));
    } finally {
      setConfirmingId('');
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get('/maintenance');
        if (active) setRequests(res.data?.data || []);
      } catch (err) {
        if (active) setError(err.response?.data?.message || 'Failed to load your requests.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) return <p className="py-10 text-center text-sm text-gray-400">Loading your requests…</p>;
  if (error) return <p className="py-10 text-center text-sm text-red-500">{error}</p>;
  if (requests.length === 0) return (
    <div className="py-12 text-center">
      <p className="text-sm text-gray-400">You haven&apos;t reported any problems yet.</p>
      <button type="button" onClick={onReport} className="mt-4 px-5 py-2.5 bg-[#F47C3C] hover:bg-[#e85e2f] text-white text-sm font-bold rounded-xl transition">Report an issue</button>
    </div>
  );

  return (
    <ul className="space-y-4">
      {requests.map((r) => {
        const cover = (r.media || []).find((m) => m.type === 'image' || m.type === 'video') || (r.image ? { url: r.image } : null);
        const pendingConfirmation = r.status === 'access_confirmation_required' || r.status === 'resolution_confirmation_required';
        return (
          <li key={r._id} className="bg-white border border-[#E8E4DF] rounded-2xl p-4 md:p-5 shadow-sm">
            <div className="flex items-start gap-4">
              {cover && (isVideoFile(cover) ? <video src={cover.url} className="w-16 h-16 rounded-xl object-cover bg-black shrink-0" /> : <img src={cover.url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />)}
              <div className="min-w-0 flex-1">
                <p className="text-sm md:text-base font-bold text-[#0F253B]">{r.title}</p>
                <p className="text-xs text-gray-400 font-medium mt-0.5">{[r.ref, `Reported ${fmt(r.createdAt)}`, r.room].filter(Boolean).join(' · ')}</p>
                {r.description && <p className="text-xs text-gray-500 mt-2 line-clamp-2 whitespace-pre-line">{r.description}</p>}
              </div>
            </div>
            <Tracker r={r} />
            {pendingConfirmation && (
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3">
                {r.status === 'access_confirmation_required' ? <>
                  <p className="text-sm font-semibold text-[#0F253B]">Please confirm access for the maintenance visit.</p>
                  <button type="button" disabled={confirmingId === r._id} onClick={() => confirmStep(r, 'access')} className="mt-3 rounded-lg bg-[#F47C3C] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{confirmingId === r._id ? 'Confirming…' : 'Confirm access'}</button>
                </> : <>
                  <p className="text-sm font-semibold text-[#0F253B]">Has the repair resolved the issue?</p>
                  <button type="button" disabled={confirmingId === r._id} onClick={() => confirmStep(r, 'resolution')} className="mt-3 rounded-lg bg-[#F47C3C] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{confirmingId === r._id ? 'Confirming…' : 'Confirm resolution'}</button>
                </>}
              </div>
            )}
            {actionErrors[r._id] && <p role="alert" className="mt-2 text-xs text-red-600">{actionErrors[r._id]}</p>}
            {PAUSE_NOTE[r.status] && <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">{PAUSE_NOTE[r.status]}</p>}
          </li>
        );
      })}
    </ul>
  );
}
