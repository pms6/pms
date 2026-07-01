"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import api from "../../api/api";

const STATUS = ["new", "qualified", "converted", "lost"];
const STATUS_TONE = { new: "blue", qualified: "green", converted: "orange", lost: "gray" };

function LeadModal({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    name: initial?.name || "",
    email: initial?.email || "",
    phone: initial?.phone || "",
    source: initial?.source || "",
    status: initial?.status || "new",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = { name: form.name, status: form.status };
      if (form.email) body.email = form.email;
      if (form.phone) body.phone = form.phone;
      if (form.source) body.source = form.source;
      if (isEdit) await api.patch(`/leads/${initial._id}`, body);
      else await api.post("/leads", body);
      onSaved();
    } catch (err) {
      const d = err.response?.data;
      setError(d?.details?.[0]?.message || d?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const field = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium";
  const labelCls = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">{isEdit ? "Edit Lead" : "New Lead"}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>
        {error && <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelCls}>Name</label>
            <input className={field} value={form.name} onChange={set("name")} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" className={field} value={form.email} onChange={set("email")} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input className={field} value={form.phone} onChange={set("phone")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Source</label>
              <input className={field} value={form.source} onChange={set("source")} placeholder="Rightmove" />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={field} value={form.status} onChange={set("status")}>
                {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" disabled={saving} className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center">
            {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : isEdit ? "Save Changes" : "Create Lead"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AgentLeads() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { limit: 50, sort: "-createdAt" };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/leads", { params });
      setItems(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const remove = async (l) => {
    if (!confirm(`Delete lead "${l.name}"?`)) return;
    try {
      await api.delete(`/leads/${l._id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leads"
        subtitle="Track enquiries through the pipeline"
        action={
          <button onClick={() => setModal({})} className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
            <Plus size={18} /> New Lead
          </button>
        }
      />

      <div className="flex gap-2 flex-wrap">
        {["", ...STATUS].map((s) => (
          <button key={s || "all"} onClick={() => setStatusFilter(s)} className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all ${statusFilter === s ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {error && <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-bold rounded">{error}</div>}

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">No leads yet</td></tr>
              ) : (
                items.map((l) => (
                  <tr key={l._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-bold text-[#0F253B]">{l.name}</td>
                    <td className="px-5 py-3 text-gray-500">{l.email || l.phone || "—"}</td>
                    <td className="px-5 py-3 text-gray-500">{l.source || "—"}</td>
                    <td className="px-5 py-3"><Badge tone={STATUS_TONE[l.status] || "gray"}>{l.status}</Badge></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setModal(l)} className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg"><Pencil size={16} /></button>
                        <button onClick={() => remove(l)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal !== null && (
        <LeadModal initial={modal._id ? modal : null} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}
