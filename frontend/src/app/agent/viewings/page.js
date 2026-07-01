"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import api from "../../api/api";

const STATUS = ["scheduled", "done", "cancelled"];
const STATUS_TONE = { scheduled: "orange", done: "green", cancelled: "gray" };

/** Convert an ISO string to the value a datetime-local input expects. */
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function ViewingModal({ initial, leads, onClose, onSaved }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    leadId: initial?.leadId?._id || initial?.leadId || "",
    scheduledAt: toLocalInput(initial?.scheduledAt),
    status: initial?.status || "scheduled",
    feedback: initial?.feedback || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.scheduledAt) { setError("Please pick a date & time"); return; }
    setSaving(true);
    setError("");
    try {
      const body = {
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        status: form.status,
      };
      if (form.leadId) body.leadId = form.leadId;
      if (form.feedback) body.feedback = form.feedback;
      if (isEdit) await api.patch(`/viewings/${initial._id}`, body);
      else await api.post("/viewings", body);
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
          <h3 className="text-xl font-bold text-[#0F253B]">{isEdit ? "Edit Viewing" : "Schedule Viewing"}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>
        {error && <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelCls}>Lead</label>
            <select className={field} value={form.leadId} onChange={set("leadId")}>
              <option value="">— None —</option>
              {leads.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Date &amp; Time</label>
            <input type="datetime-local" className={field} value={form.scheduledAt} onChange={set("scheduledAt")} required />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={field} value={form.status} onChange={set("status")}>
              {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Feedback</label>
            <textarea className={field} rows={2} value={form.feedback} onChange={set("feedback")} placeholder="Notes after the viewing…" />
          </div>
          <button type="submit" disabled={saving} className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center">
            {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : isEdit ? "Save Changes" : "Schedule"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AgentViewings() {
  const [items, setItems] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modal, setModal] = useState(null);

  useEffect(() => {
    api.get("/leads", { params: { limit: 100 } }).then((r) => setLeads(r.data.data)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { limit: 50, sort: "scheduledAt" };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/viewings", { params });
      setItems(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load viewings");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const remove = async (v) => {
    if (!confirm("Delete this viewing?")) return;
    try {
      await api.delete(`/viewings/${v._id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const fmt = (iso) => (iso ? new Date(iso).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Viewings"
        subtitle="Schedule and record property viewings"
        action={
          <button onClick={() => setModal({})} className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
            <Plus size={18} /> Schedule Viewing
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
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">Lead</th>
                <th className="px-5 py-3">Agent</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">No viewings scheduled</td></tr>
              ) : (
                items.map((v) => (
                  <tr key={v._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-bold text-[#0F253B]">{fmt(v.scheduledAt)}</td>
                    <td className="px-5 py-3 text-gray-500">{v.leadId?.name || "—"}</td>
                    <td className="px-5 py-3 text-gray-500">{v.agentId?.name || "—"}</td>
                    <td className="px-5 py-3"><Badge tone={STATUS_TONE[v.status] || "gray"}>{v.status}</Badge></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setModal(v)} className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg"><Pencil size={16} /></button>
                        <button onClick={() => remove(v)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
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
        <ViewingModal initial={modal._id ? modal : null} leads={leads} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />
      )}
    </div>
  );
}
