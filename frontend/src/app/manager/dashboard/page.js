"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Home, Wrench, ShieldAlert, TrendingUp, BedDouble, UserPlus } from "lucide-react";
import { StatCard, PageHeader, Card, Badge } from "../../Shared/ui";
import api from "../../api/api";

const PRIORITY_TONE = { urgent: "red", high: "amber", med: "gray", low: "gray" };

function complianceTone(status) {
  return status === "expired" ? "red" : status === "expiring" ? "amber" : "green";
}

export default function ManagerDashboard() {
  const [stats, setStats] = useState(null);
  const [maintenance, setMaintenance] = useState([]);
  const [compliance, setCompliance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [s, m, c] = await Promise.all([
          api.get("/dashboard/stats"),
          api.get("/maintenance", { params: { status: "open", limit: 5 } }),
          api.get("/compliance", { params: { due: "soon", limit: 5, sort: "expiryDate" } }),
        ]);
        if (!active) return;
        setStats(s.data.data);
        setMaintenance(m.data.data);
        setCompliance(c.data.data);
      } catch (err) {
        if (active) setError(err.response?.data?.message || "Failed to load dashboard");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-32"><div className="w-8 h-8 border-2 border-[#F47C3C]/30 border-t-[#F47C3C] rounded-full animate-spin" /></div>;
  }
  if (error) {
    return <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-bold rounded">{error}</div>;
  }

  const s = stats;

  return (
    <div className="space-y-6">
      <PageHeader title="Manager Dashboard" subtitle="Portfolio operations at a glance" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Home} label="Properties" value={s.properties.total} sub={`${s.properties.archived} archived`} tone="navy" />
        <StatCard icon={TrendingUp} label="Occupancy" value={`${s.occupancy.occupancyRate}%`} sub={`${s.occupancy.occupied}/${s.occupancy.totalRooms} rooms`} tone="orange" />
        <StatCard icon={Wrench} label="Open Maintenance" value={s.maintenance.open} sub={`${s.maintenance.urgent} urgent`} />
        <StatCard icon={ShieldAlert} label="Compliance Due" value={s.compliance.due} sub={`${s.compliance.expired} expired`} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BedDouble} label="Active Tenancies" value={s.tenancies.active} />
        <StatCard icon={UserPlus} label="New Leads" value={s.leads.new} sub={`${s.leads.total} total`} />
        <StatCard icon={TrendingUp} label="Vacant Rooms" value={s.occupancy.vacant} />
        <StatCard icon={Wrench} label="In Maintenance" value={s.occupancy.maintenance} sub="rooms" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Compliance Due Soon" action={<Link href="/manager/compliance" className="text-[10px] font-bold text-[#F47C3C] hover:underline uppercase tracking-widest">View all</Link>}>
          {compliance.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">Nothing due in the next 30 days.</p>
          ) : (
            <ul className="space-y-2">
              {compliance.map((c) => (
                <li key={c._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <div>
                    <p className="text-sm font-bold text-[#0F253B]">{c.certType}</p>
                    <p className="text-xs text-gray-400 font-medium">{c.propertyId?.name || "—"}</p>
                  </div>
                  <Badge tone={complianceTone(c.status)}>
                    {c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : c.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Maintenance Queue" action={<Link href="/manager/maintenance" className="text-[10px] font-bold text-[#F47C3C] hover:underline uppercase tracking-widest">View all</Link>}>
          {maintenance.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">No open requests. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {maintenance.map((m) => (
                <li key={m._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0F253B] truncate">{m.title || m.category || "Request"}</p>
                    <p className="text-xs text-gray-400 font-medium">{m.propertyId?.name || "—"}</p>
                  </div>
                  <Badge tone={PRIORITY_TONE[m.priority] || "gray"}>{m.priority}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
