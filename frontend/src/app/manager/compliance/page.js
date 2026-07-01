"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import api from "../../api/api";

const CERT_TYPES = ["EPC", "Gas", "EICR", "FRA", "PAT", "Legionella", "FireDoor", "Alarm"];
const STATUS_TONE = { valid: "green", expiring: "amber", expired: "red" };

function CertModal({ initial, properties, onClose, onSaved }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    propertyId: initial?.propertyId?._id || initial?.propertyId || "",
    certType: initial?.certType || "Gas",
    issueDate: initial?.issueDate ? initial.issueDate.slice(0, 10) : "",
    expiryDate: initial?.expiryDate ? initial.expiryDate.slice(0, 10) : "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!isEdit && !form.propertyId) { setError("Please choose a property"); return; }
    setSaving(true);
    setError("");
    try {
      const body = { certType: form.certType };
      if (form.issueDate) body.issueDate = form.issueDate;
      if (form.expiryDate) body.expiryDate = form.expiryDate;
      if (isEdit) {
        await api.patch(`/compliance/${initial._id}`, body);
      } else {
        body.propertyId = form.propertyId;
        await api.post("/compliance", body);
      }
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
          <h3 className="text-xl font-bold text-[#0F253B]">{isEdit ? "Edit Certificate" : "New Certificate"}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>
        {error && <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          {!isEdit && (
            <div>
              <label className={labelCls}>Property</label>
              <select className={field} value={form.propertyId} onChange={set("propertyId")} required>
                <option value="">Select property…</option>
                {properties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className={labelCls}>Certificate Type</label>
            <select className={field} value={form.certType} onChange={set("certType")}>
              {CERT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Issue Date</label>
              <input type="date" className={field} value={form.issueDate} onChange={set("issueDate")} />
            </div>
            <div>
              <label className={labelCls}>Expiry Date</label>
              <input type="date" className={field} value={form.expiryDate} onChange={set("expiryDate")} />
            </div>
          </div>
          <button type="submit" disabled={saving} className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center">
            {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : isEdit ? "Save Changes" : "Create Certificate"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ManagerCompliance() {
  const [items, setItems] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dueFilter, setDueFilter] = useState("");
  const [modal, setModal] = useState(null);

  useEffect(() => {
    api.get("/properties", { params: { limit: 100 } }).then((r) => setProperties(r.data.data)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { limit: 100, sort: "expiryDate" };
      if (dueFilter) params.due = dueFilter;
      const res = await api.get("/compliance", { params });
      setItems(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load certificates");
    } finally {
      setLoading(false);
    }
  }, [dueFilter]);

  useEffect(() => { load(); }, [load]);

  const remove = async (c) => {
    if (!confirm(`Delete ${c.certType} certificate?`)) return;
    try {
      await api.delete(`/compliance/${c._id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const FILTERS = [
    { key: "", label: "All" },
    { key: "soon", label: "Due soon" },
    { key: "expired", label: "Expired" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Compliance"
        subtitle="Safety certificates and expiry tracking"
        action={
          <button onClick={() => setModal({})} className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
            <Plus size={18} /> Add Certificate
          </button>
        }
      />

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key || "all"}
            onClick={() => setDueFilter(f.key)}
            className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all ${dueFilter === f.key ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-bold rounded">{error}</div>}

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Property</th>
                <th className="px-5 py-3">Issued</th>
                <th className="px-5 py-3">Expires</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No certificates</td></tr>
              ) : (
                items.map((c) => (
                  <tr key={c._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-bold text-[#0F253B]">{c.certType}</td>
                    <td className="px-5 py-3 text-gray-500">{c.propertyId?.name || "—"}</td>
                    <td className="px-5 py-3 text-gray-500">{c.issueDate ? new Date(c.issueDate).toLocaleDateString() : "—"}</td>
                    <td className="px-5 py-3 text-gray-500">{c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : "—"}</td>
                    <td className="px-5 py-3"><Badge tone={STATUS_TONE[c.status] || "gray"}>{c.status}</Badge></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setModal(c)} className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg"><Pencil size={16} /></button>
                        <button onClick={() => remove(c)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
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
        <CertModal
          initial={modal._id ? modal : null}
          properties={properties}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
