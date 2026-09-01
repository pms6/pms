"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Building2, Download, X, Bell, BellRing, CalendarClock, FileText, Eye, ScrollText, Loader2, Pencil, Trash2 } from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import api from "../../api/api";
import { uploadFileToCloudinary, downloadUrlFor } from "../../utils/uploadToCloudinary";
import { ExpiryBadge } from "../../Components/PropertyContract";
import PdfFrame from "../../Shared/PdfFrame";
import { fileKind, kindLabel } from "../../Shared/fileType";

const STATUS_TONE = { expired: "red", warning: "amber", valid: "green" };

const CATEGORIES = [
  "Carbon Monoxide Check",
  "EICR",
  "EPC",
  "Fire Safety",
  "Gas Safety",
  "HMO Licence",
  "PAT",
  "Smoke Detector Test"
];

// Contracts are not compliance certificates — they live on the Property record
// (property.contract for the terms, property.documents[type=CONTRACT] for the
// files). This is a display mode over that data, not a new certificate type.
const CONTRACT_VIEW = "Property Contract";

const AGREEMENT_LABEL = {
  AST: "Assured Shorthold Tenancy",
  COMPANY_LET: "Company Let",
  LICENCE: "Licence",
  LODGER: "Lodger Agreement",
  OTHER: "Other",
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");
const fmtMoney = (n) =>
  n || n === 0 ? `£${Number(n).toLocaleString("en-GB")}` : "—";

// A property counts as having a contract if it has terms or a contract file.
const contractDocs = (p) =>
  (p?.documents || []).filter((d) => d.type === "CONTRACT");
const hasContract = (p) =>
  Boolean(p?.contract?.startDate || p?.contract?.endDate || p?.contract?.rentAmount) ||
  contractDocs(p).length > 0;

const FIELD = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

// ---------------------------------------------------------------------------
// Certificate viewer — the evidence file attached to a compliance record.
// ---------------------------------------------------------------------------
// PDFs go through PdfFrame, which checks the host will actually serve the file
// before embedding it; images render inline; anything else falls back to the
// download button, which is always present.
function CertificateModal({ record, onClose }) {
  if (!record) return null;

  const url = record.fileUrl;
  const name = record.fileName || "Certificate";
  const kind = fileKind(url, record.fileName);
  const title = [record.type, record.subType].filter(Boolean).join(" — ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-[#0F253B] truncate">{title || "Certificate"}</h3>
            <p className="text-xs font-medium text-gray-400 truncate">
              {record.property || "—"} · expires {fmtDate(record.expiryDate)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-gray-100 min-h-[18rem]">
          {!url ? (
            <div className="flex h-full min-h-[18rem] items-center justify-center px-6 text-center">
              <p className="text-sm font-bold text-gray-400">
                No certificate file was attached to this record.
              </p>
            </div>
          ) : kind === "pdf" ? (
            <PdfFrame url={url} title={name} className="w-full h-[65vh]" />
          ) : kind === "image" ? (
            <div className="flex items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={name} className="max-h-[65vh] w-auto rounded-xl bg-white object-contain" />
            </div>
          ) : (
            <div className="flex h-full min-h-[18rem] flex-col items-center justify-center gap-2 px-6 text-center">
              <FileText size={28} className="text-gray-300" />
              <p className="text-sm font-bold text-[#0F253B]">
                {kindLabel(url, record.fileName)} files can&apos;t be previewed here.
              </p>
              <p className="text-xs font-medium text-gray-500">Download it to open in its own app.</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-400 truncate min-w-0">{url ? name : ""}</p>
          <div className="flex gap-2 shrink-0">
            {url && (
              <>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-sm text-[#0F253B] hover:bg-gray-50"
                >
                  Open in new tab
                </a>
                <a
                  href={downloadUrlFor(url, record.fileName)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm"
                >
                  <Download size={16} /> Download
                </a>
              </>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-200 font-bold text-sm hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// yyyy-mm-dd for <input type="date">; anything unparseable becomes empty.
const toDateInput = (d) => {
  if (!d) return "";
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

// One form for both modes — `record` absent means a new certificate.
function ComplianceModal({ record, properties, onClose, onSave }) {
  const [form, setForm] = useState({
    propertyId: record?.propertyId || "",
    property: record?.property || "",
    type: record?.type || "Carbon Monoxide Check",
    subType: record?.subType || "",
    carriedOut: toDateInput(record?.carriedOut),
    validityMonths: String(record?.validityMonths ?? "3"),
    expiryDate: toDateInput(record?.expiryDate),
    reminderDaysBefore: String(record?.reminderDaysBefore ?? "14"),
    autoReminder: record?.autoReminder ?? true,
    notes: record?.notes || "",
    file: null
  });

  // The attachment already on the record. Cleared when the user removes it, so
  // saving with nothing chosen detaches the old file rather than silently
  // keeping it.
  const [existingFile, setExistingFile] = useState(
    record?.fileUrl ? { url: record.fileUrl, name: record.fileName || "Attachment" } : null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => {
      const updated = { ...f, [k]: val };

      if ((k === "carriedOut" || k === "validityMonths") && updated.carriedOut) {
        const date = new Date(updated.carriedOut);
        date.setMonth(date.getMonth() + Number(updated.validityMonths || 0));
        updated.expiryDate = date.toISOString().split('T')[0];
      }
      return updated;
    });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setForm({ ...form, file: e.target.files[0] });
    }
  };

  const onPropertyChange = (e) => {
    const propertyId = e.target.value;
    const property = properties.find((p) => p._id === propertyId)?.name || "";
    setForm((f) => ({ ...f, propertyId, property }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.propertyId) { setError("Property is required"); return; }
    if (!form.expiryDate) { setError("Expiry date is required"); return; }

    setSaving(true);
    setError("");

    try {
      await onSave({ ...form, existingFile });
    } catch (err) {
      setError(err.message || "Failed to save compliance certificate");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">
            {record ? "Edit Compliance Asset" : "Add Compliance Asset"}
          </h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={LABEL}>Property</label>
            <select className={FIELD} value={form.propertyId} onChange={onPropertyChange} required>
              <option value="">Select property</option>
              {properties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Certificate Type</label>
              <select className={FIELD} value={form.type} onChange={set("type")}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Sub-Type / Details</label>
              <input className={FIELD} value={form.subType} onChange={set("subType")} placeholder="e.g. Regular Cleaner Check" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={LABEL}>Date Completed</label>
              <input type="date" className={`${FIELD} px-2`} value={form.carriedOut} onChange={set("carriedOut")} required />
            </div>
            <div>
              <label className={LABEL}>Valid For (Months)</label>
              <input type="number" min="1" className={FIELD} value={form.validityMonths} onChange={set("validityMonths")} placeholder="e.g. 3" />
            </div>
            <div>
              <label className={LABEL}>Expiry Date</label>
              <input type="date" className={`${FIELD} px-2`} value={form.expiryDate} onChange={set("expiryDate")} required />
            </div>
          </div>

          <div>
            <label className={LABEL}>Internal Administrative Notes</label>
            <textarea rows={2} className={FIELD} value={form.notes} onChange={set("notes")} placeholder="Tested/Checked by cleaner on a regular visit..." />
          </div>

          <div>
            <label className={LABEL}>Evidence Attachment (Files)</label>

            {existingFile && !form.file && (
              <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                <a
                  href={existingFile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 min-w-0 text-xs font-bold text-[#0F253B] hover:text-[#F47C3C]"
                >
                  <FileText size={14} className="text-[#F47C3C] shrink-0" />
                  <span className="truncate">{existingFile.name}</span>
                </a>
                <button
                  type="button"
                  onClick={() => setExistingFile(null)}
                  className="text-[11px] font-bold text-red-600 hover:underline shrink-0"
                >
                  Remove
                </button>
              </div>
            )}

            <div className="border border-dashed border-gray-200 rounded-xl p-4 bg-gray-50/50 text-center hover:bg-gray-50 transition-colors relative cursor-pointer">
              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} />
              <p className="text-xs font-bold text-gray-500">
                {form.file
                  ? `Selected: ${form.file.name}`
                  : existingFile
                  ? "Choose a file to replace the one above"
                  : "Choose PDF or Image (max 15MB)"}
              </p>
            </div>
          </div>

          <div className="p-4 bg-orange-50/50 border border-orange-100 rounded-xl space-y-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="autoReminder"
                className="mt-1 accent-[#F47C3C] h-4 w-4 rounded"
                checked={form.autoReminder}
                onChange={set("autoReminder")}
              />
              <label htmlFor="autoReminder" className="cursor-pointer select-none">
                <span className="block text-xs font-bold text-[#0F253B] flex items-center gap-1.5">
                  <Bell size={13} className="text-[#F47C3C]" /> Auto-Send Renew Reminders
                </span>
                <span className="block text-[11px] text-gray-500 mt-0.5">
                  Enables background action engine notification loops prior to expiration criteria.
                </span>
              </label>
            </div>

            {form.autoReminder && (
              <div className="flex items-center gap-3 pl-7 pt-1 transition-all animate-fadeIn">
                <div className="w-32">
                  <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Days Before Alert</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-[#0F253B]"
                    value={form.reminderDaysBefore}
                    onChange={set("reminderDaysBefore")}
                  />
                </div>
                <p className="text-[11px] font-medium text-gray-500 mt-4">
                  System will fire warnings exactly <span className="font-bold text-[#F47C3C]">{form.reminderDaysBefore || 0} days</span> prior to expiration date.
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all active:scale-[0.98]"
          >
            {saving ? "Saving Certificate…" : record ? "Save Changes" : "Save Certificate"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminCompliance() {
  const [list, setList] = useState([]);
  const [properties, setProperties] = useState([]);
  const [stats, setStats] = useState({ total: 0, expired: 0, warning: 0, byCategory: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  // undefined = closed, null = adding, a record = editing that record.
  const [editing, setEditing] = useState(undefined);
  const [deletingId, setDeletingId] = useState(null);
  // The record whose certificate file is open in the viewer.
  const [viewing, setViewing] = useState(null);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [reminderMsg, setReminderMsg] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [compRes, propsRes] = await Promise.all([
        api.get("/compliance"),
        api.get("/properties", { params: { limit: 100 } })
      ]);

      let records = compRes.data.data || [];

      // Normalize data to fix propertyId comparison
      records = records.map(record => ({
        ...record,
        propertyId: record.propertyId?._id || record.propertyId,   // ensure string ID
        property: record.propertyId?.name || record.property || "",
      }));

      setList(records);
      setProperties(propsRes.data.data || []);

      const computedStats = records.reduce((acc, current) => {
        acc.total++;
        if (current.status === "expired") acc.expired++;
        if (current.status === "warning") acc.warning++;

        const cat = current.type || "General";
        acc.byCategory[cat] = (acc.byCategory[cat] || 0) + 1;
        return acc;
      }, { total: 0, expired: 0, warning: 0, byCategory: {} });

      setStats(computedStats);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load compliance details");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // One save path for add and edit — the modal decides which by whether it was
  // given a record. A newly chosen file is uploaded and replaces whatever was
  // attached; with none chosen, the record keeps (or drops) the existing one
  // according to what the modal hands back.
  const saveCompliance = async (formData) => {
    try {
      let fileUrl = formData.existingFile?.url || null;
      let fileName = formData.existingFile?.name || null;

      if (formData.file) {
        const uploadResult = await uploadFileToCloudinary(formData.file);
        fileUrl = uploadResult.url;
        fileName = uploadResult.name || formData.file.name;
      }

      const payload = {
        propertyId: formData.propertyId,
        type: formData.type,
        subType: formData.subType,
        carriedOut: formData.carriedOut,
        validityMonths: formData.validityMonths,
        expiryDate: formData.expiryDate,
        reminderDaysBefore: formData.reminderDaysBefore,
        autoReminder: formData.autoReminder,
        notes: formData.notes,
        fileUrl,
        fileName,
      };

      if (editing) await api.put(`/compliance/${editing._id}`, payload);
      else await api.post("/compliance", payload);

      setEditing(undefined);
      loadData(); // refresh list
    } catch (err) {
      console.error(err);
      throw new Error(
        err.response?.data?.message || err.message || "Failed to save compliance certificate"
      );
    }
  };

  const deleteCompliance = async (row) => {
    const label = [row.type, row.subType].filter(Boolean).join(" — ");
    if (!confirm(`Delete the ${label} certificate for ${row.property || "this property"}? This cannot be undone.`)) {
      return;
    }

    setDeletingId(row._id);
    setError("");
    try {
      await api.delete(`/compliance/${row._id}`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete the certificate");
    } finally {
      setDeletingId(null);
    }
  };

  // Fire the expiry reminders for this organization now, rather than waiting
  // for the nightly 8am job. The backend de-duplicates per reminder window, so
  // a certificate already emailed this cycle is skipped rather than re-sent.
  const sendReminders = async () => {
    setSendingReminders(true);
    setReminderMsg("");
    try {
      const { data } = await api.post("/compliance/send-reminders");
      setReminderMsg(data.message || "Reminder process completed");
      loadData(); // pick up the new lastReminderSentAt stamps
    } catch (err) {
      setReminderMsg(
        err.response?.data?.message || "Failed to send reminders"
      );
    } finally {
      setSendingReminders(false);
    }
  };

  const exportCSV = () => {
    const headers = "Property,Type,Status,Carried Out,Expiry Date,Reminder Window\n";
    const rows = filteredRows
      .map((r) =>
        `"${r.property}","${r.type}${r.subType ? ` > ${r.subType}` : ""}","${r.status}","${r.carriedOut || ""}","${r.expiryDate}","${r.reminderDaysBefore} days"`
      )
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("href", url);
    a.setAttribute("download", "compliance_report.csv");
    a.click();
  };

  // Properties with a contract, honouring the property filter above.
  const contractProperties = properties.filter(
    (p) => hasContract(p) && (!propertyFilter || p._id === propertyFilter)
  );

  const showingContracts = selectedCategory === CONTRACT_VIEW;

  // Fixed filtering logic
  const filteredRows = list.filter((item) => {
    const matchStatus = !statusFilter || item.status === statusFilter;
    
    const matchProp = !propertyFilter || item.propertyId === propertyFilter;
    
    const matchCat = selectedCategory === "All" || item.type === selectedCategory;

    return matchStatus && matchProp && matchCat;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Compliance Dashboard"
        subtitle="Manage dynamic safety checklists, carbon metrics, and adaptive renewal periods"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={sendReminders}
              disabled={sendingReminders}
              title="Email the organization owner (managers copied in) about every certificate now inside its reminder window"
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed text-[#0F253B] font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              {sendingReminders ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <BellRing size={16} className="text-[#F47C3C]" />
              )}
              {sendingReminders ? "Sending..." : "Send Reminders"}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              <Plus size={18} /> Add Document
            </button>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      {reminderMsg && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-medium text-[#0F253B]">
          <span className="flex items-center gap-2">
            <BellRing size={15} className="text-[#F47C3C]" /> {reminderMsg}
          </span>
          <button
            onClick={() => setReminderMsg("")}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={15} />
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-1 gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B] outline-none focus:ring-2 focus:ring-[#F47C3C] capitalize"
            >
              <option value="">All Statuses</option>
              <option value="expired">Expired</option>
              <option value="warning">Expiring Soon</option>
              <option value="valid">Valid</option>
            </select>
          </div>
          <div className="w-full sm:w-64">
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
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
        {["All", ...CATEGORIES, CONTRACT_VIEW].map((cat) => {
          const isSelected = selectedCategory === cat;
          const count =
            cat === "All"
              ? stats.total
              : cat === CONTRACT_VIEW
              ? contractProperties.length
              : (stats.byCategory[cat] || 0);

          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`p-3 rounded-xl border text-center transition-all flex flex-col justify-between items-center min-h-[72px] ${
                isSelected
                  ? "bg-[#0F253B] text-white border-[#0F253B] shadow-sm"
                  : count > 0
                  ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                  : "bg-white text-gray-400 border-gray-100 hover:bg-gray-50"
              }`}
            >
              <span className="text-xl font-bold tracking-tight block">{loading ? "—" : count}</span>
              <span className="text-[9px] font-bold block uppercase tracking-wider mt-1 break-words w-full text-center line-clamp-2">
                {cat}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400">Loading metrics data…</div>
      ) : showingContracts ? (
        contractProperties.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400">
            No property contracts on record. Contracts are set on the property itself — add one
            under Properties, and it will appear here.
          </div>
        ) : (
          <div className="space-y-4">
            {contractProperties.map((p) => (
              <ContractCard key={p._id} property={p} />
            ))}
          </div>
        )
      ) : filteredRows.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400">No matching tracking data detected.</div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Property</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Carried Out</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Expiry Date</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Reminder Settings</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm font-medium text-[#0F253B]">
                {filteredRows.map((row) => (
                  <tr key={row._id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="p-4 flex items-center gap-2 font-bold">
                      <Building2 size={14} className="text-gray-400" />
                      {row.property || "—"}
                    </td>
                    <td className="p-4 text-xs">
                      <div className="font-semibold text-gray-700">{row.type}</div>
                      {row.notes && <div className="text-[11px] text-gray-400 font-normal mt-0.5 max-w-xs truncate">{row.notes}</div>}
                    </td>
                    <td className="p-4">
                      <Badge tone={STATUS_TONE[row.status] || "gray"}>{row.status}</Badge>
                    </td>
                    <td className="p-4 text-xs text-gray-500">
                      {row.carriedOut ? new Date(row.carriedOut).toLocaleDateString("en-GB") : "—"}
                    </td>
                    <td className="p-4 text-xs font-bold text-red-600">
                      {new Date(row.expiryDate).toLocaleDateString("en-GB")}
                      {typeof row.daysUntilExpiry === "number" && (
                        <div className="text-[10px] font-semibold text-gray-400 mt-0.5">
                          {row.daysUntilExpiry < 0
                            ? Math.abs(row.daysUntilExpiry) + "d overdue"
                            : row.daysUntilExpiry === 0
                            ? "expires today"
                            : "in " + row.daysUntilExpiry + "d"}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {row.autoReminder ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#F47C3C] bg-orange-50 px-2 py-0.5 rounded-md">
                            <CalendarClock size={10} /> Alert active ({row.reminderDaysBefore}d prior)
                          </span>
                          {row.lastReminderSentAt ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                              <Bell size={10} /> Emailed {fmtDate(row.lastReminderSentAt)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-300 font-medium">Not yet emailed</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-300 font-medium">Inactive</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        {row.fileUrl ? (
                          <>
                            <button
                              onClick={() => setViewing(row)}
                              title="View certificate"
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <Eye size={15} />
                            </button>
                            <a
                              href={downloadUrlFor(row.fileUrl, row.fileName)}
                              title={`Download ${row.fileName || "certificate"}`}
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <Download size={15} />
                            </a>
                          </>
                        ) : (
                          <span
                            title="No certificate file attached"
                            className="p-1.5 text-gray-200"
                          >
                            <FileText size={15} />
                          </span>
                        )}
                        <button
                          onClick={() => setEditing(row)}
                          title="Edit certificate"
                          className="p-1.5 text-[#0F253B] hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => deleteCompliance(row)}
                          disabled={deletingId === row._id}
                          title="Delete certificate"
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {deletingId === row._id ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-gray-50/30 border-t border-gray-100">
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-600 transition-all"
            >
              <Download size={14} /> Export (CSV)
            </button>
          </div>
        </div>
      )}

      <CertificateModal record={viewing} onClose={() => setViewing(null)} />

      {editing !== undefined && (
        <ComplianceModal
          record={editing}
          properties={properties}
          onClose={() => setEditing(undefined)}
          onSave={saveCompliance}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Property contract — read-only view of what the Property record holds */
/* ------------------------------------------------------------------ */

function ContractTerm({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
      <p className="text-sm font-bold text-[#0F253B] mt-0.5 break-words">{value || "—"}</p>
    </div>
  );
}

function ContractCard({ property }) {
  const c = property.contract || {};
  const docs = contractDocs(property);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <ScrollText size={16} className="text-[#F47C3C] shrink-0" />
          <h3 className="font-bold text-[#0F253B] truncate">{property.name}</h3>
          <Badge tone="gray">{AGREEMENT_LABEL[c.agreementType] || c.agreementType || "—"}</Badge>
          <ExpiryBadge contract={c} />
        </div>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          {docs.length} document{docs.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <ContractTerm label="Start" value={fmtDate(c.startDate)} />
        <ContractTerm label="End" value={fmtDate(c.endDate)} />
        <ContractTerm
          label="Rent"
          value={
            c.rentAmount
              ? `${fmtMoney(c.rentAmount)} ${(c.rentPeriod || "MONTHLY").toLowerCase()}`
              : ""
          }
        />
        <ContractTerm label="Notice" value={c.noticeMonths ? `${c.noticeMonths} month${c.noticeMonths === 1 ? "" : "s"}` : ""} />
        <ContractTerm label="Deposit" value={c.depositAmount ? fmtMoney(c.depositAmount) : ""} />
        <ContractTerm label="Deposit scheme" value={c.depositScheme === "NONE" ? "" : c.depositScheme} />
        <ContractTerm label="Landlord" value={c.landlordName} />
        <ContractTerm label="Tenant" value={c.tenantName} />
      </div>

      {c.rollsToPeriodic && (
        <p className="mt-3 text-xs font-medium text-gray-500">
          Rolls into a periodic tenancy at the end of the fixed term.
        </p>
      )}

      {c.notes && <p className="mt-3 text-sm text-gray-600 font-medium">{c.notes}</p>}

      <div className="mt-4 pt-4 border-t border-gray-50">
        {docs.length === 0 ? (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-300">
            <FileText size={12} /> No contract file uploaded on this property.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {docs.map((d, i) => (
              <span
                key={d.url || i}
                className="inline-flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2"
              >
                <FileText size={13} className="text-gray-400 shrink-0" />
                <span className="text-xs font-bold text-[#0F253B] truncate max-w-[200px]">
                  {d.name || "Contract"}
                </span>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View"
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-[#F47C3C] hover:underline"
                >
                  <Eye size={11} /> View
                </a>
                <a
                  href={d.url}
                  download={d.name || true}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Download"
                  className="text-gray-400 hover:text-[#0F253B]"
                >
                  <Download size={12} />
                </a>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
