"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Clock, Wrench, User, Info, CheckCircle2, Ban, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import api from "@/app/api/api";
import { fmtAccessDate } from "@/app/Shared/AccessNoticesBoard";

const todayKey = () => new Date().toLocaleDateString("en-CA");
const isPast = (n) => new Date(n.accessDate).toISOString().slice(0, 10) < todayKey();

const fmtDateTime = (d) =>
  new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function NoticeCard({ n, onAcknowledge, busy }) {
  const cancelled = n.status === "cancelled";
  const past = isPast(n);
  const reason = n.reasonDetail ? `${n.reason} — ${n.reasonDetail}` : n.reason;

  return (
    <article
      className={`bg-white rounded-2xl border shadow-sm p-5 sm:p-6 ${
        cancelled ? "border-gray-200 opacity-70" : !past && !n.acknowledgedAt ? "border-[#F47C3C]/40" : "border-gray-200"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${cancelled ? "bg-gray-100" : "bg-orange-100"}`}>
            {cancelled ? <Ban className="text-gray-400" size={22} /> : <CalendarCheck className="text-[#F47C3C]" size={22} />}
          </div>
          <div className="min-w-0">
            <p className={`font-bold text-base sm:text-lg text-[#0F253B] ${cancelled ? "line-through" : ""}`}>
              {fmtAccessDate(n.accessDate, { weekday: "long", month: "long" })}
            </p>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 mt-0.5">
              <Clock size={14} /> {n.windowStart} – {n.windowEnd}
            </p>
            <p className="flex items-start gap-1.5 text-sm text-gray-600 mt-2">
              <Wrench size={14} className="mt-0.5 shrink-0" /> {reason}
            </p>
            {n.attendee && (
              <p className="flex items-center gap-1.5 text-sm text-gray-600 mt-1">
                <User size={14} /> {n.attendee}
              </p>
            )}
            {[n.property, n.room].filter(Boolean).length > 0 && (
              <p className="text-xs text-gray-400 mt-1">{[n.property, n.room].filter(Boolean).join(" · ")}</p>
            )}
          </div>
        </div>

        <div className="sm:text-right shrink-0">
          {cancelled ? (
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">Cancelled</span>
          ) : n.acknowledgedAt ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
              <CheckCircle2 size={13} /> Acknowledged
            </span>
          ) : past ? (
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500">Past</span>
          ) : (
            <button
              onClick={() => onAcknowledge(n)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#F47C3C] hover:bg-[#e36f31] text-white text-sm font-bold disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Acknowledge
            </button>
          )}
          <p className="text-[11px] text-gray-400 mt-2">Issued {fmtDateTime(n.sentAt)}</p>
        </div>
      </div>

      {n.instructions && !cancelled && (
        <div className="mt-4 rounded-xl bg-orange-50/60 border border-orange-100 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#F47C3C] mb-1">
            <Info size={12} /> Instructions
          </p>
          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{n.instructions}</p>
        </div>
      )}
      {cancelled && (
        <p className="mt-4 text-sm text-gray-500">
          This visit has been cancelled — nobody will attend.{n.cancelReason ? ` Reason: ${n.cancelReason}` : ""}
        </p>
      )}
    </article>
  );
}

// The tenant's access notices: formal notice from the office that the
// property will be entered. Upcoming ones can be acknowledged; the office sees
// the acknowledgement on its record of the notice.
export default function TenantAccessNoticesPage() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get("/access-notices/my");
        if (active) setNotices(res.data?.data || []);
      } catch (err) {
        if (active) setError(err.response?.data?.message || "Failed to load access notices.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const acknowledge = async (n) => {
    setBusyId(n._id);
    try {
      const res = await api.patch(`/access-notices/my/${n._id}/acknowledge`);
      setNotices((prev) => prev.map((x) => (x._id === n._id ? { ...x, acknowledgedAt: res.data.data.acknowledgedAt } : x)));
      toast.success("Thanks — your property manager has been told you received this notice.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to acknowledge the notice.");
    } finally {
      setBusyId(null);
    }
  };

  // Upcoming first (soonest at the top), then everything past or cancelled.
  const upcoming = notices
    .filter((n) => !isPast(n) && n.status !== "cancelled")
    .sort((a, b) => new Date(a.accessDate) - new Date(b.accessDate) || a.windowStart.localeCompare(b.windowStart));
  const earlier = notices.filter((n) => isPast(n) || n.status === "cancelled");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0F253B]">Access Notices</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">
          Notice from your property manager of when someone needs to enter the property, and why.
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-500">Loading notices…</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">{error}</div>
      ) : notices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
            <CalendarCheck className="text-[#F47C3C]" size={24} />
          </div>
          <p className="text-gray-600 font-medium">No access notices</p>
          <p className="text-sm text-gray-400 mt-1">When access to your home is needed, the notice will appear here.</p>
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Upcoming</h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-400">No upcoming visits.</p>
            ) : (
              upcoming.map((n) => <NoticeCard key={n._id} n={n} onAcknowledge={acknowledge} busy={busyId === n._id} />)
            )}
          </section>
          {earlier.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Past &amp; cancelled</h2>
              {earlier.map((n) => <NoticeCard key={n._id} n={n} onAcknowledge={acknowledge} busy={busyId === n._id} />)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
