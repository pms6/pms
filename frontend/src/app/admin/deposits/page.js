"use client";

import { useState } from "react";
import { Search, Download, Eye, X, ShieldCheck, Clock } from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import {
  deposits, DEPOSIT_STATUS, DEPOSIT_STATUS_TONE, DEPOSIT_TYPES, DEPOSIT_TAGS,
  PROTECTION_SCHEMES, PROTECTION_TYPES, properties, money,
} from "../_data/dummy";

export default function AdminDeposits() {
  const [q, setQ] = useState("");
  const [f, setF] = useState({ property: "", tag: "", depositType: "", scheme: "", protectionType: "", status: "" });
  const [view, setView] = useState(null);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const list = deposits.filter((d) => {
    const s = q.toLowerCase();
    const matchesSearch = !s || d.tenant.toLowerCase().includes(s) || d.property.toLowerCase().includes(s) || (d.room || "").toLowerCase().includes(s);
    return (
      matchesSearch &&
      (!f.property || d.property === f.property) &&
      (!f.tag || (d.tags || []).includes(f.tag)) &&
      (!f.depositType || d.depositType === f.depositType) &&
      (!f.scheme || d.scheme === f.scheme) &&
      (!f.protectionType || d.protectionType === f.protectionType) &&
      (!f.status || d.status === f.status)
    );
  });

  const counts = DEPOSIT_STATUS.reduce((acc, s) => ({ ...acc, [s]: deposits.filter((d) => d.status === s).length }), {});
  const activeValue = deposits.filter((d) => d.status === "Active").reduce((sum, d) => sum + d.amount, 0);
  const propertyNames = properties.map((p) => p.name);

  const Select = ({ k, label, options }) => (
    <select value={f[k]} onChange={set(k)} className="px-3.5 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]">
      <option value="">{label}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deposits"
        subtitle="Manage and monitor tenant deposits across all properties"
        action={
          <button onClick={() => alert("Deposit records — CSV export (demo)")} className="flex items-center gap-2 px-4 py-2.5 bg-[#0F253B] hover:bg-[#1c3e5e] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
            <Download size={18} /> Export CSV
          </button>
        }
      />

      {/* Status summary + active value */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {DEPOSIT_STATUS.map((s) => (
          <button key={s} onClick={() => setF({ ...f, status: f.status === s ? "" : s })}
            className={`text-left rounded-2xl p-4 border transition-all ${f.status === s ? "border-[#F47C3C] ring-1 ring-[#F47C3C]/30 bg-orange-50" : "bg-white border-gray-100 hover:shadow-sm"}`}>
            <p className="text-2xl font-bold text-[#0F253B]">{counts[s]}</p>
            <div className="mt-1"><Badge tone={DEPOSIT_STATUS_TONE[s]}>{s}</Badge></div>
          </button>
        ))}
        <div className="rounded-2xl p-4 bg-gradient-to-br from-[#0F253B] to-[#1c3e5e] text-white col-span-2 lg:col-span-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Active Deposits Value</p>
          <p className="text-2xl font-bold mt-1">{money(activeValue)}</p>
          <p className="text-[11px] text-white/60 mt-1">currently held</p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tenant, property or room…" className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select k="property" label="All properties" options={propertyNames} />
          <Select k="tag" label="All tags" options={DEPOSIT_TAGS} />
          <Select k="depositType" label="All deposit types" options={DEPOSIT_TYPES} />
          <Select k="scheme" label="All schemes" options={PROTECTION_SCHEMES} />
          <Select k="protectionType" label="All protection types" options={PROTECTION_TYPES} />
        </div>
      </div>

      {/* List */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3">Property &amp; Room</th>
                <th className="px-5 py-3">Tenant</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3">Deposit Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No deposits match these filters</td></tr>
              ) : (
                list.map((d) => (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <p className="font-bold text-[#0F253B]">{d.property}</p>
                      <p className="text-[11px] text-gray-400">{d.room !== "—" ? d.room : "Whole property"}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{d.tenant}</td>
                    <td className="px-5 py-3 text-right font-bold text-[#0F253B]">{money(d.amount)}</td>
                    <td className="px-5 py-3 text-gray-500">
                      <span className="block">{d.depositType}</span>
                      <span className="text-[11px] text-gray-400">{d.scheme} · {d.protectionType}</span>
                    </td>
                    <td className="px-5 py-3"><Badge tone={DEPOSIT_STATUS_TONE[d.status]}>{d.status}</Badge></td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setView(d)} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F47C3C] hover:underline"><Eye size={14} /> View</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {view && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setView(null)}>
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-xl font-bold text-[#0F253B]">{view.tenant}</h3>
                <p className="text-xs text-gray-400 font-medium">{view.property}{view.room !== "—" ? ` · ${view.room}` : ""}</p>
              </div>
              <button onClick={() => setView(null)} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4 flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Deposit Amount</p>
                <p className="text-2xl font-bold text-[#0F253B]">{money(view.amount)}</p>
              </div>
              <Badge tone={DEPOSIT_STATUS_TONE[view.status]}>{view.status}</Badge>
            </div>

            {/* Protection info */}
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={16} className="text-[#F47C3C]" />
              <h4 className="font-bold text-[#0F253B]">Protection</h4>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                ["Deposit Type", view.depositType],
                ["Scheme", view.scheme],
                ["Protection Type", view.protectionType],
                ["Reference", view.ref],
                ["Protected On", view.protectedDate ? new Date(view.protectedDate).toLocaleDateString("en-GB") : "—"],
                ["Tags", (view.tags || []).join(", ") || "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{k}</p>
                  <p className="text-sm font-semibold text-[#0F253B] mt-0.5">{v}</p>
                </div>
              ))}
            </div>

            {/* History */}
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-[#F47C3C]" />
              <h4 className="font-bold text-[#0F253B]">Deposit History</h4>
            </div>
            <ul className="space-y-2">
              {view.history.map((h, i) => (
                <li key={i} className="flex gap-3 p-3 rounded-xl bg-gray-50">
                  <span className="text-[11px] font-bold text-gray-400 w-20 shrink-0">{new Date(h.date).toLocaleDateString("en-GB")}</span>
                  <span className="text-sm text-gray-600">{h.event}</span>
                </li>
              ))}
            </ul>

            <button onClick={() => setView(null)} className="w-full mt-5 py-3 bg-[#0F253B] hover:bg-[#1c3e5e] text-white font-bold rounded-xl transition-all">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
