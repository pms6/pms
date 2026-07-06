"use client";

import { useState } from "react";
import {
  X, CreditCard, CalendarDays, Hash, RefreshCw, Pencil, PoundSterling, TrendingUp,
  Percent, Clock, Plus, FileText, Upload, ShieldCheck, Check, Eye, AlertCircle, Wallet,
} from "lucide-react";
import { Badge } from "../../Shared/ui";
import { money } from "../_data/dummy";

const STATUS_TONE = { Paid: "green", Due: "amber", Overdue: "red" };

const COMPLIANCE_DOCS = [
  { name: "Electrical Installation Condition Report (EICR)", available: "2026-07-05", ack: true },
  { name: "Energy Performance Certificate (EPC)", available: "2026-07-05", ack: false },
  { name: "Gas Safety Certificate", available: "2026-07-05", ack: true },
  { name: "HMO Licence", available: "2026-07-05", ack: true },
  { name: "How to Rent Guide", available: "2026-07-05", ack: false },
];

const ACTIONS = [
  { label: "Log a Payment", icon: Plus },
  { label: "Apply Rent Credit", icon: Wallet },
  { label: "Record Money Due", icon: PoundSterling },
  { label: "Mark All Rent as Paid", icon: Check },
  { label: "Tenant Statement", icon: FileText },
  { label: "Rent Records", icon: FileText },
  { label: "Reassociate Transactions", icon: RefreshCw },
  { label: "Import Payments (CSV)", icon: Upload },
  { label: "Credit Control Notes", icon: FileText },
  { label: "Audit Log", icon: Clock },
];

function Section({ icon: Icon, title, action, children }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F47C3C] flex items-center justify-center"><Icon size={16} /></div>
          <h3 className="font-bold text-[#0F253B]">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
function Stat({ icon: Icon, label, value, tone = "light" }) {
  const wrap = tone === "red" ? "bg-red-50" : tone === "navy" ? "bg-[#0F253B] text-white" : "bg-gray-50";
  const val = tone === "red" ? "text-red-600" : tone === "navy" ? "text-white" : "text-[#0F253B]";
  const lab = tone === "navy" ? "text-white/60" : "text-gray-400";
  return (
    <div className={`rounded-xl p-3 ${wrap}`}>
      <div className="flex items-center gap-1.5 mb-1"><Icon size={13} className={tone === "navy" ? "text-[#F47C3C]" : "text-[#F47C3C]"} /><p className={`text-[10px] font-bold uppercase tracking-widest ${lab}`}>{label}</p></div>
      <p className={`text-lg font-bold ${val}`}>{value}</p>
    </div>
  );
}

export default function RentCollectionPanel({ charge, onClose }) {
  const { tenant, property, room, amount, method, dueDate } = charge;
  const [ledgerFilter, setLedgerFilter] = useState("all");
  const [autoGen, setAutoGen] = useState(true);
  const act = (label) => () => alert(`${label} (demo)`);

  // Build a small dummy ledger with a running balance.
  const base = [
    { date: "2026-05-01", type: "Rent", status: "Paid", amount },
    { date: "2026-05-02", type: "Payment", status: "Paid", amount: -amount },
    { date: "2026-06-01", type: "Rent", status: "Paid", amount },
    { date: "2026-06-03", type: "Payment", status: "Paid", amount: -amount },
    { date: "2026-07-01", type: "Rent", status: charge.status === "paid" ? "Paid" : charge.status === "overdue" ? "Overdue" : "Due", amount },
    ...(charge.status === "paid" ? [{ date: "2026-07-01", type: "Payment", status: "Paid", amount: -amount }] : []),
  ];
  let bal = 0;
  const ledger = base.map((t, i) => { bal += t.amount; return { id: i, ...t, balance: bal }; });
  const shown = ledger.filter((t) =>
    ledgerFilter === "payments" ? t.type === "Payment" : ledgerFilter === "outstanding" ? t.status !== "Paid" : true
  );
  const overdue = charge.status === "overdue" ? amount : 0;
  const currentDue = charge.status === "paid" ? 0 : amount;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-3xl bg-[#F8FAFC] h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Rent Collection</p>
            <h2 className="text-lg font-bold text-[#0F253B]">{tenant} · {property}{room && room !== "—" ? ` · ${room}` : ""}</h2>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={22} /></button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {/* Schedule */}
          <Section
            icon={CalendarDays}
            title="Rent Collection Schedule"
            action={<button onClick={act("Edit Schedule")} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-100 text-[#0F253B] text-xs font-bold rounded-lg"><Pencil size={13} /> Edit Schedule</button>}
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1"><CreditCard size={11} />Method</p><p className="text-sm font-bold text-[#0F253B] mt-0.5">{method}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1"><CalendarDays size={11} />Due Date</p><p className="text-sm font-bold text-[#0F253B] mt-0.5">1st monthly</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1"><Hash size={11} />Reference</p><p className="text-sm font-bold text-[#0F253B] mt-0.5">RENT-{tenant.split(" ")[0].toUpperCase()}</p></div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1"><RefreshCw size={11} />Auto Generation</p>
                <button onClick={() => setAutoGen((v) => !v)} className="mt-1"><Badge tone={autoGen ? "green" : "gray"}>{autoGen ? "Enabled" : "Disabled"}</Badge></button>
              </div>
            </div>
          </Section>

          {/* Summary */}
          <Section icon={TrendingUp} title="Rent Summary">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Stat icon={AlertCircle} label="Total Overdue" value={money(overdue)} tone={overdue ? "red" : "light"} />
              <Stat icon={PoundSterling} label="Current Due" value={money(currentDue)} tone="navy" />
              <Stat icon={Wallet} label="Last Payment" value={money(amount)} />
              <Stat icon={Percent} label="On-Time" value="92%" />
              <Stat icon={Clock} label="Avg Days Late" value="1.4" />
            </div>
          </Section>

          {/* Ledger */}
          <Section
            icon={FileText}
            title="Rent Ledger"
            action={
              <div className="flex flex-wrap gap-1.5">
                {[["all", "All"], ["payments", "Payments"], ["outstanding", "Outstanding"]].map(([k, l]) => (
                  <button key={k} onClick={() => setLedgerFilter(k)} className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg border ${ledgerFilter === k ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-white text-gray-500 border-gray-100"}`}>{l}</button>
                ))}
                <button onClick={act("Deleted / Reversed records")} className="px-2.5 py-1.5 text-[11px] font-bold rounded-lg border bg-white text-gray-500 border-gray-100">Deleted / Reversed</button>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                    <th className="px-3 py-2.5 text-right">Balance</th>
                    <th className="px-3 py-2.5 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((t) => (
                    <tr key={t.id} className="border-b border-gray-50">
                      <td className="px-3 py-2.5 text-gray-500">{new Date(t.date).toLocaleDateString("en-GB")}</td>
                      <td className="px-3 py-2.5"><Badge tone={t.type === "Payment" ? "blue" : "gray"}>{t.type}</Badge></td>
                      <td className="px-3 py-2.5"><Badge tone={STATUS_TONE[t.status] || "gray"}>{t.status}</Badge></td>
                      <td className={`px-3 py-2.5 text-right font-bold ${t.amount < 0 ? "text-emerald-600" : "text-[#0F253B]"}`}>{t.amount < 0 ? "-" : ""}{money(Math.abs(t.amount))}</td>
                      <td className="px-3 py-2.5 text-right text-gray-500">{money(t.balance)}</td>
                      <td className="px-3 py-2.5 text-right"><button onClick={act("Transaction details")} className="text-[#F47C3C]"><Eye size={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Actions */}
          <Section icon={Wallet} title="Manage Rent">
            <div className="flex flex-wrap gap-2">
              {ACTIONS.map((a) => (
                <button key={a.label} onClick={act(a.label)} className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-100 hover:bg-gray-100 text-[#0F253B] text-xs font-bold rounded-lg transition-all">
                  <a.icon size={13} /> {a.label}
                </button>
              ))}
            </div>
          </Section>

          {/* Compliance */}
          <Section
            icon={ShieldCheck}
            title="Compliance"
            action={<button onClick={act("Compliance Report")} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white text-xs font-bold rounded-lg"><FileText size={13} /> Compliance Report</button>}
          >
            <ul className="space-y-2">
              {COMPLIANCE_DOCS.map((d) => (
                <li key={d.name} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-[#F47C3C] shrink-0"><FileText size={16} /></div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0F253B] truncate">{d.name}</p>
                      <p className="text-[11px] text-gray-400 font-medium">On COHO account {new Date(d.available).toLocaleDateString("en-GB")}</p>
                    </div>
                  </div>
                  {d.ack ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 shrink-0"><Check size={13} /> Acknowledged</span>
                  ) : (
                    <button onClick={act("Mark acknowledged")} className="text-[11px] font-bold text-amber-600 hover:underline shrink-0">Mark acknowledged</button>
                  )}
                </li>
              ))}
            </ul>
          </Section>

          <button onClick={onClose} className="w-full py-3 bg-white border border-gray-200 hover:bg-gray-50 text-[#0F253B] font-bold rounded-xl transition-all">Close Rent Collection Panel</button>
        </div>
      </div>
    </div>
  );
}
