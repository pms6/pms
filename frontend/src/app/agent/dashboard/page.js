"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus, CalendarClock, Percent, Building2, BedDouble } from "lucide-react";
import { StatCard, PageHeader, Card, Badge } from "../../Shared/ui";
import api from "../../api/api";

const LEAD_TONE = { new: "blue", qualified: "green", converted: "orange", lost: "gray" };

export default function AgentDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const fetchDashboardData = async () => {
      try {
        const [
          propertiesRes,
          roomsRes,
          viewingsRes,
          leadsRes,
          convertedRes,
        ] = await Promise.all([
          api.get("/properties", { params: { limit: 6, sort: "-createdAt" } }),
          api.get("/rooms/stats/available").catch(() => ({ data: { data: { available: 0 } } })),
          api.get("/viewings", { params: { status: "scheduled", limit: 5, sort: "scheduledAt" } }),
          api.get("/leads", { params: { limit: 5, sort: "-createdAt" } }),
          api.get("/leads", { params: { status: "converted", limit: 1 } }),
        ]);

        if (!active) return;

        const properties = propertiesRes.data?.data || [];
        const roomsData = roomsRes.data?.data || {};
        const viewings = viewingsRes.data?.data || [];
        const recentLeads = leadsRes.data?.data || [];
        const convCount = convertedRes.data?.meta?.total || 0;

        const totalLeads = recentLeads.length; // fallback if no stats endpoint
        const totalProperties = properties.length;
        const totalRooms = roomsData.available || roomsData.total || 0;

        setData({
          totalLeads,
          newLeads: recentLeads.filter(l => l.status === "new").length,
          upcomingViewings: viewings.length,
          conversion: totalLeads > 0 ? Math.round((convCount / totalLeads) * 100) : 0,
          totalProperties,
          totalRooms,
          properties: properties.slice(0, 3),
          viewings,
          recentLeads,
        });
      } catch (err) {
        console.error(err);
        if (active) setError(err.response?.data?.message || "Failed to load dashboard");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchDashboardData();

    return () => { active = false; };
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
  const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString([], { 
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" 
  }) : "—");

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Agent Dashboard" 
        subtitle="Your lettings pipeline & portfolio" 
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={UserPlus} label="New Leads" value={d.newLeads} sub={`${d.totalLeads} total`} tone="navy" />
        <StatCard icon={CalendarClock} label="Upcoming Viewings" value={d.upcomingViewings} tone="orange" />
        <StatCard icon={Percent} label="Conversion" value={`${d.conversion}%`} sub="leads → converted" />
        <StatCard icon={Building2} label="Properties" value={d.totalProperties} sub="in portfolio" tone="navy" />
        <StatCard icon={BedDouble} label="Rooms" value={d.totalRooms} sub="available" tone="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Properties */}
        <Card 
          title="Your Properties" 
          className="lg:col-span-1"
          action={<Link href="/agent/properties" className="text-[10px] font-bold text-[#F47C3C] hover:underline uppercase tracking-widest">View all</Link>}
        >
          {d.properties?.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">No properties yet.</p>
          ) : (
            <ul className="space-y-3">
              {d.properties.map((p) => (
                <li key={p._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#0F253B] truncate">{p.name || p.title}</p>
                    <p className="text-xs text-gray-400">{p.type} • {p.status}</p>
                  </div>
                  <Badge tone="emerald">{p.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Upcoming Viewings */}
        <Card 
          title="Upcoming Viewings" 
          className="lg:col-span-1"
          action={<Link href="/agent/viewings" className="text-[10px] font-bold text-[#F47C3C] hover:underline uppercase tracking-widest">View all</Link>}
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
          action={<Link href="/agent/leads" className="text-[10px] font-bold text-[#F47C3C] hover:underline uppercase tracking-widest">View all</Link>}
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
    </div>
  );
}