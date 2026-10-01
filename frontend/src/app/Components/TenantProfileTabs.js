"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  X,
  Loader2,
  History,
  MessageSquare,
  Briefcase,
  Wrench,
  CreditCard,
  Receipt,
  ClipboardList,
  FolderOpen,
  UserRound,
  Mail,
  Phone,
  MessageCircle,
  StickyNote,
  Users,
  MoreHorizontal,
  Home,
  LogIn,
  LogOut,
  FileText,
  Bell,
  Plus,
  Send,
  Paperclip,
  ExternalLink,
  Search,
} from "lucide-react";
import api from "@/app/api/api";
import { Badge } from "@/app/Shared/ui";
import { FIELD, LABEL, ErrorBanner } from "@/app/Shared/registerParts";
import { MediaUploader, MediaViewerModal, AttachmentRow, applyFiles } from "@/app/Shared/MediaAttachments";
import TenantCasesBoard from "@/app/Shared/TenantCasesBoard";
import InvoicesBoard from "@/app/Shared/InvoicesBoard";
import InventoryReportsPanel from "./InventoryReportsPanel";
import { CASE_STATUS_TONE } from "@/app/utils/tenantCases";

/* ------------------------------------------------------------------ *
 * The tabs added to a tenant on the Tenants page. "Overview" is the existing
 * tenant detail, unchanged; everything else reads the records that already
 * exist elsewhere in the PMS (Email Records, Maintenance, Rent, Check-in /
 * Check-out) plus the new Cases, Invoices and Inventory Reports — nothing is
 * copied onto the tenant.
 * ------------------------------------------------------------------ */

export const TABS = [
  { key: "overview", label: "Overview", icon: UserRound },
  { key: "timeline", label: "Timeline", icon: History },
  { key: "communications", label: "Communications", icon: MessageSquare },
  { key: "cases", label: "Cases", icon: Briefcase },
  { key: "maintenance", label: "Maintenance", icon: Wrench },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "invoices", label: "Invoices", icon: Receipt },
  { key: "inventory", label: "Inventory", icon: ClipboardList },
  { key: "documents", label: "Documents", icon: FolderOpen },
];

const CHANNEL_ICON = { Email: Mail, Call: Phone, Text: MessageSquare, WhatsApp: MessageCircle, Note: StickyNote, Meeting: Users, Other: MoreHorizontal };
// "Text" is stored as-is for older records; it is an SMS.
export const CHANNEL_LABEL = { Text: "SMS" };
const CHANNELS = ["Call", "Text", "WhatsApp", "Email", "Meeting", "Note", "Other"];

const EVENT_META = {
  tenancy: { icon: Home, tone: "bg-[#0F253B]", label: "Tenancy" },
  communication: { icon: MessageSquare, tone: "bg-blue-500", label: "Communication" },
  message: { icon: MessageCircle, tone: "bg-blue-400", label: "Message" },
  notice: { icon: Bell, tone: "bg-purple-500", label: "Notice" },
  case: { icon: Briefcase, tone: "bg-[#F47C3C]", label: "Case" },
  case_activity: { icon: Briefcase, tone: "bg-orange-300", label: "Case update" },
  maintenance: { icon: Wrench, tone: "bg-amber-500", label: "Maintenance" },
  payment: { icon: CreditCard, tone: "bg-emerald-500", label: "Rent" },
  invoice: { icon: Receipt, tone: "bg-teal-500", label: "Invoice" },
  invoice_payment: { icon: Receipt, tone: "bg-teal-400", label: "Invoice payment" },
  check_in: { icon: LogIn, tone: "bg-emerald-600", label: "Check-in" },
  check_out: { icon: LogOut, tone: "bg-gray-500", label: "Check-out" },
  inventory: { icon: ClipboardList, tone: "bg-indigo-500", label: "Inventory" },
  document: { icon: FileText, tone: "bg-gray-400", label: "Document" },
};

const TIMELINE_FILTERS = [
  ["", "Everything"],
  ["communication,message,notice", "Communications"],
  ["case,case_activity", "Cases"],
  ["maintenance", "Maintenance"],
  ["payment,invoice,invoice_payment", "Money"],
  ["check_in,check_out,inventory,tenancy", "Tenancy & inventory"],
  ["document", "Documents"],
];

const fmtWhen = (d) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

const toLocalInput = (d = new Date()) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};

/* ------------------------------------------------------------------ *
 * Timeline
 * ------------------------------------------------------------------ */
function Timeline({ data, types, onOpenFiles }) {
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const active = types || filter;
  const events = useMemo(() => {
    const allowed = active ? new Set(active.split(",")) : null;
    const needle = q.trim().toLowerCase();
    return (data?.events || []).filter(
      (e) => (!allowed || allowed.has(e.type)) && (!needle || `${e.title} ${e.summary || ""}`.toLowerCase().includes(needle))
    );
  }, [data, active, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {!types &&
          TIMELINE_FILTERS.map(([k, l]) => (
            <button
              key={l}
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filter === k ? "bg-[#0F253B] text-white" : "bg-white border border-gray-100 text-gray-500"}`}
            >
              {l}
            </button>
          ))}
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search history…" className="pl-8 pr-3 py-1.5 bg-white border border-gray-100 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]" />
        </div>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-gray-400 font-medium bg-gray-50 rounded-2xl p-6 text-center">Nothing recorded here yet.</p>
      ) : (
        <ol className="relative border-l-2 border-gray-100 ml-3 space-y-4">
          {events.map((e, i) => {
            const meta = EVENT_META[e.type] || EVENT_META.document;
            const Icon = meta.icon;
            return (
              <li key={i} className="ml-6">
                <span className={`absolute -left-[13px] w-6 h-6 rounded-full ${meta.tone} text-white flex items-center justify-center`}>
                  <Icon size={12} />
                </span>
                <div className={`bg-white border border-gray-100 rounded-xl p-3 ${e.retracted ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <p className={`text-sm font-bold text-[#0F253B] ${e.retracted ? "line-through" : ""}`}>{e.title}</p>
                    <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap">{fmtWhen(e.date)}</span>
                  </div>
                  {e.summary && <p className={`text-xs text-gray-600 mt-0.5 whitespace-pre-line line-clamp-4 ${e.retracted ? "line-through" : ""}`}>{e.summary}</p>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">{meta.label}</span>
                    {e.status && <Badge tone={CASE_STATUS_TONE[e.status] || "gray"}>{String(e.status).replace(/_/g, " ")}</Badge>}
                    {e.retracted && <Badge tone="red">Retracted</Badge>}
                    {e.by && <span className="text-[11px] text-gray-400">{e.by}</span>}
                    {e.files?.length > 0 && (
                      <button onClick={() => onOpenFiles(e.title, e.files)} className="text-[11px] font-bold text-[#F47C3C] flex items-center gap-1">
                        <Paperclip size={11} /> {e.files.length}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Communications — the tenant's Email Records, and logging a new one
 * ------------------------------------------------------------------ */
function Communications({ row, tenancyIds, onOpenFiles, onChanged }) {
  const pathname = usePathname() || "";
  const portal = pathname.split("/")[1] || "admin";
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [channel, setChannel] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [logging, setLogging] = useState(false);
  const [replyFor, setReplyFor] = useState(null);

  const key = tenancyIds.join(",");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/email-records", { params: { tenancyIds: key || "none", channel: channel || undefined, q: q || undefined } });
      setRecords(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load communications.");
    } finally {
      setLoading(false);
    }
  }, [key, channel, q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const blank = { channel: "Call", direction: "Outgoing", date: toLocalInput(), subject: "", notes: "", files: [] };
  const [form, setForm] = useState(blank);
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // A new conversation is a new Email Records row; a follow-up goes into an
  // existing row's thread. Either way nothing already logged is touched.
  const submit = async (e) => {
    e.preventDefault();
    if (uploading) return;
    setSaving(true);
    setError("");
    try {
      if (replyFor) {
        await api.post(`/email-records/${replyFor._id}/history`, {
          channel: form.channel,
          direction: form.direction,
          date: new Date(form.date).toISOString(),
          summary: form.notes,
          files: form.files,
        });
      } else {
        await api.post("/email-records", {
          tenancyId: row._id,
          propertyId: row.property?.linked ? row.property._id : null,
          property: row.property?.name && row.property.name !== "—" ? row.property.name : "—",
          date: new Date(form.date).toISOString(),
          channel: form.channel,
          subject: form.subject,
          issue: form.notes,
          category: "Tenant Issue",
          ...(form.channel === "Email" ? { emailTo: form.direction === "Outgoing" ? row.email : "", emailFrom: form.direction === "Incoming" ? row.email : "" } : {}),
          files: form.files,
        });
      }
      setForm(blank);
      setLogging(false);
      setReplyFor(null);
      await load();
      onChanged();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const showForm = logging || replyFor;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className="px-3 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B]">
          <option value="">All types</option>
          {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c] || c}</option>)}
        </select>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations…" className="pl-8 pr-3 py-2 bg-white border border-gray-100 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]" />
        </div>
        {portal === "admin" && (
          <Link href="/admin/email-records" className="text-xs font-bold text-gray-400 hover:text-[#F47C3C] flex items-center gap-1">
            Full log <ExternalLink size={12} />
          </Link>
        )}
        <button onClick={() => { setReplyFor(null); setLogging(true); }} className="ml-auto px-4 py-2 rounded-xl bg-[#F47C3C] text-white text-xs font-bold flex items-center gap-1">
          <Plus size={13} /> Log communication
        </button>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {showForm && (
        <form onSubmit={submit} className="bg-orange-50/40 border border-orange-100 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-bold text-[#0F253B]">
            {replyFor ? `Add to “${replyFor.subject || replyFor.issue}”` : "New conversation"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Type</label>
              <select className={FIELD} value={form.channel} onChange={set("channel")}>
                {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c] || c}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Direction</label>
              <select className={FIELD} value={form.direction} onChange={set("direction")}>
                <option value="Outgoing">We contacted the tenant</option>
                <option value="Incoming">Tenant contacted us</option>
                <option value="Internal">Internal note</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Date & time</label>
              <input type="datetime-local" className={FIELD} value={form.date} onChange={set("date")} required />
            </div>
          </div>
          {!replyFor && (
            <div>
              <label className={LABEL}>Subject / issue</label>
              <input className={FIELD} value={form.subject} onChange={set("subject")} placeholder="e.g. Broken boiler — no hot water" required />
            </div>
          )}
          <div>
            <label className={LABEL}>Full notes / message</label>
            <textarea className={FIELD} rows={4} value={form.notes} onChange={set("notes")} required />
          </div>
          <MediaUploader label="Photos, screenshots, documents" files={form.files} onChange={(u) => setForm((f) => ({ ...f, files: applyFiles(u, f.files) }))} onUploadingChange={setUploading} />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setLogging(false); setReplyFor(null); setForm(blank); }} className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold">Cancel</button>
            <button type="submit" disabled={saving || uploading > 0} className="px-4 py-2 rounded-xl bg-[#F47C3C] text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Save
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin inline text-[#F47C3C]" /></div>
      ) : records.length === 0 ? (
        <p className="text-sm text-gray-400 font-medium bg-gray-50 rounded-2xl p-6 text-center">No communications logged with this tenant.</p>
      ) : (
        <div className="space-y-3">
          {records.map((r) => {
            const Icon = CHANNEL_ICON[r.channel] || Mail;
            const expanded = open === r._id;
            return (
              <div key={r._id} className="bg-white border border-gray-100 rounded-2xl">
                <button onClick={() => setOpen(expanded ? null : r._id)} className="w-full text-left p-4 flex items-start gap-3">
                  <span className="w-8 h-8 rounded-lg bg-orange-50 text-[#F47C3C] flex items-center justify-center shrink-0"><Icon size={15} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm text-[#0F253B]">{r.subject || r.issue}</p>
                      <Badge tone={["Resolved", "Closed"].includes(r.status) ? "green" : "amber"}>{r.status}</Badge>
                    </div>
                    <p className="text-[11px] text-gray-400 font-medium">
                      {CHANNEL_LABEL[r.channel] || r.channel} · {fmtWhen(r.date)}{r.createdByEmail ? ` · ${r.createdByEmail}` : ""}{r.room ? ` · ${r.room}` : ""} · {r.history?.length || 0} in thread
                    </p>
                  </div>
                </button>
                {expanded && (
                  <div className="px-4 pb-4 space-y-2 border-t border-gray-50 pt-3">
                    <p className="text-sm text-gray-700 whitespace-pre-line">{r.issue}</p>
                    {r.files?.length > 0 && (
                      <button onClick={() => onOpenFiles(r.subject || "Attachments", r.files)} className="text-xs font-bold text-[#F47C3C] flex items-center gap-1"><Paperclip size={12} /> {r.files.length} attachment(s)</button>
                    )}
                    {(r.history || []).map((h) => {
                      const HIcon = CHANNEL_ICON[h.channel] || Mail;
                      return (
                        <div key={h._id} className={`ml-4 bg-gray-50 rounded-xl p-3 ${h.retractedAt ? "opacity-60" : ""}`}>
                          <p className="text-[11px] font-bold text-[#0F253B] flex items-center gap-1.5 flex-wrap">
                            <HIcon size={11} className="text-[#F47C3C]" /> {CHANNEL_LABEL[h.channel] || h.channel} · {h.direction} · {fmtWhen(h.date)}
                            {h.createdByEmail && <span className="font-medium text-gray-400">· {h.createdByEmail}</span>}
                            {h.retractedAt && <Badge tone="red">Retracted by {h.retractedByEmail}</Badge>}
                          </p>
                          <p className={`text-xs text-gray-700 whitespace-pre-line mt-1 ${h.retractedAt ? "line-through" : ""}`}>{h.summary}</p>
                          {h.retractReason && <p className="text-[11px] text-red-600 mt-1">Reason: {h.retractReason}</p>}
                          {h.files?.length > 0 && (
                            <button onClick={() => onOpenFiles("Message attachments", h.files)} className="text-[11px] font-bold text-[#F47C3C] mt-1 flex items-center gap-1"><Paperclip size={11} /> {h.files.length}</button>
                          )}
                        </div>
                      );
                    })}
                    <button onClick={() => { setLogging(false); setReplyFor(r); setForm({ ...blank, channel: r.channel }); }} className="ml-4 text-xs font-bold text-[#F47C3C] flex items-center gap-1">
                      <Plus size={12} /> Add to this conversation
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The tab bar and the tab bodies
 * ------------------------------------------------------------------ */
export default function TenantProfileTabs({ row, overview, onClose }) {
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [viewer, setViewer] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/tenancies/${row._id}/timeline`)
      .then((r) => !cancelled && setData(r.data.data))
      .catch((err) => !cancelled && setError(err.response?.data?.message || "Failed to load the tenant's history."));
    return () => {
      cancelled = true;
    };
  }, [row._id, version]);

  const refresh = () => setVersion((v) => v + 1);
  const tenancyIds = data?.tenancyIds || [String(row._id)];
  const counts = data?.counts || {};
  const badge = { communications: counts.communications, cases: counts.openCases, invoices: counts.invoices, inventory: counts.inventory, documents: counts.documents, maintenance: counts.maintenance };
  const openFiles = (title, files) => setViewer({ title, files });
  const preset = {
    tenancyId: String(row._id),
    propertyId: row.property?.linked ? String(row.property._id) : "",
    roomId: row.room?.linked ? String(row.room._id) : "",
  };

  return (
    <div className="space-y-4 min-w-0">
      <div className="bg-white border border-gray-100 rounded-2xl p-2 flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${active ? "bg-[#0F253B] text-white" : "text-gray-500 hover:bg-gray-50"}`}
            >
              <t.icon size={13} className={active ? "text-[#F47C3C]" : "text-gray-300"} />
              {t.label}
              {badge[t.key] ? <span className={`px-1.5 rounded-md text-[10px] ${active ? "bg-white/15" : "bg-gray-100"}`}>{badge[t.key]}</span> : null}
            </button>
          );
        })}
      </div>

      {tab === "overview" ? (
        overview
      ) : (
        <div className="bg-gray-50 border border-gray-100 rounded-3xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[#0F253B] truncate">{row.name}</h2>
              <p className="text-xs text-gray-400 font-medium">
                {[row.property?.name, row.room?.roomName].filter((x) => x && x !== "—").join(" · ")}
                {data?.tenancies?.length > 1 ? ` · ${data.tenancies.length} tenancies` : ""}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-500 shrink-0"><X size={20} /></button>
          </div>

          {error && <ErrorBanner>{error}</ErrorBanner>}

          {!data && !error && ["timeline", "maintenance", "payments", "documents"].includes(tab) ? (
            <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin inline text-[#F47C3C]" /></div>
          ) : tab === "timeline" ? (
            <Timeline data={data} onOpenFiles={openFiles} />
          ) : tab === "maintenance" ? (
            <Timeline data={data} types="maintenance" onOpenFiles={openFiles} />
          ) : tab === "payments" ? (
            <Timeline data={data} types="payment,invoice_payment" onOpenFiles={openFiles} />
          ) : tab === "communications" ? (
            <Communications row={row} tenancyIds={tenancyIds} onOpenFiles={openFiles} onChanged={refresh} />
          ) : tab === "cases" ? (
            <TenantCasesBoard tenancyIds={tenancyIds} tenancyId={String(row._id)} compact />
          ) : tab === "invoices" ? (
            <InvoicesBoard tenancyIds={tenancyIds} compact preset={{ billToType: "Tenant", tenancyId: preset.tenancyId, propertyId: preset.propertyId }} />
          ) : tab === "inventory" ? (
            <InventoryReportsPanel tenancyIds={tenancyIds} preset={preset} compact />
          ) : tab === "documents" ? (
            <div className="space-y-2">
              {(data?.documents || []).length === 0 ? (
                <p className="text-sm text-gray-400 font-medium bg-white rounded-2xl p-6 text-center">No documents on this tenant&apos;s records yet.</p>
              ) : (
                data.documents.map((d, i) => (
                  <div key={(d.url || "") + i}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                      {d.source}{d.date ? ` · ${new Date(d.date).toLocaleDateString("en-GB")}` : ""}
                    </p>
                    <AttachmentRow file={d} />
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      )}

      {viewer && <MediaViewerModal title={viewer.title} files={viewer.files || []} onClose={() => setViewer(null)} />}
    </div>
  );
}
