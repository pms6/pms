"use client";

import { useMemo, useState } from "react";
import {
  X,
  Mail,
  Phone,
  MessageSquare,
  MessageCircle,
  StickyNote,
  Paperclip,
  FileSpreadsheet,
  Users,
  CalendarDays,
} from "lucide-react";
import { Badge } from "./ui";
import { guardModalClose } from "./modalGuard";
import { FileStrip, filesOf, EmptyRow } from "./registerParts";
import {
  STATUS_TONE,
  fmtDateTime,
  monthLabel,
  inMonth,
  groupByTenant,
  exportTenantConversationXlsx,
} from "@/app/utils/emailRecordsSheet";

/* ------------------------------------------------------------------ *
 * Tenant Conversations — the Email Records log regrouped per tenant: every
 * email, call, text and WhatsApp with them, every reply and every
 * attachment, in one timestamped thread that can be filtered by month.
 *
 * Built from the same records as the log (nothing is stored twice), so a
 * message added anywhere shows up here straight away.
 * ------------------------------------------------------------------ */

export const CHANNEL_ICON = {
  Email: Mail,
  Call: Phone,
  Text: MessageSquare,
  WhatsApp: MessageCircle,
  Note: StickyNote,
};

const MONTH_INPUT =
  "px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]";

// One message in the chat view. Incoming (from the tenant) sits on the left,
// ours on the right, internal notes and status changes in the middle.
function MessageBubble({ ev, onOpenRecord, onOpenFiles }) {
  const h = ev.entry;
  const Icon = CHANNEL_ICON[h.channel] || Mail;
  const files = filesOf(h.files);

  if (h.direction === "Internal") {
    return (
      <div className="flex justify-center">
        <p className="max-w-[85%] text-center text-[11px] font-medium text-gray-400 bg-gray-50 rounded-full px-3 py-1">
          {h.summary} · {fmtDateTime(ev.date)}
          {h.createdByEmail && ` · ${h.createdByEmail}`}
        </p>
      </div>
    );
  }

  const incoming = h.direction === "Incoming";
  return (
    <div className={`flex ${incoming ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 border ${
          incoming ? "bg-white border-gray-100 rounded-bl-md" : "bg-orange-50 border-orange-100 rounded-br-md"
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold text-[#0F253B]">
          <Icon size={12} className="text-[#F47C3C]" />
          <span>{h.channel}</span>
          {ev.original && <span className="text-gray-400">Original</span>}
          {h.isReply && <span className="text-emerald-600">Reply</span>}
          {h.isFollowUp && <span className="text-[#F47C3C]">Follow-up</span>}
          {h.auto && <span className="text-gray-300 font-medium">auto-saved</span>}
        </div>
        {(h.from || h.to) && (
          <p className="text-[11px] text-gray-400 font-medium mt-0.5 break-words">
            {h.from && <>From {h.from}</>}
            {h.from && h.to && " · "}
            {h.to && <>To {h.to}</>}
          </p>
        )}
        <p className="text-sm text-gray-700 font-medium whitespace-pre-line mt-1.5 break-words">{h.summary}</p>
        {files.length > 0 && (
          <div className="mt-2">
            <FileStrip files={files} onOpen={() => onOpenFiles(files, ev)} />
          </div>
        )}
        {h.emailStatus === "Sent" && (
          <p className="text-[10px] font-bold text-emerald-600 mt-1.5">Emailed {fmtDateTime(h.emailSentAt)}</p>
        )}
        {h.emailStatus === "Failed" && (
          <p className="text-[10px] font-bold text-red-600 mt-1.5 break-words">
            Not sent{h.emailError ? ` — ${h.emailError}` : ""} · open the record to resend
          </p>
        )}
        <div className="flex items-center justify-between gap-3 mt-2">
          <button
            onClick={() => onOpenRecord(ev.record)}
            className="text-[10px] font-bold text-[#F47C3C] hover:underline truncate"
            title="Open the record this message belongs to"
          >
            {ev.record.property} · {ev.record.status}
          </button>
          <p className="text-[10px] font-medium text-gray-400 whitespace-nowrap">{fmtDateTime(ev.date)}</p>
        </div>
      </div>
    </div>
  );
}

// The whole conversation with one tenant, grouped by day.
export function TenantThreadModal({ tenant, initialMonth = "", onClose, onOpenRecord, onOpenFiles }) {
  const [month, setMonth] = useState(initialMonth);

  const events = useMemo(() => tenant.events.filter((ev) => inMonth(ev.date, month)), [tenant, month]);

  const days = useMemo(() => {
    const out = [];
    for (const ev of events) {
      const label = new Date(ev.date).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      if (!out.length || out[out.length - 1].label !== label) out.push({ label, events: [] });
      out[out.length - 1].events.push(ev);
    }
    return out;
  }, [events]);

  const attachmentCount = events.reduce((n, ev) => n + filesOf(ev.entry.files).length, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={guardModalClose(onClose)}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-[#0F253B] break-words">{tenant.name}</h3>
              <p className="text-xs text-gray-400 font-medium break-words">
                {[tenant.email, tenant.property].filter(Boolean).join(" · ")}
                {!tenant.current && " · past tenant"}
              </p>
              <p className="text-xs text-gray-500 font-bold mt-1">
                {events.length} message{events.length === 1 ? "" : "s"} · {attachmentCount} attachment
                {attachmentCount === 1 ? "" : "s"}
                {month ? ` · ${monthLabel(month)}` : " · all time"}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-500 shrink-0"><X size={20} /></button>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-4">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className={MONTH_INPUT}
              title="Show one month"
            />
            {month && (
              <button onClick={() => setMonth("")} className="text-xs font-bold text-[#F47C3C] hover:underline">
                All months
              </button>
            )}
            <button
              onClick={() => exportTenantConversationXlsx(tenant, events, month)}
              disabled={!events.length}
              className="ml-auto flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-100 hover:bg-gray-50 text-[#0F253B] font-bold text-sm rounded-xl transition-all disabled:opacity-50"
            >
              <FileSpreadsheet size={16} /> Export
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 bg-gray-50/40">
          {days.length === 0 && (
            <p className="text-sm font-medium text-gray-300 text-center py-10">
              No messages with this tenant{month ? ` in ${monthLabel(month)}` : ""}.
            </p>
          )}
          {days.map((day) => (
            <div key={day.label} className="space-y-3">
              <p className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">{day.label}</p>
              {day.events.map((ev) => (
                <MessageBubble
                  key={ev.key}
                  ev={ev}
                  onOpenRecord={onOpenRecord}
                  onOpenFiles={(files) =>
                    onOpenFiles({ title: tenant.name, subtitle: `${ev.entry.channel} · ${fmtDateTime(ev.date)}`, files })
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// The tenant list: who we have been talking to, how much, and when last.
export function TenantConversationsPanel({ rows, tenancies, month, needle, loading, onOpenTenant }) {
  const tenants = useMemo(() => {
    return groupByTenant(rows, tenancies)
      .map((t) => {
        const events = t.events.filter((ev) => inMonth(ev.date, month));
        const last = events[events.length - 1] || null;
        return {
          ...t,
          monthEvents: events,
          last,
          incoming: events.filter((ev) => ev.entry.direction === "Incoming").length,
          attachments: events.reduce((n, ev) => n + filesOf(ev.entry.files).length, 0),
          openRecords: t.records.filter((r) => !["Resolved", "Closed"].includes(r.status)).length,
        };
      })
      .filter((t) => t.monthEvents.length > 0)
      .filter(
        (t) =>
          !needle ||
          [t.name, t.email, t.property, ...t.monthEvents.map((ev) => ev.entry.summary)].some((v) =>
            String(v || "").toLowerCase().includes(needle)
          )
      )
      .sort((a, b) => new Date(b.last?.date || 0) - new Date(a.last?.date || 0));
  }, [rows, tenancies, month, needle]);

  const th = "px-4 py-3 whitespace-nowrap";

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-bold text-[#0F253B] flex items-center gap-2">
          <Users size={15} className="text-[#F47C3C]" /> Tenant Conversations
        </p>
        <p className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
          <CalendarDays size={13} /> {month ? monthLabel(month) : "All time"} · {tenants.length} tenant
          {tenants.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
              <th className={th}>Tenant</th>
              <th className={th}>Property</th>
              <th className={th}>Messages</th>
              <th className={th}>From tenant</th>
              <th className={th}>Attachments</th>
              <th className={th}>Open issues</th>
              <th className={th}>Last message</th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <EmptyRow
                colSpan={7}
                loading={loading}
                anyRows={rows.length > 0}
                emptyText="No tenant conversations yet — link a record to a tenant, or log one from a tenant's email address"
              />
            ) : (
              tenants.map((t) => (
                <tr
                  key={t.key}
                  onClick={() => onOpenTenant(t)}
                  className="border-b border-gray-50 hover:bg-gray-50/50 align-top cursor-pointer"
                >
                  <td className="px-4 py-3 min-w-[10rem]">
                    <p className="font-semibold text-[#0F253B]">{t.name}</p>
                    <p className="text-[11px] text-gray-400 font-medium">{t.email || "—"}</p>
                    {!t.current && <Badge tone="gray">Past tenant</Badge>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-medium">{t.property || "—"}</td>
                  <td className="px-4 py-3 font-bold text-[#0F253B]">{t.monthEvents.length}</td>
                  <td className="px-4 py-3 text-gray-500 font-medium">{t.incoming}</td>
                  <td className="px-4 py-3 text-gray-500 font-medium">
                    <span className="inline-flex items-center gap-1"><Paperclip size={12} /> {t.attachments}</span>
                  </td>
                  <td className="px-4 py-3">
                    {t.openRecords ? <Badge tone="amber">{t.openRecords} open</Badge> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-medium max-w-[20rem]">
                    <p className="text-[11px] text-gray-400 whitespace-nowrap">{fmtDateTime(t.last?.date)}</p>
                    <p className="line-clamp-2">{t.last?.entry.summary}</p>
                    {t.last && <Badge tone={STATUS_TONE[t.last.record.status]}>{t.last.record.status}</Badge>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
