"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";

// Common reasons, offered as one-tap fills for the remark box.
const PRESETS = [
  "Budget too high",
  "Chose another property",
  "No longer looking",
  "Unresponsive",
  "Failed checks",
  "Timing didn't work",
  "Room no longer available",
];

/**
 * Asks why a lead is being lost. The backend rejects a "lost" status with no
 * reason, so every board routes through this before moving the card.
 */
export default function LostReasonModal({ lead, onCancel, onConfirm }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const trimmed = reason.trim();

  const submit = async (e) => {
    e.preventDefault();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onConfirm(trimmed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-xl font-bold text-[#0F253B]">Why was this lead lost?</h3>
          <button onClick={onCancel} className="text-gray-300 hover:text-gray-500 shrink-0">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gray-400 font-medium mb-5">
          {lead?.name} — this is kept on the lead so you can see later why it didn&apos;t convert.
        </p>

        <form onSubmit={submit}>
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setReason(p)}
                className={`text-[11px] font-bold rounded-full px-3 py-1.5 border transition-all ${
                  trimmed === p
                    ? "bg-[#0F253B] text-white border-[#0F253B]"
                    : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <textarea
            autoFocus
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Add a remark…"
            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium resize-none"
          />

          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-[#0F253B] font-bold hover:bg-gray-50 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!trimmed || saving}
              className="flex-1 py-3 rounded-xl bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              Mark as Lost
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
