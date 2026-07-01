"use client";

import { CalendarDays, Wallet, Wrench, FileText, Plus, BedDouble } from "lucide-react";
import { StatCard, PageHeader, Card, Badge } from "../../Shared/ui";

// Design-only: static sample data illustrating the tenant portal.
const REQUESTS = [
  { ref: "#MR-1042", title: "Boiler not heating", status: "in progress", tone: "amber" },
  { ref: "#MR-1030", title: "Wardrobe door loose", status: "closed", tone: "green" },
];
const DOCUMENTS = [
  { name: "Tenancy Agreement.pdf", meta: "Signed 12 Jan 2026" },
  { name: "Deposit Certificate.pdf", meta: "Protected — DPS" },
  { name: "Gas Safety (CP12).pdf", meta: "Valid to Mar 2027" },
];

export default function TenantDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Welcome back"
        subtitle="Elm Court HMO · Room 4"
        action={
          <button className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
            <Plus size={18} /> Report an Issue
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Wallet} label="Next Rent Due" value="£650" sub="1 Jul 2026" tone="navy" />
        <StatCard icon={CalendarDays} label="Balance" value="£0.00" sub="all paid" tone="orange" />
        <StatCard icon={Wrench} label="Open Requests" value="1" sub="in progress" />
        <StatCard icon={BedDouble} label="Tenancy" value="Active" sub="ends 11 Jan 2027" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Rent / payment summary */}
        <Card title="Rent" className="lg:col-span-1">
          <div className="space-y-3">
            <div>
              <p className="text-3xl font-bold text-[#0F253B]">£650<span className="text-sm font-medium text-gray-400">/mo</span></p>
              <p className="text-xs text-gray-400 font-medium">Paid monthly · DD on the 1st</p>
            </div>
            <button className="w-full py-3 bg-[#0F253B] text-white font-bold text-sm rounded-xl hover:bg-[#1c3e5e] transition-all">
              Make a Payment
            </button>
            <p className="text-[11px] text-emerald-600 font-bold">✓ You're all paid up</p>
          </div>
        </Card>

        {/* Maintenance requests */}
        <Card title="My Maintenance" className="lg:col-span-2">
          <ul className="space-y-2">
            {REQUESTS.map((r) => (
              <li key={r.ref} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div>
                  <p className="text-sm font-bold text-[#0F253B]">{r.title}</p>
                  <p className="text-xs text-gray-400 font-medium">{r.ref}</p>
                </div>
                <Badge tone={r.tone}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Documents">
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {DOCUMENTS.map((d) => (
            <li key={d.name} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
              <div className="w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-[#F47C3C] shrink-0">
                <FileText size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#0F253B] truncate">{d.name}</p>
                <p className="text-xs text-gray-400 font-medium truncate">{d.meta}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
