"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Building2, TrendingUp, PoundSterling, BedDouble, ShieldAlert,
  UserPlus, CalendarClock, ArrowUpRight,
} from "lucide-react";
import { Card } from "../../Shared/ui";
import api from "../../api/api";

function Kpi({ icon: Icon, label, value, delta, tone = "light" }) {
  const wrap = {
    navy: "bg-[#0F253B] text-white",
    orange: "bg-gradient-to-br from-[#F47C3C] to-[#e0651f] text-white",
    light: "bg-white border border-gray-100 text-[#0F253B]",
  }[tone];

  const iconWrap = tone === "light" ? "bg-orange-50 text-[#F47C3C]" : "bg-white/15 text-white";
  const sub = tone === "light" ? "text-gray-400" : "text-white/70";

  return (
    <div className={`rounded-2xl p-5 shadow-sm ${wrap}`}>
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconWrap}`}>
          <Icon size={22} />
        </div>
        {delta && (
          <span className={`flex items-center gap-0.5 text-xs font-bold ${tone === "light" ? "text-emerald-600" : "text-white/90"}`}>
            <ArrowUpRight size={14} />{delta}
          </span>
        )}
      </div>
      <p className="text-3xl font-bold mt-4">{value}</p>
      <p className={`text-[11px] font-bold uppercase tracking-widest mt-1 ${sub}`}>{label}</p>
    </div>
  );
}

const money = (amount) => `£${(amount || 0).toLocaleString()}`;

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    properties: 0,
    occupancyRate: 0,
    monthlyRevenue: 0,
    newLeads: 0,
    activeTenancies: 0,
    upcomingViewings: 0,
    complianceDue: 0,
    occupied: 0,
    vacant: 0,
  });

  const [revenueSeries, setRevenueSeries] = useState([]);
  const [activity, setActivity] = useState([]);
  const [viewings, setViewings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [propsRes, roomsRes, leadsRes, tenanciesRes, viewingsRes, complianceRes] = await Promise.all([
        api.get("/properties", { params: { limit: 100 } }),
        api.get("/rooms", { params: { limit: 500 } }),
        api.get("/leads", { params: { limit: 50 } }),
        api.get("/tenancies", { params: { limit: 200 } }),
        api.get("/viewings", { params: { limit: 20 } }),
        api.get("/compliance", { params: { limit: 100 } }),
      ]);

      const properties = propsRes.data.data || [];
      const allRooms = roomsRes.data.data || [];
      const leads = leadsRes.data.data || [];
      const tenancies = tenanciesRes.data.data || [];
      const allViewings = viewingsRes.data.data || [];
      const compliance = complianceRes.data.data || [];

      // Calculate Stats
      const totalProperties = properties.length;
      const totalRooms = allRooms.length;
      const occupiedRooms = tenancies.filter(t => ["ACTIVE", "RENEWAL"].includes(t.status)).length;

      const monthlyRevenue = tenancies.reduce((sum, t) => sum + (t.monthlyRent || 0), 0);

      const today = new Date().toISOString().split('T')[0];
      const upcomingViewingsToday = allViewings.filter(v => 
        v.date?.startsWith(today) && v.status !== "cancelled"
      ).length;

      const complianceDueSoon = compliance.filter(c => 
        c.status === "expired" || c.status === "warning"
      ).length;

      // Simple last 7 months mock (you can improve later with real data)
      const months = ["Jul", "Jun", "May", "Apr", "Mar", "Feb", "Jan"];
      const revSeries = months.map((m, i) => ({
        m,
        v: Math.floor(monthlyRevenue / 7 * (0.7 + Math.random() * 0.6))
      }));

      setStats({
        properties: totalProperties,
        occupancyRate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
        monthlyRevenue,
        newLeads: leads.filter(l => l.status === "new").length,
        activeTenancies: tenancies.length,
        upcomingViewings: upcomingViewingsToday,
        complianceDue: complianceDueSoon,
        occupied: occupiedRooms,
        vacant: Math.max(0, totalRooms - occupiedRooms),
      });

      setRevenueSeries(revSeries);
      setViewings(allViewings);
      
      // Mock activity (replace with real ActivityLog if you have it)
      setActivity([
        { id: 1, who: "Sharjeel", action: "approved", target: "New Tenancy", time: "1h ago", tone: "green" },
        { id: 2, who: "Ella Moore", action: "scheduled", target: "Viewing", time: "3h ago", tone: "orange" },
      ]);

    } catch (err) {
      console.error(err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const maxRev = revenueSeries.length ? Math.max(...revenueSeries.map(r => r.v)) : 100;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-[#F47C3C]/30 border-t-[#F47C3C] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="rounded-3xl bg-gradient-to-r from-[#0F253B] to-[#1c3e5e] text-white p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full bg-[#F47C3C]/20 blur-2xl" />
        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/50">Northern Lettings · Admin</p>
          <h1 className="text-2xl sm:text-3xl font-bold mt-1">Welcome back, Sharjeel 👋</h1>
          <p className="text-sm text-white/60 mt-1">Here's what's happening across your portfolio today.</p>

          <div className="flex flex-wrap gap-6 mt-5">
            <div><p className="text-2xl font-bold">{stats.properties}</p><p className="text-[11px] uppercase tracking-widest text-white/50">Properties</p></div>
            <div><p className="text-2xl font-bold">{stats.occupancyRate}%</p><p className="text-[11px] uppercase tracking-widest text-white/50">Occupancy</p></div>
            <div><p className="text-2xl font-bold">{money(stats.monthlyRevenue)}</p><p className="text-[11px] uppercase tracking-widest text-white/50">Monthly rent</p></div>
            <div><p className="text-2xl font-bold">{stats.newLeads}</p><p className="text-[11px] uppercase tracking-widest text-white/50">New leads</p></div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={PoundSterling} label="Monthly Revenue" value={money(stats.monthlyRevenue)} delta="+6%" tone="orange" />
        <Kpi icon={TrendingUp} label="Occupancy" value={`${stats.occupancyRate}%`} delta="+2%" tone="navy" />
        <Kpi icon={Building2} label="Properties" value={stats.properties} />
        <Kpi icon={BedDouble} label="Active Tenancies" value={stats.activeTenancies} />
      </div>

      {/* Charts & Occupancy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Revenue — last 7 months" className="lg:col-span-2">
          <div className="flex items-end gap-3 h-48 pt-2">
            {revenueSeries.map((r) => (
              <div key={r.m} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="w-full bg-gray-100 rounded-lg flex items-end h-full relative">
                  <div className="w-full bg-gradient-to-t from-[#F47C3C] to-[#f9a870] rounded-lg transition-all group-hover:opacity-90" 
                       style={{ height: `${maxRev ? (r.v / maxRev) * 100 : 50}%` }} />
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-[#0F253B] opacity-0 group-hover:opacity-100">£{r.v}k</span>
                </div>
                <span className="text-[10px] font-bold text-gray-400">{r.m}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Occupancy">
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative w-32 h-32">
              <svg viewBox="0 0 36 36" className="w-32 h-32 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F1F5F9" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F47C3C" strokeWidth="3.5"
                  strokeDasharray={`${stats.occupancyRate} ${100 - stats.occupancyRate}`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-[#0F253B]">{stats.occupancyRate}%</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">let</span>
              </div>
            </div>
            <div className="flex gap-4 mt-4 text-xs font-medium">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#F47C3C]" />{stats.occupied} occ.</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />{stats.vacant} vacant</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Alerts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/admin/leads" className="rounded-2xl bg-white border border-gray-100 p-5 hover:shadow-md transition-all flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><UserPlus size={22} /></div>
          <div><p className="text-2xl font-bold text-[#0F253B]">{stats.newLeads}</p><p className="text-xs font-medium text-gray-400">New leads to action</p></div>
        </Link>

        <Link href="/admin/viewings" className="rounded-2xl bg-white border border-gray-100 p-5 hover:shadow-md transition-all flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#F47C3C] flex items-center justify-center"><CalendarClock size={22} /></div>
          <div><p className="text-2xl font-bold text-[#0F253B]">{stats.upcomingViewings}</p><p className="text-xs font-medium text-gray-400">Upcoming viewings</p></div>
        </Link>

        <div className="rounded-2xl bg-white border border-gray-100 p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><ShieldAlert size={22} /></div>
          <div><p className="text-2xl font-bold text-[#0F253B]">{stats.complianceDue}</p><p className="text-xs font-medium text-gray-400">Compliance due soon</p></div>
        </div>
      </div>

      {/* Activity + Today's Viewings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Recent Activity" className="lg:col-span-2">
          <ul className="space-y-1">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${{
                  green: "bg-emerald-500", blue: "bg-blue-500", amber: "bg-amber-500", 
                  orange: "bg-[#F47C3C]", gray: "bg-gray-300"
                }[a.tone]}`} />
                <p className="text-sm text-gray-600 flex-1 min-w-0">
                  <b className="text-[#0F253B]">{a.who}</b> {a.action} <span className="text-gray-400">· {a.target}</span>
                </p>
                <span className="text-[11px] text-gray-300 font-medium shrink-0">{a.time}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Today's Viewings" action={
          <Link href="/admin/viewings" className="text-[10px] font-bold text-[#F47C3C] hover:underline uppercase tracking-widest">All</Link>
        }>
          <ul className="space-y-2">
            {viewings.filter((v) => v.status !== "cancelled").slice(0, 4).map((v) => (
              <li key={v._id} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50">
                <span className="text-sm font-bold text-[#F47C3C] w-12 shrink-0">
                  {v.date ? new Date(v.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#0F253B] truncate">{v.lead?.name || v.tenant?.name || "Lead"}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {v.property?.name || "Property"} · {v.room?.roomName || v.room?.title || ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {error && <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-bold rounded">{error}</div>}
    </div>
  );
}