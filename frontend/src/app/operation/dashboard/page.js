"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus, CalendarClock, ListChecks, AlertTriangle, MapPin } from "lucide-react";
import { StatCard, PageHeader, Card, Badge } from "../../Shared/ui";
import { PRIORITY_TONE, STATUS_TONE, fmtDate, dueLabel } from "../../Shared/tasks";
import api from "../../api/api";

const LEAD_TONE = { new: "blue", qualified: "green", converted: "orange", lost: "gray" };

export default function OperationDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const fetchDashboardData = async () => {
      try {
        const [viewingsRes, leadsRes, myTasksRes] = await Promise.all([
          api.get("/viewings", { params: { status: "scheduled", limit: 5, sort: "scheduledAt" } }),
          api.get("/leads", { params: { limit: 5, sort: "-createdAt" } }),
          api.get("/tasks/my"),
        ]);

        if (!active) return;

        const viewings = viewingsRes.data?.data || [];
        const recentLeads = leadsRes.data?.data || [];
        const myTasks = myTasksRes.data?.data || [];
        const myTaskStats = myTasksRes.data?.stats || { total: 0 };

        const upcomingTasks = myTasks
          .filter((t) => t.effectiveStatus !== "Done" && t.effectiveStatus !== "Cancelled")
          .sort((a, b) => (a.daysUntilDue ?? 999) - (b.daysUntilDue ?? 999))
          .slice(0, 5);

        setData({
          newLeads: recentLeads.filter((l) => l.status === "new").length,
          upcomingViewings: viewings.length,
          myOpenTasks: (myTaskStats["Not Started"] || 0) + (myTaskStats["In Progress"] || 0),
          myOverdueTasks: myTaskStats["Overdue"] || 0,
          viewings,
          recentLeads,
          upcomingTasks,
        });
      } catch (err) {
        console.error(err);
        if (active) setError(err.response?.data?.message || "Failed to load dashboard");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchDashboardData();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-[#F47C3C]/30 border-t-[#F47C3C] rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-bold rounded">
        {error}
      </div>
    );
  }

  const d = data || {};
  const fmtTime = (iso) =>
    iso
      ? new Date(iso).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
      : "—";

  return (
    <div className="space-y-6">
      <PageHeader title="Operation Dashboard" subtitle="Your leads, viewings and assigned work at a glance" />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={UserPlus} label="New Leads" value={d.newLeads} tone="navy" />
        <StatCard icon={CalendarClock} label="Upcoming Viewings" value={d.upcomingViewings} tone="orange" />
        <StatCard icon={ListChecks} label="My Open Tasks" value={d.myOpenTasks} tone="navy" />
        <StatCard icon={AlertTriangle} label="My Overdue Tasks" value={d.myOverdueTasks} tone="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* My Tasks */}
        <Card
          title="My Tasks"
          className="lg:col-span-1"
          action={
            <Link href="/operation/tasks" className="text-[10px] font-bold text-[#F47C3C] hover:underline uppercase tracking-widest">
              View all
            </Link>
          }
        >
          {d.upcomingTasks?.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">No tasks assigned to you yet.</p>
          ) : (
            <ul className="space-y-2">
              {d.upcomingTasks.map((t) => (
                <li key={t._id} className="p-3 rounded-xl bg-gray-50">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-[#0F253B] truncate">{t.title}</p>
                    <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold ${PRIORITY_TONE[t.priority]}`}>
                      {t.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_TONE[t.effectiveStatus]}`}>
                      {t.effectiveStatus}
                    </span>
                    <span className={`text-[10px] font-bold ${t.effectiveStatus === "Overdue" ? "text-red-500" : "text-gray-400"}`}>
                      {fmtDate(t.dueDate)} · {dueLabel(t)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Upcoming Viewings */}
        <Card
          title="Upcoming Viewings"
          className="lg:col-span-1"
          action={
            <Link href="/operation/viewings" className="text-[10px] font-bold text-[#F47C3C] hover:underline uppercase tracking-widest">
              View all
            </Link>
          }
        >
          {d.viewings.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">No viewings scheduled.</p>
          ) : (
            <ul className="space-y-2">
              {d.viewings.map((v) => (
                <li key={v._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#0F253B] truncate">
                      {v.lead?.name || v.leadId?.name || "Lead"} • {v.property?.name || v.propertyId?.name}
                    </p>
                    <p className="text-xs text-gray-400 font-medium">{fmtTime(v.scheduledAt || v.date)}</p>
                  </div>
                  <Badge tone="orange">scheduled</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Recent Leads */}
        <Card
          title="Recent Leads"
          className="lg:col-span-1"
          action={
            <Link href="/operation/leads" className="text-[10px] font-bold text-[#F47C3C] hover:underline uppercase tracking-widest">
              View all
            </Link>
          }
        >
          {d.recentLeads.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">No leads yet.</p>
          ) : (
            <ul className="space-y-2">
              {d.recentLeads.map((l) => (
                <li key={l._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <div className="min-w-0 flex-1">
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

      <Card
        title="Live Location"
        action={
          <Link href="/operation/live-location" className="text-[10px] font-bold text-[#F47C3C] hover:underline uppercase tracking-widest">
            View team map
          </Link>
        }
      >
        <p className="flex items-center gap-2 text-sm text-gray-500 font-medium py-1">
          <MapPin size={16} className="text-[#F47C3C]" />
          Turn on live location in the header so the team can see where you are, and see everyone else sharing on the team map.
        </p>
      </Card>
    </div>
  );
}
