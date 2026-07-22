"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Home, Wrench, ShieldAlert, TrendingUp, BedDouble } from "lucide-react";
import { StatCard, PageHeader, Card, Badge } from "../../Shared/ui";
import api from "../../api/api";

const PRIORITY_TONE = { urgent: "red", high: "amber", med: "gray", low: "gray" };

function complianceTone(status) {
  return status === "expired" ? "red" : status === "warning" || status === "expiring" ? "amber" : "green";
}

export default function ManagerDashboard() {
  const [stats, setStats] = useState(null);
  const [maintenance, setMaintenance] = useState([]);
  const [compliance, setCompliance] = useState([]);
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      try {
        const [propsRes, roomsRes, maintRes, compRes] = await Promise.all([
          api.get("/properties", { params: { limit: 50 } }),
          api.get("/rooms"), // or /rooms/stats if available
          api.get("/maintenance", { params: { status: "open", limit: 5 } }),
          api.get("/compliance", { params: { due: "soon", limit: 5, sort: "expiryDate" } }),
        ]);

        if (!active) return;

        const allProperties = propsRes.data?.data || [];
        const allRooms = roomsRes.data?.data || [];

        // Calculate occupancy stats
        const occupiedRooms = allRooms.filter(r => 
          r.status === "OCCUPIED" || r.status === "occupied"
        ).length;
        const totalRooms = allRooms.length;
        const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

        setProperties(allProperties);
        setRooms(allRooms);

        setStats({
          properties: { 
            total: allProperties.length, 
            archived: 0 
          },
          occupancy: {
            occupancyRate,
            occupied: occupiedRooms,
            totalRooms,
            vacant: totalRooms - occupiedRooms,
            maintenance: allRooms.filter(r => r.status === "MAINTENANCE").length,
          },
          maintenance: { 
            open: maintRes.data?.data?.length || 0, 
            urgent: maintRes.data?.data?.filter(m => m.priority === "urgent").length || 0 
          },
          compliance: { 
            due: compRes.data?.data?.length || 0, 
            expired: compRes.data?.data?.filter(c => c.status === "expired").length || 0 
          },
          tenancies: { active: occupiedRooms },
          leads: { new: 0, total: 0 }, // Add leads fetch if needed
        });

        setMaintenance(maintRes.data?.data || []);
        setCompliance(compRes.data?.data || []);
      } catch (err) {
        console.error(err);
        if (active) setError(err.response?.data?.message || "Failed to load manager dashboard");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();

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

  const s = stats || {};

  return (
    <div className="space-y-6">
      <PageHeader title="Manager Dashboard" subtitle="Portfolio operations at a glance" />

      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={Home} 
          label="Properties" 
          value={s.properties?.total || 0} 
          sub={`${s.properties?.archived || 0} archived`} 
          tone="navy" 
        />
        <StatCard 
          icon={TrendingUp} 
          label="Occupancy" 
          value={`${s.occupancy?.occupancyRate || 0}%`} 
          sub={`${s.occupancy?.occupied || 0}/${s.occupancy?.totalRooms || 0} rooms`} 
          tone="orange" 
        />
        <StatCard 
          icon={Wrench} 
          label="Open Maintenance" 
          value={s.maintenance?.open || 0} 
          sub={`${s.maintenance?.urgent || 0} urgent`} 
        />
        <StatCard 
          icon={ShieldAlert} 
          label="Compliance Due" 
          value={s.compliance?.due || 0} 
          sub={`${s.compliance?.expired || 0} expired`} 
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BedDouble} label="Active Tenancies" value={s.tenancies?.active || 0} />
        {/* <StatCard icon={UserPlus} label="New Leads" value={s.leads?.new || 0} sub={`${s.leads?.total || 0} total`} /> */}
        <StatCard icon={TrendingUp} label="Vacant Rooms" value={s.occupancy?.vacant || 0} />
        <StatCard icon={Wrench} label="In Maintenance" value={s.occupancy?.maintenance || 0} sub="rooms" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Compliance Card */}
        <Card 
          title="Compliance Due Soon" 
          action={<Link href="/manager/compliance" className="text-[10px] font-bold text-[#F47C3C] hover:underline uppercase tracking-widest">View all</Link>}
        >
          {compliance.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">Nothing due in the next 30 days.</p>
          ) : (
            <ul className="space-y-2">
              {compliance.map((c) => (
                <li key={c._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <div>
                    <p className="text-sm font-bold text-[#0F253B]">{c.type || c.certType}</p>
                    <p className="text-xs text-gray-400 font-medium">
                      {c.property?.name || c.propertyId?.name || "—"}
                    </p>
                  </div>
                  <Badge tone={complianceTone(c.status)}>
                    {c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : c.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Maintenance Card */}
        <Card 
          title="Maintenance Queue" 
          action={<Link href="/manager/maintenance" className="text-[10px] font-bold text-[#F47C3C] hover:underline uppercase tracking-widest">View all</Link>}
        >
          {maintenance.length === 0 ? (
            <p className="text-sm text-gray-400 py-3">No open requests. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {maintenance.map((m) => (
                <li key={m._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0F253B] truncate">{m.title || m.category}</p>
                    <p className="text-xs text-gray-400 font-medium">
                      {m.property?.name || m.propertyId?.name || "—"}
                    </p>
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