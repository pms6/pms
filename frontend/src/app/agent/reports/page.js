"use client";

import { useState } from "react";
import { PoundSterling, TrendingUp, Wallet, Percent, Download, FileText, Filter } from "lucide-react";
import { PageHeader, Card, Badge } from "../../Shared/ui";
import { reports, stats, rentSummary, money } from "../_data/dummy";

const PERIODS = ["This month", "This quarter", "This year"];
const TYPE_TONE = { Finance: "orange", Operations: "blue", Compliance: "amber", Lettings: "green" };

function Kpi({ icon: Icon, label, value, sub, tone = "light" }) {
  const wrap = { navy: "bg-[#0F253B] text-white", orange: "bg-gradient-to-br from-[#F47C3C] to-[#e0651f] text-white", light: "bg-white border border-gray-100 text-[#0F253B]" }[tone];
  const iconWrap = tone === "light" ? "bg-orange-50 text-[#F47C3C]" : "bg-white/15 text-white";
  const subC = tone === "light" ? "text-gray-400" : "text-white/70";
  return (
    <div className={`rounded-2xl p-5 shadow-sm ${wrap}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconWrap}`}><Icon size={22} /></div>
      <p className="text-2xl font-bold mt-4">{value}</p>
      <p className={`text-[11px] font-bold uppercase tracking-widest mt-1 ${subC}`}>{label}</p>
      {sub && <p className={`text-xs font-medium mt-0.5 ${subC}`}>{sub}</p>}
    </div>
  );
}

export default function AdminReports() {
  const [period, setPeriod] = useState("This month");
  const [typeFilter, setTypeFilter] = useState("");

  const { incomeExpenses, occupancyTrend, leadSources, expenseBreakdown, arrears, files } = reports;
  const maxIE = Math.max(...incomeExpenses.map((d) => d.income));
  const totalLeads = leadSources.reduce((s, l) => s + l.count, 0);
  const totalArrears = arrears.reduce((s, a) => s + a.amount, 0);
  const ytdIncome = incomeExpenses.reduce((s, d) => s + d.income, 0);
  const ytdExpenses = incomeExpenses.reduce((s, d) => s + d.expenses, 0);

  // Build a conic-gradient string for the expense donut.
  let acc = 0;
  const donut = expenseBreakdown
    .map((e) => {
      const from = acc; acc += e.pct;
      const col = { "bg-[#F47C3C]": "#F47C3C", "bg-[#0F253B]": "#0F253B", "bg-blue-500": "#3b82f6", "bg-amber-500": "#f59e0b", "bg-gray-400": "#9ca3af" }[e.tone];
      return `${col} ${from}% ${acc}%`;
    })
    .join(", ");

  const shownFiles = typeFilter ? files.filter((f) => f.type === typeFilter) : files;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Financial, occupancy, lettings & compliance insights"
        action={
          <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl p-1">
            {PERIODS.map((p) => (
              <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${period === p ? "bg-[#0F253B] text-white" : "text-gray-500 hover:bg-gray-50"}`}>{p}</button>
            ))}
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={PoundSterling} label="Income (YTD)" value={`£${ytdIncome}k`} sub="+6% vs last year" tone="orange" />
        <Kpi icon={Wallet} label="Expenses (YTD)" value={`£${ytdExpenses}k`} sub={`${Math.round((ytdExpenses / ytdIncome) * 100)}% of income`} tone="navy" />
        <Kpi icon={TrendingUp} label="Net income" value={`£${ytdIncome - ytdExpenses}k`} />
        <Kpi icon={Percent} label="Avg occupancy" value={`${stats.occupancyRate}%`} sub="up 8pts YTD" />
      </div>

      {/* Income vs Expenses + Occupancy trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Income vs Expenses (£k)" className="lg:col-span-2">
          <div className="flex items-end gap-4 h-52 pt-2">
            {incomeExpenses.map((d) => (
              <div key={d.m} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end justify-center gap-1 h-full">
                  <div className="w-1/2 bg-gradient-to-t from-[#F47C3C] to-[#f9a870] rounded-t-md" style={{ height: `${(d.income / maxIE) * 100}%` }} title={`Income £${d.income}k`} />
                  <div className="w-1/2 bg-[#0F253B] rounded-t-md" style={{ height: `${(d.expenses / maxIE) * 100}%` }} title={`Expenses £${d.expenses}k`} />
                </div>
                <span className="text-[10px] font-bold text-gray-400">{d.m}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-xs font-medium">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#F47C3C]" />Income</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#0F253B]" />Expenses</span>
          </div>
        </Card>

        <Card title="Occupancy trend">
          <div className="flex items-end gap-2 h-52 pt-2">
            {occupancyTrend.map((d) => (
              <div key={d.m} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-gray-100 rounded-md flex items-end h-full">
                  <div className="w-full bg-emerald-500 rounded-md" style={{ height: `${d.v}%` }} title={`${d.v}%`} />
                </div>
                <span className="text-[10px] font-bold text-gray-400">{d.m}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 font-medium mt-3">Portfolio occupancy climbed to <b className="text-[#0F253B]">{stats.occupancyRate}%</b>.</p>
        </Card>
      </div>

      {/* Expense breakdown donut + lead sources + arrears */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Expense breakdown">
          <div className="flex items-center gap-5">
            <div className="w-28 h-28 rounded-full shrink-0" style={{ background: `conic-gradient(${donut})` }}>
              <div className="w-full h-full rounded-full flex items-center justify-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-[#0F253B]">£{ytdExpenses}k</span>
                </div>
              </div>
            </div>
            <ul className="space-y-1.5 flex-1">
              {expenseBreakdown.map((e) => (
                <li key={e.label} className="flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center gap-2 text-gray-500"><span className={`w-2.5 h-2.5 rounded-full ${e.tone}`} />{e.label}</span>
                  <span className="font-bold text-[#0F253B]">{e.pct}%</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card title="Lead sources">
          <ul className="space-y-3">
            {leadSources.map((l) => (
              <li key={l.source}>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-gray-500">{l.source}</span>
                  <span className="text-[#0F253B]">{l.count}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full ${l.tone}`} style={{ width: `${(l.count / totalLeads) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Rent arrears">
          <p className="text-2xl font-bold text-[#0F253B]">{money(totalArrears)}</p>
          <p className="text-xs text-gray-400 font-medium mb-4">outstanding · {rentSummary.collectionRate}% collection rate</p>
          <ul className="space-y-2">
            {arrears.map((a) => (
              <li key={a.bucket} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50">
                <span className="text-xs font-semibold text-gray-500">{a.bucket}</span>
                <span className="text-sm font-bold text-[#0F253B]">{money(a.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Report library */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-lg font-bold text-[#0F253B]">Report Library</h2>
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-gray-300" />
            {["", "Finance", "Operations", "Compliance", "Lettings"].map((t) => (
              <button key={t || "all"} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${typeFilter === t ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"}`}>
                {t || "All"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shownFiles.map((f) => (
            <div key={f.id} className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#F47C3C] flex items-center justify-center"><FileText size={20} /></div>
                <Badge tone={TYPE_TONE[f.type] || "gray"}>{f.type}</Badge>
              </div>
              <p className="font-bold text-[#0F253B] mt-3">{f.name}</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5 flex-1">{f.desc}</p>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{f.period}</p>
                  <p className="text-[11px] text-gray-400 font-medium">Generated {new Date(f.generatedAt).toLocaleDateString("en-GB")}</p>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-2 bg-[#F47C3C] hover:bg-[#e06d30] text-white text-xs font-bold rounded-lg transition-all active:scale-[0.98]">
                  <Download size={14} /> Export
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
