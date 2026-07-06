"use client";

import { useState } from "react";
import { PoundSterling, AlertCircle, Wallet, TrendingUp, Download } from "lucide-react";
import { PageHeader, Card, Badge } from "../../Shared/ui";
import RentCollectionPanel from "../_components/RentCollectionPanel";
import { rentCharges, rentSummary, money } from "../_data/dummy";

const STATUS_TONE = { paid: "green", due: "amber", overdue: "red", partial: "blue" };

function Kpi({ icon: Icon, label, value, tone }) {
  const wrap = { navy: "bg-[#0F253B] text-white", orange: "bg-gradient-to-br from-[#F47C3C] to-[#e0651f] text-white", light: "bg-white border border-gray-100 text-[#0F253B]" }[tone];
  const iconWrap = tone === "light" ? "bg-orange-50 text-[#F47C3C]" : "bg-white/15 text-white";
  const sub = tone === "light" ? "text-gray-400" : "text-white/60";
  return (
    <div className={`rounded-2xl p-5 shadow-sm ${wrap}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconWrap}`}><Icon size={22} /></div>
      <p className="text-2xl font-bold mt-4">{value}</p>
      <p className={`text-[11px] font-bold uppercase tracking-widest mt-1 ${sub}`}>{label}</p>
    </div>
  );
}

export default function AdminRentCollection() {
  const [filter, setFilter] = useState("");
  const [panel, setPanel] = useState(null);
  const rows = filter ? rentCharges.filter((r) => r.status === filter) : rentCharges;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rent Collection"
        subtitle="Track rent due, collected and overdue"
        action={
          <button className="flex items-center gap-2 px-4 py-2.5 bg-[#0F253B] hover:bg-[#1c3e5e] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
            <Download size={18} /> Export
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={PoundSterling} label="Collected (MTD)" value={money(rentSummary.collected)} tone="orange" />
        <Kpi icon={Wallet} label="Due this month" value={money(rentSummary.dueThisMonth)} tone="navy" />
        <Kpi icon={AlertCircle} label="Outstanding" value={money(rentSummary.outstanding)} tone="light" />
        <Kpi icon={TrendingUp} label="Collection rate" value={`${rentSummary.collectionRate}%`} tone="light" />
      </div>

      {/* Collection progress */}
      <Card title="This month's collection">
        <div className="flex items-center justify-between text-xs font-bold mb-2">
          <span className="text-gray-400">{money(rentSummary.collected)} collected</span>
          <span className="text-gray-400">{money(rentSummary.dueThisMonth)} due</span>
        </div>
        <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#F47C3C] to-[#f9a870] rounded-full" style={{ width: `${rentSummary.collectionRate}%` }} />
        </div>
        <p className="text-xs text-red-500 font-bold mt-2">{money(rentSummary.overdue)} overdue across tenants</p>
      </Card>

      <div className="flex gap-2 flex-wrap">
        {["", "paid", "due", "overdue", "partial"].map((s) => (
          <button key={s || "all"} onClick={() => setFilter(s)} className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all capitalize ${filter === s ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3">Tenant</th>
                <th className="px-5 py-3">Property</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Due</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-bold text-[#0F253B]">{r.tenant}</td>
                  <td className="px-5 py-3 text-gray-500">{r.property} · {r.room}</td>
                  <td className="px-5 py-3 font-bold text-[#0F253B]">{money(r.amount)}</td>
                  <td className="px-5 py-3 text-gray-500">{new Date(r.dueDate).toLocaleDateString("en-GB")}</td>
                  <td className="px-5 py-3 text-gray-500">{r.method}</td>
                  <td className="px-5 py-3"><Badge tone={STATUS_TONE[r.status] || "gray"}>{r.status}</Badge></td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {r.status === "paid" ? (
                        <span className="text-xs text-gray-300 font-medium">Paid {r.paidDate ? new Date(r.paidDate).toLocaleDateString("en-GB") : ""}</span>
                      ) : (
                        <button className="text-xs font-bold text-gray-400 hover:text-[#0F253B]">Send reminder</button>
                      )}
                      <button onClick={() => setPanel(r)} className="text-xs font-bold text-[#F47C3C] hover:underline">View</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {panel && <RentCollectionPanel charge={panel} onClose={() => setPanel(null)} />}
    </div>
  );
}
