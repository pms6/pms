"use client";

import { useState } from "react";
import { Plus, Pencil, ClipboardCheck, X } from "lucide-react";
import { money } from "../admin/_data/dummy";
import { uploadFileToCloudinary } from "../utils/uploadToCloudinary";

/* ------------------------------------------------------------------ */
/* Contract — the agreement held on the property record                */
/*                                                                     */
/* Terms live on property.contract; the signed file lives in           */
/* property.documents with type "CONTRACT". The Compliance page reads  */
/* both, so anything saved here shows up there too.                    */
/* ------------------------------------------------------------------ */

const AGREEMENT_TYPES = [
  ["AST", "Assured Shorthold Tenancy"],
  ["COMPANY_LET", "Company Let"],
  ["LICENCE", "Licence"],
  ["LODGER", "Lodger Agreement"],
  ["OTHER", "Other"],
];

const DEPOSIT_SCHEMES = [
  ["NONE", "None"],
  ["DPS", "DPS"],
  ["MYDEPOSITS", "mydeposits"],
  ["TDS", "TDS"],
];

const AGREEMENT_LABEL = Object.fromEntries(AGREEMENT_TYPES);

const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");
const toInputDate = (d) => (d ? String(d).slice(0, 10) : "");

const contractDocs = (property) =>
  (property?.documents || []).filter((d) => d.type === "CONTRACT");

// Expiry state derived from endDate every render — never stored, so it cannot
// go stale the way the Compliance model's saved status does.
// Mirrors contractStatus() in backend/cranjob/contractReminder.js.
export function contractExpiry(contract) {
  if (!contract?.endDate) return { status: "none", days: null };

  const end = new Date(contract.endDate);
  end.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((end - today) / 86400000);

  if (days < 0) return { status: "expired", days };
  if (days <= (contract.reminderDaysBefore || 30)) return { status: "warning", days };
  return { status: "valid", days };
}

const EXPIRY_STYLE = {
  expired: "bg-red-50 text-red-700 border-red-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  valid: "bg-green-50 text-green-700 border-green-200",
};

export function ExpiryBadge({ contract }) {
  const { status, days } = contractExpiry(contract);
  if (status === "none") return null;

  const label =
    status === "expired"
      ? `Expired ${Math.abs(days)}d ago`
      : status === "warning"
      ? `Expires in ${days}d`
      : `Expires ${fmt(contract.endDate)}`;

  return (
    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${EXPIRY_STYLE[status]}`}>
      {label}
    </span>
  );
}

function Info({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-sm font-bold text-[#0F253B] mt-0.5 break-words">{value || "—"}</p>
    </div>
  );
}

export function ContractSection({ property, onEdit }) {
  const c = property.contract || {};
  const docs = contractDocs(property);
  const hasTerms = Boolean(c.startDate || c.endDate || c.rentAmount);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-[#0F253B]">Contract</h2>
          <ExpiryBadge contract={c} />
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-2 px-4 py-2 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-xs rounded-xl transition-all active:scale-[0.98]"
        >
          {hasTerms || docs.length ? (
            <>
              <Pencil size={14} /> Edit Contract
            </>
          ) : (
            <>
              <Plus size={14} /> Add Contract
            </>
          )}
        </button>
      </div>

      {!hasTerms && docs.length === 0 ? (
        <p className="text-sm text-gray-400 font-medium">
          No contract recorded. Add the agreement terms and upload the signed document — it will
          also appear under Compliance → Property Contract.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Info label="Agreement" value={AGREEMENT_LABEL[c.agreementType] || c.agreementType} />
            <Info label="Start" value={fmt(c.startDate)} />
            <Info label="End" value={fmt(c.endDate)} />
            <Info
              label="Rent"
              value={
                c.rentAmount
                  ? `${money(c.rentAmount)} ${(c.rentPeriod || "MONTHLY").toLowerCase()}`
                  : ""
              }
            />
            <Info
              label="Notice"
              value={c.noticeMonths ? `${c.noticeMonths} month${c.noticeMonths === 1 ? "" : "s"}` : ""}
            />
            <Info label="Deposit" value={c.depositAmount ? money(c.depositAmount) : ""} />
            <Info label="Deposit Scheme" value={c.depositScheme === "NONE" ? "" : c.depositScheme} />
            <Info label="Rolls to Periodic" value={c.rollsToPeriodic ? "Yes" : "No"} />
            <Info label="Landlord" value={c.landlordName} />
            <Info label="Tenant" value={c.tenantName} />
            <Info
              label="Expiry Reminder"
              value={
                c.endDate
                  ? c.autoReminder === false
                    ? "Off"
                    : `${c.reminderDaysBefore || 30} days before`
                  : ""
              }
            />
          </div>

          {c.notes && <p className="mt-4 text-sm text-gray-600 font-medium">{c.notes}</p>}

          <div className="mt-5 pt-4 border-t border-gray-50">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
              Documents ({docs.length})
            </p>
            {docs.length === 0 ? (
              <p className="text-sm text-gray-400 font-medium">No contract file uploaded.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {docs.map((d, i) => (
                  <a
                    key={d.url || i}
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl px-3 py-2 transition-all"
                  >
                    <ClipboardCheck size={13} className="text-[#F47C3C] shrink-0" />
                    <span className="text-xs font-bold text-[#0F253B] truncate max-w-[220px]">
                      {d.name || "Contract"}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function ContractModal({ property, onClose, onSave }) {
  const c = property.contract || {};
  const existingDocs = property.documents || [];

  const [form, setForm] = useState({
    agreementType: c.agreementType || "AST",
    startDate: toInputDate(c.startDate),
    endDate: toInputDate(c.endDate),
    rentAmount: c.rentAmount ?? "",
    rentPeriod: c.rentPeriod || "MONTHLY",
    noticeMonths: c.noticeMonths ?? 1,
    depositScheme: c.depositScheme || "NONE",
    depositAmount: c.depositAmount ?? "",
    landlordName: c.landlordName || "",
    tenantName: c.tenantName || "",
    rollsToPeriodic: c.rollsToPeriodic !== false,
    notes: c.notes || "",
    autoReminder: c.autoReminder !== false,
    reminderDaysBefore: c.reminderDaysBefore ?? 30,
  });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setError("The end date cannot be before the start date.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      let documents;

      if (file) {
        const uploaded = await uploadFileToCloudinary(file);
        // Append rather than replace — a property can hold more than one
        // contract document, and other document types must survive.
        documents = [
          ...existingDocs,
          {
            name: uploaded.name || file.name,
            url: uploaded.url,
            type: "CONTRACT",
            uploadedAt: new Date().toISOString(),
          },
        ];
      }

      const payload = {
        contract: {
          agreementType: form.agreementType,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          rentAmount: form.rentAmount === "" ? null : Number(form.rentAmount),
          rentPeriod: form.rentPeriod,
          noticeMonths: form.noticeMonths === "" ? null : Number(form.noticeMonths),
          depositScheme: form.depositScheme,
          depositAmount: form.depositAmount === "" ? null : Number(form.depositAmount),
          landlordName: form.landlordName,
          tenantName: form.tenantName,
          rollsToPeriodic: form.rollsToPeriodic,
          notes: form.notes,
          autoReminder: form.autoReminder,
          reminderDaysBefore:
            form.reminderDaysBefore === "" ? 30 : Number(form.reminderDaysBefore),
        },
      };
      if (documents) payload.documents = documents;

      await onSave(payload);
    } catch (err) {
      setError(err.message || err.error || "Failed to save the contract.");
    } finally {
      setSaving(false);
    }
  };

  const FIELD =
    "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
  const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-[#0F253B]">Property Contract</h3>
            <p className="text-sm text-gray-400 font-medium truncate">{property.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 shrink-0">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Agreement Type</label>
              <select className={FIELD} value={form.agreementType} onChange={set("agreementType")}>
                {AGREEMENT_TYPES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Start Date</label>
              <input type="date" className={FIELD} value={form.startDate} onChange={set("startDate")} />
            </div>
            <div>
              <label className={LABEL}>End Date</label>
              <input type="date" className={FIELD} value={form.endDate} onChange={set("endDate")} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Rent Amount (£)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={FIELD}
                value={form.rentAmount}
                onChange={set("rentAmount")}
                placeholder="1200"
              />
            </div>
            <div>
              <label className={LABEL}>Rent Period</label>
              <select className={FIELD} value={form.rentPeriod} onChange={set("rentPeriod")}>
                <option value="MONTHLY">Monthly</option>
                <option value="WEEKLY">Weekly</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Notice (months)</label>
              <input
                type="number"
                min="0"
                className={FIELD}
                value={form.noticeMonths}
                onChange={set("noticeMonths")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Deposit Scheme</label>
              <select className={FIELD} value={form.depositScheme} onChange={set("depositScheme")}>
                {DEPOSIT_SCHEMES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Deposit Amount (£)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={FIELD}
                value={form.depositAmount}
                onChange={set("depositAmount")}
                placeholder="1200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Landlord Name</label>
              <input className={FIELD} value={form.landlordName} onChange={set("landlordName")} />
            </div>
            <div>
              <label className={LABEL}>Tenant Name</label>
              <input className={FIELD} value={form.tenantName} onChange={set("tenantName")} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-[#0F253B]">
            <input
              type="checkbox"
              checked={form.rollsToPeriodic}
              onChange={set("rollsToPeriodic")}
              className="accent-[#F47C3C]"
            />
            Rolls into a periodic tenancy at the end of the fixed term
          </label>

          {/* Expiry reminder — same idea as the Compliance reminder settings */}
          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
            <label className="flex items-center gap-2 text-sm font-bold text-[#0F253B]">
              <input
                type="checkbox"
                checked={form.autoReminder}
                onChange={set("autoReminder")}
                className="accent-[#F47C3C]"
              />
              Email me before this contract ends
            </label>

            {form.autoReminder && (
              <div className="mt-3 flex items-center gap-2">
                <label className="text-xs font-medium text-gray-500">Remind</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={form.reminderDaysBefore}
                  onChange={set("reminderDaysBefore")}
                  className="w-24 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-[#0F253B] outline-none focus:ring-2 focus:ring-[#F47C3C]"
                />
                <span className="text-xs font-medium text-gray-500">days before the end date</span>
              </div>
            )}

            {!form.endDate && (
              <p className="mt-2 text-[11px] font-medium text-amber-600">
                Set an end date above for reminders to run.
              </p>
            )}
          </div>

          <div>
            <label className={LABEL}>Notes</label>
            <textarea
              rows={3}
              className={`${FIELD} resize-none`}
              value={form.notes}
              onChange={set("notes")}
            />
          </div>

          <div>
            <label className={LABEL}>Contract Document (.docx, .doc, .pdf or image)</label>
            <input
              type="file"
              accept=".doc,.docx,.pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm font-medium text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-[#0F253B] file:text-white file:font-bold file:text-xs hover:file:bg-[#1b3a58] file:cursor-pointer"
            />
            <p className="mt-1.5 text-[11px] text-gray-400 font-medium">
              {file ? `Selected: ${file.name}` : "Optional — existing documents are kept."}
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-[#0F253B] font-bold hover:bg-gray-50 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold transition-all disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Contract"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
