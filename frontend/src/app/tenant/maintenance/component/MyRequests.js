'use client';
import { useEffect, useState } from 'react';
import api from '@/app/api/api';
import { isVideoFile } from './StepTwo';

// The milestones a tenant sees, in order. "awaiting_response" and "on_hold"
// are pauses inside "in progress" rather than steps of their own; legacy
// "open"/"closed" read as reported/sorted.
const STAGES = [
  { key: 'reported', label: 'Reported', statuses: ['pending', 'open'] },
  { key: 'assigned', label: 'Contractor assigned', statuses: ['assigned'] },
  { key: 'in_progress', label: 'Work in progress', statuses: ['in_progress', 'awaiting_response', 'on_hold'] },
  { key: 'sorted', label: 'Sorted', statuses: ['sorted', 'closed'] },
];

const stageIndex = (status) => Math.max(0, STAGES.findIndex((s) => s.statuses.includes(status)));

const PAUSE_NOTE = {
  awaiting_response: 'We are waiting on a reply, possibly from you, a contractor or the landlord.',
  on_hold: 'This job is on hold for now. We will update you when it moves again.',
};

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

// When the job first reached each stage, from its status history. Jobs saved
// before the history existed only know when they were reported.
const stageDates = (r) => {
  const dates = {};
  for (const ev of r.statusHistory || []) {
    const key = STAGES[stageIndex(ev.status)].key;
    if (!dates[key]) dates[key] = ev.at;
  }
  if (!dates.reported) dates.reported = r.createdAt;
  return dates;
};

function Tracker({ r }) {
  const current = stageIndex(r.status);
  const dates = stageDates(r);
  return (
    <ol className="mt-4 grid grid-cols-4 gap-1">
      {STAGES.map((stage, i) => {
        const done = i <= current;
        return (
          <li key={stage.key} className="flex flex-col items-center text-center">
            <div className="flex items-center w-full">
              <div className={`h-[2px] flex-1 ${i === 0 ? 'invisible' : done ? 'bg-[#18B26A]' : 'bg-gray-200'}`} />
              <div
                className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold
                ${i === current && i < STAGES.length - 1 ? 'bg-[#F27438] text-white' : done ? 'bg-[#18B26A] text-white' : 'bg-gray-200 text-gray-500'}`}
              >
                {done && !(i === current && i < STAGES.length - 1) ? '✓' : i + 1}
              </div>
              <div className={`h-[2px] flex-1 ${i === STAGES.length - 1 ? 'invisible' : i < current ? 'bg-[#18B26A]' : 'bg-gray-200'}`} />
            </div>
            <span className={`mt-1.5 text-[10px] md:text-xs font-semibold ${done ? 'text-[#0F253B]' : 'text-gray-400'}`}>
              {stage.label}
            </span>
            {done && dates[stage.key] && (
              <span className="text-[9px] md:text-[10px] text-gray-400">{fmt(dates[stage.key])}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function MyRequests({ onReport }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p className="py-10 text-center text-sm text-gray-400">Loading your requests…</p>;
  }
  if (error) {
    return <p className="py-10 text-center text-sm text-red-500">{error}</p>;
  }
  if (requests.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-400">You haven&apos;t reported any problems yet.</p>
        <button
          type="button"
          onClick={onReport}
          className="mt-4 px-5 py-2.5 bg-[#F47C3C] hover:bg-[#e85e2f] text-white text-sm font-bold rounded-xl transition"
        >
          Report an issue
        </button>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {requests.map((r) => {
        const cover = (r.media || []).find((m) => m.type === 'image' || m.type === 'video') || (r.image ? { url: r.image } : null);
        return (
          <li key={r._id} className="bg-white border border-[#E8E4DF] rounded-2xl p-4 md:p-5 shadow-sm">
            <div className="flex items-start gap-4">
              {cover && (
                isVideoFile(cover) ? (
                  <video src={cover.url} className="w-16 h-16 rounded-xl object-cover bg-black shrink-0" />
                ) : (
                  <img src={cover.url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                )
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm md:text-base font-bold text-[#0F253B]">{r.title}</p>
                <p className="text-xs text-gray-400 font-medium mt-0.5">
                  {[r.ref, `Reported ${fmt(r.createdAt)}`, r.room].filter(Boolean).join(' · ')}
                </p>
                {r.description && (
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2 whitespace-pre-line">{r.description}</p>
                )}
              </div>
            </div>
            <Tracker r={r} />
            {PAUSE_NOTE[r.status] && (
              <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                {PAUSE_NOTE[r.status]}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
