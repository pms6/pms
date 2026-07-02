"use client";

import { useState } from "react";
import { Plus, Wrench, User, Building2, PoundSterling } from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import { maintenance, money } from "../_data/dummy";

const PRIORITY_TONE = { urgent: "red", high: "amber", med: "blue", low: "gray" };
const STATUS_TONE = { open: "blue", assigned: "amber", in_progress: "orange", closed: "green" };
const STATUSES = ["open", "assigned", "in_progress", "closed"];

export default function AdminMaintenance() {
  const [filter, setFilter] = useState("");
  const rows = filter ? maintenance.filter((m) => m.status === filter) : maintenance;

  const summary = {
    open: maintenance.filter((m) => m.status !== "closed").length,
    urgent: maintenance.filter((m) => m.priority === "urgent" && m.status !== "closed").length,
    spend: maintenance.reduce((s, m) => s + (m.cost || 0), 0),
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Maintenance"
        subtitle="Repair requests, suppliers and costs"
        action={
          <button className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
            <Plus size={18} /> New Request
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Open requests", value: summary.open },
          { label: "Urgent", value: summary.urgent },
          { label: "Suppliers engaged", value: 6 },
          { label: "Spend (30d)", value: money(summary.spend) },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-2xl font-bold text-[#0F253B]">{s.value}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {["", ...STATUSES].map((s) => (
          <button key={s || "all"} onClick={() => setFilter(s)} className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all capitalize ${filter === s ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"}`}>
            {s ? s.replace("_", " ") : "All"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((m) => (
          <div key={m.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-all">
            <div className="relative h-36 bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.image} alt={m.title} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              <div className="absolute top-2 left-2 flex gap-1.5">
                <Badge tone={PRIORITY_TONE[m.priority] || "gray"}>{m.priority}</Badge>
              </div>
              <div className="absolute top-2 right-2">
                <Badge tone={STATUS_TONE[m.status] || "gray"}>{m.status.replace("_", " ")}</Badge>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-bold text-[#0F253B]">{m.title}</p>
                <span className="text-[10px] font-bold text-gray-300">#{m.ref}</span>
              </div>
              <p className="text-xs text-gray-400 font-medium mt-1 flex items-center gap-1.5"><Building2 size={12} />{m.property} · {m.room}</p>
              <div className="mt-3 space-y-1.5 text-xs text-gray-500 font-medium">
                <p className="flex items-center gap-1.5"><User size={12} className="text-gray-300" />Reported by {m.reportedBy}</p>
                <p className="flex items-center gap-1.5"><Wrench size={12} className="text-gray-300" />{m.supplier || "Unassigned"}</p>
                <p className="flex items-center gap-1.5"><PoundSterling size={12} className="text-gray-300" />{m.cost != null ? money(m.cost) : "TBC"} · {m.category}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
