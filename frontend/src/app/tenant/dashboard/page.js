"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Wallet, Wrench, FileText, Plus, BedDouble, Loader2 } from "lucide-react";
import { StatCard, PageHeader, Card, Badge } from "../../Shared/ui";
import api from "../../api/api";

const fmtMoney = (n) =>
  `£${Number(n || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
const fmtAmount = (n) =>
  `£${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;

// Maintenance status → presentation.
const MR_STATUS = {
  open: { label: "open", tone: "amber" },
  assigned: { label: "assigned", tone: "blue" },
  in_progress: { label: "in progress", tone: "amber" },
  closed: { label: "closed", tone: "green" },
};

export default function TenantDashboard() {
  const [room, setRoom] = useState(null);
  const [payments, setPayments] = useState({ charges: [], summary: { monthlyRent: 0, nextDueDate: null, balance: 0 } });
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      // Resilient: each card degrades independently if its source fails.
      const [roomRes, payRes, mrRes] = await Promise.allSettled([
        api.get("/tenancies/my-room"),
        api.get("/payments/my"),
        api.get("/maintenance"),
      ]);
      if (!active) return;
      if (roomRes.status === "fulfilled") setRoom(roomRes.value.data?.data || null);
      if (payRes.status === "fulfilled") {
        setPayments({
          charges: payRes.value.data?.data?.charges || [],
          summary: payRes.value.data?.data?.summary || { monthlyRent: 0, nextDueDate: null, balance: 0 },
        });
      }
      if (mrRes.status === "fulfilled") setRequests(mrRes.value.data?.data || []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const { summary } = payments;
  const openRequests = requests.filter((r) => r.status !== "closed");
  const paidUp = Number(summary.balance || 0) <= 0;
  const monthlyRent = summary.monthlyRent || room?.rent || 0;

  const subtitle = room
    ? [room.property, room.room].filter((x) => x && x !== "—").join(" · ") || "Your tenancy"
    : "Your tenant portal";

  const tenancyEnd = fmtDate(room?.fixedTermEnd);
  const tenancyStart = fmtDate(room?.startDate);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-[#F47C3C]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Welcome back"
        subtitle={subtitle}
        action={
          <Link
            href="/tenant/maintenance"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
          >
            <Plus size={18} /> Report an Issue
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Wallet}
          label="Next Rent Due"
          value={monthlyRent ? fmtMoney(monthlyRent) : "—"}
          sub={fmtDate(summary.nextDueDate) || "No upcoming charge"}
          tone="navy"
        />
        <StatCard
          icon={CalendarDays}
          label="Balance"
          value={fmtAmount(summary.balance)}
          sub={paidUp ? "all paid" : "outstanding"}
          tone="orange"
        />
        <StatCard
          icon={Wrench}
          label="Open Requests"
          value={String(openRequests.length)}
          sub={openRequests.length ? "active" : "none open"}
        />
        <StatCard
          icon={BedDouble}
          label="Tenancy"
          value={room ? (room.status || "Active") : "—"}
          sub={room ? (tenancyEnd ? `ends ${tenancyEnd}` : tenancyStart ? `since ${tenancyStart}` : "active") : "not started"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Rent / payment summary */}
        <Card title="Rent" className="lg:col-span-1">
          <div className="space-y-3">
            <div>
              <p className="text-3xl font-bold text-[#0F253B]">
                {monthlyRent ? fmtMoney(monthlyRent) : "—"}
                {monthlyRent ? <span className="text-sm font-medium text-gray-400">/mo</span> : null}
              </p>
              <p className="text-xs text-gray-400 font-medium">
                {summary.nextDueDate ? `Next due ${fmtDate(summary.nextDueDate)}` : "No upcoming charge"}
              </p>
            </div>
            <Link
              href="/tenant/payments"
              className="block text-center w-full py-3 bg-[#0F253B] text-white font-bold text-sm rounded-xl hover:bg-[#1c3e5e] transition-all"
            >
              {paidUp ? "View Payments" : "Make a Payment"}
            </Link>
            {paidUp ? (
              <p className="text-[11px] text-emerald-600 font-bold">✓ You're all paid up</p>
            ) : (
              <p className="text-[11px] text-rose-600 font-bold">{fmtAmount(summary.balance)} outstanding</p>
            )}
          </div>
        </Card>

        {/* Maintenance requests */}
        <Card
          title="My Maintenance"
          className="lg:col-span-2"
          action={
            <Link href="/tenant/maintenance" className="text-[11px] font-bold text-[#F47C3C] hover:underline">
              Report an issue
            </Link>
          }
        >
          {requests.length === 0 ? (
            <p className="text-sm text-gray-400 font-medium py-2">No maintenance requests yet.</p>
          ) : (
            <ul className="space-y-2">
              {requests.slice(0, 5).map((r) => {
                const st = MR_STATUS[r.status] || { label: r.status, tone: "gray" };
                return (
                  <li key={r._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0F253B] truncate">{r.title}</p>
                      <p className="text-xs text-gray-400 font-medium">
                        {r.ref}{r.category ? ` · ${r.category}` : ""}
                      </p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Documents">
        {room?.documents?.length > 0 ? (
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {room.documents.map((d, i) => (
              <li key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                <div className="w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-[#F47C3C] shrink-0">
                  <FileText size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#0F253B] truncate">{d.name}</p>
                  {d.url && (
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F47C3C] font-medium hover:underline">
                      View
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400 font-medium">No documents have been shared yet.</p>
        )}
      </Card>
    </div>
  );
}
