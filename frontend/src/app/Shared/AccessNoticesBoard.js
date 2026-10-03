"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  X,
  Search,
  ClipboardList,
  CalendarClock,
  Clock,
  MailCheck,
  MailWarning,
  CheckCircle2,
  Eye,
  EyeOff,
  Ban,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import api from "@/app/api/api";
import { PageHeader, Badge } from "./ui";
import { guardModalClose } from "./modalGuard";
import { FIELD, LABEL, ErrorBanner, ViewRow } from "./registerParts";

/* ------------------------------------------------------------------ *
 * Access Notices — formal notice to tenants that the property will be
 * entered: the date, the time window, the reason and any instructions,
 * with a record of every notice sent (who sent it, when, whether the email
 * went out, and whether the tenant acknowledged it).
 *
 * Backed by /access-notices (backend/controllers/accessNotice.controller.js).
 * The tenant's side is app/tenant/access-notices/page.js.
 * ------------------------------------------------------------------ */

// MUST stay in sync with ACCESS_REASONS in backend/models/AccessNotice.js.
export const ACCESS_REASONS = [
  "Repairs / Maintenance",
  "Inspection",
  "Gas Safety Check",
  "Electrical Safety Check",
  "Fire Safety Check",
  "Viewing",
  "Cleaning",
  "Pest Control",
  "Meter Reading",
  "Other",
];

// Under a standard UK tenancy a landlord must give at least 24 hours' written
// notice before entering for repairs or inspections, outside emergencies.
const MIN_NOTICE_HOURS = 24;

const unitOf = (t) => (t?.unit && t.unit !== "—" ? t.unit : "");

// accessDate is stored at UTC midnight, so it is read back in UTC.
export const fmtAccessDate = (d, opts = {}) =>
  new Date(d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
    ...opts,
  });

const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const todayInput = () => new Date().toLocaleDateString("en-CA");

// "Today" in the same terms as accessDate (a UTC-midnight date).
const isPast = (n) => new Date(n.accessDate).toISOString().slice(0, 10) < todayInput();

// How the tenant side of a notice reads, for the table and the detail.
export const tenantState = (n) => {
  if (n.status === "cancelled") return { tone: "gray", label: "Cancelled", icon: Ban };
  if (n.acknowledgedAt) return { tone: "green", label: "Acknowledged", icon: CheckCircle2 };
  if (n.viewedAt) return { tone: "blue", label: "Viewed", icon: Eye };
  return { tone: "amber", label: "Not viewed yet", icon: EyeOff };
};

const emailState = (n) =>
  n.emailStatus === "sent"
    ? { tone: "green", label: "Emailed", icon: MailCheck }
    : n.emailStatus === "failed"
      ? { tone: "red", label: "Email failed", icon: MailWarning }
      : { tone: "gray", label: "Portal only", icon: MailWarning };

const noticeLabel = (hours) => {
  if (hours === null || hours === undefined) return "";
  if (hours < 0) return "after the window began";
  if (hours < 48) return `${Math.round(hours)}h notice`;
  return `${Math.round(hours / 24)} days' notice`;
};

/* ------------------------------------------------------------------ *
 * New notice
 * ------------------------------------------------------------------ */
function NewNoticeModal({ tenancies, onClose, onSent }) {
  // Tenancies grouped by property, so a whole-house visit is one tick.
  const byProperty = useMemo(() => {
    const map = new Map();
    for (const t of tenancies) {
      const key = String(t.property || "—").split(" — ")[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tenancies]);

  const [property, setProperty] = useState("");
  const [selected, setSelected] = useState([]);
  const [form, setForm] = useState({
    accessDate: "",
    windowStart: "10:00",
    windowEnd: "12:00",
    reason: "Repairs / Maintenance",
    reasonDetail: "",
    attendee: "",
    instructions: "",
  });
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const occupants = byProperty.find(([p]) => p === property)?.[1] || [];

  const pickProperty = (p) => {
    setProperty(p);
    // Every occupier ticked by default — most access is to the whole house.
    setSelected((byProperty.find(([name]) => name === p)?.[1] || []).map((t) => t._id));
  };

  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // When the form was opened — "now" for the notice-period warning. Taken
  // once rather than on every render, which keeps the render pure.
  const [openedAt] = useState(() => Date.now());

  // How much notice this gives, from now to the start of the window (browser
  // time — the office and the browser are both in the UK).
  const hoursNotice = useMemo(() => {
    if (!form.accessDate || !form.windowStart) return null;
    const start = new Date(`${form.accessDate}T${form.windowStart}:00`);
    return (start.getTime() - openedAt) / 3600000;
  }, [form.accessDate, form.windowStart, openedAt]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!selected.length) return setError("Choose at least one tenant.");
    if (!form.accessDate) return setError("Choose the date access is needed.");
    if (!form.windowStart || !form.windowEnd) return setError("Enter the time window.");
    if (form.windowEnd <= form.windowStart) return setError("The window must end after it starts.");
    if (form.reason === "Other" && !form.reasonDetail.trim()) return setError("Describe the reason for access.");
    if (hoursNotice !== null && hoursNotice < MIN_NOTICE_HOURS) {
      const ok = confirm(
        `This gives the tenant less than ${MIN_NOTICE_HOURS} hours' notice. Tenants are normally entitled to at least 24 hours' written notice unless it is an emergency.\n\nSend it anyway?`
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      const res = await api.post("/access-notices", { tenancyIds: selected, ...form, sendEmail });
      onSent(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send the access notice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={guardModalClose(onClose)}>
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold text-[#0F253B]">New Access Notice</h3>
            <p className="text-xs text-gray-400 font-medium">Formal notice to tenants that the property will be entered</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>

        <ErrorBanner>{error}</ErrorBanner>

        <form onSubmit={submit} className="space-y-5">
          {/* Who */}
          <div>
            <label className={LABEL}>Property</label>
            <select className={FIELD} value={property} onChange={(e) => pickProperty(e.target.value)}>
              <option value="">— Choose a property —</option>
              {byProperty.map(([p, list]) => (
                <option key={p} value={p}>
                  {p} ({list.length} tenant{list.length === 1 ? "" : "s"})
                </option>
              ))}
            </select>

            {property && (
              <div className="mt-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Send to ({selected.length} of {occupants.length})
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelected(selected.length === occupants.length ? [] : occupants.map((t) => t._id))}
                    className="text-[11px] font-bold text-[#F47C3C] hover:underline"
                  >
                    {selected.length === occupants.length ? "Clear all" : "Select all"}
                  </button>
                </div>
                <div className="space-y-1">
                  {occupants.map((t) => (
                    <label key={t._id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer">
                      <input type="checkbox" checked={selected.includes(t._id)} onChange={() => toggle(t._id)} className="accent-[#F47C3C]" />
                      <span className="text-sm font-semibold text-[#0F253B]">{t.tenant}</span>
                      <span className="text-[11px] text-gray-400 truncate">
                        {[unitOf(t), t.tenantEmail || "no email — portal only"].filter(Boolean).join(" · ")}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* When */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Date of access</label>
              <input type="date" min={todayInput()} className={FIELD} value={form.accessDate} onChange={set("accessDate")} required />
            </div>
            <div>
              <label className={LABEL}>Window from</label>
              <input type="time" className={FIELD} value={form.windowStart} onChange={set("windowStart")} required />
            </div>
            <div>
              <label className={LABEL}>Window to</label>
              <input type="time" className={FIELD} value={form.windowEnd} onChange={set("windowEnd")} required />
            </div>
          </div>
          {hoursNotice !== null && hoursNotice < MIN_NOTICE_HOURS && (
            <p className="-mt-3 flex items-start gap-1.5 text-[11px] font-bold text-amber-700">
              <AlertTriangle size={13} className="mt-px shrink-0" />
              Less than {MIN_NOTICE_HOURS} hours&apos; notice. Tenants are normally entitled to at least 24 hours&apos; written notice except in an emergency.
            </p>
          )}

          {/* Why */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Reason for access</label>
              <select className={FIELD} value={form.reason} onChange={set("reason")}>
                {ACCESS_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Who is attending (optional)</label>
              <input className={FIELD} value={form.attendee} onChange={set("attendee")} placeholder="e.g. ABC Plumbing — John" />
            </div>
          </div>
          <div>
            <label className={LABEL}>Reason details{form.reason === "Other" ? "" : " (optional)"}</label>
            <input
              className={FIELD}
              value={form.reasonDetail}
              onChange={set("reasonDetail")}
              maxLength={1000}
              placeholder="e.g. Repair the leaking kitchen tap reported on 2 Oct"
              required={form.reason === "Other"}
            />
          </div>
          <div>
            <label className={LABEL}>Instructions for the tenant (optional)</label>
            <textarea
              rows={3}
              className={FIELD}
              value={form.instructions}
              onChange={set("instructions")}
              maxLength={4000}
              placeholder={"e.g. Please clear the cupboard under the sink.\nThe contractor will ring 30 minutes before arriving."}
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-[#0F253B] cursor-pointer select-none">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="accent-[#F47C3C]" />
            Email the notice to the tenant{selected.length === 1 ? "" : "s"} as well as posting it in their portal
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {saving ? "Sending…" : `Send Notice${selected.length > 1 ? ` to ${selected.length} Tenants` : ""}`}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Detail — the record of the notice
 * ------------------------------------------------------------------ */
function NoticeDetail({ notice, onClose, onChanged }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const n = notice;
  const t = tenantState(n);
  const em = emailState(n);

  const resend = async () => {
    setBusy("resend");
    setError("");
    try {
      const res = await api.post(`/access-notices/${n._id}/resend`);
      onChanged(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend");
      if (err.response?.data?.data) onChanged(err.response.data.data);
    } finally {
      setBusy("");
    }
  };

  const cancel = async () => {
    setBusy("cancel");
    setError("");
    try {
      const res = await api.patch(`/access-notices/${n._id}/cancel`, { reason: cancelReason });
      onChanged(res.data.data);
      setCancelling(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to cancel");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C]">Access notice</p>
            <h3 className="text-xl font-bold text-[#0F253B] mt-1">
              {fmtAccessDate(n.accessDate, { weekday: "long", month: "long" })}
            </h3>
            <p className="text-sm font-bold text-gray-500">{n.windowStart} – {n.windowEnd}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge tone={n.status === "cancelled" ? "gray" : "green"}>{n.status === "cancelled" ? "Cancelled" : "Sent"}</Badge>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
          </div>
        </div>

        <ErrorBanner>{error}</ErrorBanner>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <ViewRow label="Tenant">{n.tenantName}</ViewRow>
            <ViewRow label="Email">{n.tenantEmail}</ViewRow>
            <ViewRow label="Property">{n.property}</ViewRow>
            <ViewRow label="Room">{n.room}</ViewRow>
            <ViewRow label="Reason">{n.reason}</ViewRow>
            <ViewRow label="Attending">{n.attendee}</ViewRow>
          </div>
          {n.reasonDetail && <ViewRow label="Reason details">{n.reasonDetail}</ViewRow>}
          {n.instructions && (
            <div>
              <p className={LABEL}>Instructions</p>
              <p className="text-sm text-gray-600 font-medium whitespace-pre-line leading-relaxed">{n.instructions}</p>
            </div>
          )}

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C] mb-3">Record of notice</p>
            <div className="grid grid-cols-2 gap-4">
              <ViewRow label="Sent">{fmtDateTime(n.sentAt)}</ViewRow>
              <ViewRow label="Sent by">{n.sentByEmail}</ViewRow>
              <ViewRow label="Notice given">{noticeLabel(n.noticeHours)}</ViewRow>
              <ViewRow label="Email">
                <span className="inline-flex items-center gap-1.5"><em.icon size={13} /> {em.label}{n.emailedTo ? ` · ${n.emailedTo}` : ""}</span>
              </ViewRow>
              <ViewRow label="Tenant">
                <span className="inline-flex items-center gap-1.5"><t.icon size={13} /> {t.label}</span>
              </ViewRow>
              <ViewRow label="Viewed / acknowledged">
                {[n.viewedAt && `Viewed ${fmtDateTime(n.viewedAt)}`, n.acknowledgedAt && `Acknowledged ${fmtDateTime(n.acknowledgedAt)}`]
                  .filter(Boolean)
                  .join(" · ")}
              </ViewRow>
              {n.status === "cancelled" && (
                <>
                  <ViewRow label="Cancelled">{fmtDateTime(n.cancelledAt)}</ViewRow>
                  <ViewRow label="Cancel reason">{n.cancelReason}</ViewRow>
                </>
              )}
            </div>
            {n.emailError && n.emailStatus === "failed" && (
              <p className="mt-3 text-[11px] font-medium text-red-600">Last email error: {n.emailError}</p>
            )}
            {n.emailLog?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Email log</p>
                <ul className="space-y-1">
                  {n.emailLog.map((e, i) => (
                    <li key={i} className="text-[11px] text-gray-500 font-medium">
                      {fmtDateTime(e.at)} · {e.kind} · {e.to || "no address"} ·{" "}
                      <span className={e.ok ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>
                        {e.ok ? "delivered to mail server" : `failed${e.error ? ` (${e.error})` : ""}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {n.status !== "cancelled" && (
            cancelling ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4 space-y-3">
                <p className="text-sm font-bold text-red-700">Cancel this notice?</p>
                <p className="text-xs text-red-700/80">The tenant will be emailed and told in their portal that nobody will attend.</p>
                <input
                  className={FIELD}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason (optional) — e.g. contractor rescheduled"
                />
                <div className="flex gap-2">
                  <button
                    onClick={cancel}
                    disabled={busy === "cancel"}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {busy === "cancel" && <Loader2 size={15} className="animate-spin" />} Cancel notice
                  </button>
                  <button onClick={() => setCancelling(false)} className="px-4 py-2.5 bg-white border border-gray-200 text-sm font-bold rounded-xl">
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={resend}
                  disabled={busy === "resend" || !n.tenantEmail}
                  title={n.tenantEmail ? "Email the notice again" : "No email address on the tenancy"}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#0F253B] hover:bg-[#1b3a58] text-white text-sm font-bold rounded-xl disabled:opacity-40"
                >
                  {busy === "resend" ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Resend email
                </button>
                <button
                  onClick={() => setCancelling(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-sm font-bold rounded-xl"
                >
                  <Ban size={16} /> Cancel notice
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Board
 * ------------------------------------------------------------------ */
export default function AccessNoticesBoard() {
  const [notices, setNotices] = useState([]);
  const [tenancies, setTenancies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  const [q, setQ] = useState("");
  const [when, setWhen] = useState("all");
  const [status, setStatus] = useState("");

  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nRes, tRes] = await Promise.all([api.get("/access-notices"), api.get("/tenancies")]);
      setNotices(nRes.data?.data || []);
      setTenancies(tRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load access notices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      // A notification click lands here with ?open=<noticeId>.
      const id = new URLSearchParams(window.location.search).get("open");
      if (id) setOpenId(id);
    })();
  }, [load]);

  const needle = q.trim().toLowerCase();
  const visible = notices.filter((n) => {
    if (status && n.status !== status) return false;
    if (when === "upcoming" && isPast(n)) return false;
    if (when === "past" && !isPast(n)) return false;
    if (!needle) return true;
    return [n.tenantName, n.tenantEmail, n.property, n.room, n.reason, n.attendee].some((v) =>
      String(v || "").toLowerCase().includes(needle)
    );
  });

  const live = notices.filter((n) => n.status === "sent");
  const cards = [
    { label: "Upcoming visits", value: live.filter((n) => !isPast(n)).length, icon: CalendarClock },
    { label: "Awaiting acknowledgement", value: live.filter((n) => !isPast(n) && !n.acknowledgedAt).length, icon: Clock },
    { label: "Email failed", value: live.filter((n) => n.emailStatus === "failed").length, icon: MailWarning },
    { label: "Notices sent (all time)", value: notices.length, icon: ClipboardList },
  ];

  const opened = notices.find((n) => n._id === openId);

  const replace = (updated) => setNotices((prev) => prev.map((n) => (n._id === updated._id ? updated : n)));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Access Notices"
        subtitle="Formal notice to tenants before the property is entered — with a record of every notice sent"
        action={
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
          >
            <Plus size={18} /> New Access Notice
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
          <button onClick={load} className="ml-3 px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg text-xs font-bold">Retry</button>
        </div>
      )}
      {flash && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 flex items-center justify-between gap-3">
          {flash}
          <button onClick={() => setFlash("")} className="text-emerald-400 hover:text-emerald-600"><X size={16} /></button>
        </div>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold text-[#0F253B]">{loading ? "—" : value}</p>
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mt-1">{label}</p>
            </div>
            <span className="h-9 w-9 rounded-xl bg-orange-50 text-[#F47C3C] flex items-center justify-center"><Icon size={18} /></span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tenant, property, reason…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>
        <select value={when} onChange={(e) => setWhen(e.target.value)} className="px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]">
          <option value="all">All dates</option>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]">
          <option value="">Any status</option>
          <option value="sent">Sent</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-4 py-3">Access date</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Tenant status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <ClipboardList size={28} className="mx-auto text-gray-200" />
                    <p className="mt-2 text-sm font-bold text-gray-400">
                      {notices.length ? "No notices match these filters" : "No access notices sent yet"}
                    </p>
                  </td>
                </tr>
              ) : (
                visible.map((n) => {
                  const t = tenantState(n);
                  const em = emailState(n);
                  return (
                    <tr
                      key={n._id}
                      onClick={() => setOpenId(n._id)}
                      className={`border-b border-gray-50 hover:bg-gray-50/60 cursor-pointer align-top ${n.status === "cancelled" ? "opacity-60" : ""}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className={`font-bold text-[#0F253B] ${n.status === "cancelled" ? "line-through" : ""}`}>{fmtAccessDate(n.accessDate)}</p>
                        <p className="text-xs text-gray-500 font-medium">{n.windowStart} – {n.windowEnd}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#0F253B]">{n.tenantName || "—"}</p>
                        <p className="text-[11px] text-gray-400">{n.tenantEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-medium">
                        {n.property || "—"}
                        {n.room && <p className="text-[11px] text-gray-400">{n.room}</p>}
                      </td>
                      <td className="px-4 py-3 text-[#0F253B] font-medium">
                        {n.reason}
                        {n.reasonDetail && <p className="text-[11px] text-gray-400 line-clamp-1 max-w-xs">{n.reasonDetail}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-medium whitespace-nowrap">
                        {fmtDateTime(n.sentAt)}
                        {n.noticeHours !== null && n.noticeHours !== undefined && (
                          <p className={n.noticeHours < MIN_NOTICE_HOURS ? "text-amber-600 font-bold" : "text-gray-400"}>
                            {noticeLabel(n.noticeHours)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3"><Badge tone={em.tone}>{em.label}</Badge></td>
                      <td className="px-4 py-3"><Badge tone={t.tone}>{t.label}</Badge></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {creating && (
        <NewNoticeModal
          tenancies={tenancies}
          onClose={() => setCreating(false)}
          onSent={(res) => {
            setCreating(false);
            setFlash(res.message || "Access notice sent.");
            setNotices((prev) => [...(res.data || []), ...prev]);
          }}
        />
      )}

      {opened && (
        <NoticeDetail key={opened._id + opened.updatedAt} notice={opened} onClose={() => setOpenId(null)} onChanged={replace} />
      )}
    </div>
  );
}
