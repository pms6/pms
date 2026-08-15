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

function ExpenseModal({ properties, onClose, onSave }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    category: "Maintenance",
    description: "",
    propertyId: "",
    supplier: "",
    paymentMethod: "",
    reference: "",
    notes: "",
  });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      let fileUrl = "";
      let fileName = "";
      if (file) {
        const uploaded = await uploadFileToCloudinary(file);
        fileUrl = uploaded.url;
        fileName = uploaded.name || file.name;
      }
      await onSave({ ...form, fileUrl, fileName });
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
          <h3 className="text-xl font-bold text-[#0F253B]">Add Expense</h3>
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

          <div>
            <label className={LABEL}>Receipt / Invoice</label>
            <input
              type="file"
              accept=".doc,.docx,.pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm font-medium text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-[#0F253B] file:text-white file:font-bold file:text-xs hover:file:bg-[#1b3a58] file:cursor-pointer"
            />
            {file && <p className="mt-1.5 text-[11px] text-gray-400 font-medium">Selected: {file.name}</p>}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {saving ? "Saving…" : "Add Expense"}
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

  const createExpense = async (form) => {
    await api.post("/expenses", {
      ...form,
      propertyId: form.propertyId || null,
      amount: Number(form.amount),
    });
    setShowModal(false);
    await loadData();
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
            onClick={() => setShowModal(true)}
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
                {rows.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="p-4 text-xs text-gray-500">
                      {new Date(r.date).toLocaleDateString("en-GB")}
                    </td>
                    <td className="p-4 text-xs font-bold">{r.category}</td>
                    <td className="p-4 text-xs">
                      {r.description || "—"}
                      {r.fileUrl && (
                        <a
                          href={r.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-[10px] font-bold text-[#F47C3C] hover:underline"
                        >
                          receipt
                        </a>
                      )}
                    </td>
                    <td className="p-4 text-xs text-gray-500">{r.property || "—"}</td>
                    <td className="p-4 text-xs text-gray-500">{r.supplier || "—"}</td>
                    <td className="p-4 text-right font-bold">{money(r.amount)}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => removeExpense(r)}
                        className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ExpenseModal
          properties={properties}
          onClose={() => setShowModal(false)}
          onSave={createExpense}
        />
      )}
    </div>
  );
}
