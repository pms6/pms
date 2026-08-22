"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Scale, Download, PieChart, PoundSterling,
} from "lucide-react";
import { PageHeader } from "../../Shared/ui";
import api from "../../api/api";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const money = (n) =>
  `£${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const yearOptions = () => {
  const now = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => now - i);
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
 * Finance reports — money in against money out for one year.
 *
 * Income comes from the rent ledger (GET /payments, byMonth) and costs from the
 * expense sheet (GET /expenses/monthly). Both are real organization data; there
 * is no separate reporting store to reconcile against.
 */
export default function FinanceReports() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [income, setIncome] = useState([]);
  const [expenseSheet, setExpenseSheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [payRes, expRes] = await Promise.all([
        api.get("/payments"),
        api.get("/expenses/monthly", { params: { year } }),
      ]);
      setIncome(payRes.data?.byMonth || []);
      setExpenseSheet(expRes.data || null);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    (async () => { await loadData(); })();
  }, [loadData]);

  // Fold both sources onto the same 12-month spine so they line up.
  const expenseMonths = expenseSheet?.months || [];
  const rows = MONTHS.map((label, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    const inc = income.find((m) => m.periodKey === key);
    // The expense sheet returns one entry per month, in order.
    const exp = expenseMonths[i];
    const collected = inc?.collected || 0;
    const billed = inc?.billed || 0;
    const spent = exp?.total || 0;
    return { label, key, billed, collected, spent, net: collected - spent };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.billed += r.billed;
      acc.collected += r.collected;
      acc.spent += r.spent;
      return acc;
    },
    { billed: 0, collected: 0, spent: 0 }
  );
  totals.net = totals.collected - totals.spent;
  totals.margin = totals.collected ? Math.round((totals.net / totals.collected) * 100) : 0;

  const scale = Math.max(1, ...rows.map((r) => Math.max(r.collected, r.spent)));
  const byCategory = Object.entries(expenseSheet?.byCategory || {}).sort((a, b) => b[1] - a[1]);
  const maxCategory = Math.max(1, ...byCategory.map(([, v]) => v));

  const exportCSV = () => {
    const headers = "Month,Rent billed,Rent collected,Expenses,Net\n";
    const body = rows
      .map((r) =>
        [`${r.label} ${year}`, r.billed.toFixed(2), r.collected.toFixed(2), r.spent.toFixed(2), r.net.toFixed(2)]
          .map((v) => `"${v}"`)
          .join(",")
      )
      .join("\n");
    const footer = `\n"Total","${totals.billed.toFixed(2)}","${totals.collected.toFixed(2)}","${totals.spent.toFixed(2)}","${totals.net.toFixed(2)}"`;
    const blob = new Blob([headers + body + footer], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("href", url);
    a.setAttribute("download", `finance_report_${year}.csv`);
    a.click();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        subtitle="Rent collected against operating costs"
        action={
          <div className="flex items-center gap-2">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B] outline-none focus:ring-2 focus:ring-[#F47C3C]"
            >
              {yearOptions().map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-600 transition-all bg-white"
            >
              <Download size={14} /> Export (CSV)
            </button>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          icon={TrendingUp}
          label="Rent collected"
          value={loading ? "—" : money(totals.collected)}
          sub={loading ? "" : `of ${money(totals.billed)} billed`}
          tone="navy"
        />
        <Kpi icon={TrendingDown} label="Expenses" value={loading ? "—" : money(totals.spent)} tone="orange" />
        <Kpi
          icon={Scale}
          label="Net"
          value={loading ? "—" : money(totals.net)}
          sub={loading ? "" : `${totals.margin}% margin`}
        />
        <Kpi
          icon={PoundSterling}
          label="Uncollected rent"
          value={loading ? "—" : money(totals.billed - totals.collected)}
        />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
          Rent collected vs expenses — {year}
        </p>
        <div className="flex items-end gap-2 h-44">
          {rows.map((r) => (
            <div key={r.key} className="flex-1 flex flex-col items-center gap-2 min-w-0">
              <div className="w-full h-full flex items-end gap-0.5">
                <div
                  className="flex-1 bg-[#0F253B] rounded-t"
                  style={{ height: `${(r.collected / scale) * 100}%` }}
                  title={`Collected ${money(r.collected)}`}
                />
                <div
                  className="flex-1 bg-[#F47C3C] rounded-t"
                  style={{ height: `${(r.spent / scale) * 100}%` }}
                  title={`Expenses ${money(r.spent)}`}
                />
              </div>
              <span className="text-[10px] font-bold text-gray-400">{r.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] font-bold text-gray-400">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#0F253B]" /> Rent collected</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#F47C3C]" /> Expenses</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Monthly breakdown</p>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="p-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Month</th>
                  <th className="p-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Collected</th>
                  <th className="p-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Expenses</th>
                  <th className="p-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs font-medium text-[#0F253B]">
                {rows.map((r) => (
                  <tr key={r.key} className="hover:bg-gray-50/70">
                    <td className="p-3 font-bold">{r.label}</td>
                    <td className="p-3 text-right">{r.collected ? money(r.collected) : "—"}</td>
                    <td className="p-3 text-right">{r.spent ? money(r.spent) : "—"}</td>
                    <td className={`p-3 text-right font-bold ${r.net < 0 ? "text-red-600" : r.net > 0 ? "text-emerald-600" : "text-gray-300"}`}>
                      {r.net ? money(r.net) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-100 text-xs font-bold text-[#0F253B]">
                  <td className="p-3">Total</td>
                  <td className="p-3 text-right">{money(totals.collected)}</td>
                  <td className="p-3 text-right">{money(totals.spent)}</td>
                  <td className={`p-3 text-right ${totals.net < 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {money(totals.net)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-1.5">
            <PieChart size={12} className="text-[#F47C3C]" /> Expenses by category — {year}
          </p>
          {byCategory.length === 0 ? (
            <p className="text-xs font-medium text-gray-400">No expenses recorded for {year}.</p>
          ) : (
            <div className="space-y-2.5">
              {byCategory.map(([cat, amount]) => (
                <div key={cat}>
                  <div className="flex items-center justify-between text-xs font-bold text-[#0F253B] mb-1">
                    <span className="truncate">{cat}</span>
                    <span className="text-gray-500 shrink-0 ml-2">{money(amount)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#F47C3C] rounded-full"
                      style={{ width: `${(amount / maxCategory) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
