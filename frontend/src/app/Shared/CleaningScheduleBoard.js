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
  Building2,
  CheckCircle2,
  Circle,
  Mail,
  Phone,
  Paperclip,
  Refrigerator,
  WashingMachine,
  ClipboardCheck,
  LayoutGrid,
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
 *   Property | Date | Day | Status
 * Day and the month band are derived from the date, never stored, so the
 * sheet's usual failure (a weekday that no longer matches its date) can't
 * happen. MUST stay in sync with backend/models/CleaningSchedule.js.
 * ------------------------------------------------------------------ */

export const CLEANING_STATUSES = ["PENDING", "DONE"];
const STATUS_LABEL = { PENDING: "Pending", DONE: "Done" };
const STATUS_TONE = { PENDING: "amber", DONE: "green" };

// The three jobs the office runs on its properties. The board is read one
// category at a time from the tiles across the top, the way the compliance
// register is read one certificate type at a time.
// MUST stay in sync with CLEANING_CATEGORIES in
// backend/models/CleaningSchedule.js.
export const CLEANING_CATEGORIES = [
  "Fridge Cleaning",
  "Washing Machine Descaling",
  "Self Inspection",
];

// Rows written before categories existed have none — they read as the category
// the sheet was overwhelmingly used for, matching the schema default.
const DEFAULT_CATEGORY = "Fridge Cleaning";
const categoryOf = (row) =>
  CLEANING_CATEGORIES.includes(row?.category) ? row.category : DEFAULT_CATEGORY;

const CATEGORY_ICON = {
  "Fridge Cleaning": Refrigerator,
  "Washing Machine Descaling": WashingMachine,
  "Self Inspection": ClipboardCheck,
};

const CATEGORY_TONE = {
  "Fridge Cleaning": "blue",
  "Washing Machine Descaling": "amber",
  "Self Inspection": "orange",
};

// The table has no room for "Washing Machine Descaling" in full.
const CATEGORY_SHORT = {
  "Fridge Cleaning": "Fridge",
  "Washing Machine Descaling": "Descaling",
  "Self Inspection": "Inspection",
};

const filesOf = (row) => (Array.isArray(row?.files) ? row.files : []);

// One row against the search box. Pulled out of the filter chain because the
// category tiles need to count against exactly the same test the table uses.
const matchesSearch = (row, needle) =>
  [
    row.property,
    categoryOf(row),
    row.message,
    row.notes,
    row.contactEmail,
    row.contactPhone,
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
    emailSent: Boolean(initial?.emailSent),
    callMade: Boolean(initial?.callMade),
    contactEmail: initial?.contactEmail || "",
    contactPhone: initial?.contactPhone || "",
    message: initial?.message || "",
    notes: initial?.notes || "",
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
    if (form.emailSent && !form.contactEmail.trim()) {
      setError("Add the email address the message was sent to");
      return;
    }
    if (form.callMade && !form.contactPhone.trim()) {
      setError("Add the number that was called");
      return;
    }
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
        emailSent: form.emailSent,
        callMade: form.callMade,
        // Only keep the detail for the channel that was actually used.
        contactEmail: form.emailSent ? form.contactEmail.trim() : "",
        contactPhone: form.callMade ? form.contactPhone.trim() : "",
        message: form.message.trim(),
        notes: form.notes.trim(),
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

          {/* Which of the three jobs this is. Buttons rather than a select:
              there are only three, and the icon says which at a glance. */}
          <div>
            <label className={LABEL}>Category</label>
            <div className="grid grid-cols-3 gap-2">
              {CLEANING_CATEGORIES.map((c) => {
                const Icon = CATEGORY_ICON[c];
                const active = form.category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, category: c }))}
                    className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border text-center transition-all ${
                      active
                        ? "bg-[#0F253B] text-white border-[#0F253B] shadow-sm"
                        : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100"
                    }`}
                  >
                    <Icon size={18} className={active ? "text-[#F47C3C]" : "text-gray-400"} />
                    <span className="text-[10px] font-bold uppercase tracking-wider leading-tight">
                      {c}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

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

          <div>
            <label className={LABEL}>Contact</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggle("emailSent")}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                  form.emailSent
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100"
                }`}
              >
                {form.emailSent ? <CheckCircle2 size={15} /> : <Mail size={15} />}
                Email sent
              </button>
              <button
                type="button"
                onClick={toggle("callMade")}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                  form.callMade
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100"
                }`}
              >
                {form.callMade ? <CheckCircle2 size={15} /> : <Phone size={15} />}
                Call made
              </button>
            </div>

            {(form.emailSent || form.callMade) && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {form.emailSent && (
                  <input
                    type="email"
                    className={FIELD}
                    value={form.contactEmail}
                    onChange={set("contactEmail")}
                    placeholder="Email address the message went to"
                  />
                )}
                {form.callMade && (
                  <input
                    type="tel"
                    className={FIELD}
                    value={form.contactPhone}
                    onChange={set("contactPhone")}
                    placeholder="Number that was called"
                  />
                )}
              </div>
            )}
          </div>

          <div>
            <label className={LABEL}>Message</label>
            <textarea
              rows={3}
              className={FIELD}
              value={form.message}
              onChange={set("message")}
              placeholder="The cleaning message for this visit…"
            />
            <p className="text-[11px] text-gray-400 font-medium mt-1.5">
              What goes out to the cleaner. Notes below stay in the office.
            </p>
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

function ViewModal({ row, onClose, onEdit, onViewFiles }) {
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
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge tone={CATEGORY_TONE[categoryOf(row)] || "gray"}>{categoryOf(row)}</Badge>
            <Badge tone={STATUS_TONE[row.status] || "gray"}>{STATUS_LABEL[row.status] || row.status}</Badge>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ViewRow label="Month">{monthLabel(monthKey(row.date))}</ViewRow>
          <ViewRow label="Contact">
            {[
              row.emailSent && `Email sent${row.contactEmail ? ` — ${row.contactEmail}` : ""}`,
              row.callMade && `Call made${row.contactPhone ? ` — ${row.contactPhone}` : ""}`,
            ]
              .filter(Boolean)
              .join(" · ") || "None yet"}
          </ViewRow>
        </div>

        {row.message && (
          <div className="mt-5">
            <p className={LABEL}>Message</p>
            <p className="text-sm text-[#0F253B] font-medium whitespace-pre-line leading-relaxed bg-gray-50 border border-gray-100 rounded-xl px-3.5 py-3">
              {row.message}
            </p>
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
  const [statusFilter, setStatusFilter] = useState("");
  // "All" or one of CLEANING_CATEGORIES — the tiles across the top.
  const [category, setCategory] = useState("All");

  const [modal, setModal] = useState(null); // {} = create, row = edit
  const [viewing, setViewing] = useState(null);
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
    const base = rows
      .filter((r) => (month ? monthKey(r.date) === month : true))
      .filter((r) => (statusFilter ? r.status === statusFilter : true))
      .filter((r) => (needle ? matchesSearch(r, needle) : true));

    const counts = { All: { total: base.length, done: 0 } };
    for (const c of CLEANING_CATEGORIES) counts[c] = { total: 0, done: 0 };

    for (const r of base) {
      const c = categoryOf(r);
      counts[c].total++;
      if (r.status === "DONE") {
        counts[c].done++;
        counts.All.done++;
      }
    }
    return counts;
  }, [rows, q, month, statusFilter]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => (month ? monthKey(r.date) === month : true))
      .filter((r) => (statusFilter ? r.status === statusFilter : true))
      .filter((r) => (category === "All" ? true : categoryOf(r) === category))
      .filter((r) => (needle ? matchesSearch(r, needle) : true));
  }, [rows, q, month, statusFilter, category]);

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
      await api.patch(`/cleaning-schedule/${row._id}/status`, { status });
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

  const doneCount = visible.filter((r) => r.status === "DONE").length;
  const cards = [
    { label: "Entries", value: visible.length },
    { label: "Done", value: doneCount },
    { label: "Pending", value: visible.length - doneCount },
    { label: "Months", value: months.length },
  ];

  // "All" plus the three jobs, as the register's own tabs.
  const categoryTiles = ["All", ...CLEANING_CATEGORIES];

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
        {cards.map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-2xl font-bold text-[#0F253B]">{loading ? "—" : s.value}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* The register's tabs — one per job, with what each holds under the
          filters currently set. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {categoryTiles.map((c) => {
          const Icon = c === "All" ? LayoutGrid : CATEGORY_ICON[c];
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
            placeholder="Search property, cleaner, day…"
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
          {[["", "All"], ...CLEANING_STATUSES.map((s) => [s, STATUS_LABEL[s]])].map(([v, l]) => (
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
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3 w-36">Category</th>
                <th className="px-4 py-3 w-32">Date</th>
                <th className="px-4 py-3 w-32">Day</th>
                <th className="px-4 py-3 w-28">Status</th>
                <th className="px-4 py-3 w-36">Contact</th>
                <th className="px-4 py-3 w-24">Files</th>
                <th className="px-4 py-3">Message</th>
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
                    onViewFiles={setViewingFiles}
                    onEdit={setModal}
                    onDelete={remove}
                    onToggle={toggleStatus}
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
          // A new entry opens on whichever category the board is showing, so
          // working through one register does not mean re-picking it every time.
          defaultCategory={category === "All" ? CLEANING_CATEGORIES[0] : category}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

// One month block — the band, then its rows, as the sheet prints it.
function FragmentGroup({ group, onView, onViewFiles, onEdit, onDelete, onToggle }) {
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
      {group.rows.map((r) => (
        <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50/50">
          <td className="px-4 py-3">
            <p className="font-semibold text-[#0F253B] flex items-center gap-1.5">
              <Building2 size={13} className="text-gray-300 shrink-0" />
              {r.property}
            </p>
            {r.notes && <p className="text-[11px] font-medium text-gray-400 truncate max-w-md">{r.notes}</p>}
          </td>
          <td className="px-4 py-3">
            <Badge tone={CATEGORY_TONE[categoryOf(r)] || "gray"}>
              {CATEGORY_SHORT[categoryOf(r)] || categoryOf(r)}
            </Badge>
          </td>
          <td className="px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{fmtDate(r.date)}</td>
          <td className="px-4 py-3 text-gray-500 font-medium">{dayName(r.date)}</td>
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
              <Badge tone={STATUS_TONE[r.status] || "gray"}>{STATUS_LABEL[r.status] || r.status}</Badge>
            </button>
          </td>
          <td className="px-4 py-3">
            <div className="flex flex-wrap gap-1">
              {r.emailSent && (
                <Badge tone="green">
                  <span className="flex items-center gap-1" title={r.contactEmail || "Email sent"}>
                    <Mail size={10} /> Email
                  </span>
                </Badge>
              )}
              {r.callMade && (
                <Badge tone="green">
                  <span className="flex items-center gap-1" title={r.contactPhone || "Call made"}>
                    <Phone size={10} /> Call
                  </span>
                </Badge>
              )}
              {!r.emailSent && !r.callMade && <span className="text-gray-400 font-medium">—</span>}
            </div>
          </td>
          <td className="px-4 py-3">
            {filesOf(r).length > 0 ? (
              <button
                type="button"
                onClick={() => onViewFiles(r)}
                title={`View ${filesOf(r).length} attached file${filesOf(r).length === 1 ? "" : "s"}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-bold text-[#0F253B] hover:bg-gray-200"
              >
                <Paperclip size={11} /> {filesOf(r).length}
              </button>
            ) : (
              <span className="text-gray-300 font-medium">—</span>
            )}
          </td>
          <td className="px-4 py-3 text-gray-500 font-medium">
            {r.message ? (
              <span className="block truncate max-w-xs" title={r.message}>{r.message}</span>
            ) : (
              "—"
            )}
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
