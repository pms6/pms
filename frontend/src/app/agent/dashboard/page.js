"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus, CalendarClock, ClipboardList, Percent } from "lucide-react";
import { StatCard, PageHeader, Card, Badge } from "../../Shared/ui";
import api from "../../api/api";

const LEAD_TONE = { new: "blue", qualified: "green", converted: "orange", lost: "gray" };

export default function AgentDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [stats, viewings, recent, converted, pending] = await Promise.all([
          api.get("/dashboard/stats"),
          api.get("/viewings", { params: { status: "scheduled", limit: 5, sort: "scheduledAt" } }),
          api.get("/leads", { params: { limit: 5, sort: "-createdAt" } }),
          api.get("/leads", { params: { status: "converted", limit: 1 } }),
          api.get("/applicants", { params: { referenceStatus: "pending", limit: 1 } }),
        ]);
        if (!active) return;
        const s = stats.data.data;
        const total = s.leads.total || 0;
        const conv = converted.data.meta?.total || 0;
        setData({
          newLeads: s.leads.new,
          totalLeads: total,
          upcomingViewings: s.viewings.upcoming,
          pendingApplicants: pending.data.meta?.total || 0,
          conversion: total > 0 ? Math.round((conv / total) * 100) : 0,
          viewings: viewings.data.data,
          recent: recent.data.data,
        });
      } catch (err) {
        if (active) setError(err.response?.data?.message || "Failed to load dashboard");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) return <div className="flex items-center justify-center py-32"><div className="w-8 h-8 border-2 border-[#F47C3C]/30 border-t-[#F47C3C] rounded-full animate-spin" /></div>;
  if (error) return <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-bold rounded">{error}</div>;

  const d = data;
  const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

  return (
    <div className="space-y-6">
      <PageHeader title="Agent Dashboard" subtitle="Your lettings pipeline" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={UserPlus} label="New Leads" value={d.newLeads} sub={`${d.totalLeads} total`} tone="navy" />
        <StatCard icon={CalendarClock} label="Upcoming Viewings" value={d.upcomingViewings} tone="orange" />
        <StatCard icon={ClipboardList} label="Pending Applicants" value={d.pendingApplicants} sub="awaiting refs" />
        <StatCard icon={Percent} label="Conversion" value={`${d.conversion}%`} sub="leads → converted" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Upcoming Viewings" action={<Link href="/agent/viewings" className="text-[10px] font-bold text-[#F47C3C] hover:underline uppercase tracking-widest">View all</Link>}>
          {d.viewings.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">No viewings scheduled.</p>
          ) : (
            <ul className="space-y-2">
              {d.viewings.map((v) => (
                <li key={v._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0F253B] truncate">{v.leadId?.name || "Viewing"}</p>
                    <p className="text-xs text-gray-400 font-medium">{fmtTime(v.scheduledAt)}</p>
                  </div>
                  <Badge tone="orange">scheduled</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent Leads" action={<Link href="/agent/leads" className="text-[10px] font-bold text-[#F47C3C] hover:underline uppercase tracking-widest">View all</Link>}>
          {d.recent.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">No leads yet.</p>
          ) : (
            <ul className="space-y-2">
              {d.recent.map((l) => (
                <li key={l._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0F253B] truncate">{l.name}</p>
                    <p className="text-xs text-gray-400 font-medium">{l.source || "—"}</p>
                  </div>
                  <Badge tone={LEAD_TONE[l.status] || "gray"}>{l.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
