"use client";

import { useState } from "react";
import { X, Loader2, CalendarClock, ArrowRight } from "lucide-react";

const PRESETS = [
  "Tenant requested",
  "Agent unavailable",
  "Property access issue",
  "Weather",
  "No-show",
];

function pretty(date, time) {
  if (!date) return "—";
  const d = new Date(`${date}T00:00:00`);
  const day = Number.isNaN(d.valueOf())
    ? date
    : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return time ? `${day}, ${time}` : day;
}

/**
 * Moves a scheduled viewing to a new slot. The backend keeps the trail, so the
 * old slot is shown here to make the change explicit before it is saved.
 */
export default function RescheduleModal({ viewing, onClose, onConfirm }) {
  const [date, setDate] = useState(viewing?.date || "");
  const [time, setTime] = useState(viewing?.time || "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const unchanged = date === viewing?.date && time === viewing?.time;
  const history = viewing?.rescheduleHistory || [];

  const submit = async (e) => {
    e.preventDefault();
    if (!date || !time || unchanged) return;
    setSaving(true);
    setError("");
    try {
      await onConfirm({ date, time, reason: reason.trim() });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reschedule this viewing.");
    } finally {
      setSaving(false);
    }
  };

  const field =
    "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium";
  const labelCls =
    "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-[#0F253B]">Reschedule Viewing</h3>
            <p className="text-sm text-gray-400 font-medium truncate">
              {viewing?.lead?.name || "Viewing"} — {viewing?.property?.name || ""}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-5 p-3 bg-gray-50 rounded-xl text-sm font-bold text-[#0F253B]">
          <CalendarClock size={16} className="text-[#F47C3C] shrink-0" />
          <span>{pretty(viewing?.date, viewing?.time)}</span>
          <ArrowRight size={14} className="text-gray-300 shrink-0" />
          <span className={unchanged ? "text-gray-300" : "text-[#F47C3C]"}>
            {unchanged ? "pick a new slot" : pretty(date, time)}
          </span>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>New date</label>
              <input
                type="date"
                className={field}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelCls}>New time</label>
              <input
                type="time"
                className={field}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Reason (optional)</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setReason(p)}
                  className={`text-[11px] font-bold rounded-full px-3 py-1.5 border transition-all ${
                    reason.trim() === p
                      ? "bg-[#0F253B] text-white border-[#0F253B]"
                      : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <input
              className={field}
              placeholder="Why is it moving?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {history.length > 0 && (
            <div className="pt-1">
              <p className={labelCls}>Previously moved {history.length}×</p>
              <ul className="space-y-1.5">
                {history.map((h, i) => (
                  <li key={i} className="text-xs text-gray-500 font-medium">
                    <span className="text-gray-400">{pretty(h.fromDate, h.fromTime)}</span>
                    {" → "}
                    <span className="text-[#0F253B] font-bold">{pretty(h.toDate, h.toTime)}</span>
                    {h.reason && <span className="text-gray-400"> — {h.reason}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="submit"
            disabled={saving || unchanged}
            className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {unchanged ? "Pick a new slot" : "Confirm Reschedule"}
          </button>
        </form>
      </div>
    </div>
  );
}
