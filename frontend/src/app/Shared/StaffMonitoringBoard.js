"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Monitor,
  Loader2,
  Search,
  Eye,
  Trash2,
  X,
  Settings2,
  ShieldAlert,
  Clock,
  Users,
  Camera,
  RefreshCw,
} from "lucide-react";
import { PageHeader, Badge } from "./ui";
import OnlineStaffPanel from "./OnlineStaffPanel";
import api from "@/app/api/api";
import { guardModalClose } from "@/app/Shared/modalGuard";

/* ---------------------------------------------------------------------------
 * Staff monitoring — the admin's review surface.
 *
 * Owner and admin only. A MANAGER can run most of the team screens but not this
 * one: watching a colleague's screen is a different power from managing their
 * seat, and the API refuses them too, so the page is not the only guard.
 * ------------------------------------------------------------------------- */

const DAYS = [
  [1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [7, "Sun"],
];

const END_REASON = {
  STOPPED: "Ended by staff member",
  SHARE_REVOKED: "Screen sharing stopped",
  OUT_OF_HOURS: "Working hours ended",
  EXPIRED: "Expired",
  "": "—",
};

const fmtDateTime = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const day = date.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London",
  });
  const time = date
    .toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Europe/London" })
    .toLowerCase();
  return `${day}, ${time}`;
};

const fmtTime = (d) =>
  d
    ? new Date(d)
        .toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Europe/London" })
        .toLowerCase()
    : "—";

const duration = (from, to) => {
  if (!from) return "—";
  const ms = (to ? new Date(to) : new Date()) - new Date(from);
  if (ms < 0) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

const FIELD =
  "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

/* ------------------------------------------------------------------ *
 * Policy editor
 * ------------------------------------------------------------------ */
function PolicyModal({ policy, onClose, onSave }) {
  const [form, setForm] = useState({
    enabled: policy.enabled,
    workStart: policy.workStart,
    workEnd: policy.workEnd,
    workDays: policy.workDays || [1, 2, 3, 4, 5],
    minIntervalMinutes: policy.minIntervalMinutes,
    maxIntervalMinutes: policy.maxIntervalMinutes,
    retentionDays: policy.retentionDays,
    noticeText: policy.noticeText,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggleDay = (d) =>
    setForm((f) => ({
      ...f,
      workDays: f.workDays.includes(d)
        ? f.workDays.filter((x) => x !== d)
        : [...f.workDays, d].sort(),
    }));

  const submit = async (e) => {
    e.preventDefault();
    if (Number(form.maxIntervalMinutes) < Number(form.minIntervalMinutes)) {
      return setError("The maximum interval cannot be shorter than the minimum.");
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        ...form,
        minIntervalMinutes: Number(form.minIntervalMinutes),
        maxIntervalMinutes: Number(form.maxIntervalMinutes),
        retentionDays: Number(form.retentionDays),
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save the policy.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={guardModalClose(onClose)}>
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold text-[#0F253B]">Monitoring policy</h3>
            <p className="text-xs text-gray-400 font-medium">
              The rules the server enforces — not suggestions the browser can ignore
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <label className="flex items-start gap-3 p-4 rounded-2xl border border-gray-100 bg-gray-50/60 cursor-pointer">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              className="mt-0.5 w-4 h-4 accent-[#F47C3C]"
            />
            <span>
              <span className="block text-sm font-bold text-[#0F253B]">Screen monitoring enabled</span>
              <span className="block text-xs text-gray-500 font-medium">
                Off means nobody can start a monitored shift. Existing screenshots are kept.
              </span>
            </span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Working hours start (UK)</label>
              <input type="time" className={FIELD} value={form.workStart} onChange={set("workStart")} required />
            </div>
            <div>
              <label className={LABEL}>Working hours end (UK)</label>
              <input type="time" className={FIELD} value={form.workEnd} onChange={set("workEnd")} required />
            </div>
          </div>

          {/* An end earlier than the start is a shift running past midnight, not
              a mistake — say which days it covers, since the early-hours part
              belongs to the previous day's shift. */}
          {form.workEnd < form.workStart && (
            <p className="-mt-2 text-[11px] font-medium text-[#F47C3C]">
              Overnight shift: {form.workStart} through to {form.workEnd} the next day. The hours
              after midnight count as part of the previous working day, so a Friday shift covers
              Saturday morning but a Saturday morning on its own is not monitored.
            </p>
          )}

          <div>
            <label className={LABEL}>Working days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(([d, label]) => {
                const on = form.workDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                      on
                        ? "bg-[#0F253B] text-white border-[#0F253B]"
                        : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Min interval (min)</label>
              <input type="number" min="1" max="240" className={FIELD} value={form.minIntervalMinutes} onChange={set("minIntervalMinutes")} />
            </div>
            <div>
              <label className={LABEL}>Max interval (min)</label>
              <input type="number" min="1" max="480" className={FIELD} value={form.maxIntervalMinutes} onChange={set("maxIntervalMinutes")} />
            </div>
            <div>
              <label className={LABEL}>Keep for (days)</label>
              <input type="number" min="1" max="365" className={FIELD} value={form.retentionDays} onChange={set("retentionDays")} />
            </div>
          </div>
          <p className="-mt-2 text-[11px] text-gray-400 font-medium">
            Each screenshot lands at a random point in that range, chosen by the server. Shorter
            retention is easier to justify than longer.
          </p>

          <div>
            <label className={LABEL}>Notice shown to staff</label>
            <textarea rows={4} className={FIELD} value={form.noticeText} onChange={set("noticeText")} />
            <p className="mt-1.5 text-[11px] text-gray-400 font-medium">
              Copied onto each session as the member accepts it, so a later edit cannot rewrite what
              they were told.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] disabled:opacity-50 text-white font-bold rounded-xl transition-all active:scale-[0.98]"
          >
            {saving ? "Saving…" : "Save policy"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * One session's screenshots
 * ------------------------------------------------------------------ */
function SessionModal({ sessionId, onClose }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(null);

  useEffect(() => {
    let active = true;
    api
      .get(`/screen-monitor/sessions/${sessionId}`)
      .then((res) => { if (active) setSession(res.data.data); })
      .catch((err) => { if (active) setError(err.response?.data?.message || "Failed to load the session."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sessionId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5 gap-4">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-[#0F253B] truncate">
              {session?.email || "Session"}
            </h3>
            <p className="text-xs text-gray-400 font-medium">
              {session ? `${fmtDateTime(session.startedAt)} · ${duration(session.startedAt, session.endedAt)}` : "Loading…"}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>

        {loading ? (
          <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin inline text-[#F47C3C]" /></div>
        ) : error ? (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              {[
                ["Status", session.status === "ACTIVE" ? "Running" : END_REASON[session.endedReason] || "Ended"],
                ["Screenshots", String(session.captures?.length || 0)],
                ["Notice accepted", fmtDateTime(session.acknowledgedAt)],
                ["Opened by admins", String(session.viewedBy?.length || 0)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className={LABEL}>{label}</p>
                  <p className="text-sm font-semibold text-[#0F253B] break-words">{value}</p>
                </div>
              ))}
            </div>

            {session.noticeTextSeen && (
              <div className="mb-5 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                <p className={LABEL}>Notice this member accepted</p>
                <p className="text-xs text-gray-500 font-medium whitespace-pre-line leading-relaxed">
                  {session.noticeTextSeen}
                </p>
              </div>
            )}

            {session.captures?.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400 font-medium">
                No screenshots in this session.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {session.captures.map((c) => (
                  <button
                    key={c._id || c.url}
                    onClick={() => setZoom(c)}
                    className="text-left group"
                  >
                    <img
                      src={c.url}
                      alt={`Screenshot at ${fmtTime(c.capturedAt)}`}
                      className="w-full rounded-xl border border-gray-100 group-hover:border-[#F47C3C] transition-all"
                    />
                    <p className="mt-1 text-[11px] font-bold text-gray-400">
                      {fmtTime(c.capturedAt)}
                      {c.width ? ` · ${c.width}×${c.height}` : ""}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {session.viewedBy?.length > 0 && (
              <div className="mt-6 rounded-2xl border border-gray-100 p-4">
                <p className={LABEL}>Who has opened these screenshots</p>
                <ul className="space-y-1">
                  {session.viewedBy.map((v, i) => (
                    <li key={i} className="text-xs font-medium text-gray-500">
                      {v.email || "Unknown"} · {fmtDateTime(v.viewedAt)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={(e) => { e.stopPropagation(); setZoom(null); }}
        >
          <img src={zoom.url} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Board
 * ------------------------------------------------------------------ */
// How stale the board is allowed to get while somebody is looking at it.
// Sessions start, screenshots land and a session goes quiet without anything on
// this page knowing, so it refetches rather than showing whatever was true when
// it was opened.
const REFRESH_MS = 5 * 60 * 1000;

// The interval only decides when to CHECK; REFRESH_MS decides whether a refetch
// is actually due. Checking more often than the refresh is what keeps the gap
// at five minutes rather than up to ten when a manual reload lands just before
// a tick.
const TICK_MS = 60 * 1000;

export default function StaffMonitoringBoard({
  subtitle = "Consented, working-hours screen checks of the team — owner and admin only",
}) {
  const [sessions, setSessions] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [openSession, setOpenSession] = useState(null);
  const [showPolicy, setShowPolicy] = useState(false);
  const [purging, setPurging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedAt, setLoadedAt] = useState(null);

  // When the data last arrived. A ref as well as state because the interval
  // reads it to decide whether a refetch is due, and a ref does not make the
  // effect re-run every time it changes.
  const loadedAtRef = useRef(0);

  /**
   * A quiet load refetches in place: no spinner, no blanking the table out to
   * "—" under someone who is reading it. The first load and an explicit retry
   * are not quiet; the automatic refresh always is.
   */
  const load = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else {
      setLoading(true);
      setError("");
    }
    try {
      const [sRes, pRes] = await Promise.all([
        api.get("/screen-monitor/sessions"),
        api.get("/screen-monitor/policy"),
      ]);
      setSessions(sRes.data.data || []);
      setPolicy(pRes.data.data || null);
      setError("");
      loadedAtRef.current = Date.now();
      setLoadedAt(new Date());
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load staff monitoring.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh while the section is open.
  //
  // Two things it deliberately does not do: poll a hidden tab — a board left
  // open on a second monitor overnight would otherwise call the API all night —
  // and refetch underneath the open policy editor, which is pointless work
  // while somebody is part-way through changing the settings.
  useEffect(() => {
    if (showPolicy) return undefined;

    const refreshIfDue = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - loadedAtRef.current < REFRESH_MS) return;
      load({ quiet: true });
    };

    const timer = setInterval(refreshIfDue, TICK_MS);
    // Coming back to a tab that has been away: catch up on the way in rather
    // than making them wait out the rest of the interval.
    document.addEventListener("visibilitychange", refreshIfDue);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfDue);
    };
  }, [load, showPolicy]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sessions
      .filter((s) => (statusFilter ? s.status === statusFilter : true))
      .filter((s) => (needle ? String(s.email || "").toLowerCase().includes(needle) : true));
  }, [sessions, q, statusFilter]);

  const savePolicy = async (payload) => {
    await api.put("/screen-monitor/policy", payload);
    setShowPolicy(false);
    await load();
  };

  const remove = async (s) => {
    if (!confirm(`Delete this session and its ${s.captureCount} screenshot(s) for ${s.email}?`)) return;
    try {
      await api.delete(`/screen-monitor/sessions/${s._id}`);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const purge = async () => {
    setPurging(true);
    try {
      const res = await api.post("/screen-monitor/purge");
      alert(res.data.message);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Purge failed");
    } finally {
      setPurging(false);
    }
  };

  const activeCount = sessions.filter((s) => s.status === "ACTIVE" && !s.stale).length;
  const pausedCount = sessions.filter((s) => s.status === "ACTIVE" && s.stale).length;
  const shots = sessions.reduce((n, s) => n + (s.captureCount || 0), 0);
  const people = new Set(sessions.map((s) => String(s.userId))).size;

  const cards = [
    { label: "Sessions", value: sessions.length, icon: Monitor },
    { label: pausedCount ? `Running (${pausedCount} paused)` : "Running now", value: activeCount, icon: Clock },
    { label: "Screenshots", value: shots, icon: Camera },
    { label: "Staff monitored", value: people, icon: Users },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Staff Monitoring"
        subtitle={subtitle}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={purge}
              disabled={purging}
              title="Delete screenshots past the retention period"
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 disabled:opacity-50 border border-gray-100 text-[#0F253B] font-bold text-sm rounded-xl transition-all"
            >
              {purging ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
              Purge expired
            </button>
            <button
              onClick={() => setShowPolicy(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              <Settings2 size={18} /> Policy
            </button>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
          <button onClick={() => load()} className="ml-3 px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg text-xs font-bold">Retry</button>
        </div>
      )}

      <OnlineStaffPanel />

      {/* Says plainly what this can and cannot do, so nobody plans around a
          capability the browser does not give. */}
      <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 flex items-start gap-3">
        <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs font-medium text-amber-900 leading-relaxed">
          <p className="font-bold">Screenshots are not covert, and cannot be.</p>
          <p className="mt-1">
            A browser will not capture a screen without the person starting it and choosing what to
            share, and it shows a sharing indicator throughout. Staff start their own monitored
            shift; screenshots are then random until they stop. Under UK rules workers must be told
            they are monitored and the monitoring must be proportionate — the notice, the
            working-hours window and the retention period below are what evidence that.
          </p>
          {policy && !policy.enabled && (
            <p className="mt-2 font-bold">
              Monitoring is currently switched OFF — no one can start a shift.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {cards.map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4">
            <s.icon size={18} className="text-[#F47C3C]" />
            <p className="text-2xl font-bold text-[#0F253B] mt-2">{loading ? "—" : s.value}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {policy && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-gray-500">
          <span>
            <strong className="text-[#0F253B]">Hours:</strong> {policy.workStart}–{policy.workEnd} UK
            {/* Without this an overnight window reads as though it ran backwards. */}
            {policy.overnight && <span className="text-[#F47C3C]"> (next day)</span>}
          </span>
          <span>
            <strong className="text-[#0F253B]">Days:</strong>{" "}
            {DAYS.filter(([d]) => policy.workDays?.includes(d)).map(([, l]) => l).join(", ") || "none"}
          </span>
          <span><strong className="text-[#0F253B]">Every:</strong> {policy.minIntervalMinutes}–{policy.maxIntervalMinutes} min (random)</span>
          <span><strong className="text-[#0F253B]">Kept:</strong> {policy.retentionDays} days</span>
          <span className={policy.withinWorkingHours ? "text-emerald-600 font-bold" : "text-gray-400"}>
            {policy.withinWorkingHours ? "Inside working hours now" : "Outside working hours now"}
          </span>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search staff member…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>
        <div className="flex gap-2">
          {[["", "All"], ["ACTIVE", "Running"], ["ENDED", "Ended"]].map(([v, l]) => (
            <button
              key={v || "all"}
              onClick={() => setStatusFilter(v)}
              className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all ${
                statusFilter === v
                  ? "bg-[#0F253B] text-white border-[#0F253B]"
                  : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Says when the numbers are from, so nobody reads a five-minute-old
            board as this second's. The refresh itself is announced quietly — it
            is not something anyone asked for and should not draw the eye. */}
        <div className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
          {refreshing ? (
            <>
              <RefreshCw size={12} className="animate-spin" />
              Updating…
            </>
          ) : loadedAt ? (
            <>
              <RefreshCw size={12} className="text-gray-300" />
              Updated {loadedAt.toLocaleTimeString()}
              <button
                onClick={() => load({ quiet: true })}
                className="ml-1 font-bold text-[#F47C3C] hover:underline"
              >
                Refresh
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-4 py-3">Staff member</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3 w-28">Duration</th>
                <th className="px-4 py-3 w-28 text-right">Screenshots</th>
                <th className="px-4 py-3 w-40">Status</th>
                <th className="px-4 py-3 w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin inline text-[#F47C3C]" /></td></tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 rounded-2xl bg-gray-50 text-[#F47C3C] flex items-center justify-center mb-3">
                        <Monitor size={22} />
                      </div>
                      <p className="text-gray-500 font-medium">
                        {sessions.length === 0 ? "No monitored shifts yet" : "No sessions match these filters"}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        {sessions.length === 0
                          ? "Staff start a shift from the button in their portal header."
                          : "Try clearing the search or the status filter."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                visible.map((s) => (
                  <tr key={s._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#0F253B]">{s.email || "—"}</p>
                      <p className="text-[11px] font-medium text-gray-400">{s.role || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{fmtDateTime(s.startedAt)}</td>
                    <td className="px-4 py-3 text-gray-500 font-medium">{duration(s.startedAt, s.endedAt)}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#0F253B]">{s.captureCount}</td>
                    <td className="px-4 py-3">
                      {s.status !== "ACTIVE" ? (
                        <span className="text-xs font-medium text-gray-500">{END_REASON[s.endedReason] || "Ended"}</span>
                      ) : s.stale ? (
                        // Open on the server, but no screenshots arriving. Almost
                        // always a page reload, which drops screen sharing and
                        // cannot be restored without the member clicking resume.
                        <span title="No screenshots arriving — the staff member's page was probably reloaded, which stops screen sharing. They need to press Resume.">
                          <Badge tone="amber">Paused</Badge>
                          <span className="block text-[10px] font-medium text-gray-400 mt-0.5">
                            not capturing
                          </span>
                        </span>
                      ) : (
                        <Badge tone="green">Running</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setOpenSession(s._id)} title="View screenshots" className="p-2 text-gray-400 hover:text-[#0F253B] hover:bg-gray-100 rounded-lg"><Eye size={16} /></button>
                        <button onClick={() => remove(s)} title="Delete session" className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openSession && <SessionModal sessionId={openSession} onClose={() => setOpenSession(null)} />}
      {showPolicy && policy && (
        <PolicyModal policy={policy} onClose={() => setShowPolicy(false)} onSave={savePolicy} />
      )}
    </div>
  );
}
