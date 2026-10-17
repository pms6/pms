"use client";

import { useState, useEffect, useCallback } from "react";
import { DoorOpen, Users, Mail, Repeat, RefreshCw, Download, Send, Eye, X, Plus, FileSpreadsheet, Pencil, Trash2, KeyRound } from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import { TENANCY_STATUS, TENANCY_STATUS_TONE, money } from "../_data/dummy";
import api from "../../api/api";
import AddOccupancyModal from "./_components/AddOccupancyModal";
import ImportExcelModal from "./_components/ImportExcelModal";
import { guardModalClose } from "@/app/Shared/modalGuard";

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
  const [sendingWelcome, setSendingWelcome] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revealedCredentials, setRevealedCredentials] = useState(null);

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

  const emailAttention = items.filter((o) => o.accountExists && o.welcomeEmailStatus !== "Sent").length;

  const list = items.filter((o) => (!propF || o.property === propF) && (!statusF || o.status === statusF));

  const overview = [
    { icon: DoorOpen, label: "Units", value: stats.units },
    { icon: Users, label: "Occupants", value: stats.occupants },
    { icon: Mail, label: "Welcome Emails To Send", value: emailAttention },
    { icon: Repeat, label: "Tenancy Changes", value: stats.tenancyChanges },
    { icon: RefreshCw, label: "Renewals", value: stats.renewals },
  ];

  const statusChips = [
    { key: "", label: "All Occupants", count: items.length, tone: "gray" },
    ...TENANCY_STATUS.map((s) => ({ key: s, label: s, count: items.filter((o) => o.status === s).length, tone: TENANCY_STATUS_TONE[s] })),
  ];

  const saveEdit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    for (const key of ["startDate", "fixedTermEnd", "periodicStart"]) payload[key] = payload[key] || null;
    try {
      const res = await api.put(`/tenancies/${view._id}`, payload);
      setItems((xs) => xs.map((x) => x._id === view._id ? { ...x, ...res.data.data } : x));
      setView((v) => ({ ...v, ...res.data.data }));
      setEditing(false);
    } catch (err) { alert(err.response?.data?.message || "Failed to update occupancy"); }
    finally { setSaving(false); }
  };

  const deleteOccupancy = async (tenancy) => {
    if (!confirm(`Delete the occupancy record for ${tenancy.tenant}? This hides it from the active register while preserving its history.`)) return;
    try {
      await api.delete(`/tenancies/${tenancy._id}`);
      setView(null);
      await load();
    } catch (err) { alert(err.response?.data?.message || "Failed to delete occupancy"); }
  };

  const resetPassword = async (tenancy) => {
    if (!confirm(`Reset ${tenancy.tenant}'s portal password to London@1234?`)) return;
    try {
      const res = await api.patch(`/tenancies/${tenancy._id}/reset-password`);
      setRevealedCredentials({ tenancyId: tenancy._id, email: tenancy.tenantEmail, password: "London@1234" });
      alert(res.data?.message || "Password reset.");
    } catch (err) { alert(err.response?.data?.message || "Failed to reset password"); }
  };

  const sendWelcome = async (tenancy) => {
    const alreadySent = tenancy.welcomeEmailStatus === "Sent";
    if (!confirm(`${alreadySent ? "Resend" : "Send"} the portal welcome email to ${tenancy.tenantEmail}? The password will be set to London@1234 so the email contains a working login.`)) return;
    setSendingWelcome(true);
    try {
      const res = await api.patch(`/tenancies/${tenancy._id}/welcome-email`);
      const updated = res.data?.data;
      setItems((xs) => xs.map((x) => x._id === tenancy._id ? { ...x, ...(updated || {}), accountExists: true, welcomeEmailStatus: "Sent", welcomeEmailSentAt: updated?.welcomeEmailSentAt || new Date().toISOString() } : x));
      setView((v) => v && v._id === tenancy._id ? { ...v, ...(updated || {}), accountExists: true, welcomeEmailStatus: "Sent", welcomeEmailSentAt: updated?.welcomeEmailSentAt || new Date().toISOString() } : v);
      setRevealedCredentials({ tenancyId: tenancy._id, email: tenancy.tenantEmail, password: "London@1234" });
      alert(res.data?.message || "Welcome email sent.");
    } catch (err) {
      if (err.response?.status === 502) {
        setRevealedCredentials({ tenancyId: tenancy._id, email: tenancy.tenantEmail, password: "London@1234" });
        setItems((xs) => xs.map((x) => x._id === tenancy._id ? { ...x, accountExists: true, welcomeEmailStatus: "Failed" } : x));
        setView((v) => v && v._id === tenancy._id ? { ...v, accountExists: true, welcomeEmailStatus: "Failed" } : v);
      }
      alert(err.response?.data?.message || "Failed to send welcome email");
    }
    finally { setSendingWelcome(false); }
  };

  const exportBtn = (label) => (
    <button key={label} onClick={() => alert(`${label} (demo)`)} className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-100 hover:bg-gray-50 text-[#0F253B] font-bold text-xs rounded-xl transition-all">
      <Download size={15} /> {label}
    </button>
  );

  const closeOccupancyDetails = () => {
    setEditing(false);
    setView(null);
  };
  const requestCloseDetails = guardModalClose(closeOccupancyDetails);
  const requestCancelEdit = guardModalClose(() => setEditing(false));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Occupancy"
        subtitle="Occupancy status of all properties, units and tenants"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-[#0F253B] font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
              <FileSpreadsheet size={18} /> Import Excel
            </button>
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[#0F253B] hover:bg-[#1c3853] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
              <Plus size={18} /> Add Occupancy
            </button>
          </div>
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
                <th className="px-5 py-3 text-right">Room Rent</th>
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
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-[#0F253B]">{money(o.rent)} <span className="text-[10px] font-medium text-gray-400">/{o.rentPeriod === "WEEKLY" ? "week" : "month"}</span></td>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={requestCloseDetails}>
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-xl font-bold text-[#0F253B]">{view.tenant}</h3>
                <p className="text-xs text-gray-400 font-medium">{view.property} · {view.unit}</p>
              </div>
              <button type="button" onClick={requestCloseDetails} aria-label="Close occupancy details" className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4 flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Room Rent / {view.rentPeriod === "WEEKLY" ? "Week" : "Month"}</p>
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
                ["Tenant login", view.accountExists ? `Account active (${view.tenantEmail || "email on file"})` : "No portal account"],
                ["Welcome email", view.welcomeEmailStatus === "Sent" ? `Sent ${fmtDate(view.welcomeEmailSentAt)}` : view.welcomeEmailStatus === "Failed" ? `Failed${view.welcomeEmailError ? `: ${view.welcomeEmailError}` : ""}` : "Not sent"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3"><dt className="text-gray-400 font-medium">{k}</dt><dd className="font-bold text-[#0F253B] text-right">{v}</dd></div>
              ))}
            </dl>

            {view.accountExists && <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm">
              <p className="font-bold text-[#0F253B]">Login details</p>
              <p className="mt-1 text-gray-600">Email: <span className="font-semibold">{view.tenantEmail}</span></p>
              {revealedCredentials?.tenancyId === view._id
                ? <p className="mt-1 text-gray-600">Password (set by your latest reset): <span className="font-mono font-bold">{revealedCredentials.password}</span></p>
                : <p className="mt-1 text-gray-400">Password is hidden for security. Reset it to set and view a known password.</p>}
            </div>}

            {editing && (
              <form onSubmit={saveEdit} className="mt-5 space-y-3">
                {[["tenant", "Tenant name", view.tenant], ["tenantEmail", "Email", view.tenantEmail], ["availability", "Availability", view.availability]].map(([name, label, value]) => <label key={name} className="block text-xs font-bold text-gray-500">{label}<input name={name} defaultValue={value || ""} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal" /></label>)}
                <label className="block text-xs font-bold text-gray-500">Status<select name="status" defaultValue={view.status} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal">{TENANCY_STATUS.map((s) => <option key={s}>{s}</option>)}</select></label>
                {[ ["startDate", "Start date"], ["fixedTermEnd", "Fixed term end"], ["periodicStart", "Periodic start"] ].map(([name, label]) => <label key={name} className="block text-xs font-bold text-gray-500">{label}<input type="date" name={name} defaultValue={view[name] ? new Date(view[name]).toISOString().slice(0, 10) : ""} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal" /></label>)}
                <div className="flex gap-2"><button disabled={saving} className="flex-1 rounded-xl bg-[#0F253B] py-2.5 text-sm font-bold text-white">{saving ? "Saving…" : "Save changes"}</button><button type="button" onClick={requestCancelEdit} disabled={saving} className="px-4 text-sm font-bold text-gray-400 disabled:opacity-40">Cancel</button></div>
              </form>
            )}

            {!editing && <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={() => setEditing(true)} className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-[#0F253B]"><Pencil size={15}/> Edit</button>
              <button onClick={() => resetPassword(view)} disabled={!view.accountExists} className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-[#0F253B] disabled:opacity-40"><KeyRound size={15}/> Reset password</button>
              <button onClick={() => sendWelcome(view)} disabled={!view.tenantEmail || sendingWelcome} className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 py-2.5 text-sm font-bold text-[#c65d27] disabled:opacity-40"><Send size={15}/>{sendingWelcome ? "Sending…" : view.welcomeEmailStatus === "Sent" ? "Send welcome email again" : "Send welcome email"}</button>
              <button onClick={() => deleteOccupancy(view)} className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-red-100 py-2.5 text-sm font-bold text-red-600"><Trash2 size={15}/> Delete occupancy</button>
            </div>}
            <button type="button" onClick={requestCloseDetails} className="w-full mt-3 py-2.5 text-sm font-bold text-gray-400 hover:text-[#0F253B]">Close</button>
          </div>
        </div>
      )}

      {/* Add Property + Room + Tenancy */}
      {showAdd && <AddOccupancyModal onClose={() => setShowAdd(false)} onCreated={load} />}

      {/* Excel import */}
      {showImport && <ImportExcelModal onClose={() => setShowImport(false)} onImported={load} />}
    </div>
  );
}
