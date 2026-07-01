"use client";

import { useEffect, useState } from "react";
import { Home, BedDouble, Wrench, ShieldAlert, TrendingUp } from "lucide-react";
import { PageHeader, Card, StatCard } from "../../Shared/ui";
import api from "../../api/api";

export default function ManagerReports() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/dashboard/stats")
      .then((r) => { if (active) setStats(r.data.data); })
      .catch((err) => { if (active) setError(err.response?.data?.message || "Failed to load report"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="flex items-center justify-center py-32"><div className="w-8 h-8 border-2 border-[#F47C3C]/30 border-t-[#F47C3C] rounded-full animate-spin" /></div>;
  if (error) return <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-bold rounded">{error}</div>;

  const s = stats;
  const occ = s.occupancy;
  const segs = occ.totalRooms > 0
    ? [
        { label: "Occupied", value: occ.occupied, color: "bg-[#F47C3C]" },
        { label: "Vacant", value: occ.vacant, color: "bg-emerald-500" },
        { label: "Maintenance", value: occ.maintenance, color: "bg-amber-500" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Portfolio summary" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Home} label="Properties" value={s.properties.total} sub={`${s.properties.archived} archived`} tone="navy" />
        <StatCard icon={TrendingUp} label="Occupancy" value={`${occ.occupancyRate}%`} sub={`${occ.occupied}/${occ.totalRooms} rooms`} tone="orange" />
        <StatCard icon={BedDouble} label="Active Tenancies" value={s.tenancies.active} />
        <StatCard icon={ShieldAlert} label="Compliance Issues" value={s.compliance.due + s.compliance.expired} sub={`${s.compliance.expired} expired`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Occupancy Breakdown">
          {segs.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">No rooms recorded yet.</p>
          ) : (
            <>
              <div className="flex gap-6 flex-wrap mb-4">
                {segs.map((r) => (
                  <div key={r.label} className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${r.color}`} />
                    <span className="text-sm font-bold text-[#0F253B]">{r.value}</span>
                    <span className="text-xs text-gray-400 font-medium">{r.label}</span>
                  </div>
                ))}
              </div>
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden flex">
                {segs.map((r) => (
                  <div key={r.label} className={`${r.color} h-full`} style={{ width: `${(r.value / occ.totalRooms) * 100}%` }} />
                ))}
              </div>
            </>
          )}
        </Card>

        <Card title="Operations Snapshot">
          <ul className="divide-y divide-gray-50">
            {[
              { icon: Wrench, label: "Open maintenance", value: s.maintenance.open, extra: `${s.maintenance.urgent} urgent` },
              { icon: ShieldAlert, label: "Compliance due (30d)", value: s.compliance.due, extra: `${s.compliance.expired} expired` },
              { icon: TrendingUp, label: "New leads", value: s.leads.new, extra: `${s.leads.total} total` },
              { icon: BedDouble, label: "Vacant rooms", value: occ.vacant, extra: `${occ.totalRooms} total` },
            ].map((row, i) => (
              <li key={i} className="flex items-center justify-between py-3">
                <span className="flex items-center gap-2 text-sm font-medium text-gray-500">
                  <row.icon size={16} className="text-[#F47C3C]" />{row.label}
                </span>
                <span className="text-sm font-bold text-[#0F253B]">{row.value} <span className="text-xs font-medium text-gray-400">· {row.extra}</span></span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <p className="text-xs text-gray-300 font-medium">Generated {new Date(s.generatedAt).toLocaleString()}</p>
    </div>
  );
}
