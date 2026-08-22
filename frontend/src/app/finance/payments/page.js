"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PoundSterling, AlertCircle, Wallet, CheckCircle2, Clock, Search,
  Download, Loader2, Building2, DoorOpen,
} from "lucide-react";
import { PageHeader } from "../../Shared/ui";
import api from "../../api/api";

const STATUS_TONE = {
  paid: "bg-emerald-100 text-emerald-700",
  due: "bg-amber-100 text-amber-700",
  overdue: "bg-red-100 text-red-700",
  upcoming: "bg-slate-100 text-slate-600",
  awaiting_confirmation: "bg-blue-100 text-blue-700",
};

const STATUS_LABEL = {
  paid: "Paid",
  due: "Due",
  overdue: "Overdue",
  upcoming: "Upcoming",
  awaiting_confirmation: "Awaiting confirmation",
};

const money = (n) =>
  `£${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

// "2026-08" -> "Aug 2026"
const fmtPeriod = (key) => {
  if (!key) return "—";
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return Number.isNaN(d.getTime()) ? key : d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
};

function Kpi({ icon: Icon, label, value, sub, tone = "light" }) {
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
      {sub && <p className={`text-[11px] font-medium mt-0.5 ${subC}`}>{sub}</p>}
    </div>
  );
}

/**
 * Rent & Payments — the organization's whole rent ledger.
 *
 * Reads GET /payments, which generates any missing monthly charges and
 * re-derives due/overdue before returning, so the ledger is current rather than
 * only filling in when an individual tenant opens their own page.
 */
export default function FinancePayments() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [byMonth, setByMonth] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (q.trim()) params.search = q.trim();
      const { data } = await api.get("/payments", { params });
      setRows(data?.data || []);
      setSummary(data?.summary || null);
      setByMonth(data?.byMonth || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load the rent ledger.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, q]);

  useEffect(() => {
    (async () => { await loadData(); })();
  }, [loadData]);

  // Confirming is what marks a charge paid — a tenant can only ever claim.
  const resolveClaim = async (charge, confirm) => {
    setBusyId(charge._id);
    try {
      await api.patch(`/payments/${charge._id}/confirm`, { confirm });
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update the charge.");
    } finally {
      setBusyId(null);
    }
  };

  const exportCSV = () => {
    const headers = "Period,Due date,Tenant,Property,Room,Amount,Status,Paid date,Method\n";
    const body = rows
      .map((r) =>
        [
          r.periodKey || "", fmtDate(r.dueDate), r.tenantEmail || "", r.property || "",
          r.room || "", Number(r.amount || 0).toFixed(2),
          STATUS_LABEL[r.status] || r.status, fmtDate(r.paidDate), r.method || "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([headers + body], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("href", url);
    a.setAttribute("download", "rent_ledger.csv");
    a.click();
  };

  const maxMonth = Math.max(1, ...byMonth.map((m) => m.billed));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rent & Payments"
        subtitle="Every rent charge raised across the portfolio, and what has been collected"
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          icon={PoundSterling}
          label="Collected"
          value={loading ? "—" : money(summary?.collected)}
          sub={loading ? "" : `${summary?.collectionRate ?? 0}% of ${money(summary?.billed)} billed`}
          tone="navy"
        />
        <Kpi icon={Wallet} label="Outstanding" value={loading ? "—" : money(summary?.outstanding)} />
        <Kpi
          icon={AlertCircle}
          label="Overdue"
          value={loading ? "—" : money(summary?.overdue)}
          sub={loading ? "" : `${summary?.byStatus?.overdue ?? 0} charges`}
          tone="orange"
        />
        <Kpi
          icon={Clock}
          label="Awaiting confirmation"
          value={loading ? "—" : money(summary?.awaiting)}
          sub={loading ? "" : `${summary?.byStatus?.awaiting_confirmation ?? 0} claims`}
        />
      </div>

      {byMonth.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
            Billed vs collected by month
          </p>
          <div className="flex items-end gap-3 h-36">
            {byMonth.map((m) => (
              <div key={m.periodKey} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                <div className="w-full h-full bg-gray-100 rounded-lg flex items-end relative overflow-hidden">
                  <div
                    className="w-full bg-gray-200 rounded-lg absolute bottom-0"
                    style={{ height: `${(m.billed / maxMonth) * 100}%` }}
                    title={`Billed ${money(m.billed)}`}
                  />
                  <div
                    className="w-full bg-[#F47C3C] rounded-lg absolute bottom-0"
                    style={{ height: `${(m.collected / maxMonth) * 100}%` }}
                    title={`Collected ${money(m.collected)}`}
                  />
                </div>
                <span className="text-[10px] font-bold text-gray-400 truncate w-full text-center">
                  {fmtPeriod(m.periodKey)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[10px] font-bold text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#F47C3C]" /> Collected</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-gray-200" /> Billed</span>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tenant, property or room…"
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B] outline-none focus:ring-2 focus:ring-[#F47C3C] sm:w-56"
        >
          <option value="">All statuses</option>
          {Object.keys(STATUS_LABEL).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <button
          onClick={exportCSV}
          disabled={rows.length === 0}
          className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-600 transition-all disabled:opacity-40"
        >
          <Download size={14} /> Export (CSV)
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-gray-400 font-medium">Loading the rent ledger…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-gray-500 font-medium">No charges match this view</p>
            <p className="text-sm text-gray-400 mt-1">
              Charges are generated monthly from each tenancy&apos;s rent and start date.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Period</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tenant</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Property</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Due</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Amount</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm font-medium text-[#0F253B]">
                {rows.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="p-4 text-xs font-bold">{fmtPeriod(r.periodKey)}</td>
                    <td className="p-4 text-xs text-gray-500 truncate max-w-[14rem]">{r.tenantEmail || "—"}</td>
                    <td className="p-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <Building2 size={12} className="text-gray-300 shrink-0" />
                        {r.property || "—"}
                      </span>
                      {r.room && (
                        <span className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-0.5">
                          <DoorOpen size={11} className="shrink-0" /> {r.room}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-xs">
                      <span className={r.status === "overdue" ? "text-red-600 font-bold" : "text-gray-500"}>
                        {fmtDate(r.dueDate)}
                      </span>
                      {r.paidDate && (
                        <span className="block text-[10px] text-emerald-600 font-bold">
                          Paid {fmtDate(r.paidDate)}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right font-bold">{money(r.amount)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_TONE[r.status] || "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {r.status === "awaiting_confirmation" && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => resolveClaim(r, true)}
                            disabled={busyId === r._id}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
                            title="Confirm this payment"
                          >
                            {busyId === r._id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                            Confirm
                          </button>
                          <button
                            onClick={() => resolveClaim(r, false)}
                            disabled={busyId === r._id}
                            className="px-2.5 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-500 rounded-lg text-[11px] font-bold transition-all disabled:opacity-50"
                            title="Reject the claim and return it to the ledger"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
