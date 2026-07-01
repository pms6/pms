"use client";

import { PoundSterling, AlertCircle, ShieldCheck, Wallet } from "lucide-react";
import { StatCard, PageHeader, Card, Badge } from "../../Shared/ui";

// Design-only: static sample data illustrating the finance view.
const REVENUE = [
  { m: "Jan", v: 62 }, { m: "Feb", v: 70 }, { m: "Mar", v: 66 },
  { m: "Apr", v: 78 }, { m: "May", v: 84 }, { m: "Jun", v: 81 },
];
const INVOICES = [
  { ref: "INV-2041", tenant: "Sarah Khan", amount: "£650.00", status: "overdue", tone: "red" },
  { ref: "INV-2040", tenant: "Tom Reeves", amount: "£720.00", status: "due", tone: "amber" },
  { ref: "INV-2038", tenant: "Aisha Patel", amount: "£595.00", status: "paid", tone: "green" },
  { ref: "INV-2037", tenant: "James Lo", amount: "£640.00", status: "paid", tone: "green" },
];
const max = Math.max(...REVENUE.map((r) => r.v));

export default function FinanceDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader title="Finance Dashboard" subtitle="Rent, invoices and settlements" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={PoundSterling} label="Collected (MTD)" value="£38.4k" sub="92% of due" tone="navy" />
        <StatCard icon={AlertCircle} label="Outstanding" value="£3.2k" sub="5 invoices" tone="orange" />
        <StatCard icon={Wallet} label="Overdue" value="£1.1k" sub="2 invoices" />
        <StatCard icon={ShieldCheck} label="Deposits Protected" value="£14.6k" sub="22 tenancies" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Revenue — last 6 months">
          <div className="flex items-end gap-3 h-40 pt-2">
            {REVENUE.map((r) => (
              <div key={r.m} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-gray-100 rounded-lg flex items-end" style={{ height: "100%" }}>
                  <div className="w-full bg-[#F47C3C] rounded-lg" style={{ height: `${(r.v / max) * 100}%` }} />
                </div>
                <span className="text-[10px] font-bold text-gray-400">{r.m}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Recent Invoices">
          <ul className="space-y-2">
            {INVOICES.map((inv) => (
              <li key={inv.ref} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div>
                  <p className="text-sm font-bold text-[#0F253B]">{inv.tenant}</p>
                  <p className="text-xs text-gray-400 font-medium">{inv.ref}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-[#0F253B]">{inv.amount}</span>
                  <Badge tone={inv.tone}>{inv.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
