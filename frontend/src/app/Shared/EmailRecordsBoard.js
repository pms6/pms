"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Plus,
  X,
  Pencil,
  Search,
  Mail,
  Users,
  FileSpreadsheet,
  Printer,
  BellRing,
  AlertTriangle,
  History,
  Trash2,
  Loader2,
  CalendarDays,
  Send,
  CheckCircle2,
  XCircle,
  RotateCw,
  Inbox,
} from "lucide-react";
import { PageHeader, Badge } from "./ui";
import { MediaUploader, MediaViewerModal } from "./MediaAttachments";
import { guardModalClose } from "./modalGuard";
import { CHANNEL_ICON, TenantConversationsPanel, TenantThreadModal } from "./TenantConversations";
import api from "@/app/api/api";
import { fmtDate } from "@/app/utils/cleaningSheet";
import {
  DEFAULT_OPTIONS,
  STATUS_TONE,
  PRIORITY_TONE,
  isDone,
  isOverdue,
  isDueToday,
  resolvedRecently,
  replyText,
  fmtDateTime,
  toInputDateTime,
  currentMonth,
  monthLabel,
  recordInMonth,
  recordEvents,
  groupByTenant,
  exportEmailRecordsXlsx,
  printEmailRecordsPdf,
} from "@/app/utils/emailRecordsSheet";
import {
  FIELD,
  LABEL,
  toInputDate,
  filesOf,
  FileStrip,
  ModalShell,
  PropertyFields,
  ErrorBanner,
  SubmitButton,
  ViewRow,
  FilesBlock,
  RowActions,
  EmptyRow,
} from "./registerParts";

/* ------------------------------------------------------------------ *
 * Email Records — the property-management communication log. One row per
 * email (or call / message) about a property issue, with its reply, its
 * follow-up date, the staff member chasing it and the full thread behind it.
 * MUST stay in sync with backend/models/EmailRecord.js.
 * ------------------------------------------------------------------ */

const matchesSearch = (row, needle) =>
  [
    row.property,
    row.tenantName,
    row.tenantEmail,
    row.emailTo,
    row.emailFrom,
    row.subject,
    row.issue,
    row.replySummary,
    row.followUpNotes,
    row.assignedToEmail,
    ...(row.history || []).map((h) => h.summary),
  ].some((v) => String(v || "").toLowerCase().includes(needle));

// Same property whether linked to the portfolio or typed as an address.
const sameProperty = (a, b) =>
  (a.propertyId && b.propertyId && String(a.propertyId) === String(b.propertyId)) ||
  String(a.property || "").trim().toLowerCase() === String(b.property || "").trim().toLowerCase();

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+(\s*[,;]\s*[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+)*$/;

const SELECT =
  "px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]";

// A dropdown of the company mailboxes that still takes any other address.
function AccountInput({ id, value, onChange, accounts, placeholder }) {
  return (
    <>
      <input
        className={FIELD}
        list={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      <datalist id={id}>
        {accounts.map((a) => (
          <option key={a.email} value={a.email}>{a.purpose}</option>
        ))}
      </datalist>
    </>
  );
}

// Whether a message was actually emailed from the system, with a resend
// button when it failed. Nothing is shown for messages that were only logged.
export function DeliveryStatus({ item, onResend }) {
  const [sending, setSending] = useState(false);
  if (!item?.emailStatus) return null;

  const resend = async () => {
    setSending(true);
    try {
      await onResend();
    } finally {
      setSending(false);
    }
  };

  if (item.emailStatus === "Sent") {
    return (
      <p className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-1">
        <CheckCircle2 size={12} /> Emailed {fmtDateTime(item.emailSentAt)}
      </p>
    );
  }
  return (
    <div className="flex items-center gap-2 flex-wrap mt-1">
      <p className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 break-words">
        <XCircle size={12} className="shrink-0" /> Not sent{item.emailError ? ` — ${item.emailError}` : ""}
      </p>
      {onResend && (
        <button
          type="button"
          onClick={resend}
          disabled={sending}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F47C3C] hover:underline disabled:opacity-50"
        >
          {sending ? <Loader2 size={11} className="animate-spin" /> : <RotateCw size={11} />} Resend
        </button>
      )}
    </div>
  );
}

// POST /email-records/:id/send — the record's original email, or one entry.
const resendRequest = async (recordId, entryId) => {
  try {
    const res = await api.post(`/email-records/${recordId}/send`, entryId ? { entryId } : {});
    return res.data.data;
  } catch (err) {
    alert(err.response?.data?.message || "Sending failed");
    return err.response?.data?.data || null;
  }
};

function WideShell({ onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={guardModalClose(onClose)}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Add / edit one record
 * ------------------------------------------------------------------ */
function RecordModal({ initial, properties, members, tenancies, options, onClose, onSave }) {
  const isEdit = Boolean(initial?._id);

  const [form, setForm] = useState({
    propertyId: initial?.propertyId || "",
    property: initial?.property || "",
    date: toInputDate(initial?.date) || toInputDate(new Date()),
    channel: initial?.channel || "Email",
    emailTo: initial?.emailTo || "",
    emailFrom: initial?.emailFrom || "",
    subject: initial?.subject || "",
    issue: initial?.issue || "",
    category: initial?.category || "General",
    priority: initial?.priority || "Medium",
    status: initial?.status || "Open",
    assignedTo: initial?.assignedTo ? String(initial.assignedTo) : "",
    replyReceived: Boolean(initial?.replyReceived),
    replyDate: toInputDate(initial?.replyDate),
    replySummary: initial?.replySummary || "",
    followUpDate: toInputDate(initial?.followUpDate),
    followUpNotes: initial?.followUpNotes || "",
    tenancyId: initial?.tenancyId ? String(initial.tenancyId) : "",
  });

  const [files, setFiles] = useState(() => filesOf(initial?.files));
  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendNow, setSendNow] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isEmail = form.channel === "Email";
  // Sending is offered for a new email only; an existing one is resent from
  // its detail view.
  const canSend = !isEdit && isEmail;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.property.trim()) { setError("Property is required"); return; }
    if (!form.date) { setError("Date is required"); return; }
    if (!form.issue.trim()) { setError("Issue is required"); return; }
    if (uploadingCount) { setError("Wait for the uploads to finish"); return; }
    if (canSend && sendNow && !EMAIL_RE.test(form.emailTo.trim())) {
      setError("Enter a valid 'Email to' address to send");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSave({
        sendNow: canSend && sendNow,
        ...form,
        propertyId: form.propertyId || null,
        tenancyId: form.tenancyId || null,
        property: form.property.trim(),
        issue: form.issue.trim(),
        assignedTo: form.assignedTo || null,
        replyDate: form.replyReceived ? form.replyDate || null : null,
        followUpDate: form.followUpDate || null,
        files,
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save record");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={isEdit ? "Edit Email Record" : "New Email Record"}
      subtitle="The email, the issue, the reply and when it next needs chasing"
      onClose={onClose}
    >
      <ErrorBanner>{error}</ErrorBanner>

      <form onSubmit={submit} className="space-y-4">
        <PropertyFields form={form} setForm={setForm} properties={properties} />

        <div>
          <label className={LABEL}>Tenant (optional)</label>
          <select
            className={FIELD}
            value={form.tenancyId}
            onChange={(e) => {
              const id = e.target.value;
              const t = tenancies.find((x) => String(x._id) === id);
              setForm((f) => ({
                ...f,
                tenancyId: id,
                // Picking a tenant fills in the property when it is still empty.
                ...(t && !f.property.trim()
                  ? { property: t.property || "", propertyId: t.propertyId ? String(t.propertyId) : "" }
                  : {}),
              }));
            }}
          >
            <option value="">Not a tenant conversation</option>
            {/* A linked tenant whose tenancy has since ended is kept selectable. */}
            {form.tenancyId && !tenancies.some((t) => String(t._id) === form.tenancyId) && (
              <option value={form.tenancyId}>{initial?.tenantName || "Past tenant"} (past tenant)</option>
            )}
            {tenancies.map((t) => (
              <option key={String(t._id)} value={String(t._id)}>
                {t.tenant}{t.property ? ` — ${t.property}` : ""}{t.unit && t.unit !== "—" ? `, ${t.unit}` : ""}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-gray-400 font-medium mt-1">
            Linked records, their replies and attachments are kept in the tenant&apos;s conversation history.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Date</label>
            <input type="date" className={FIELD} value={form.date} onChange={set("date")} required />
          </div>
          <div>
            <label className={LABEL}>Type</label>
            <select className={FIELD} value={form.channel} onChange={set("channel")}>
              {options.channels.map((c) => <option key={c} value={c}>{c === "Call" ? "Phone call" : c}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>{isEmail ? "Email to" : "To"}</label>
            <AccountInput
              id="email-to-accounts"
              value={form.emailTo}
              onChange={set("emailTo")}
              accounts={options.accounts}
              placeholder={isEmail ? "Pick a mailbox or type an address" : "Who it went to"}
            />
          </div>
          <div>
            <label className={LABEL}>{isEmail ? "Email from" : "From"}</label>
            <AccountInput
              id="email-from-accounts"
              value={form.emailFrom}
              onChange={set("emailFrom")}
              accounts={options.accounts}
              placeholder={isEmail ? "Pick a mailbox or type an address" : "Who it came from"}
            />
          </div>
        </div>

        {isEmail && (
          <div>
            <label className={LABEL}>Subject</label>
            <input className={FIELD} value={form.subject} onChange={set("subject")} placeholder="Email subject line" />
          </div>
        )}

        <div>
          <label className={LABEL}>Issue</label>
          <textarea
            rows={3}
            className={FIELD}
            value={form.issue}
            onChange={set("issue")}
            placeholder="What the email is about"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={LABEL}>Category</label>
            <select className={FIELD} value={form.category} onChange={set("category")}>
              {options.categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Priority</label>
            <select className={FIELD} value={form.priority} onChange={set("priority")}>
              {options.priorities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Status</label>
            <select className={FIELD} value={form.status} onChange={set("status")}>
              {options.statuses.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={LABEL}>Assigned to</label>
          <select className={FIELD} value={form.assignedTo} onChange={set("assignedTo")}>
            <option value="">Nobody yet</option>
            {members.map((m) => (
              <option key={String(m.userId)} value={String(m.userId)}>
                {m.email}{m.role ? ` (${m.role.toLowerCase()})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl bg-gray-50 p-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-bold text-[#0F253B]">
            <input
              type="checkbox"
              checked={form.replyReceived}
              onChange={(e) => setForm((f) => ({ ...f, replyReceived: e.target.checked }))}
              className="accent-[#F47C3C] w-4 h-4"
            />
            Reply received
          </label>
          {form.replyReceived && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={LABEL}>Reply date</label>
                <input type="date" className={FIELD} value={form.replyDate} onChange={set("replyDate")} />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Reply summary</label>
                <input className={FIELD} value={form.replySummary} onChange={set("replySummary")} placeholder="What they said" />
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={LABEL}>Follow-up date</label>
            <input type="date" className={FIELD} value={form.followUpDate} onChange={set("followUpDate")} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Follow-up notes</label>
            <input className={FIELD} value={form.followUpNotes} onChange={set("followUpNotes")} placeholder="What needs doing next" />
          </div>
        </div>

        <MediaUploader
          files={files}
          onChange={setFiles}
          onUploadingChange={setUploadingCount}
          label="Attachments"
          hint="Photos, invoices, quotations, documents — any file type"
        />

        {canSend && (
          <label className="flex items-start gap-2 rounded-2xl border border-orange-100 bg-orange-50/60 p-4 text-sm font-bold text-[#0F253B] cursor-pointer">
            <input
              type="checkbox"
              checked={sendNow}
              onChange={(e) => setSendNow(e.target.checked)}
              className="accent-[#F47C3C] w-4 h-4 mt-0.5"
            />
            <span>
              <span className="inline-flex items-center gap-1.5"><Send size={14} className="text-[#F47C3C]" /> Send this email now</span>
              <span className="block text-[11px] font-medium text-gray-500 mt-0.5">
                Emails the Issue text, with the attachments, to the &quot;Email to&quot; address. Replies go to the &quot;Email from&quot; mailbox.
              </span>
            </span>
          </label>
        )}

        {canSend && sendNow ? (
          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] disabled:opacity-50 text-white font-bold rounded-xl transition-all"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {saving ? "Sending…" : "Save & Send Email"}
          </button>
        ) : (
          <SubmitButton saving={saving} isEdit={isEdit} />
        )}
      </form>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ *
 * One step in the thread
 * ------------------------------------------------------------------ */
function HistoryItem({ entry, onDelete, onOpenFiles, onResend }) {
  const Icon = CHANNEL_ICON[entry.channel] || Mail;
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-orange-50 text-[#F47C3C] flex items-center justify-center shrink-0">
        <Icon size={15} />
      </div>
      <div className="min-w-0 flex-1 rounded-xl border border-gray-100 p-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-bold text-[#0F253B]">
            {entry.channel} · {entry.direction}
            {entry.isReply && <span className="ml-2 text-emerald-600">Reply</span>}
            {entry.isFollowUp && <span className="ml-2 text-[#F47C3C]">Follow-up</span>}
            {entry.auto && <span className="ml-2 text-gray-300 font-medium">auto-saved</span>}
          </p>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-medium text-gray-400">{fmtDateTime(entry.date)}</p>
            {onDelete && (
              <button onClick={onDelete} title="Remove" className="text-gray-300 hover:text-red-600">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
        {(entry.from || entry.to) && (
          <p className="text-[11px] text-gray-400 font-medium mt-0.5 break-words">
            {entry.from && <>From {entry.from}</>}
            {entry.from && entry.to && " · "}
            {entry.to && <>To {entry.to}</>}
          </p>
        )}
        <p className="text-sm text-gray-600 font-medium whitespace-pre-line mt-1.5">{entry.summary}</p>
        {filesOf(entry.files).length > 0 && (
          <div className="mt-2">
            <FileStrip files={filesOf(entry.files)} onOpen={() => onOpenFiles?.(entry)} />
          </div>
        )}
        <DeliveryStatus item={entry} onResend={onResend} />
        {entry.createdByEmail && (
          <p className="text-[10px] text-gray-300 font-medium mt-1">Logged by {entry.createdByEmail}</p>
        )}
      </div>
    </div>
  );
}

function AddHistoryForm({ row, options, onAdded }) {
  const [form, setForm] = useState({
    channel: "Email",
    direction: "Outgoing",
    date: toInputDateTime(new Date()),
    from: "",
    to: "",
    summary: "",
    isReply: false,
    isFollowUp: false,
    nextFollowUpDate: "",
    status: "",
    subject: "",
  });
  const [sendNow, setSendNow] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  // Remounts the uploader after a save so its own state starts clean.
  const [uploaderKey, setUploaderKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const tick = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.checked }));
  const canSend = form.channel === "Email" && form.direction === "Outgoing";

  // Ticking "send" fills in the obvious addresses: to the tenant (or whoever
  // wrote in), from the mailbox the conversation is running on.
  const toggleSend = (e) => {
    const on = e.target.checked;
    setSendNow(on);
    if (!on) return;
    const isCompany = (a) => DEFAULT_OPTIONS.accounts.concat(options.accounts).some((x) => x.email === a);
    setForm((f) => ({
      ...f,
      to: f.to || row.tenantEmail || (isCompany(row.emailFrom) ? row.emailTo : row.emailFrom) || "",
      from: f.from || (isCompany(row.emailFrom) ? row.emailFrom : isCompany(row.emailTo) ? row.emailTo : ""),
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.summary.trim()) { setError(canSend && sendNow ? "Write the email" : "Write a short summary"); return; }
    if (uploadingCount) { setError("Wait for the uploads to finish"); return; }
    if (canSend && sendNow && !EMAIL_RE.test(form.to.trim())) { setError("Enter a valid 'To' address to send"); return; }
    setSaving(true);
    setError("");
    try {
      // Sent as a full timestamp so the server stores the time the person
      // picked in their own timezone.
      const when = form.date ? new Date(form.date) : new Date();
      const payload = {
        ...form,
        summary: form.summary.trim(),
        date: Number.isNaN(when.getTime()) ? new Date().toISOString() : when.toISOString(),
        files,
        sendNow: canSend && sendNow,
      };
      if (!payload.subject) delete payload.subject;
      if (!form.nextFollowUpDate) delete payload.nextFollowUpDate;
      if (!form.status) delete payload.status;
      const res = await api.post(`/email-records/${row._id}/history`, payload);
      onAdded(res.data.data);
      if (payload.sendNow && res.data.emailStatus !== "Sent") alert(res.data.message);
      setForm((f) => ({
        ...f,
        date: toInputDateTime(new Date()),
        summary: "",
        isReply: false,
        isFollowUp: false,
        nextFollowUpDate: "",
        status: "",
        subject: "",
      }));
      setSendNow(false);
      setFiles([]);
      setUploaderKey((k) => k + 1);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl bg-gray-50 p-4 space-y-3">
      <p className={LABEL}>Log a reply, follow-up, call or message</p>
      <ErrorBanner>{error}</ErrorBanner>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <select className={FIELD} value={form.channel} onChange={set("channel")}>
          {options.channels.map((c) => <option key={c} value={c}>{c === "Call" ? "Phone call" : c}</option>)}
        </select>
        <select className={FIELD} value={form.direction} onChange={set("direction")}>
          {["Outgoing", "Incoming", "Internal"].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          type="datetime-local"
          className={`${FIELD} col-span-2 sm:col-span-1`}
          value={form.date}
          onChange={set("date")}
          title="Date and time of the message"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AccountInput id="history-from" value={form.from} onChange={set("from")} accounts={options.accounts} placeholder="From" />
        <AccountInput id="history-to" value={form.to} onChange={set("to")} accounts={options.accounts} placeholder="To" />
      </div>
      {canSend && (
        <label className="flex items-center gap-2 text-xs font-bold text-[#0F253B] cursor-pointer">
          <input type="checkbox" checked={sendNow} onChange={toggleSend} className="accent-[#F47C3C]" />
          <Send size={13} className="text-[#F47C3C]" /> Send this as a real email to the &quot;To&quot; address
        </label>
      )}
      {canSend && sendNow && (
        <input
          className={FIELD}
          value={form.subject}
          onChange={set("subject")}
          placeholder={`Subject (default: Re: ${row.subject || row.issue.slice(0, 40)})`}
        />
      )}
      <textarea
        rows={canSend && sendNow ? 5 : 2}
        className={FIELD}
        value={form.summary}
        onChange={set("summary")}
        placeholder={canSend && sendNow ? "The email to send" : "What was said"}
      />
      <MediaUploader
        key={uploaderKey}
        files={files}
        onChange={setFiles}
        onUploadingChange={setUploadingCount}
        label="Attachments (optional)"
        hint="Screenshots, photos, PDFs or documents sent in this message"
      />
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs font-bold text-[#0F253B]">
          <input type="checkbox" checked={form.isReply} onChange={tick("isReply")} className="accent-[#F47C3C]" />
          This is their reply
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-[#0F253B]">
          <input type="checkbox" checked={form.isFollowUp} onChange={tick("isFollowUp")} className="accent-[#F47C3C]" />
          This is a follow-up
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>Next follow-up date (optional)</label>
          <input type="date" className={FIELD} value={form.nextFollowUpDate} onChange={set("nextFollowUpDate")} />
        </div>
        <div>
          <label className={LABEL}>Change status (optional)</label>
          <select className={FIELD} value={form.status} onChange={set("status")}>
            <option value="">Leave as {row.status}</option>
            {options.statuses.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 bg-[#0F253B] hover:bg-[#1a3654] disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all"
      >
        {saving ? (canSend && sendNow ? "Sending…" : "Adding…") : canSend && sendNow ? "Send email & add to history" : "Add to history"}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Full detail — the record, its thread, attachments and timestamps
 * ------------------------------------------------------------------ */
function ViewModal({ row, options, onClose, onEdit, onOpenFiles, onChanged, onPropertyHistory, onTenantHistory }) {
  const overdue = isOverdue(row);
  const Icon = CHANNEL_ICON[row.channel] || Mail;
  const thread = [...(row.history || [])].sort((a, b) => new Date(a.date) - new Date(b.date));

  const resend = async (entry) => {
    const updated = await resendRequest(row._id, entry?._id);
    if (updated) onChanged(updated);
  };

  const removeEntry = async (entry) => {
    if (!confirm("Remove this entry from the history?")) return;
    try {
      const res = await api.delete(`/email-records/${row._id}/history/${entry._id}`);
      onChanged(res.data.data);
    } catch (err) {
      alert(err.response?.data?.message || "Remove failed");
    }
  };

  return (
    <WideShell onClose={onClose}>
      <div className="flex items-start justify-between mb-5 gap-4">
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-[#0F253B] break-words flex items-center gap-2">
            <Icon size={18} className="text-[#F47C3C] shrink-0" /> {row.property}
          </h3>
          <p className="text-xs text-gray-400 font-medium">
            {row.channel} · {fmtDate(row.date)}{row.subject ? ` · ${row.subject}` : ""}
          </p>
          <DeliveryStatus item={row} onResend={() => resend(null)} />
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
            <Badge tone={PRIORITY_TONE[row.priority]}>{row.priority}</Badge>
            <Badge tone="gray">{row.category}</Badge>
            {row.escalated && <Badge tone="red">Escalated</Badge>}
          </div>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 shrink-0"><X size={20} /></button>
      </div>

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <ViewRow label="Email to">{row.emailTo}</ViewRow>
          <ViewRow label="Email from">{row.emailFrom}</ViewRow>
          <ViewRow label="Tenant">
            {row.tenantName ? (
              <button onClick={() => onTenantHistory(row)} className="text-left hover:text-[#F47C3C]" title="Full conversation with this tenant">
                {row.tenantName}{row.tenantEmail ? ` · ${row.tenantEmail}` : ""}
              </button>
            ) : null}
          </ViewRow>
          <ViewRow label="Assigned to">{row.assignedToEmail}</ViewRow>
          <ViewRow label="Follow-up">
            {row.followUpDate ? (
              <span className={overdue ? "text-red-600" : ""}>
                {fmtDate(row.followUpDate)}{overdue && " · overdue"}
              </span>
            ) : null}
          </ViewRow>
        </div>

        <div>
          <p className={LABEL}>Issue</p>
          <p className="text-sm text-gray-600 font-medium whitespace-pre-line leading-relaxed">{row.issue}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl bg-gray-50 p-4">
          <ViewRow label="Reply">{replyText(row)}</ViewRow>
          <ViewRow label="Follow-up notes">{row.followUpNotes}</ViewRow>
        </div>

        <FilesBlock
          label="Attachments"
          files={filesOf(row.files)}
          onOpen={() => onOpenFiles({ title: row.property, subtitle: `Email record · ${fmtDate(row.date)}`, files: filesOf(row.files) })}
        />

        <div>
          <div className="flex items-center justify-between mb-3">
            <p className={LABEL}>Thread &amp; history <span className="text-gray-300">({thread.length})</span></p>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {row.tenantName && (
                <button
                  onClick={() => onTenantHistory(row)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F47C3C] hover:underline"
                >
                  <Users size={13} /> All chats with this tenant
                </button>
              )}
              <button
                onClick={() => onPropertyHistory(row)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F47C3C] hover:underline"
              >
                <History size={13} /> All communication for this property
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {thread.length === 0 && <p className="text-sm font-medium text-gray-300">Nothing logged after the original email yet.</p>}
            {thread.map((h) => (
              <HistoryItem
                key={h._id}
                entry={h}
                onDelete={() => removeEntry(h)}
                onResend={() => resend(h)}
                onOpenFiles={(entry) =>
                  onOpenFiles({ title: row.property, subtitle: `${entry.channel} · ${fmtDateTime(entry.date)}`, files: filesOf(entry.files) })
                }
              />
            ))}
          </div>
          <div className="mt-4">
            <AddHistoryForm row={row} options={options} onAdded={onChanged} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] font-medium text-gray-400 border-t border-gray-100 pt-4">
          <p>Created<br /><span className="text-[#0F253B] font-bold">{fmtDate(row.createdAt)}</span></p>
          <p>Updated<br /><span className="text-[#0F253B] font-bold">{fmtDate(row.updatedAt)}</span></p>
          <p>Replied<br /><span className="text-[#0F253B] font-bold">{fmtDate(row.replyDate) || "—"}</span></p>
          <p>Last followed up<br /><span className="text-[#0F253B] font-bold">{fmtDate(row.lastFollowUpAt) || "—"}</span></p>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => onEdit(row)}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98]"
        >
          <Pencil size={16} /> Edit Record
        </button>
        <button
          onClick={onClose}
          className="px-6 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-100 text-[#0F253B] font-bold rounded-xl transition-all"
        >
          Close
        </button>
      </div>
    </WideShell>
  );
}

/* ------------------------------------------------------------------ *
 * Everything said about one property — emails, calls and messages —
 * oldest first.
 * ------------------------------------------------------------------ */
function PropertyHistoryModal({ anchor, rows, onClose, onOpen, onOpenFiles }) {
  const events = useMemo(
    () =>
      rows
        .filter((x) => sameProperty(x, anchor))
        .flatMap(recordEvents)
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [rows, anchor]
  );

  return (
    <WideShell onClose={onClose}>
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h3 className="text-xl font-bold text-[#0F253B]">{anchor.property}</h3>
          <p className="text-xs text-gray-400 font-medium">Communication history · {events.length} entries</p>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
      </div>
      <div className="space-y-3">
        {events.map((ev) => (
          <div key={ev.key}>
            <HistoryItem
              entry={{ ...ev.entry, date: ev.date }}
              onOpenFiles={(entry) =>
                onOpenFiles({ title: anchor.property, subtitle: `${entry.channel} · ${fmtDateTime(entry.date)}`, files: filesOf(entry.files) })
              }
            />
            <button
              onClick={() => onOpen(ev.record)}
              className="ml-11 mt-1 text-[11px] font-bold text-[#F47C3C] hover:underline"
            >
              {ev.record.category} · {ev.record.status} — open record
            </button>
          </div>
        ))}
      </div>
    </WideShell>
  );
}

/* ------------------------------------------------------------------ *
 * Board
 * ------------------------------------------------------------------ */
const EMPTY_FILTERS = {
  propertyKey: "",
  status: "",
  category: "",
  priority: "",
  account: "",
  assignedTo: "",
  followUp: "",
  from: "",
  to: "",
  month: "",
};

export default function EmailRecordsBoard({
  subtitle = "Property management email communication log — replies, follow-ups and escalations",
}) {
  const [rows, setRows] = useState([]);
  const [properties, setProperties] = useState([]);
  const [members, setMembers] = useState([]);
  const [tenancies, setTenancies] = useState([]);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  // {} = create, row = edit, null = closed.
  const [modal, setModal] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [viewingFiles, setViewingFiles] = useState(null);
  const [propertyHistory, setPropertyHistory] = useState(null);
  // "records" = the log, "tenants" = one conversation per tenant.
  const [view, setView] = useState("records");
  const [tenantThreadKey, setTenantThreadKey] = useState(null);
  const [runningReminders, setRunningReminders] = useState(false);
  const [checkingInbox, setCheckingInbox] = useState(false);
  const [inbox, setInbox] = useState(null);
  const openedFromUrl = useRef(false);

  const viewing = viewingId ? rows.find((r) => r._id === viewingId) || null : null;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [listRes, propsRes] = await Promise.all([
        api.get("/email-records"),
        api.get("/properties", { params: { limit: 200 } }),
      ]);
      setRows(listRes.data.data || []);
      setProperties(propsRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load email records");
    } finally {
      setLoading(false);
    }
    // Option lists and the staff list are extras — the log works without them.
    api.get("/email-records/options").then((r) => r.data?.data && setOptions(r.data.data)).catch(() => {});
    api.get("/tasks/assignable-members").then((r) => setMembers(r.data?.data || [])).catch(() => {});
    api.get("/tenancies").then((r) => setTenancies(r.data?.data || [])).catch(() => {});
    api.get("/email-records/inbox-status").then((r) => setInbox(r.data?.data || null)).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  // A notification click lands here with ?open=<recordId>.
  useEffect(() => {
    if (openedFromUrl.current || loading) return;
    const params = new URLSearchParams(window.location.search);
    const openId = params.get("open");
    if (!openId) return;
    openedFromUrl.current = true;
    (async () => {
      if (rows.some((r) => r._id === openId)) setViewingId(openId);
    })();
    params.delete("open");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [loading, rows]);

  const propertyChoices = useMemo(() => {
    const seen = new Map();
    for (const r of rows) {
      const key = r.propertyId ? `id:${r.propertyId}` : `txt:${r.property.trim().toLowerCase()}`;
      if (!seen.has(key)) seen.set(key, r.property);
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const needle = q.trim().toLowerCase();
  const f = filters;

  const visible = useMemo(() => {
    const fromD = f.from ? new Date(f.from) : null;
    const toD = f.to ? new Date(`${f.to}T23:59:59`) : null;
    return rows.filter((r) => {
      if (f.propertyKey) {
        const key = r.propertyId ? `id:${r.propertyId}` : `txt:${r.property.trim().toLowerCase()}`;
        if (key !== f.propertyKey) return false;
      }
      if (f.status && r.status !== f.status) return false;
      if (f.category && r.category !== f.category) return false;
      if (f.priority && r.priority !== f.priority) return false;
      if (f.account && r.emailTo !== f.account && r.emailFrom !== f.account) return false;
      if (f.assignedTo && String(r.assignedTo || "") !== f.assignedTo) return false;
      if (f.followUp === "overdue" && !isOverdue(r)) return false;
      if (f.followUp === "today" && !isDueToday(r)) return false;
      if (f.followUp === "set" && (!r.followUpDate || isDone(r))) return false;
      if (f.followUp === "open" && isDone(r)) return false;
      if (f.followUp === "awaiting" && (r.replyReceived || isDone(r))) return false;
      if (f.followUp === "urgent" && (r.priority !== "Urgent" || isDone(r))) return false;
      if (f.followUp === "escalated" && !r.escalated) return false;
      if (f.followUp === "recentResolved" && !resolvedRecently(r)) return false;
      if (fromD && new Date(r.date) < fromD) return false;
      if (toD && new Date(r.date) > toD) return false;
      if (f.month && !recordInMonth(r, f.month)) return false;
      if (needle && !matchesSearch(r, needle)) return false;
      return true;
    });
  }, [rows, f, needle]);

  const setFilter = (k) => (e) => setFilters((prev) => ({ ...prev, [k]: e.target.value }));
  const anyFilter = needle || Object.values(filters).some(Boolean);

  // Dashboard — over every record, not just the filtered view. Each card
  // applies its own filter when clicked.
  const cards = [
    { key: "open", label: "Open emails", value: rows.filter((r) => !isDone(r)).length },
    { key: "awaiting", label: "Awaiting reply", value: rows.filter((r) => !r.replyReceived && !isDone(r)).length },
    { key: "overdue", label: "Overdue follow-ups", value: rows.filter(isOverdue).length, alert: true },
    { key: "urgent", label: "Urgent issues", value: rows.filter((r) => r.priority === "Urgent" && !isDone(r)).length, alert: true },
    { key: "escalated", label: "Escalated", value: rows.filter((r) => r.escalated).length, alert: true },
    {
      key: "recentResolved",
      label: "Resolved (7 days)",
      value: rows.filter((r) => resolvedRecently(r)).length,
    },
  ];

  const save = async (payload) => {
    let res;
    if (modal?._id) res = await api.put(`/email-records/${modal._id}`, payload);
    else res = await api.post("/email-records", payload);
    setModal(null);
    await load();
    // The record is saved either way; a failed send is reported, and can be
    // retried from the record.
    if (payload.sendNow) alert(res.data.message);
  };

  // Recomputed from the live rows, so a message added while the thread is
  // open shows up in it.
  const tenantGroups = useMemo(() => groupByTenant(rows, tenancies), [rows, tenancies]);
  const tenantThread = tenantThreadKey ? tenantGroups.find((t) => t.key === tenantThreadKey) || null : null;

  const openTenantFor = (row) => {
    const g = tenantGroups.find((t) => t.records.some((r) => r._id === row._id));
    if (g) setTenantThreadKey(g.key);
  };

  const replaceRow = (updated) => setRows((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));

  const remove = async (row) => {
    if (!confirm(`Delete the ${fmtDate(row.date)} record for "${row.property}"?`)) return;
    const snapshot = rows;
    if (viewingId === row._id) setViewingId(null);
    setRows((prev) => prev.filter((r) => r._id !== row._id));
    try {
      await api.delete(`/email-records/${row._id}`);
    } catch (err) {
      setRows(snapshot);
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const runReminders = async () => {
    setRunningReminders(true);
    try {
      const res = await api.post("/email-records/run-reminders");
      const d = res.data.data || {};
      alert(`Reminders sent: ${d.reminders || 0}. Escalations: ${d.escalations || 0}.`);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to run reminders");
    } finally {
      setRunningReminders(false);
    }
  };

  // Replies are read from the inbox every five minutes on the server; this
  // reads it now.
  const checkInbox = async () => {
    setCheckingInbox(true);
    try {
      const res = await api.post("/email-records/fetch-inbox");
      const d = res.data.data || {};
      setInbox(d.status || null);
      if (d.skipped) alert(d.skipped);
      else if (d.errors?.length && !d.replies && !d.newConversations) alert(`Could not read the inbox: ${d.errors[0].error}`);
      else alert(`Replies filed: ${d.replies || 0}. New tenant conversations: ${d.newConversations || 0}.`);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to check the inbox");
    } finally {
      setCheckingInbox(false);
    }
  };

  const exportPdf = () => {
    const title = filters.month ? `Email Records — ${monthLabel(filters.month)}` : "Email Records";
    if (!printEmailRecordsPdf(visible, { title })) alert("Allow pop-ups for this site to print or save as PDF.");
  };

  const thClass = "px-4 py-3 whitespace-nowrap";
  const toolBtn =
    "flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-100 hover:bg-gray-50 text-[#0F253B] font-bold text-sm rounded-xl transition-all disabled:opacity-50";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Email Records"
        subtitle={subtitle}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => exportEmailRecordsXlsx(visible)} className={toolBtn} title="Export the current view to Excel">
              <FileSpreadsheet size={16} /> Excel
            </button>
            <button onClick={exportPdf} className={toolBtn} title="Print or save the current view as PDF">
              <Printer size={16} /> PDF
            </button>
            <button onClick={checkInbox} disabled={checkingInbox} className={toolBtn} title="Fetch tenant replies from the inbox now">
              {checkingInbox ? <Loader2 size={16} className="animate-spin" /> : <Inbox size={16} />} Check inbox
            </button>
            <button onClick={runReminders} disabled={runningReminders} className={toolBtn} title="Send follow-up reminders and escalations now">
              {runningReminders ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />} Reminders
            </button>
            <button
              onClick={() => setModal({})}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              <Plus size={18} /> New Record
            </button>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
          <button onClick={load} className="ml-3 px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg text-xs font-bold">Retry</button>
        </div>
      )}

      {inbox && (
        <p className={`flex items-center gap-2 text-xs font-medium ${inbox.lastError ? "text-red-600" : "text-gray-400"}`}>
          <Inbox size={13} />
          {!inbox.configured
            ? "Tenant replies are not being fetched — no inbox is configured on the server."
            : inbox.lastError
              ? `Could not read ${inbox.mailbox}: ${inbox.lastError}`
              : `Tenant replies are fetched automatically from ${inbox.mailbox} every 5 minutes${
                  inbox.lastSuccessAt ? ` · last checked ${fmtDateTime(inbox.lastSuccessAt)}` : ""
                }`}
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex rounded-xl bg-white border border-gray-100 p-1">
          {[
            { key: "records", label: "Email Log", Icon: Mail },
            { key: "tenants", label: "Tenant Conversations", Icon: Users },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                view === key ? "bg-[#0F253B] text-white" : "text-[#0F253B] hover:bg-gray-50"
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-gray-400" />
          <input
            type="month"
            value={filters.month}
            onChange={setFilter("month")}
            className={SELECT}
            title="Show one month"
          />
          {filters.month ? (
            <button
              onClick={() => setFilters((prev) => ({ ...prev, month: "" }))}
              className="text-xs font-bold text-[#F47C3C] hover:underline"
            >
              All months
            </button>
          ) : (
            <button
              onClick={() => setFilters((prev) => ({ ...prev, month: currentMonth() }))}
              className="text-xs font-bold text-[#F47C3C] hover:underline"
            >
              This month
            </button>
          )}
        </div>
      </div>

      {view === "tenants" ? (
        <>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tenant, email, property or message…"
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
            />
          </div>
          <TenantConversationsPanel
            rows={rows}
            tenancies={tenancies}
            month={filters.month}
            needle={needle}
            loading={loading}
            onOpenTenant={(t) => setTenantThreadKey(t.key)}
          />
        </>
      ) : (
      <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((s) => {
          const active = filters.followUp === s.key;
          const hot = s.alert && s.value > 0;
          return (
            <button
              key={s.key}
              onClick={() => setFilters((prev) => ({ ...prev, followUp: active ? "" : s.key }))}
              className={`text-left bg-white border rounded-2xl p-4 transition-all ${active ? "border-[#F47C3C] ring-2 ring-[#F47C3C]/30" : "border-gray-100 hover:border-gray-200"}`}
            >
              <p className={`text-2xl font-bold ${hot ? "text-red-600" : "text-[#0F253B]"}`}>{loading ? "—" : s.value}</p>
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mt-1">{s.label}</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 rounded-2xl bg-white border border-gray-100 p-4">
        <div className="relative sm:col-span-2 lg:col-span-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search property, issue, sender, reply…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>
        <select value={filters.propertyKey} onChange={setFilter("propertyKey")} className={SELECT}>
          <option value="">All properties</option>
          {propertyChoices.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <select value={filters.account} onChange={setFilter("account")} className={SELECT}>
          <option value="">All mailboxes</option>
          {options.accounts.map((a) => <option key={a.email} value={a.email}>{a.email}</option>)}
        </select>
        <select value={filters.assignedTo} onChange={setFilter("assignedTo")} className={SELECT}>
          <option value="">All staff</option>
          {members.map((m) => <option key={String(m.userId)} value={String(m.userId)}>{m.email}</option>)}
        </select>
        <select value={filters.status} onChange={setFilter("status")} className={SELECT}>
          <option value="">All statuses</option>
          {options.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.category} onChange={setFilter("category")} className={SELECT}>
          <option value="">All categories</option>
          {options.categories.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.priority} onChange={setFilter("priority")} className={SELECT}>
          <option value="">All priorities</option>
          {options.priorities.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.followUp} onChange={setFilter("followUp")} className={SELECT}>
          <option value="">Any follow-up</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="set">Has a follow-up date</option>
          <option value="open">Open only</option>
          <option value="awaiting">Awaiting reply</option>
          <option value="urgent">Urgent (open)</option>
          <option value="escalated">Escalated</option>
          <option value="recentResolved">Resolved in last 7 days</option>
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={filters.from} onChange={setFilter("from")} className={`${SELECT} w-full`} title="From date" />
          <input type="date" value={filters.to} onChange={setFilter("to")} className={`${SELECT} w-full`} title="To date" />
        </div>
        {anyFilter && (
          <button
            onClick={() => { setFilters(EMPTY_FILTERS); setQ(""); }}
            className="text-xs font-bold text-[#F47C3C] hover:underline justify-self-start"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
          <p className="text-sm font-bold text-[#0F253B] flex items-center gap-2">
            <Mail size={15} className="text-[#F47C3C]" /> Email Communication Log
          </p>
          <p className="text-xs font-medium text-gray-400">{visible.length} of {rows.length}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className={`${thClass} w-10`}>Sr#</th>
                <th className={thClass}>Property</th>
                <th className={thClass}>Date</th>
                <th className={thClass}>Email to</th>
                <th className={thClass}>Email from</th>
                <th className={thClass}>Issue</th>
                <th className={thClass}>Priority</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Reply</th>
                <th className={thClass}>Follow up</th>
                <th className={thClass}>Assigned</th>
                <th className={thClass}>Files</th>
                <th className={`${thClass} w-32 text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <EmptyRow colSpan={13} loading={loading} anyRows={rows.length > 0} emptyText="No email records yet" />
              ) : (
                visible.map((r, i) => {
                  const overdue = isOverdue(r);
                  const dueToday = isDueToday(r);
                  const Icon = CHANNEL_ICON[r.channel] || Mail;
                  return (
                    <tr key={r._id} className={`border-b border-gray-50 hover:bg-gray-50/50 align-top ${r.escalated ? "bg-red-50/40" : ""}`}>
                      <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-[#0F253B] min-w-[10rem]">
                        <button onClick={() => setPropertyHistory(r)} className="text-left hover:text-[#F47C3C]" title="Communication history for this property">
                          {r.property}
                        </button>
                        {r.tenantName && (
                          <button
                            onClick={() => openTenantFor(r)}
                            className="flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-[#F47C3C] mt-0.5"
                            title="Full conversation with this tenant"
                          >
                            <Users size={11} /> {r.tenantName}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-medium whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <Icon size={13} className="text-gray-300" /> {fmtDate(r.date)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#0F253B] font-medium">{r.emailTo || "—"}</td>
                      <td className="px-4 py-3 text-[#0F253B] font-medium">{r.emailFrom || "—"}</td>
                      <td className="px-4 py-3 text-[#0F253B] font-medium max-w-[18rem]">
                        <p className="line-clamp-2">{r.issue}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-1">
                          {r.category}{r.history?.length ? ` · ${r.history.length} in thread` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3"><Badge tone={PRIORITY_TONE[r.priority]}>{r.priority}</Badge></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                        {r.escalated && (
                          <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-600">
                            <AlertTriangle size={11} /> Escalated
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-medium max-w-[14rem]">
                        <p className={`line-clamp-2 ${r.replyReceived ? "" : "text-gray-300"}`}>{replyText(r)}</p>
                      </td>
                      <td className={`px-4 py-3 font-medium whitespace-nowrap ${overdue ? "text-red-600" : dueToday ? "text-[#F47C3C]" : "text-gray-500"}`}>
                        {r.followUpDate ? fmtDate(r.followUpDate) : "—"}
                        {overdue && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider">Overdue</span>}
                        {dueToday && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider">Today</span>}
                        {r.followUpNotes && <p className="text-[11px] text-gray-400 font-medium whitespace-normal line-clamp-1 max-w-[12rem]">{r.followUpNotes}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-medium">{r.assignedToEmail || "—"}</td>
                      <td className="px-4 py-3">
                        <FileStrip
                          files={filesOf(r.files)}
                          onOpen={() => setViewingFiles({ title: r.property, subtitle: `Email record · ${fmtDate(r.date)}`, files: filesOf(r.files) })}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <RowActions
                          onView={() => setViewingId(r._id)}
                          onEdit={() => setModal(r)}
                          onDelete={() => remove(r)}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {viewing && (
        <ViewModal
          row={viewing}
          options={options}
          onClose={() => setViewingId(null)}
          onEdit={(row) => { setViewingId(null); setModal(row); }}
          onOpenFiles={setViewingFiles}
          onChanged={replaceRow}
          onPropertyHistory={(row) => { setViewingId(null); setPropertyHistory(row); }}
          onTenantHistory={(row) => { setViewingId(null); openTenantFor(row); }}
        />
      )}

      {propertyHistory && (
        <PropertyHistoryModal
          anchor={propertyHistory}
          rows={rows}
          onClose={() => setPropertyHistory(null)}
          onOpen={(row) => { setPropertyHistory(null); setViewingId(row._id); }}
          onOpenFiles={setViewingFiles}
        />
      )}

      {tenantThread && (
        <TenantThreadModal
          key={tenantThread.key}
          tenant={tenantThread}
          initialMonth={filters.month}
          onClose={() => setTenantThreadKey(null)}
          onOpenRecord={(row) => { setTenantThreadKey(null); setViewingId(row._id); }}
          onOpenFiles={setViewingFiles}
        />
      )}

      {viewingFiles && (
        // Sits above whichever thread opened it, so closing it returns there.
        <div className="relative z-[60]">
          <MediaViewerModal
            title={viewingFiles.title}
            subtitle={viewingFiles.subtitle}
            files={viewingFiles.files}
            onClose={() => setViewingFiles(null)}
          />
        </div>
      )}

      {modal !== null && (
        <RecordModal
          initial={modal._id ? modal : null}
          properties={properties}
          members={members}
          tenancies={tenancies}
          options={options}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
