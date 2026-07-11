"use client";

import { useState, useEffect, useCallback } from "react";
import { DoorOpen, Users, UserPlus, Repeat, RefreshCw, Download, Send, Eye, X } from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import { TENANCY_STATUS, TENANCY_STATUS_TONE, money } from "../_data/dummy";
import api from "../../api/api";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

export default function AdminOccupancy() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ units: 0, occupants: 0, onboardings: 0, tenancyChanges: 0, renewals: 0 });
  const [propertyNames, setPropertyNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [propF, setPropF] = useState("");
  const [statusF, setStatusF] = useState("");
  const [view, setView] = useState(null);
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [tenRes, statsRes, propsRes] = await Promise.all([
        api.get("/tenancies"),
        api.get("/tenancies/stats"),
        api.get("/properties", { params: { limit: 100 } }),
      ]);
      setItems(tenRes.data.data || []);
      setStats(statsRes.data.data || { units: 0, occupants: 0, onboardings: 0, tenancyChanges: 0, renewals: 0 });
      setPropertyNames((propsRes.data.data || []).map((p) => p.name));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load occupancy");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pendingOnboarding = items.filter((o) => !o.onboarded).length;

  const list = items.filter((o) => (!propF || o.property === propF) && (!statusF || o.status === statusF));

  const overview = [
    { icon: DoorOpen, label: "Units", value: stats.units },
    { icon: Users, label: "Occupants", value: stats.occupants },
    { icon: UserPlus, label: "Onboardings", value: pendingOnboarding },
    { icon: Repeat, label: "Tenancy Changes", value: stats.tenancyChanges },
    { icon: RefreshCw, label: "Renewals", value: stats.renewals },
  ];

  const statusChips = [
    { key: "", label: "All Occupants", count: items.length, tone: "gray" },
    ...TENANCY_STATUS.map((s) => ({ key: s, label: s, count: items.filter((o) => o.status === s).length, tone: TENANCY_STATUS_TONE[s] })),
  ];

  const inviteAll = async () => {
    if (pendingOnboarding === 0) return;
    if (!confirm(`Invite ${pendingOnboarding} tenant(s) to onboard?`)) return;
    setInviting(true);
    try {
      const res = await api.post("/tenancies/invite-all");
      alert(res.data?.message || "Invites sent.");
      setItems((xs) => xs.map((x) => (x.onboarded ? x : { ...x, invitedAt: new Date().toISOString() })));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to send invites");
    } finally {
      setInviting(false);
    }
  };

  const inviteOne = async (tenancy) => {
    try {
      const res = await api.patch(`/tenancies/${tenancy._id}/invite`);
      alert(res.data?.message || "Invite sent.");
      const updated = res.data?.data;
      if (updated) {
        setItems((xs) => xs.map((x) => (x._id === updated._id ? updated : x)));
        setView((v) => (v && v._id === updated._id ? updated : v));
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to send invite");
    }
  };

  const exportBtn = (label) => (
    <button key={label} onClick={() => alert(`${label} (demo)`)} className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-100 hover:bg-gray-50 text-[#0F253B] font-bold text-xs rounded-xl transition-all">
      <Download size={15} /> {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Occupancy"
        subtitle="Occupancy status of all properties, units and tenants"
        action={
          <button onClick={inviteAll} disabled={inviting || pendingOnboarding === 0} className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
            <Send size={18} /> Invite All Tenants
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</div>
      )}

      {/* Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {overview.map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#F47C3C] flex items-center justify-center mb-3"><s.icon size={18} /></div>
            <p className="text-2xl font-bold text-[#0F253B]">{loading ? "—" : s.value}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tenancy status summary (clickable filters) */}
      <div className="flex flex-wrap gap-2">
        {statusChips.map((c) => (
          <button key={c.label} onClick={() => setStatusF(c.key)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-bold transition-all ${statusF === c.key ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-white text-gray-600 border-gray-100 hover:bg-gray-50"}`}>
            {c.label}
            <span className={`text-[11px] font-bold rounded-full px-1.5 py-0.5 ${statusF === c.key ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>{c.count}</span>
          </button>
        ))}
      </div>

      {/* Property filter + exports */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select value={propF} onChange={(e) => setPropF(e.target.value)} className="px-3.5 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]">
          <option value="">All properties</option>
          {propertyNames.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="flex flex-wrap gap-2">
          {["Current Tenancies (CSV)", "Past Tenancies (CSV)", "Cancelled Tenancies (CSV)", "Tenancy Revenue Report (CSV)"].map(exportBtn)}
        </div>
      </div>

      {/* List */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3">Property &amp; Unit</th>
                <th className="px-5 py-3">Tenant</th>
                <th className="px-5 py-3 text-right">Monthly Rent</th>
                <th className="px-5 py-3">Start</th>
                <th className="px-5 py-3">Term End / Periodic</th>
                <th className="px-5 py-3">Availability</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400">Loading tenancies…</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400">No tenancies match these filters</td></tr>
              ) : (
                list.map((o) => (
                  <tr key={o._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <p className="font-bold text-[#0F253B]">{o.property}</p>
                      <p className="text-[11px] text-gray-400">{o.unit}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {o.tenant}
                      {!o.onboarded && <span className="ml-2 text-[10px] font-bold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">Onboarding</span>}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-[#0F253B]">{money(o.rent)}</td>
                    <td className="px-5 py-3 text-gray-500">{fmtDate(o.startDate)}</td>
                    <td className="px-5 py-3 text-gray-500">{o.fixedTermEnd ? fmtDate(o.fixedTermEnd) : `Periodic from ${fmtDate(o.periodicStart)}`}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-bold ${o.availability === "Occupied" ? "text-gray-400" : "text-emerald-600"}`}>{o.availability}</span>
                    </td>
                    <td className="px-5 py-3"><Badge tone={TENANCY_STATUS_TONE[o.status]}>{o.status}</Badge></td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setView(o)} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F47C3C] hover:underline"><Eye size={14} /> View</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {view && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setView(null)}>
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-xl font-bold text-[#0F253B]">{view.tenant}</h3>
                <p className="text-xs text-gray-400 font-medium">{view.property} · {view.unit}</p>
              </div>
              <button onClick={() => setView(null)} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4 flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Monthly Rent</p>
                <p className="text-2xl font-bold text-[#0F253B]">{money(view.rent)}</p>
              </div>
              <Badge tone={TENANCY_STATUS_TONE[view.status]}>{view.status}</Badge>
            </div>

            <dl className="space-y-2.5 text-sm">
              {[
                ["Tenancy Start", fmtDate(view.startDate)],
                ["Fixed Term End", view.fixedTermEnd ? fmtDate(view.fixedTermEnd) : "—"],
                ["Periodic Start", view.periodicStart ? fmtDate(view.periodicStart) : "—"],
                ["Availability", view.availability],
                ["Onboarding", view.onboarded ? "Complete" : view.invitedAt ? `Invited ${fmtDate(view.invitedAt)}` : "Pending invite"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3"><dt className="text-gray-400 font-medium">{k}</dt><dd className="font-bold text-[#0F253B] text-right">{v}</dd></div>
              ))}
            </dl>

            {!view.onboarded && (
              <button onClick={() => inviteOne(view)} className="w-full mt-5 flex items-center justify-center gap-2 py-3 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all">
                <Send size={16} /> Send Onboarding Invite
              </button>
            )}
            <button onClick={() => setView(null)} className="w-full mt-3 py-2.5 text-sm font-bold text-gray-400 hover:text-[#0F253B]">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
