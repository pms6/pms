"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  X,
  Wallet,
  Receipt,
  Building2,
  Download,
  Trash2,
  Loader2,
  CalendarRange,
  Eye,
  Pencil,
  Paperclip,
} from "lucide-react";
import { PageHeader } from "../../Shared/ui";
import api from "../../api/api";
import { uploadFileToCloudinary } from "../../utils/uploadToCloudinary";

// MUST stay in sync with EXPENSE_CATEGORIES in backend/models/Expense.js.
const EXPENSE_CATEGORIES = [
  "Maintenance",
  "Repairs",
  "Cleaning",
  "Utilities",
  "Insurance",
  "Council Tax",
  "Mortgage",
  "Management Fee",
  "Letting Fee",
  "Compliance",
  "Furnishings",
  "Legal & Professional",
  "Marketing",
  "Other",
];

const PAYMENT_METHODS = ["Bank Transfer", "Card", "Cash", "Direct Debit", "Cheque"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// The filter reaches back six years, newest first. The backend offers the same
// span in `availableYears`; this is the fallback before the first response.
const YEAR_SPAN = 6;
const yearOptions = () => {
  const now = new Date().getFullYear();
  return Array.from({ length: YEAR_SPAN }, (_, i) => now - i);
};

const money = (n) =>
  `£${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const FIELD =
  "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

function Kpi({ icon: Icon, label, value, tone = "light" }) {
  const wrap = {
    navy: "bg-[#0F253B] text-white",
    orange: "bg-gradient-to-br from-[#F47C3C] to-[#e0651f] text-white",
    light: "bg-white border border-gray-100 text-[#0F253B]",
  }[tone];
  const iconWrap = tone === "light" ? "bg-orange-50 text-[#F47C3C]" : "bg-white/15 text-white";
  const subC = tone === "light" ? "text-gray-400" : "text-white/70";
  return (
    <div className={`rounded-2xl p-5 shadow-sm ${wrap}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconWrap}`}>
        <Icon size={22} />
      </div>
      <p className="text-2xl font-bold mt-4">{value}</p>
      <p className={`text-[11px] font-bold uppercase tracking-widest mt-1 ${subC}`}>{label}</p>
    </div>
  );
}

// A receipt is worth showing inline when it is an image; PDFs and anything else
// get a link. Cloudinary URLs carry /image/upload/ even without a file
// extension, so check both.
const isImageReceipt = (url) => {
  if (!url) return false;
  const clean = String(url).split("?")[0];
  return /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(clean) || /\/image\/upload\//.test(clean);
};

// Normalise legacy single-file records into a files array.
const getExpenseFiles = (e) => {
  if (!e) return [];
  if (Array.isArray(e.files) && e.files.length) {
    return e.files.filter((f) => f?.url);
  }
  if (e.fileUrl) {
    return [{ url: e.fileUrl, name: e.fileName || "Receipt" }];
  }
  return [];
};

const fmtDateTime = (d) => {
  if (!d) return "—";
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleString("en-GB", {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
};

const fmtDateLong = (d) => {
  if (!d) return "—";
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString("en-GB", {
        weekday: "short", day: "numeric", month: "long", year: "numeric",
      });
};

// Dates are stored at UTC midnight, so read them back in UTC — a local-time
// slice would shift the day west of Greenwich.
const toDateInput = (d) => {
  if (!d) return "";
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

function Field({ label, value, span = false }) {
  return (
    <div className={span ? "sm:col-span-2" : ""}>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
      <p className="text-sm font-bold text-[#0F253B] mt-1 break-words whitespace-pre-line">
        {value || <span className="text-gray-300">—</span>}
      </p>
    </div>
  );
}

// Read-only view of one expense: everything on the record, including the fields
// the table has no room for (payment method, reference, notes, receipt, and who
// recorded it).
function ExpenseDetailModal({ expense, onClose, onEdit }) {
  const e = expense;
  // createdBy is populated to { _id, email }; older rows may still be a bare id.
  const recordedBy = typeof e.createdBy === "object" && e.createdBy !== null ? e.createdBy.email : "";
  const files = getExpenseFiles(e);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(ev) => ev.stopPropagation()}
      >
        {/* Headline: the amount is the thing you came to see */}
        <div className="p-7 pb-5 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="inline-block px-2.5 py-1 rounded-lg bg-orange-50 text-[#F47C3C] text-[11px] font-bold uppercase tracking-widest">
                {e.category || "Uncategorised"}
              </span>
              <p className="text-3xl font-bold text-[#0F253B] mt-3">{money(e.amount)}</p>
              <p className="text-sm font-medium text-gray-400 mt-1">{fmtDateLong(e.date)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onEdit(e)}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 hover:bg-gray-50 rounded-xl text-xs font-bold text-[#0F253B] transition-all"
              >
                <Pencil size={14} className="text-[#F47C3C]" /> Edit
              </button>
              <button onClick={onClose} className="text-gray-300 hover:text-gray-500" title="Close">
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-7 space-y-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C] mb-3">Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Property" value={e.property} />
              <Field label="Supplier" value={e.supplier} />
              <Field label="Payment method" value={e.paymentMethod} />
              <Field label="Reference" value={e.reference} />
              <Field label="Description" value={e.description} span />
              <Field label="Notes" value={e.notes} span />
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C] mb-3">
              Receipt{files.length !== 1 ? "s" : ""} ({files.length})
            </p>
            {files.length > 0 ? (
              <div className="space-y-4">
                {files.map((f, idx) => (
                  <div key={`${f.url}-${idx}`} className="space-y-2">
                    {isImageReceipt(f.url) && (
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="block">
                        <img
                          src={f.url}
                          alt={f.name || `Receipt ${idx + 1}`}
                          className="max-h-72 w-auto rounded-xl border border-gray-100 object-contain bg-gray-50"
                        />
                      </a>
                    )}
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 hover:bg-gray-50 rounded-xl text-xs font-bold text-[#0F253B] transition-all"
                    >
                      <Paperclip size={14} className="text-[#F47C3C]" />
                      {f.name || `Open receipt ${idx + 1}`}
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-medium text-gray-300">No receipts attached.</p>
            )}
          </div>

          <div className="pt-5 border-t border-gray-100">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C] mb-3">Record</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Recorded by" value={recordedBy} />
              <Field label="Recorded on" value={fmtDateTime(e.createdAt)} />
              <Field label="Last updated" value={fmtDateTime(e.updatedAt)} />
              <Field label="Entry ID" value={e._id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add and edit share one form. `expense` is null when adding; when it is set the
// fields are seeded from the record and the save is a PUT.
function ExpenseModal({ expense, properties, onClose, onSave }) {
  const isEdit = Boolean(expense);

  const [form, setForm] = useState(() => ({
    date: toDateInput(expense?.date) || new Date().toISOString().slice(0, 10),
    amount: expense?.amount ?? "",
    category: expense?.category || "Maintenance",
    description: expense?.description || "",
    // propertyId comes back as a bare id string on the list rows.
    propertyId: expense?.propertyId ? String(expense.propertyId) : "",
    supplier: expense?.supplier || "",
    paymentMethod: expense?.paymentMethod || "",
    reference: expense?.reference || "",
    notes: expense?.notes || "",
  }));

  // Existing files kept from the record (user can remove individual ones).
  const [existingFiles, setExistingFiles] = useState(() => getExpenseFiles(expense));
  // Newly selected File objects to upload.
  const [newFiles, setNewFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const removeExisting = (idx) => {
    setExistingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeNew = (idx) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const onFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length) {
      setNewFiles((prev) => [...prev, ...selected]);
    }
    // Allow selecting the same file again later.
    e.target.value = "";
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form };

      // Upload any newly chosen files.
      const uploaded = [];
      for (const file of newFiles) {
        const result = await uploadFileToCloudinary(file);
        uploaded.push({
          url: result.url,
          name: result.name || file.name,
        });
      }

      const allFiles = [...existingFiles, ...uploaded];

      // Prefer the new multi-file shape. Also keep legacy single-file fields
      // populated so older code paths still work.
      payload.files = allFiles;
      if (allFiles.length > 0) {
        payload.fileUrl = allFiles[0].url;
        payload.fileName = allFiles[0].name;
      } else {
        payload.fileUrl = "";
        payload.fileName = "";
      }

      await onSave(payload);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to save the expense.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">{isEdit ? "Edit Expense" : "Add Expense"}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Date</label>
              <input type="date" className={FIELD} value={form.date} onChange={set("date")} required />
            </div>
            <div>
              <label className={LABEL}>Amount (£)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={FIELD}
                value={form.amount}
                onChange={set("amount")}
                placeholder="250.00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Category</label>
              <select className={FIELD} value={form.category} onChange={set("category")}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Property</label>
              <select className={FIELD} value={form.propertyId} onChange={set("propertyId")}>
                <option value="">— Not property specific —</option>
                {properties.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL}>Description</label>
            <input
              className={FIELD}
              value={form.description}
              onChange={set("description")}
              placeholder="e.g. Boiler service"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Supplier</label>
              <input className={FIELD} value={form.supplier} onChange={set("supplier")} />
            </div>
            <div>
              <label className={LABEL}>Payment Method</label>
              <select className={FIELD} value={form.paymentMethod} onChange={set("paymentMethod")}>
                <option value="">—</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL}>Reference</label>
            <input className={FIELD} value={form.reference} onChange={set("reference")} placeholder="Invoice number" />
          </div>

          {/* Notes round-trip through the form, so the field has to be here —
              without it an edit would blank whatever the record already held. */}
          <div>
            <label className={LABEL}>Notes</label>
            <textarea
              rows={2}
              className={`${FIELD} resize-none`}
              value={form.notes}
              onChange={set("notes")}
              placeholder="Anything worth remembering about this expense"
            />
          </div>

          <div>
            <label className={LABEL}>Receipts / Invoices</label>

            {/* Existing files that will be kept */}
            {existingFiles.length > 0 && (
              <div className="mb-2 space-y-1.5">
                {existingFiles.map((f, idx) => (
                  <div
                    key={`${f.url}-${idx}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl"
                  >
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-bold text-[#0F253B] truncate hover:underline"
                    >
                      <Paperclip size={14} className="text-[#F47C3C] shrink-0" />
                      <span className="truncate">{f.name || `Receipt ${idx + 1}`}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => removeExisting(idx)}
                      className="text-[11px] font-bold text-gray-400 hover:text-red-600 shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Newly selected files (not yet uploaded) */}
            {newFiles.length > 0 && (
              <div className="mb-2 space-y-1.5">
                {newFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 bg-orange-50/60 border border-orange-100 rounded-xl"
                  >
                    <span className="inline-flex items-center gap-2 text-xs font-bold text-[#0F253B] truncate">
                      <Paperclip size={14} className="text-[#F47C3C] shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeNew(idx)}
                      className="text-[11px] font-bold text-gray-400 hover:text-red-600 shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              type="file"
              accept=".doc,.docx,.pdf,image/*"
              multiple
              onChange={onFileChange}
              className="w-full text-sm font-medium text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-[#0F253B] file:text-white file:font-bold file:text-xs hover:file:bg-[#1b3a58] file:cursor-pointer"
            />
            <p className="mt-1.5 text-[11px] text-gray-400 font-medium">
              You can select multiple files. Images and PDFs are supported.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Expense"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminExpenses() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthFilter, setMonthFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [sheet, setSheet] = useState(null);
  const [rows, setRows] = useState([]);
  const [properties, setProperties] = useState([]);
  const [years, setYears] = useState(yearOptions());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  // The entry whose full detail is open, or null.
  const [viewRow, setViewRow] = useState(null);
  // The entry being edited, or null when the form is adding.
  const [editRow, setEditRow] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { year };
      if (propertyFilter) params.propertyId = propertyFilter;
      if (categoryFilter) params.category = categoryFilter;

      const listParams = { ...params };
      if (monthFilter) listParams.month = monthFilter;

      const [sheetRes, listRes, propsRes] = await Promise.all([
        api.get("/expenses/monthly", { params }),
        api.get("/expenses", { params: listParams }),
        api.get("/properties", { params: { limit: 100 } }),
      ]);

      setSheet(sheetRes.data);
      if (Array.isArray(sheetRes.data?.availableYears) && sheetRes.data.availableYears.length) {
        setYears(sheetRes.data.availableYears);
      }
      setRows(listRes.data?.data || []);
      setProperties(propsRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [year, monthFilter, propertyFilter, categoryFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // One save path for both modes — the modal decides which by whether it was
  // given an expense. Errors bubble up so the modal can show them in place.
  const saveExpense = async (form) => {
    const payload = {
      ...form,
      propertyId: form.propertyId || null,
      amount: Number(form.amount),
    };

    if (editRow) {
      await api.put(`/expenses/${editRow._id}`, payload);
    } else {
      await api.post("/expenses", payload);
    }

    closeForm();
    await loadData();
  };

  const openEdit = (row) => {
    setViewRow(null);
    setEditRow(row);
    setShowModal(true);
  };

  const closeForm = () => {
    setShowModal(false);
    setEditRow(null);
  };

  const removeExpense = async (row) => {
    if (!confirm(`Delete this ${money(row.amount)} expense?`)) return;
    try {
      await api.delete(`/expenses/${row._id}`);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete the expense");
    }
  };

  const exportCSV = () => {
    const headers = "Date,Category,Description,Property,Supplier,Reference,Amount\n";
    const body = rows
      .map((r) =>
        [
          new Date(r.date).toLocaleDateString("en-GB"),
          r.category || "",
          r.description || "",
          r.property || "",
          r.supplier || "",
          r.reference || "",
          Number(r.amount || 0).toFixed(2),
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([headers + body], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("href", url);
    a.setAttribute("download", `expenses_${year}${monthFilter ? `_${monthFilter}` : ""}.csv`);
    a.click();
  };

  const months = sheet?.months || [];
  const maxMonth = Math.max(1, ...months.map((m) => m.total));
  const total = sheet?.total || 0;
  const busiest = months.reduce((best, m) => (m.total > (best?.total || 0) ? m : best), null);
  const topCategory = Object.entries(sheet?.byCategory || {}).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Monthly Expense Sheet"
        subtitle="Outgoings by month, filtered by year"
        action={
          <button
            onClick={() => { setEditRow(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
          >
            <Plus size={18} /> Add Expense
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {/* Filters — the year selector spans the last six years */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="w-full sm:w-40">
          <label className={LABEL}>
            <span className="inline-flex items-center gap-1">
              <CalendarRange size={11} /> Year
            </span>
          </label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B] outline-none focus:ring-2 focus:ring-[#F47C3C]"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-44">
          <label className={LABEL}>Month</label>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B] outline-none focus:ring-2 focus:ring-[#F47C3C]"
          >
            <option value="">All months</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-56">
          <label className={LABEL}>Property</label>
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B] outline-none focus:ring-2 focus:ring-[#F47C3C]"
          >
            <option value="">All properties</option>
            {properties.map((p) => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-52">
          <label className={LABEL}>Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B] outline-none focus:ring-2 focus:ring-[#F47C3C]"
          >
            <option value="">All categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={Wallet} label={`Total ${year}`} value={loading ? "—" : money(total)} tone="orange" />
        <Kpi icon={Receipt} label="Entries" value={loading ? "—" : sheet?.count ?? 0} tone="navy" />
        <Kpi
          icon={CalendarRange}
          label="Highest month"
          value={loading || !busiest || busiest.total === 0 ? "—" : MONTHS[busiest.month - 1]}
        />
        <Kpi
          icon={Building2}
          label="Top category"
          value={loading || !topCategory ? "—" : topCategory[0]}
        />
      </div>

      {/* The sheet: one row per month, always all twelve */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-[#0F253B]">Monthly breakdown — {year}</h2>
        </div>
        {loading ? (
          <div className="p-10 text-center text-gray-400">Loading expense sheet…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Month</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Entries</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-1/2">Share</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm font-medium text-[#0F253B]">
                {months.map((m) => (
                  <tr
                    key={m.month}
                    onClick={() => setMonthFilter(String(m.month))}
                    className={`cursor-pointer transition-colors ${
                      String(m.month) === monthFilter ? "bg-orange-50/60" : "hover:bg-gray-50/70"
                    }`}
                  >
                    <td className="p-4 font-bold">{MONTHS[m.month - 1]}</td>
                    <td className="p-4 text-xs text-gray-500">{m.count}</td>
                    <td className="p-4">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#F47C3C] to-[#f9a870] rounded-full"
                          style={{ width: `${(m.total / maxMonth) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className="p-4 text-right font-bold">
                      {m.total ? money(m.total) : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50/50 border-t border-gray-100">
                  <td className="p-4 text-xs font-bold uppercase tracking-wider text-gray-400" colSpan={3}>
                    Year total
                  </td>
                  <td className="p-4 text-right font-bold text-[#0F253B]">{money(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Individual entries for the current filter */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-[#0F253B]">
            Entries{monthFilter ? ` — ${MONTHS[Number(monthFilter) - 1]} ${year}` : ` — ${year}`}
          </h2>
          <div className="flex items-center gap-2">
            {monthFilter && (
              <button
                onClick={() => setMonthFilter("")}
                className="text-xs font-bold text-[#F47C3C] hover:underline"
              >
                Clear month
              </button>
            )}
            <button
              onClick={exportCSV}
              disabled={rows.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-600 transition-all disabled:opacity-40"
            >
              <Download size={14} /> Export (CSV)
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            No expenses recorded for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Category</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Description</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Property</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Supplier</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Amount</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm font-medium text-[#0F253B]">
                {rows.map((r) => {
                  const fileCount = getExpenseFiles(r).length;
                  return (
                    <tr
                      key={r._id}
                      onClick={() => setViewRow(r)}
                      className="hover:bg-gray-50/70 transition-colors cursor-pointer"
                    >
                      <td className="p-4 text-xs text-gray-500">
                        {new Date(r.date).toLocaleDateString("en-GB")}
                      </td>
                      <td className="p-4 text-xs font-bold">{r.category}</td>
                      <td className="p-4 text-xs">
                        {r.description || "—"}
                        {fileCount > 0 && (
                          <span className="ml-2 text-[10px] font-bold text-[#F47C3C]">
                            {fileCount === 1 ? "receipt" : `${fileCount} receipts`}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-xs text-gray-500">{r.property || "—"}</td>
                      <td className="p-4 text-xs text-gray-500">{r.supplier || "—"}</td>
                      <td className="p-4 text-right font-bold">{money(r.amount)}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); setViewRow(r); }}
                            className="p-1.5 text-gray-300 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg transition-all"
                            title="View details"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(r); }}
                            className="p-1.5 text-gray-300 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg transition-all"
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeExpense(r); }}
                            className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewRow && (
        <ExpenseDetailModal
          expense={viewRow}
          onClose={() => setViewRow(null)}
          onEdit={openEdit}
        />
      )}

      {showModal && (
        <ExpenseModal
          // Remounts when switching entries, so the form reseeds from the new row.
          key={editRow?._id || "new"}
          expense={editRow}
          properties={properties}
          onClose={closeForm}
          onSave={saveExpense}
        />
      )}
    </div>
  );
}