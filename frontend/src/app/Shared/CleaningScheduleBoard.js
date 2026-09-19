"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  X,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Eye,
  Download,
  Sparkles,
  CalendarDays,
  CheckCircle2,
  Circle,
  Refrigerator,
  WashingMachine,
  ClipboardCheck,
  Mail,
  Phone,
  MessageSquare,
  Send,
} from "lucide-react";
import { PageHeader, Badge } from "./ui";
import { MediaUploader, MediaViewerModal, AttachmentRow } from "./MediaAttachments";
import api from "@/app/api/api";
import {
  exportCleaningSheet,
  groupByMonth,
  fmtDate,
  dayName,
  monthKey,
  monthLabel,
} from "@/app/utils/cleaningSheet";
import { guardModalClose } from "@/app/Shared/modalGuard";

/* ------------------------------------------------------------------ *
 * The Cleaning Messages Schedule — the office's month-by-month sheet:
 *   # | Property | Day | Date | Status
 * Day and the month band are derived from the date, never stored, so the
 * sheet's usual failure (a weekday that no longer matches its date) can't
 * happen. MUST stay in sync with backend/models/CleaningSchedule.js.
 * ------------------------------------------------------------------ */

export const CLEANING_STATUSES = ["PENDING", "DONE"];
const STATUS_LABEL = { PENDING: "Pending", DONE: "Done" };

// Where a task stands against today's date. Derived, never stored — a stored
// "overdue" would be wrong by tomorrow morning. Done wins over everything;
// otherwise it is the date that decides.
export const TASK_STATES = ["UPCOMING", "DUE", "OVERDUE", "COMPLETED"];
const STATE_LABEL = {
  UPCOMING: "Upcoming",
  DUE: "Due today",
  OVERDUE: "Overdue",
  COMPLETED: "Completed",
};
const STATE_TONE = { UPCOMING: "blue", DUE: "amber", OVERDUE: "red", COMPLETED: "green" };

// The API stores UTC-midnight dates, so the day is read from the ISO string;
// today is the reader's own calendar day.
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const taskState = (row, today = todayKey()) => {
  if (row.status === "DONE") return "COMPLETED";
  const day = row.date ? new Date(row.date).toISOString().slice(0, 10) : "";
  if (!day) return "UPCOMING";
  if (day < today) return "OVERDUE";
  if (day === today) return "DUE";
  return "UPCOMING";
};

const communicationsOf = (row) =>
  Array.isArray(row?.communications) ? row.communications : [];

const CHANNELS = {
  message: { label: "Message", icon: MessageSquare, flag: "messageSent" },
  email: { label: "Email", icon: Mail, flag: "emailSent" },
  call: { label: "Call", icon: Phone, flag: "callMade" },
};

const fmtDateTime = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

// The sections the board is split into. Each tile across the top is one of
// these, read on its own — the way the compliance register is read one
// certificate type at a time. "Cleaning Schedule" is the general list and the
// one shown by default.
// MUST stay in sync with CLEANING_CATEGORIES in
// backend/models/CleaningSchedule.js.
export const CLEANING_CATEGORIES = [
  "Cleaning Schedule",
  "Self Inspection",
  "Fridge Cleaning",
  "Washing Machine Descaling",
];

// Rows written before categories existed have none — they read as the general
// "Cleaning Schedule", matching the schema default.
const DEFAULT_CATEGORY = "Cleaning Schedule";
const categoryOf = (row) =>
  CLEANING_CATEGORIES.includes(row?.category) ? row.category : DEFAULT_CATEGORY;

const CATEGORY_ICON = {
  "Cleaning Schedule": Sparkles,
  "Self Inspection": ClipboardCheck,
  "Fridge Cleaning": Refrigerator,
  "Washing Machine Descaling": WashingMachine,
};

const CATEGORY_TONE = {
  "Cleaning Schedule": "gray",
  "Self Inspection": "orange",
  "Fridge Cleaning": "blue",
  "Washing Machine Descaling": "amber",
};

// The table has no room for the longer names in full.
const CATEGORY_SHORT = {
  "Cleaning Schedule": "Schedule",
  "Self Inspection": "Inspection",
  "Fridge Cleaning": "Fridge",
  "Washing Machine Descaling": "Descaling",
};

// Only Self Inspection entries record the name of the person who did it.
const NAMED_CATEGORY = "Self Inspection";

const filesOf = (row) => (Array.isArray(row?.files) ? row.files : []);

// One row against the search box. Pulled out of the filter chain because the
// category tiles need to count against exactly the same test the table uses.
const matchesSearch = (row, needle) =>
  [
    row.property,
    row.room,
    categoryOf(row),
    row.notes,
    row.inspectorName,
    dayName(row.date),
    ...filesOf(row).map((f) => f.name),
  ].some((v) => String(v || "").toLowerCase().includes(needle));

const FIELD =
  "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

const toInputDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* ------------------------------------------------------------------ *
 * Add / edit one visit
 * ------------------------------------------------------------------ */
function EntryModal({ initial, properties, defaultCategory, onClose, onSave }) {
  const isEdit = Boolean(initial?._id);

  const [form, setForm] = useState({
    propertyId: initial?.propertyId || "",
    property: initial?.property || "",
    category: CLEANING_CATEGORIES.includes(initial?.category)
      ? initial.category
      : defaultCategory,
    date: toInputDate(initial?.date) || toInputDate(new Date()),
    status: initial?.status || "PENDING",
    messageSent: Boolean(initial?.messageSent),
    callMade: Boolean(initial?.callMade),
    emailSent: Boolean(initial?.emailSent),
    notes: initial?.notes || "",
    inspectorName: initial?.inspectorName || "",
  });

  // The evidence for the visit. Kept out of `form` because the uploader appends
  // to it asynchronously while the rest of the form is being typed.
  const [files, setFiles] = useState(() =>
    Array.isArray(initial?.files) ? initial.files : []
  );
  const [uploadingCount, setUploadingCount] = useState(0);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (k) => () => setForm((f) => ({ ...f, [k]: !f[k] }));

  // Picking from the portfolio fills the address; the field stays editable
  // because the sheet carries addresses that aren't property records yet.
  const onPropertyPick = (e) => {
    const propertyId = e.target.value;
    const name = properties.find((p) => p._id === propertyId)?.name || "";
    setForm((f) => ({ ...f, propertyId, property: name || f.property }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.property.trim()) { setError("Property is required"); return; }
    if (!form.date) { setError("Date is required"); return; }
    // Saving mid-upload would drop whatever has not landed yet.
    if (uploadingCount) { setError("Wait for the uploads to finish"); return; }

    setSaving(true);
    setError("");
    try {
      await onSave({
        propertyId: form.propertyId || null,
        property: form.property.trim(),
        category: form.category,
        date: form.date,
        status: form.status,
        messageSent: form.messageSent,
        callMade: form.callMade,
        emailSent: form.emailSent,
        notes: form.notes.trim(),
        ...(form.category === NAMED_CATEGORY
          ? { inspectorName: form.inspectorName.trim() }
          : {}),
        files,
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={guardModalClose(onClose)}>
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold text-[#0F253B]">
              {isEdit ? "Edit Cleaning Entry" : "New Cleaning Entry"}
            </h3>
            <p className="text-xs text-gray-400 font-medium">Which property, which day, and whether it is done</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={LABEL}>Pick from portfolio</label>
            <select className={FIELD} value={form.propertyId} onChange={onPropertyPick}>
              <option value="">Not linked — type the address below</option>
              {properties.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL}>Property</label>
            <input
              className={FIELD}
              value={form.property}
              onChange={set("property")}
              placeholder="e.g. 7 Exeter Road NW2 4SJ"
              required
            />
          </div>

          {form.category === NAMED_CATEGORY && (
            <div>
              <label className={LABEL}>Name (optional)</label>
              <input
                className={FIELD}
                value={form.inspectorName}
                onChange={set("inspectorName")}
                placeholder="Who did the self inspection"
              />
            </div>
          )}

          {/* The section this entry belongs to is set by the card selected on
              the board, so the form does not ask again. */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Date</label>
              <input type="date" className={FIELD} value={form.date} onChange={set("date")} required />
              {form.date && (
                <p className="text-[11px] text-gray-400 font-medium mt-1.5">{dayName(form.date)}</p>
              )}
            </div>
            <div>
              <label className={LABEL}>Status</label>
              <select className={FIELD} value={form.status} onChange={set("status")}>
                {CLEANING_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Call and Message are tracked separately — each is its own labelled
              tick, styled like the Done toggle. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Call</label>
              <button
                type="button"
                onClick={toggle("callMade")}
                className={`w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                  form.callMade
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100"
                }`}
              >
                {form.callMade ? (
                  <CheckCircle2 size={15} className="text-emerald-600" />
                ) : (
                  <Circle size={15} className="text-gray-300" />
                )}
                Call
              </button>
            </div>
            <div>
              <label className={LABEL}>Message</label>
              <button
                type="button"
                onClick={toggle("messageSent")}
                className={`w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                  form.messageSent
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100"
                }`}
              >
                {form.messageSent ? (
                  <CheckCircle2 size={15} className="text-emerald-600" />
                ) : (
                  <Circle size={15} className="text-gray-300" />
                )}
                Message
              </button>
            </div>
            <div>
              <label className={LABEL}>Email</label>
              <button
                type="button"
                onClick={toggle("emailSent")}
                className={`w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                  form.emailSent
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100"
                }`}
              >
                {form.emailSent ? (
                  <CheckCircle2 size={15} className="text-emerald-600" />
                ) : (
                  <Circle size={15} className="text-gray-300" />
                )}
                Email
              </button>
            </div>
          </div>

          <div>
            <label className={LABEL}>Notes</label>
            <textarea rows={2} className={FIELD} value={form.notes} onChange={set("notes")} placeholder="Access, keys, anything to flag…" />
          </div>

          {/* The proof the visit happened: photos of the cleaned fridge, a clip
              of the machine on its descale cycle, a signed inspection sheet. */}
          <MediaUploader
            files={files}
            onChange={setFiles}
            onUploadingChange={setUploadingCount}
            label="Photos, video & documents"
            hint="Drop files here, or click to choose — photos, video, PDFs, any file type"
          />

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all active:scale-[0.98]"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Entry"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Read-only detail
 * ------------------------------------------------------------------ */
function ViewRow({ label, children }) {
  return (
    <div>
      <p className={LABEL}>{label}</p>
      <p className="text-sm font-semibold text-[#0F253B] break-words">{children || "—"}</p>
    </div>
  );
}

function ViewModal({ row, onClose, onEdit, onViewFiles, onContact }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={guardModalClose(onClose)}>
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5 gap-4">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-[#0F253B] break-words">{row.property}</h3>
            <p className="text-xs text-gray-400 font-medium">
              {fmtDate(row.date)} · {dayName(row.date)}
              {row.room ? ` · ${row.room}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge tone={CATEGORY_TONE[categoryOf(row)] || "gray"}>{categoryOf(row)}</Badge>
            <Badge tone={STATE_TONE[taskState(row)]}>{STATE_LABEL[taskState(row)]}</Badge>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <ViewRow label="Month">{monthLabel(monthKey(row.date))}</ViewRow>
          <ViewRow label="Next due">{fmtDate(row.nextDueDate)}</ViewRow>
          {categoryOf(row) === NAMED_CATEGORY && (
            <ViewRow label="Name">{row.inspectorName}</ViewRow>
          )}
          <ViewRow label="Call">
            <span className="flex items-center gap-1.5">
              {row.callMade ? (
                <CheckCircle2 size={15} className="text-emerald-600" />
              ) : (
                <Circle size={15} className="text-gray-300" />
              )}
              Call
            </span>
          </ViewRow>
          <ViewRow label="Message">
            <span className="flex items-center gap-1.5">
              {row.messageSent ? (
                <CheckCircle2 size={15} className="text-emerald-600" />
              ) : (
                <Circle size={15} className="text-gray-300" />
              )}
              Message
            </span>
          </ViewRow>
          <ViewRow label="Email">
            <span className="flex items-center gap-1.5">
              {row.emailSent ? (
                <CheckCircle2 size={15} className="text-emerald-600" />
              ) : (
                <Circle size={15} className="text-gray-300" />
              )}
              Email
            </span>
          </ViewRow>
        </div>

        {communicationsOf(row).length > 0 && (
          <div className="mt-5">
            <p className={LABEL}>Communication history</p>
            <CommHistory items={communicationsOf(row)} />
          </div>
        )}

        {row.notes && (
          <div className="mt-5">
            <p className={LABEL}>Notes</p>
            <p className="text-sm text-gray-500 font-medium whitespace-pre-line leading-relaxed">{row.notes}</p>
          </div>
        )}

        {filesOf(row).length > 0 && (
          <div className="mt-5">
            <p className={LABEL}>Attachments</p>
            <div className="space-y-2">
              {filesOf(row).map((f, i) => (
                <AttachmentRow key={(f.url || "") + i} file={f} />
              ))}
            </div>
            <button
              type="button"
              onClick={() => onViewFiles(row)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#F47C3C] hover:underline"
            >
              <Eye size={13} /> Open the viewer
            </button>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => onContact(row)}
            className="px-4 py-3 bg-[#0F253B] hover:bg-[#0b1c2d] text-white font-bold rounded-xl transition-all flex items-center gap-2"
          >
            <Send size={16} /> Contact
          </button>
          <button
            onClick={() => onEdit(row)}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98]"
          >
            <Pencil size={16} /> Edit Entry
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-100 text-[#0F253B] font-bold rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Communication — message, email or call about one visit, with the history
 * ------------------------------------------------------------------ */
function CommHistory({ items }) {
  // Newest first — what was last said is what the next person needs.
  const ordered = [...items].sort((a, b) => new Date(b.at) - new Date(a.at));

  return (
    <div className="space-y-2">
      {ordered.map((c, i) => {
        const ch = CHANNELS[c.channel] || CHANNELS.message;
        const Icon = ch.icon;
        return (
          <div key={c._id || i} className="flex gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-white text-[#F47C3C] flex items-center justify-center">
              <Icon size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#0F253B]">
                {ch.label}
                {c.to ? ` · ${c.to}` : ""}
                <span className="ml-2 font-medium text-gray-400">
                  {fmtDateTime(c.at)}
                  {c.byName ? ` · ${c.byName}` : ""}
                </span>
              </p>
              {c.subject && <p className="text-xs font-semibold text-gray-500 break-words">{c.subject}</p>}
              {c.message && (
                <p className="text-xs text-gray-500 whitespace-pre-line break-words mt-0.5">{c.message}</p>
              )}
              {c.note && (
                <p className="text-xs text-[#0F253B] font-medium whitespace-pre-line break-words mt-1">
                  Note: {c.note}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CommModal({ row, onClose, onRecorded }) {
  const [channel, setChannel] = useState("message");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const defaultMessage = `Hi, this is a reminder that the ${categoryOf(row).toLowerCase()} for ${row.property}${
    row.room ? ` (${row.room})` : ""
  } is scheduled for ${dayName(row.date)} ${fmtDate(row.date)}.`;

  // Recipients are remembered per channel from the last contact on this record,
  // so chasing the same person twice doesn't mean typing the number twice.
  const lastTo = (c) =>
    [...communicationsOf(row)].reverse().find((x) => x.channel === c && x.to)?.to || "";
  const [form, setForm] = useState({
    to: { message: lastTo("message"), email: lastTo("email"), call: lastTo("call") },
    subject: `${categoryOf(row)} — ${row.property}`,
    message: defaultMessage,
    note: "",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setTo = (e) => setForm((f) => ({ ...f, to: { ...f.to, [channel]: e.target.value } }));
  const to = form.to[channel];

  const record = async ({ open }) => {
    if (!to.trim()) {
      setError(channel === "email" ? "Enter an email address" : "Enter a phone number");
      return;
    }
    setBusy(true);
    setError("");
    try {
      // The email is sent by the server, so it is only recorded if it went.
      // Messages and calls happen on this device: open the app, then record.
      if (open && channel === "message") {
        window.open(`sms:${to.trim()}?body=${encodeURIComponent(form.message)}`, "_self");
      } else if (open && channel === "call") {
        window.open(`tel:${to.trim()}`, "_self");
      }

      const res = await api.post(`/cleaning-schedule/${row._id}/communications`, {
        channel,
        to: to.trim(),
        subject: channel === "email" ? form.subject : "",
        message: channel === "call" ? "" : form.message,
        note: form.note,
        send: channel === "email" ? open : false,
      });
      onRecorded(res.data.data);
      setForm((f) => ({ ...f, note: "" }));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to record the communication");
    } finally {
      setBusy(false);
    }
  };

  const items = communicationsOf(row);
  const mainLabel =
    channel === "email" ? "Send email" : channel === "call" ? "Call & record" : "Open messages & record";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={guardModalClose(onClose)}>
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5 gap-4">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-[#0F253B]">Contact</h3>
            <p className="text-xs text-gray-400 font-medium break-words">
              {row.property}
              {row.room ? ` · ${row.room}` : ""} · {categoryOf(row)} · {fmtDate(row.date)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-4">
          {Object.entries(CHANNELS).map(([key, ch]) => {
            const Icon = ch.icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => { setChannel(key); setError(""); }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                  channel === key
                    ? "bg-[#0F253B] text-white border-[#0F253B]"
                    : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100"
                }`}
              >
                <Icon size={15} /> {ch.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          <div>
            <label className={LABEL}>{channel === "email" ? "Email address" : "Phone number"}</label>
            <input
              className={FIELD}
              type={channel === "email" ? "email" : "tel"}
              value={to}
              onChange={setTo}
              placeholder={channel === "email" ? "name@example.com" : "+44 7…"}
            />
          </div>

          {channel === "email" && (
            <div>
              <label className={LABEL}>Subject</label>
              <input className={FIELD} value={form.subject} onChange={set("subject")} />
            </div>
          )}

          {channel !== "call" && (
            <div>
              <label className={LABEL}>{channel === "email" ? "Email" : "Message"}</label>
              <textarea rows={4} className={FIELD} value={form.message} onChange={set("message")} />
            </div>
          )}

          <div>
            <label className={LABEL}>Notes for the record</label>
            <textarea
              rows={2}
              className={FIELD}
              value={form.note}
              onChange={set("note")}
              placeholder={channel === "call" ? "What was agreed on the call…" : "Anything worth remembering…"}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => record({ open: true })}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#F47C3C] hover:bg-[#e06d30] disabled:opacity-50 text-white font-bold rounded-xl transition-all active:scale-[0.98]"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {mainLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => record({ open: false })}
              title="Save this to the history without sending or opening anything"
              className="px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-100 text-[#0F253B] disabled:opacity-50 font-bold rounded-xl transition-all"
            >
              Record only
            </button>
          </div>
        </div>

        <div className="mt-6">
          <p className={LABEL}>History</p>
          {items.length ? (
            <CommHistory items={items} />
          ) : (
            <p className="text-xs text-gray-400 font-medium">Nothing recorded for this visit yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Board
 * ------------------------------------------------------------------ */
export default function CleaningScheduleBoard({
  subtitle = "Which property is cleaned, when, and whether it is done",
}) {
  const [rows, setRows] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [month, setMonth] = useState("");
  // "" or one of TASK_STATES — the upcoming / due / overdue / completed tiles.
  const [stateFilter, setStateFilter] = useState("");
  // "All" or one of CLEANING_CATEGORIES — the tiles across the top.
  const [category, setCategory] = useState(DEFAULT_CATEGORY);

  const [modal, setModal] = useState(null); // {} = create, row = edit
  const [viewing, setViewing] = useState(null);
  // The row being contacted. Held as an id so the panel always shows the live
  // row, and its history grows as contacts are recorded.
  const [contactId, setContactId] = useState(null);
  // The row whose attachments are open in the media viewer.
  const [viewingFiles, setViewingFiles] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [listRes, propsRes] = await Promise.all([
        api.get("/cleaning-schedule"),
        api.get("/properties", { params: { limit: 200 } }),
      ]);
      setRows(listRes.data.data || []);
      setProperties(propsRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load cleaning schedule");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Month options come from the rows themselves, so the picker only ever
  // offers months that exist.
  const months = useMemo(() => {
    const seen = new Set(rows.map((r) => monthKey(r.date)).filter(Boolean));
    return [...seen].sort().reverse();
  }, [rows]);

  // Counts for the tiles. Deliberately computed BEFORE the category filter and
  // after the others, so each tile reports what it would show under the search,
  // month and status currently set — a tile whose count is 0 is genuinely empty
  // under these filters rather than merely not selected.
  const categoryCounts = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const today = todayKey();
    const base = rows
      .filter((r) => (month ? monthKey(r.date) === month : true))
      .filter((r) => (stateFilter ? taskState(r, today) === stateFilter : true))
      .filter((r) => (needle ? matchesSearch(r, needle) : true));

    const counts = {};
    for (const c of CLEANING_CATEGORIES) counts[c] = { total: 0, done: 0 };

    for (const r of base) {
      const c = categoryOf(r);
      counts[c].total++;
      if (r.status === "DONE") counts[c].done++;
    }
    return counts;
  }, [rows, q, month, stateFilter]);

  // The state tiles count within the selected category, month and search, but
  // not within the state itself — otherwise picking "Overdue" would zero the
  // other three and leave nowhere to go.
  const stateCounts = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const today = todayKey();
    const counts = { UPCOMING: 0, DUE: 0, OVERDUE: 0, COMPLETED: 0 };
    for (const r of rows) {
      if (categoryOf(r) !== category) continue;
      if (month && monthKey(r.date) !== month) continue;
      if (needle && !matchesSearch(r, needle)) continue;
      counts[taskState(r, today)]++;
    }
    return counts;
  }, [rows, q, month, category]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const today = todayKey();
    return rows
      .filter((r) => (month ? monthKey(r.date) === month : true))
      .filter((r) => (stateFilter ? taskState(r, today) === stateFilter : true))
      .filter((r) => categoryOf(r) === category)
      .filter((r) => (needle ? matchesSearch(r, needle) : true));
  }, [rows, q, month, stateFilter, category]);

  const groups = useMemo(() => groupByMonth(visible), [visible]);

  const save = async (payload) => {
    if (modal?._id) await api.put(`/cleaning-schedule/${modal._id}`, payload);
    else await api.post("/cleaning-schedule", payload);
    setModal(null);
    await load();
  };

  const remove = async (row) => {
    if (!confirm(`Delete the ${fmtDate(row.date)} clean for "${row.property}"?`)) return;
    const snapshot = rows;
    setViewing((v) => (v?._id === row._id ? null : v));
    setRows((prev) => prev.filter((r) => r._id !== row._id));
    try {
      await api.delete(`/cleaning-schedule/${row._id}`);
      await load();
    } catch (err) {
      setRows(snapshot);
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  // The Done column is the one the office ticks all day, so it toggles in place.
  const toggleStatus = async (row) => {
    const status = row.status === "DONE" ? "PENDING" : "DONE";
    const snapshot = rows;
    setRows((prev) => prev.map((r) => (r._id === row._id ? { ...r, status } : r)));
    try {
      const res = await api.patch(`/cleaning-schedule/${row._id}/status`, { status });
      // Finishing a repeat task puts the next one on the board.
      if (res.data?.generated > 0) await load();
    } catch (err) {
      setRows(snapshot);
      alert(err.response?.data?.message || "Failed to update status");
    }
  };

  const exportSheet = async () => {
    setExporting(true);
    try {
      await exportCleaningSheet(visible);
    } catch (err) {
      alert(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const recordCommunication = (updated) =>
    setRows((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));

  const contactRow = contactId ? rows.find((r) => r._id === contactId) : null;

  // Each tile is also the filter for that state; clicking the active one clears it.
  const cards = [
    { state: "UPCOMING", tone: "text-blue-600" },
    { state: "DUE", tone: "text-amber-600" },
    { state: "OVERDUE", tone: "text-red-600" },
    { state: "COMPLETED", tone: "text-emerald-600" },
  ];

  // One tile per section — the register's own tabs.
  const categoryTiles = CLEANING_CATEGORIES;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cleaning Schedule"
        subtitle={subtitle}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={exportSheet}
              disabled={exporting || visible.length === 0}
              title={visible.length === 0 ? "Nothing to export" : "Export what this sheet is showing"}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-100 text-[#0F253B] font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              Export
            </button>
            <button
              onClick={() => setModal({})}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              <Plus size={18} /> New Entry
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {cards.map((s) => {
          const selected = stateFilter === s.state;
          return (
            <button
              key={s.state}
              onClick={() => setStateFilter(selected ? "" : s.state)}
              className={`text-left bg-white border rounded-2xl p-4 transition-all ${
                selected ? "border-[#0F253B] ring-2 ring-[#0F253B]/10" : "border-gray-100 hover:bg-gray-50"
              }`}
            >
              <p className={`text-2xl font-bold ${s.tone}`}>{loading ? "—" : stateCounts[s.state]}</p>
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mt-1">
                {STATE_LABEL[s.state]}
              </p>
            </button>
          );
        })}
      </div>

      {/* The register's tabs — one per job, with what each holds under the
          filters currently set. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {categoryTiles.map((c) => {
          const Icon = CATEGORY_ICON[c] || Sparkles;
          const stat = categoryCounts[c] || { total: 0, done: 0 };
          const selected = category === c;

          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-between min-h-[86px] ${
                selected
                  ? "bg-[#0F253B] text-white border-[#0F253B] shadow-sm"
                  : stat.total > 0
                  ? "bg-white text-[#0F253B] border-gray-100 hover:bg-gray-50 shadow-sm"
                  : "bg-white text-gray-400 border-gray-100 hover:bg-gray-50"
              }`}
            >
              <Icon size={16} className={selected ? "text-[#F47C3C]" : "text-gray-300"} />
              <span className="text-xl font-bold tracking-tight block">
                {loading ? "—" : stat.total}
              </span>
              <span className="text-[9px] font-bold block uppercase tracking-wider break-words w-full leading-tight">
                {c}
              </span>
              <span
                className={`text-[9px] font-semibold ${
                  selected ? "text-white/60" : "text-gray-400"
                }`}
              >
                {loading ? "" : `${stat.done} done`}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search property, day…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>

        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
        >
          <option value="">All months</option>
          {months.map((m) => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
        </select>

        <div className="flex gap-2 flex-wrap">
          {[["", "All"], ...TASK_STATES.map((s) => [s, STATE_LABEL[s]])].map(([v, l]) => (
            <button
              key={v || "all"}
              onClick={() => setStateFilter(v)}
              className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all ${
                stateFilter === v
                  ? "bg-[#0F253B] text-white border-[#0F253B]"
                  : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {/* The sheet's own title band */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/70">
          <p className="text-sm font-bold text-[#0F253B] flex items-center gap-2">
            <Sparkles size={15} className="text-[#F47C3C]" /> Cleaning Messages Schedule
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3 w-36">Category</th>
                <th className="px-4 py-3 w-32">Day</th>
                <th className="px-4 py-3 w-32">Date</th>
                <th className="px-4 py-3 w-36">Status</th>
                <th className="px-4 py-3 w-32">Next due</th>
                <th className="px-4 py-3 w-36">Contact</th>
                <th className="px-4 py-3 w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin inline text-[#F47C3C]" /></td></tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-14">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 rounded-2xl bg-gray-50 text-[#F47C3C] flex items-center justify-center mb-3">
                        <CalendarDays size={22} />
                      </div>
                      <p className="text-gray-500 font-medium">
                        {rows.length === 0 ? "No cleans scheduled yet" : "No entries match these filters"}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        {rows.length === 0
                          ? "Add an entry for the property and the day it is cleaned."
                          : "Try another category, or clear the search and month filter."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <FragmentGroup
                    key={group.month || "undated"}
                    group={group}
                    onView={setViewing}
                    onEdit={setModal}
                    onDelete={remove}
                    onToggle={toggleStatus}
                    onContact={(r) => setContactId(r._id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && (
        <ViewModal
          row={viewing}
          onClose={() => setViewing(null)}
          onEdit={(row) => { setViewing(null); setModal(row); }}
          // Swap to the viewer rather than stacking it over the detail panel.
          onViewFiles={(row) => { setViewing(null); setViewingFiles(row); }}
          onContact={(row) => { setViewing(null); setContactId(row._id); }}
        />
      )}

      {contactRow && (
        <CommModal
          key={contactRow._id}
          row={contactRow}
          onClose={() => setContactId(null)}
          onRecorded={recordCommunication}
        />
      )}

      {/* Keyed on the row so opening a different one mounts a fresh viewer,
          which resets it to the first attachment. */}
      {viewingFiles && (
        <MediaViewerModal
          key={viewingFiles._id}
          title={viewingFiles.property}
          subtitle={`${categoryOf(viewingFiles)} · ${fmtDate(viewingFiles.date)}`}
          files={filesOf(viewingFiles)}
          onClose={() => setViewingFiles(null)}
        />
      )}

      {modal !== null && (
        <EntryModal
          initial={modal._id ? modal : null}
          properties={properties}
          // A new entry belongs to whichever section the board is showing.
          defaultCategory={category}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

// One month block — the band, then its rows, as the sheet prints it.
function FragmentGroup({ group, onView, onEdit, onDelete, onToggle, onContact }) {
  const done = group.rows.filter((r) => r.status === "DONE").length;
  return (
    <>
      <tr className="bg-[#0F253B]/[0.03] border-y border-gray-100">
        <td colSpan={9} className="px-4 py-2">
          <p className="text-xs font-bold uppercase tracking-widest text-[#0F253B]">
            {group.label || "Undated"}
            <span className="ml-2 font-medium normal-case tracking-normal text-gray-400">
              {done}/{group.rows.length} done
            </span>
          </p>
        </td>
      </tr>
      {group.rows.map((r, i) => (
        <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50/50">
          <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
          <td className="px-4 py-3">
            <p className="font-semibold text-[#0F253B]">{r.property}</p>
            {r.room && <p className="text-[11px] font-bold text-gray-500">{r.room}</p>}
            {r.inspectorName && (
              <p className="text-[11px] font-bold text-[#F47C3C]">{r.inspectorName}</p>
            )}
            {r.notes && <p className="text-[11px] font-medium text-gray-400 truncate max-w-md">{r.notes}</p>}
          </td>
          <td className="px-4 py-3">
            <Badge tone={CATEGORY_TONE[categoryOf(r)] || "gray"}>
              {CATEGORY_SHORT[categoryOf(r)] || categoryOf(r)}
            </Badge>
          </td>
          <td className="px-4 py-3 text-gray-500 font-medium">{dayName(r.date)}</td>
          <td className="px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{fmtDate(r.date)}</td>
          <td className="px-4 py-3">
            <button
              onClick={() => onToggle(r)}
              title={r.status === "DONE" ? "Mark as pending" : "Mark as done"}
              className="flex items-center gap-1.5"
            >
              {r.status === "DONE" ? (
                <CheckCircle2 size={15} className="text-emerald-600" />
              ) : (
                <Circle size={15} className="text-gray-300" />
              )}
              <Badge tone={STATE_TONE[taskState(r)]}>{STATE_LABEL[taskState(r)]}</Badge>
            </button>
          </td>
          <td className="px-4 py-3 text-gray-500 font-medium whitespace-nowrap">
            {r.nextDueDate ? fmtDate(r.nextDueDate) : "—"}
          </td>
          <td className="px-4 py-3">
            {/* Message, email, call — lit once that channel has been used on
                this visit. Any of them opens the contact panel. */}
            <button
              onClick={() => onContact(r)}
              title={
                communicationsOf(r).length
                  ? `${communicationsOf(r).length} recorded — open contact history`
                  : "Message, email or call"
              }
              className="flex items-center gap-1 p-1.5 -m-1.5 rounded-lg hover:bg-gray-100"
            >
              {Object.entries(CHANNELS).map(([key, ch]) => {
                const Icon = ch.icon;
                return (
                  <span
                    key={key}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      r[ch.flag] ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-300"
                    }`}
                  >
                    <Icon size={14} />
                  </span>
                );
              })}
              {communicationsOf(r).length > 0 && (
                <span className="text-[11px] font-bold text-gray-400 ml-0.5">{communicationsOf(r).length}</span>
              )}
            </button>
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => onView(r)} title="View" className="p-2 text-gray-400 hover:text-[#0F253B] hover:bg-gray-100 rounded-lg"><Eye size={16} /></button>
              <button onClick={() => onEdit(r)} title="Edit" className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg"><Pencil size={16} /></button>
              <button onClick={() => onDelete(r)} title="Delete" className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
