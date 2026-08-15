"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  CalendarClock,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Home,
  Building2,
  Loader2,
  Ban,
  Phone,
  CalendarDays,
} from "lucide-react";
import api from "@/app/api/api";

// Map the backend status enum to tenant-facing presentation.
const STATUS = {
  scheduled: { label: "Scheduled", pill: "bg-amber-100 text-amber-700", Icon: CalendarClock },
  done: { label: "Completed", pill: "bg-green-100 text-green-700", Icon: CheckCircle2 },
  cancelled: { label: "Cancelled", pill: "bg-red-100 text-red-700", Icon: XCircle },
};

const TABS = [
  { key: "scheduled", label: "Scheduled" },
  { key: "done", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

// "2026-07-12" + "14:00" → "Sun 12 Jul 2026 · 14:00"
const formatWhen = (date, time) => {
  if (!date) return "—";
  const d = new Date(`${date}T${time || "00:00"}`);
  if (Number.isNaN(d.getTime())) return `${date}${time ? ` · ${time}` : ""}`;
  const nice = d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return time ? `${nice} · ${time}` : nice;
};

const roomName = (r) =>
  r ? r.roomName || r.title || (r.roomNumber ? `Room ${r.roomNumber}` : "") : "";

export default function TenantViewingsPage() {
  const [viewings, setViewings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("scheduled");
  const [cancellingId, setCancellingId] = useState(null);
  const [requesting, setRequesting] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get("/viewings/my");
        if (active) setViewings(res.data?.data || []);
      } catch (err) {
        if (active) setError(err.response?.data?.message || "Failed to load your viewings.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(() => {
    const c = { scheduled: 0, done: 0, cancelled: 0 };
    for (const v of viewings) if (c[v.status] != null) c[v.status] += 1;
    return c;
  }, [viewings]);

  const rows = viewings.filter((v) => v.status === activeTab);

  const cancel = async (id) => {
    if (!confirm("Cancel this viewing? This can't be undone.")) return;
    setCancellingId(id);
    try {
      const res = await api.patch(`/viewings/my/${id}/cancel`);
      const updated = res.data?.data;
      setViewings((xs) => xs.map((v) => (v._id === id ? { ...v, ...updated } : v)));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to cancel viewing.");
    } finally {
      setCancellingId(null);
    }
  };

  // The tenant proposes; an operator approves or declines. Errors are thrown so
  // the dialog can show them and keep the entered slot.
  const requestReschedule = async (id, payload) => {
    const res = await api.patch(`/viewings/my/${id}/reschedule-request`, payload);
    const updated = res.data?.data;
    setViewings((xs) => xs.map((v) => (v._id === id ? { ...v, ...updated } : v)));
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-5xl px-4">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900">
              <Search className="h-7 w-7 text-orange-500" /> My Viewings
            </h1>
            <p className="mt-2 text-slate-500">Track the property viewings you've booked.</p>
          </div>
          <Link
            href="/#properties"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F47C3C] px-5 py-3 font-bold text-white transition hover:brightness-105"
          >
            <Home className="h-4 w-4" /> Browse rooms
          </Link>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {/* Status tabs */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          {TABS.map((t) => {
            const isActive = activeTab === t.key;
            const { Icon } = STATUS[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition ${
                  isActive
                    ? "border-[#F47C3C] bg-white ring-2 ring-[#F47C3C]/20"
                    : "border-slate-100 bg-white hover:shadow-sm"
                }`}
              >
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  <Icon className="h-3.5 w-3.5" /> {t.label}
                </span>
                <span className="text-2xl font-bold text-slate-900">{counts[t.key]}</span>
              </button>
            );
          })}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center rounded-3xl border border-slate-100 bg-white py-24">
            <Loader2 className="h-7 w-7 animate-spin text-[#F47C3C]" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-orange-500">
              <CalendarDays className="h-7 w-7" />
            </div>
            <p className="font-semibold text-slate-600">No {STATUS[activeTab].label.toLowerCase()} viewings</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
              {activeTab === "scheduled"
                ? "When an operator books a viewing for you, it'll show up here."
                : "Nothing to see in this tab yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((v) => {
              const st = STATUS[v.status] || STATUS.scheduled;
              const rn = roomName(v.room);
              return (
                <div
                  key={v._id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-bold text-slate-900">
                        {v.property?.name || "Property"}
                        {rn && <span className="font-medium text-slate-500"> · {rn}</span>}
                      </h3>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${st.pill}`}>
                        <st.Icon className="h-3 w-3" /> {st.label}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-slate-400" /> {formatWhen(v.date, v.time)}
                      </span>
                      {v.organizationId?.name && (
                        <span className="flex items-center gap-1.5">
                          <Building2 className="h-4 w-4 text-slate-400" /> {v.organizationId.name}
                        </span>
                      )}
                      {v.organizationId?.phone && (
                        <a href={`tel:${v.organizationId.phone}`} className="flex items-center gap-1.5 hover:text-slate-700">
                          <Phone className="h-4 w-4 text-slate-400" /> {v.organizationId.phone}
                        </a>
                      )}
                    </div>
                    {v.notes && <p className="mt-2 text-sm text-slate-500">{v.notes}</p>}
                    <RequestState request={v.rescheduleRequest} />
                  </div>

                  {v.status === "scheduled" && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => setRequesting(v)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 transition hover:bg-amber-100"
                      >
                        <CalendarDays className="h-4 w-4" />
                        {v.rescheduleRequest?.status === "pending" ? "Change request" : "Reschedule"}
                      </button>
                      <button
                        onClick={() => cancel(v._id)}
                        disabled={cancellingId === v._id}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        {cancellingId === v._id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Ban className="h-4 w-4" />
                        )}
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {requesting && (
        <RescheduleRequestModal
          viewing={requesting}
          onClose={() => setRequesting(null)}
          onConfirm={async (payload) => {
            await requestReschedule(requesting._id, payload);
            setRequesting(null);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reschedule request                                                  */
/* ------------------------------------------------------------------ */

// Shown on the card once a request exists, so the tenant knows where it stands.
function RequestState({ request }) {
  if (!request?.status) return null;

  const when = formatWhen(request.requestedDate, request.requestedTime);

  if (request.status === "pending") {
    return (
      <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
        <span className="font-bold">Reschedule requested</span> — you asked for {when}. Waiting for
        the operator to confirm.
      </p>
    );
  }

  if (request.status === "declined") {
    return (
      <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
        <span className="font-bold">Reschedule declined</span> — your request for {when} wasn&apos;t
        accepted.{request.responseNote ? ` ${request.responseNote}` : ""} Your original slot stands.
      </p>
    );
  }

  return (
    <p className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
      <span className="font-bold">Reschedule approved</span> — moved to {when}.
      {request.responseNote ? ` ${request.responseNote}` : ""}
    </p>
  );
}

function RescheduleRequestModal({ viewing, onClose, onConfirm }) {
  const [date, setDate] = useState(viewing?.rescheduleRequest?.requestedDate || viewing?.date || "");
  const [time, setTime] = useState(viewing?.rescheduleRequest?.requestedTime || viewing?.time || "");
  const [reason, setReason] = useState(viewing?.rescheduleRequest?.reason || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const unchanged = date === viewing?.date && time === viewing?.time;

  const submit = async (e) => {
    e.preventDefault();
    if (!date || !time || unchanged) return;
    setSaving(true);
    setError("");
    try {
      await onConfirm({ date, time, reason: reason.trim() });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send your request.");
    } finally {
      setSaving(false);
    }
  };

  const field =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:bg-white focus:ring-2 focus:ring-amber-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-slate-900">Request a new time</h3>
        <p className="mt-1 text-sm text-slate-500">
          {viewing?.property?.name} — currently {formatWhen(viewing?.date, viewing?.time)}. The
          operator has to confirm before your viewing moves.
        </p>

        {error && (
          <div className="mt-4 rounded border-l-4 border-red-500 bg-red-50 p-3 text-xs font-bold text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Preferred date
              </label>
              <input
                type="date"
                className={field}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Preferred time
              </label>
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
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Reason (optional)
            </label>
            <textarea
              rows={3}
              className={`${field} resize-none`}
              placeholder="Let them know why…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || unchanged}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-bold text-white transition hover:bg-amber-600 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {unchanged ? "Pick a new slot" : "Send Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
