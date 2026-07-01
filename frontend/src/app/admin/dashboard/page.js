"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  BedDouble,
  UserPlus,
  CalendarClock,
  Wrench,
  ListChecks,
  Users,
  TrendingUp,
} from "lucide-react";
import api from "../../api/api";

function StatCard({ icon: Icon, label, value, sub, tone = "navy" }) {
  const tones = {
    navy: "bg-[#0F253B] text-white",
    orange: "bg-[#F47C3C] text-white",
    light: "bg-white text-[#0F253B] border border-gray-100",
  };
  const iconTone = tone === "light" ? "bg-gray-50 text-[#F47C3C]" : "bg-white/15 text-white";
  return (
    <div className={`rounded-2xl p-5 shadow-sm ${tones[tone]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${tone === "light" ? "text-gray-400" : "text-white/60"}`}>
            {label}
          </p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          {sub && (
            <p className={`text-xs mt-1 font-medium ${tone === "light" ? "text-gray-400" : "text-white/70"}`}>
              {sub}
            </p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconTone}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get("/dashboard/stats");
        if (active) setStats(res.data.data);
      } catch (err) {
        if (active) setError(err.response?.data?.message || "Failed to load dashboard");
      } finally {
        if (active) setLoading(false);
      }
    })();
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

  const s = stats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F253B]">Dashboard</h1>
        <p className="text-sm text-gray-400 font-medium">Overview of your portfolio and activity</p>
      </div>

      {/* Subscription banner */}
      <div className="rounded-2xl bg-linear-to-r from-[#0F253B] to-[#1c3e5e] text-white p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Subscription</p>
          <p className="text-lg font-bold capitalize mt-1">
            {s.subscription.plan} plan
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-white/15 capitalize">
              {s.subscription.status}
            </span>
          </p>
        </div>
        <TrendingUp size={28} className="text-[#F47C3C]" />
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Properties" value={s.properties.total} sub={`${s.properties.archived} archived`} tone="navy" />
        <StatCard icon={TrendingUp} label="Occupancy" value={`${s.occupancy.occupancyRate}%`} sub={`${s.occupancy.occupied}/${s.occupancy.totalRooms} rooms`} tone="orange" />
        <StatCard icon={UserPlus} label="New Leads" value={s.leads.new} sub={`${s.leads.total} total`} tone="light" />
        <StatCard icon={CalendarClock} label="Upcoming Viewings" value={s.viewings.upcoming} tone="light" />
        <StatCard icon={Wrench} label="Open Maintenance" value={s.maintenance.open} sub={`${s.maintenance.urgent} urgent`} tone="light" />
        <StatCard icon={ListChecks} label="Today's Actions" value={s.actions.today} sub={`${s.actions.overdue} overdue`} tone="light" />
        <StatCard icon={BedDouble} label="Active Tenancies" value={s.tenancies.active} tone="light" />
        <StatCard icon={Users} label="Team Members" value={s.team.total} tone="light" />
      </div>

      {/* Occupancy breakdown */}
      <div className="rounded-2xl bg-white border border-gray-100 p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Room Occupancy</p>
        <div className="flex gap-6 flex-wrap">
          {[
            { label: "Occupied", value: s.occupancy.occupied, color: "bg-[#F47C3C]" },
            { label: "Vacant", value: s.occupancy.vacant, color: "bg-emerald-500" },
            { label: "Maintenance", value: s.occupancy.maintenance, color: "bg-amber-500" },
          ].map((r) => (
            <div key={r.label} className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${r.color}`} />
              <span className="text-sm font-bold text-[#0F253B]">{r.value}</span>
              <span className="text-xs text-gray-400 font-medium">{r.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 h-3 rounded-full bg-gray-100 overflow-hidden flex">
          {s.occupancy.totalRooms > 0 ? (
            <>
              <div className="bg-[#F47C3C] h-full" style={{ width: `${(s.occupancy.occupied / s.occupancy.totalRooms) * 100}%` }} />
              <div className="bg-emerald-500 h-full" style={{ width: `${(s.occupancy.vacant / s.occupancy.totalRooms) * 100}%` }} />
              <div className="bg-amber-500 h-full" style={{ width: `${(s.occupancy.maintenance / s.occupancy.totalRooms) * 100}%` }} />
            </>
          ) : (
            <div className="text-[11px] text-gray-300 font-medium px-2">No rooms yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
