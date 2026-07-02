"use client";

import { useState } from "react";
import {
  LineChart, PoundSterling, Wallet, TrendingUp, Landmark, Receipt, FileText,
  Download, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { PageHeader, Card, Badge } from "../../Shared/ui";
import { finances, money } from "../_data/dummy";

const TABS = [
  { key: "graph", label: "Financial Graph", icon: LineChart },
  { key: "settlement", label: "Settlement", icon: Landmark },
  { key: "items", label: "Financial Items", icon: Receipt },
  { key: "reports", label: "Other Reports", icon: FileText },
];

const SETTLE_TONE = { paid: "green", due: "amber", pending: "blue" };

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

/* ---- Sub-section: Financial Graph ---- */
function GraphView() {
  const { summary, cashflow, revenueByProperty } = finances;
  const maxIE = Math.max(...cashflow.map((d) => d.income));
  const maxRev = Math.max(...revenueByProperty.map((r) => r.amount));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={PoundSterling} label="Income (YTD)" value={money(summary.income)} sub="+6% YoY" tone="orange" />
        <Kpi icon={Wallet} label="Expenses (YTD)" value={money(summary.expenses)} tone="navy" />
        <Kpi icon={TrendingUp} label="Net profit" value={money(summary.net)} />
        <Kpi icon={TrendingUp} label="Profit margin" value={`${summary.margin}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Cashflow — income vs expenses (£k)" className="lg:col-span-2">
          <div className="flex items-end gap-4 h-56 pt-2">
            {cashflow.map((d) => (
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

        <Card title="Revenue by property (/mo)">
          <ul className="space-y-3">
            {revenueByProperty.map((r) => (
              <li key={r.name}>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-gray-500 truncate pr-2">{r.name}</span>
                  <span className="text-[#0F253B] shrink-0">{money(r.amount)}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full ${r.tone}`} style={{ width: `${(r.amount / maxRev) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ---- Sub-section: Settlement ---- */
function SettlementView() {
  const { settlements } = finances;
  const totalNet = settlements.reduce((s, x) => s + x.netPayout, 0);
  const pending = settlements.filter((s) => s.status !== "paid").reduce((s, x) => s + x.netPayout, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi icon={Landmark} label="Total payouts" value={money(totalNet)} tone="navy" />
        <Kpi icon={Wallet} label="Awaiting payment" value={money(pending)} tone="orange" />
        <Kpi icon={FileText} label="Statements" value={settlements.length} />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Period</th>
                <th className="px-5 py-3 text-right">Gross</th>
                <th className="px-5 py-3 text-right">Mgmt fee</th>
                <th className="px-5 py-3 text-right">Maint.</th>
                <th className="px-5 py-3 text-right">Net payout</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3">
                    <p className="font-bold text-[#0F253B]">{s.owner}</p>
                    <p className="text-[11px] text-gray-400">{s.properties}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{s.period}</td>
                  <td className="px-5 py-3 text-right text-gray-500">{money(s.grossRent)}</td>
                  <td className="px-5 py-3 text-right text-red-500">-{money(s.mgmtFee)}</td>
                  <td className="px-5 py-3 text-right text-red-500">-{money(s.maintenance)}</td>
                  <td className="px-5 py-3 text-right font-bold text-[#0F253B]">{money(s.netPayout)}</td>
                  <td className="px-5 py-3"><Badge tone={SETTLE_TONE[s.status] || "gray"}>{s.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---- Sub-section: Financial Items ---- */
function ItemsView() {
  const [filter, setFilter] = useState("");
  const rows = filter ? finances.items.filter((i) => i.type === filter) : finances.items;
  const income = finances.items.filter((i) => i.amount > 0).reduce((s, i) => s + i.amount, 0);
  const expense = finances.items.filter((i) => i.amount < 0).reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Kpi icon={ArrowUpRight} label="Income" value={money(income)} tone="orange" />
        <Kpi icon={ArrowDownRight} label="Expenses" value={money(Math.abs(expense))} tone="navy" />
        <Kpi icon={TrendingUp} label="Net" value={money(income + expense)} />
      </div>

      <div className="flex gap-2 flex-wrap">
        {["", "income", "expense"].map((t) => (
          <button key={t || "all"} onClick={() => setFilter(t)} className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all capitalize ${filter === t ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"}`}>
            {t || "All"}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Property</th>
                <th className="px-5 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-gray-500">{new Date(i.date).toLocaleDateString("en-GB")}</td>
                  <td className="px-5 py-3"><Badge tone={i.type === "income" ? "green" : "red"}>{i.type}</Badge></td>
                  <td className="px-5 py-3 text-gray-500">{i.category}</td>
                  <td className="px-5 py-3 font-semibold text-[#0F253B]">{i.description}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{i.property}</td>
                  <td className={`px-5 py-3 text-right font-bold ${i.amount > 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {i.amount > 0 ? "+" : "-"}{money(Math.abs(i.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---- Sub-section: Other Reports ---- */
function ReportsView() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {finances.otherReports.map((r) => (
        <div key={r.id} className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col hover:shadow-md transition-all">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#F47C3C] flex items-center justify-center"><FileText size={20} /></div>
            <Badge tone="gray">{r.type}</Badge>
          </div>
          <p className="font-bold text-[#0F253B] mt-3">{r.name}</p>
          <p className="text-xs text-gray-400 font-medium mt-0.5 flex-1">{r.desc}</p>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{r.period}</span>
            <button className="flex items-center gap-1.5 px-3 py-2 bg-[#F47C3C] hover:bg-[#e06d30] text-white text-xs font-bold rounded-lg transition-all active:scale-[0.98]">
              <Download size={14} /> Export
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminFinances() {
  const [tab, setTab] = useState("graph");

  return (
    <div className="space-y-5">
      <PageHeader title="Finances" subtitle="Cashflow, settlements, ledger and financial reports" />

      {/* Sub-section tabs */}
      <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1 overflow-x-auto">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${active ? "bg-[#0F253B] text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              <t.icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "graph" && <GraphView />}
      {tab === "settlement" && <SettlementView />}
      {tab === "items" && <ItemsView />}
      {tab === "reports" && <ReportsView />}
    </div>
  );
}
