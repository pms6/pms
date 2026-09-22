"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, X, Pencil, Search, Landmark, Zap, Printer } from "lucide-react";
import { PageHeader, Badge } from "./ui";
import { MediaUploader, MediaViewerModal } from "./MediaAttachments";
import api from "@/app/api/api";
import { useAuth } from "@/app/Context/AuthContext";
import { fmtDate, monthKey, monthLabel } from "@/app/utils/cleaningSheet";
import {
  moneyOrBlank,
  printCouncilTaxPdf,
  printBillsPdf,
} from "@/app/utils/councilTaxBillsSheet";
import {
  FIELD,
  LABEL,
  money,
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
 * The Council Tax and Bills section — two of the office's sheets on one
 * page, one card each:
 *
 *   Council Tax   Sr# | Property | Account Holder Name | Account# |
 *                 Move in Date | Email | Details | 1st Installment |
 *                 2nd Installment
 *   Bills Record  Sr# | Name of property | Date | Type | Payment name |
 *                 Amount | Status | Bill
 *
 * "Sr#" is the row number, so it is never stored. MUST stay in sync with
 * backend/models/CouncilTax.js and backend/models/BillRecord.js.
 * ------------------------------------------------------------------ */

// MUST stay in sync with BILL_TYPES in backend/models/BillRecord.js. Offered as
// suggestions only — any type can be typed.
export const BILL_TYPES = ["Octopus Energy", "Gas", "Water", "Electricity"];

// MUST stay in sync with BILL_STATUSES in backend/models/BillRecord.js.
export const BILL_STATUSES = ["Pending", "Done"];

const STATUS_TONE = { Done: "green", Pending: "amber" };

const TABS = [
  { key: "council-tax", label: "Council Tax", icon: Landmark },
  { key: "bills", label: "Bills", icon: Zap },
];

const sumOf = (rows, pick) => rows.reduce((sum, r) => sum + Number(pick(r) || 0), 0);

// Number inputs hand back strings; "" means the cell was left blank.
const numOrNull = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

const Dash = () => <span className="text-gray-300">—</span>;

/* ------------------------------------------------------------------ *
 * Council tax — add / edit
 * ------------------------------------------------------------------ */
function CouncilTaxModal({ initial, properties, onClose, onSave }) {
  const isEdit = Boolean(initial?._id);

  const [form, setForm] = useState({
    propertyId: initial?.propertyId || "",
    property: initial?.property || "",
    accountHolder: initial?.accountHolder || "",
    accountNumber: initial?.accountNumber || "",
    moveInDate: toInputDate(initial?.moveInDate),
    email: initial?.email || "",
    details: initial?.details || "",
    firstInstallment: initial?.firstInstallment ?? "",
    secondInstallment: initial?.secondInstallment ?? "",
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.property.trim()) { setError("Property is required"); return; }

    setSaving(true);
    setError("");
    try {
      await onSave({
        propertyId: form.propertyId || null,
        property: form.property.trim(),
        accountHolder: form.accountHolder.trim(),
        accountNumber: form.accountNumber.trim(),
        moveInDate: form.moveInDate || null,
        email: form.email.trim(),
        details: form.details.trim(),
        firstInstallment: numOrNull(form.firstInstallment),
        secondInstallment: numOrNull(form.secondInstallment),
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={isEdit ? "Edit Council Tax" : "New Council Tax Entry"}
      subtitle="Who the council tax account is in, and the instalments due"
      onClose={onClose}
    >
      <ErrorBanner>{error}</ErrorBanner>

      <form onSubmit={submit} className="space-y-4">
        <PropertyFields form={form} setForm={setForm} properties={properties} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Account holder name</label>
            <input className={FIELD} value={form.accountHolder} onChange={set("accountHolder")} placeholder="e.g. Hamza Sheikh" />
          </div>
          <div>
            <label className={LABEL}>Account#</label>
            <input className={FIELD} value={form.accountNumber} onChange={set("accountNumber")} placeholder="e.g. 84362796" />
          </div>
          <div>
            <label className={LABEL}>Move in date</label>
            <input type="date" className={FIELD} value={form.moveInDate} onChange={set("moveInDate")} />
          </div>
          <div>
            <label className={LABEL}>Email</label>
            <input type="email" className={FIELD} value={form.email} onChange={set("email")} placeholder="Registered email" />
          </div>
        </div>

        <div>
          <label className={LABEL}>Details</label>
          <textarea
            rows={5}
            className={FIELD}
            value={form.details}
            onChange={set("details")}
            placeholder={"Tenant name, date of birth, phone,\nweb reference, single person discount…"}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>1st installment (£)</label>
            <input type="number" min="0" step="0.01" className={FIELD} value={form.firstInstallment} onChange={set("firstInstallment")} placeholder="0.00" />
          </div>
          <div>
            <label className={LABEL}>2nd installment (£)</label>
            <input type="number" min="0" step="0.01" className={FIELD} value={form.secondInstallment} onChange={set("secondInstallment")} placeholder="0.00" />
          </div>
        </div>

        <SubmitButton saving={saving} isEdit={isEdit} />
      </form>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ *
 * Bills record — add / edit
 * ------------------------------------------------------------------ */
function BillModal({ initial, properties, onClose, onSave }) {
  const isEdit = Boolean(initial?._id);

  const [form, setForm] = useState({
    propertyId: initial?.propertyId || "",
    property: initial?.property || "",
    date: isEdit ? toInputDate(initial?.date) : toInputDate(new Date()),
    type: initial?.type || "",
    paymentName: initial?.paymentName || "",
    amount: initial?.amount ?? "",
    status: initial?.status || "",
    bill: initial?.bill || "",
    notes: initial?.notes || "",
  });

  // Kept out of `form` because the uploader appends asynchronously.
  const [billFiles, setBillFiles] = useState(() => filesOf(initial?.billFiles));
  const [uploading, setUploading] = useState(0);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.property.trim()) { setError("Property is required"); return; }
    // Saving mid-upload would drop whatever has not landed yet.
    if (uploading) { setError("Wait for the uploads to finish"); return; }

    setSaving(true);
    setError("");
    try {
      await onSave({
        propertyId: form.propertyId || null,
        property: form.property.trim(),
        date: form.date || null,
        type: form.type.trim(),
        paymentName: form.paymentName.trim(),
        amount: numOrNull(form.amount),
        status: form.status,
        bill: form.bill.trim(),
        notes: form.notes.trim(),
        billFiles,
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={isEdit ? "Edit Bill Record" : "New Bill Record"}
      subtitle="A utility payment at a property — with a copy of the bill if you have one"
      onClose={onClose}
    >
      <ErrorBanner>{error}</ErrorBanner>

      <form onSubmit={submit} className="space-y-4">
        <PropertyFields form={form} setForm={setForm} properties={properties} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>Date</label>
            <input type="date" className={FIELD} value={form.date} onChange={set("date")} />
          </div>
          <div>
            <label className={LABEL}>Type</label>
            <input
              className={FIELD}
              value={form.type}
              onChange={set("type")}
              list="bill-types"
              placeholder="Octopus Energy, Gas, Water, Electricity"
            />
            <datalist id="bill-types">
              {BILL_TYPES.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div>
            <label className={LABEL}>Amount (£)</label>
            <input type="number" min="0" step="0.01" className={FIELD} value={form.amount} onChange={set("amount")} placeholder="0.00" />
          </div>
          <div>
            <label className={LABEL}>Status</label>
            <select className={FIELD} value={form.status} onChange={set("status")}>
              <option value="">—</option>
              {BILL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={LABEL}>Payment name</label>
          <input className={FIELD} value={form.paymentName} onChange={set("paymentName")} placeholder="e.g. 30 top up done on 23 May" />
        </div>

        <div>
          <label className={LABEL}>Bill</label>
          <input className={FIELD} value={form.bill} onChange={set("bill")} placeholder="e.g. Good Energy, electricity" />
        </div>

        <div>
          <label className={LABEL}>Notes</label>
          <textarea rows={2} className={FIELD} value={form.notes} onChange={set("notes")} placeholder="Anything worth remembering…" />
        </div>

        <MediaUploader
          files={billFiles}
          onChange={setBillFiles}
          onUploadingChange={setUploading}
          label="Bill copy"
          hint="Drop the bill here, or click to choose — PDF, photo, any file type"
        />

        <SubmitButton saving={saving} isEdit={isEdit} />
      </form>
    </ModalShell>
  );
}

/* ------------------------------------------------------------------ *
 * Read-only detail
 * ------------------------------------------------------------------ */
function ViewModal({ kind, row, onClose, onEdit, onOpenFiles }) {
  const isTax = kind === "council-tax";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5 gap-4">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-[#0F253B] break-words">{row.property}</h3>
            <p className="text-xs text-gray-400 font-medium">
              {isTax ? "Council tax" : `Bill record${row.date ? ` · ${fmtDate(row.date)}` : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge tone={isTax ? "blue" : "orange"}>{isTax ? "Council Tax" : "Bill"}</Badge>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
          </div>
        </div>

        {isTax ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <ViewRow label="Account holder">{row.accountHolder}</ViewRow>
              <ViewRow label="Account#">{row.accountNumber}</ViewRow>
              <ViewRow label="Move in date">{fmtDate(row.moveInDate)}</ViewRow>
              <ViewRow label="Email">{row.email}</ViewRow>
              <ViewRow label="1st installment">{moneyOrBlank(row.firstInstallment)}</ViewRow>
              <ViewRow label="2nd installment">{moneyOrBlank(row.secondInstallment)}</ViewRow>
            </div>
            <div>
              <p className={LABEL}>Details</p>
              <p className="text-sm text-gray-600 font-medium whitespace-pre-line leading-relaxed">
                {row.details || "—"}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <ViewRow label="Date">{fmtDate(row.date)}</ViewRow>
              <ViewRow label="Type">{row.type}</ViewRow>
              <ViewRow label="Payment name">{row.paymentName}</ViewRow>
              <ViewRow label="Amount">{moneyOrBlank(row.amount)}</ViewRow>
              <ViewRow label="Status">{row.status}</ViewRow>
              <ViewRow label="Bill">{row.bill}</ViewRow>
            </div>

            {row.notes && (
              <div>
                <p className={LABEL}>Notes</p>
                <p className="text-sm text-gray-500 font-medium whitespace-pre-line leading-relaxed">{row.notes}</p>
              </div>
            )}

            <FilesBlock
              label="Bill copy"
              files={filesOf(row.billFiles)}
              onOpen={() => onOpenFiles(row, filesOf(row.billFiles))}
            />
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
export default function CouncilTaxBillsBoard({
  subtitle = "The council tax account at each property, and the utility bills paid",
}) {
  const { organization } = useAuth();

  const [tab, setTab] = useState("council-tax");

  const [councilTax, setCouncilTax] = useState([]);
  const [bills, setBills] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [month, setMonth] = useState("");

  // { kind: "council-tax" | "bills", row } — {} row = create.
  const [modal, setModal] = useState(null);
  // The entry whose full detail is open: { kind, row }.
  const [viewing, setViewing] = useState(null);
  // What the media viewer is open on: { key, title, subtitle, files }.
  const [viewer, setViewer] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [taxRes, billRes, propsRes] = await Promise.all([
        api.get("/council-tax-bills/council-tax"),
        api.get("/council-tax-bills/bills"),
        api.get("/properties", { params: { limit: 200 } }),
      ]);
      setCouncilTax(taxRes.data.data || []);
      setBills(billRes.data.data || []);
      setProperties(propsRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load council tax and bills");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const switchTab = (next) => {
    setTab(next);
    setQ("");
    setMonth("");
  };

  const months = useMemo(() => {
    const seen = new Set(bills.map((r) => monthKey(r.date)).filter(Boolean));
    return [...seen].sort().reverse();
  }, [bills]);

  const needle = q.trim().toLowerCase();
  const matches = (values) =>
    needle ? values.some((v) => String(v || "").toLowerCase().includes(needle)) : true;

  const visibleTax = councilTax.filter((r) =>
    matches([r.property, r.accountHolder, r.accountNumber, r.email, r.details])
  );

  const visibleBills = bills
    .filter((r) => (month ? monthKey(r.date) === month : true))
    .filter((r) => matches([r.property, r.type, r.paymentName, r.status, r.bill, r.notes]));

  const save = async (payload) => {
    const { kind, row } = modal;
    const base = `/council-tax-bills/${kind}`;
    if (row?._id) await api.put(`${base}/${row._id}`, payload);
    else await api.post(base, payload);
    setModal(null);
    await load();
  };

  const remove = async (kind, row) => {
    const what = kind === "council-tax" ? "the council tax entry" : "this bill record";
    if (!confirm(`Delete ${what} for "${row.property}"?`)) return;

    setViewing((v) => (v?.row._id === row._id ? null : v));
    const setRows = kind === "council-tax" ? setCouncilTax : setBills;
    const snapshot = kind === "council-tax" ? councilTax : bills;
    setRows((prev) => prev.filter((r) => r._id !== row._id));
    try {
      await api.delete(`/council-tax-bills/${kind}/${row._id}`);
    } catch (err) {
      setRows(snapshot);
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const openViewer = (row, files) =>
    setViewer({ key: `${row._id}-bill`, title: row.property, subtitle: "Bill copy", files });

  const printPdf = () => {
    const company = organization?.name || "";
    const opened =
      tab === "council-tax"
        ? printCouncilTaxPdf(visibleTax, { company })
        : printBillsPdf(visibleBills, {
            company,
            title: month ? `Bills Record - ${monthLabel(month)}` : "Bills Record",
          });
    if (!opened) alert("Allow pop-ups for this site to print the PDF.");
  };

  const firstTotal = sumOf(visibleTax, (r) => r.firstInstallment);
  const secondTotal = sumOf(visibleTax, (r) => r.secondInstallment);
  const billsTotal = sumOf(visibleBills, (r) => r.amount);

  const cards =
    tab === "council-tax"
      ? [
          { label: "Properties", value: visibleTax.length },
          { label: "1st installments", value: money(firstTotal) },
          { label: "2nd installments", value: money(secondTotal) },
        ]
      : [
          { label: "Bills", value: visibleBills.length },
          { label: "Total amount", value: money(billsTotal) },
          { label: "Pending", value: visibleBills.filter((r) => r.status !== "Done").length },
        ];

  const thClass = "px-4 py-3";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Council Tax and Bills"
        subtitle={subtitle}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={printPdf}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-100 text-[#0F253B] font-bold text-sm rounded-xl transition-all disabled:opacity-50"
            >
              <Printer size={16} /> PDF
            </button>
            <button
              onClick={() => setModal({ kind: tab, row: {} })}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              <Plus size={18} /> {tab === "council-tax" ? "New Council Tax" : "New Bill"}
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

      {/* The two sheets, one card each */}
      <div className="grid grid-cols-2 gap-3 max-w-xl">
        {TABS.map(({ key, label, icon: Icon }) => {
          const selected = tab === key;
          const count = key === "council-tax" ? councilTax.length : bills.length;
          return (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={`p-5 rounded-2xl border text-left transition-all flex items-center gap-4 ${
                selected
                  ? "bg-[#0F253B] text-white border-[#0F253B] shadow-sm"
                  : "bg-white text-[#0F253B] border-gray-100 hover:bg-gray-50 shadow-sm"
              }`}
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  selected ? "bg-white/10" : "bg-orange-50"
                }`}
              >
                <Icon size={20} className="text-[#F47C3C]" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">{label}</span>
                <span className={`block text-xs font-medium ${selected ? "text-white/60" : "text-gray-400"}`}>
                  {loading ? "—" : `${count} ${count === 1 ? "entry" : "entries"}`}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        {cards.map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-2xl font-bold text-[#0F253B]">{loading ? "—" : s.value}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === "council-tax" ? "Search property, holder, account…" : "Search property, type, payment…"}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>

        {tab === "bills" && (
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
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/70">
          <p className="text-sm font-bold text-[#0F253B] flex items-center gap-2">
            {tab === "council-tax" ? (
              <><Landmark size={15} className="text-[#F47C3C]" /> Council Tax</>
            ) : (
              <><Zap size={15} className="text-[#F47C3C]" /> Bills Record{month ? ` - ${monthLabel(month)}` : ""}</>
            )}
          </p>
        </div>

        <div className="overflow-x-auto">
          {tab === "council-tax" ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                  <th className={`${thClass} w-10`}>Sr#</th>
                  <th className={thClass}>Property</th>
                  <th className={thClass}>Account Holder Name</th>
                  <th className={thClass}>Account#</th>
                  <th className={`${thClass} whitespace-nowrap`}>Move in Date</th>
                  <th className={thClass}>Email</th>
                  <th className={thClass}>Details</th>
                  <th className={`${thClass} whitespace-nowrap`}>1st Installment</th>
                  <th className={`${thClass} whitespace-nowrap`}>2nd Installment</th>
                  <th className={`${thClass} w-32 text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleTax.length === 0 ? (
                  <EmptyRow
                    colSpan={10}
                    loading={loading}
                    anyRows={councilTax.length > 0}
                    emptyText="No council tax entries recorded yet"
                  />
                ) : (
                  visibleTax.map((r, i) => (
                    <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50/50 align-top">
                      <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-[#0F253B] min-w-[180px]">{r.property}</td>
                      <td className="px-4 py-3 text-[#0F253B] font-medium">{r.accountHolder || <Dash />}</td>
                      <td className="px-4 py-3 text-gray-500 font-medium">{r.accountNumber || <Dash />}</td>
                      <td className="px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{r.moveInDate ? fmtDate(r.moveInDate) : <Dash />}</td>
                      <td className="px-4 py-3 text-gray-500 font-medium">{r.email || <Dash />}</td>
                      <td className="px-4 py-3 text-gray-500 font-medium text-xs whitespace-pre-line min-w-[200px] max-w-xs">
                        {r.details ? <p className="line-clamp-4">{r.details}</p> : <Dash />}
                      </td>
                      <td className="px-4 py-3 text-[#0F253B] font-bold whitespace-nowrap">{moneyOrBlank(r.firstInstallment) || <Dash />}</td>
                      <td className="px-4 py-3 text-[#0F253B] font-bold whitespace-nowrap">{moneyOrBlank(r.secondInstallment) || <Dash />}</td>
                      <td className="px-4 py-3">
                        <RowActions
                          onView={() => setViewing({ kind: "council-tax", row: r })}
                          onEdit={() => setModal({ kind: "council-tax", row: r })}
                          onDelete={() => remove("council-tax", r)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {visibleTax.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50/50 border-t border-gray-100">
                    <td colSpan={7} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Total</td>
                    <td className="px-4 py-3 font-bold text-[#0F253B] whitespace-nowrap">{money(firstTotal)}</td>
                    <td className="px-4 py-3 font-bold text-[#0F253B] whitespace-nowrap">{money(secondTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                  <th className={`${thClass} w-10`}>Sr#</th>
                  <th className={thClass}>Name of Property</th>
                  <th className={`${thClass} w-28`}>Date</th>
                  <th className={thClass}>Type</th>
                  <th className={thClass}>Payment Name</th>
                  <th className={`${thClass} w-24`}>Amount</th>
                  <th className={`${thClass} w-24`}>Status</th>
                  <th className={thClass}>Bill</th>
                  <th className={`${thClass} w-32 text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleBills.length === 0 ? (
                  <EmptyRow
                    colSpan={9}
                    loading={loading}
                    anyRows={bills.length > 0}
                    emptyText="No bills recorded yet"
                  />
                ) : (
                  visibleBills.map((r, i) => (
                    <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50/50 align-top">
                      <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                      <td className="px-4 py-3 min-w-[180px]">
                        <p className="font-semibold text-[#0F253B]">{r.property}</p>
                        {r.notes && <p className="text-[11px] font-medium text-gray-400 truncate max-w-xs">{r.notes}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-medium whitespace-nowrap">{r.date ? fmtDate(r.date) : <Dash />}</td>
                      <td className="px-4 py-3 text-[#0F253B] font-medium">{r.type || <Dash />}</td>
                      <td className="px-4 py-3 text-gray-500 font-medium">{r.paymentName || <Dash />}</td>
                      <td className="px-4 py-3 text-[#0F253B] font-bold whitespace-nowrap">{moneyOrBlank(r.amount) || <Dash />}</td>
                      <td className="px-4 py-3">
                        {r.status ? <Badge tone={STATUS_TONE[r.status] || "gray"}>{r.status}</Badge> : <Dash />}
                      </td>
                      <td className="px-4 py-3 space-y-1.5">
                        <p className="font-medium text-[#0F253B]">{r.bill || <Dash />}</p>
                        {filesOf(r.billFiles).length > 0 && (
                          <FileStrip files={filesOf(r.billFiles)} onOpen={() => openViewer(r, filesOf(r.billFiles))} />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <RowActions
                          onView={() => setViewing({ kind: "bills", row: r })}
                          onEdit={() => setModal({ kind: "bills", row: r })}
                          onDelete={() => remove("bills", r)}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {visibleBills.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50/50 border-t border-gray-100">
                    <td colSpan={5} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">Total</td>
                    <td className="px-4 py-3 font-bold text-[#0F253B] whitespace-nowrap">{money(billsTotal)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>

      {viewing && (
        <ViewModal
          kind={viewing.kind}
          row={viewing.row}
          onClose={() => setViewing(null)}
          onEdit={(row) => { setViewing(null); setModal({ kind: viewing.kind, row }); }}
          // Swap to the viewer rather than stacking it over the detail panel.
          onOpenFiles={(...args) => { setViewing(null); openViewer(...args); }}
        />
      )}

      {/* Keyed so opening a different set mounts a fresh viewer, which resets
          it to the first file. */}
      {viewer && (
        <MediaViewerModal
          key={viewer.key}
          title={viewer.title}
          subtitle={viewer.subtitle}
          files={viewer.files}
          onClose={() => setViewer(null)}
        />
      )}

      {modal?.kind === "council-tax" && (
        <CouncilTaxModal
          initial={modal.row?._id ? modal.row : null}
          properties={properties}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}

      {modal?.kind === "bills" && (
        <BillModal
          initial={modal.row?._id ? modal.row : null}
          properties={properties}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
