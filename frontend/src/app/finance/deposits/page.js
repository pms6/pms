"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck, ShieldAlert, Wallet, Search, Download, Building2, DoorOpen, UserRound,
} from "lucide-react";
import { PageHeader } from "../../Shared/ui";
import api from "../../api/api";

// Mirrors the depositScheme.status enum on the Onboarding model.
const STATUS_TONE = {
  protected: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  not_started: "bg-slate-100 text-slate-600",
  failed: "bg-red-100 text-red-700",
};

const STATUS_LABEL = {
  protected: "Protected",
  pending: "Pending",
  not_started: "Not started",
  failed: "Failed",
};

const money = (n) =>
  `£${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d) => {
  if (!d) return "—";
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? String(d) : parsed.toLocaleDateString("en-GB");
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
 * Deposit register.
 *
 * Deposit data lives on the Onboarding record — tenancy.deposit for the amount,
 * depositScheme for the provider, reference and protection status — so the
 * register is built from there. There is no separate deposits collection.
 */
export default function FinanceDeposits() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      const { data } = await api.get("/payments/deposits");
      setRows(data?.data || []);
      setSummary(data?.summary || null);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load the deposit register.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => { await loadData(); })();
  }, [loadData]);

  const needle = q.trim().toLowerCase();
  const list = rows.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (!needle) return true;
    return (
      r.tenant?.toLowerCase().includes(needle) ||
      r.email?.toLowerCase().includes(needle) ||
      r.property?.toLowerCase().includes(needle) ||
      r.reference?.toLowerCase().includes(needle)
    );
  });

  const exportCSV = () => {
    const headers = "Tenant,Email,Property,Room,Deposit,Holding deposit,Scheme,Reference,Status,Start date\n";
    const body = list
      .map((r) =>
        [
          r.tenant, r.email, r.property, r.room,
          Number(r.deposit || 0).toFixed(2), Number(r.holdingDeposit || 0).toFixed(2),
          r.provider, r.reference, STATUS_LABEL[r.status] || r.status, fmtDate(r.startDate),
        ]
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([headers + body], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("href", url);
    a.setAttribute("download", "deposit_register.csv");
    a.click();
  };

  const unprotectedCount =
    (summary?.byStatus?.not_started || 0) + (summary?.byStatus?.pending || 0) + (summary?.byStatus?.failed || 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Deposits"
        subtitle="What is held, under which scheme, and whether it is protected"
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          icon={Wallet}
          label="Deposits held"
          value={loading ? "—" : money(summary?.total)}
          sub={loading ? "" : `${summary?.count ?? 0} tenancies`}
          tone="navy"
        />
        <Kpi icon={ShieldCheck} label="Protected" value={loading ? "—" : money(summary?.protected)} />
        <Kpi
          icon={ShieldAlert}
          label="Not protected"
          value={loading ? "—" : money(summary?.unprotected)}
          sub={loading ? "" : `${unprotectedCount} tenancies`}
          tone="orange"
        />
        <Kpi icon={Wallet} label="Holding deposits" value={loading ? "—" : money(summary?.holding)} />
      </div>

      {!loading && summary?.unprotected > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 flex items-start gap-2">
          <ShieldAlert size={16} className="shrink-0 mt-0.5" />
          <span>
            <strong>{money(summary.unprotected)}</strong> across {unprotectedCount} tenanc
            {unprotectedCount === 1 ? "y is" : "ies are"} not recorded as protected. A deposit
            taken on an assured shorthold tenancy must be placed in an approved scheme.
          </span>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tenant, property or reference…"
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B] outline-none focus:ring-2 focus:ring-[#F47C3C] sm:w-48"
        >
          <option value="">All statuses</option>
          {Object.keys(STATUS_LABEL).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <button
          onClick={exportCSV}
          disabled={list.length === 0}
          className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-600 transition-all disabled:opacity-40"
        >
          <Download size={14} /> Export (CSV)
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-gray-400 font-medium">Loading the deposit register…</div>
        ) : list.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-gray-500 font-medium">
              {rows.length === 0 ? "No deposits recorded yet" : "No deposits match this view"}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {rows.length === 0
                ? "A deposit appears here once it is entered on an applicant's onboarding record."
                : "Try another status or search term."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tenant</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Property</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Scheme</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Start</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Holding</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Deposit</th>
                  <th className="p-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm font-medium text-[#0F253B]">
                {list.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="p-4">
                      <span className="flex items-center gap-1.5 text-xs font-bold">
                        <UserRound size={12} className="text-gray-300 shrink-0" />
                        {r.tenant || "—"}
                      </span>
                      <span className="block text-[10px] text-gray-400 truncate max-w-[13rem]">{r.email}</span>
                    </td>
                    <td className="p-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <Building2 size={12} className="text-gray-300 shrink-0" />
                        {r.property || "—"}
                      </span>
                      {r.room && r.room !== "—" && (
                        <span className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-0.5">
                          <DoorOpen size={11} className="shrink-0" /> {r.room}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-xs">
                      <span className="font-bold">{r.provider || "—"}</span>
                      {r.reference && r.reference !== "—" && (
                        <span className="block text-[10px] text-gray-400">{r.reference}</span>
                      )}
                    </td>
                    <td className="p-4 text-xs text-gray-500">{fmtDate(r.startDate)}</td>
                    <td className="p-4 text-right text-xs text-gray-500">
                      {r.holdingDeposit ? money(r.holdingDeposit) : "—"}
                    </td>
                    <td className="p-4 text-right font-bold">{money(r.deposit)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_TONE[r.status] || "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABEL[r.status] || r.status}
                      </span>
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
