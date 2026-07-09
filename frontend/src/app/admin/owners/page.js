"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, X, Pencil, Trash2, FileText, Paperclip, Loader2 } from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import { OWNER_STATUS, money } from "../_data/dummy";
import api from "@/app/api/api";

const PAYOUT_TONE = { paid: "green", due: "amber", pending: "blue" };
const statusMeta = (v) => OWNER_STATUS.find((s) => s.v === v) || { label: v, tone: "gray" };
function initials(name) { return (name || "?").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase(); }

function OwnerModal({ initial, propertyOptions, onClose, onSave }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    name: initial?.name || "",
    type: initial?.company ? "company" : "individual",
    status: initial?.status || "lead",
    email: initial?.email || "",
    phone: initial?.phone || "",
    account: initial?.bank?.account || "",
    maintenance: initial?.maintenance ?? "",
    properties: initial?.properties || [],
    notes: initial?.notes || "",
    files: initial?.files || [],
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const toggleProperty = (name) =>
    setForm((f) => ({ ...f, properties: f.properties.includes(name) ? f.properties.filter((p) => p !== name) : [...f.properties, name] }));

  const addFiles = (e) => {
    const names = Array.from(e.target.files || []).map((f) => f.name);
    if (names.length) setForm((f) => ({ ...f, files: [...f.files, ...names] }));
  };
  const removeFile = (n) => setForm((f) => ({ ...f, files: f.files.filter((x) => x !== n) }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Owner name is required"); return; }
    setSaving(true);
    setError("");
    try {
      await onSave({
        name: form.name,
        company: form.type === "company",
        status: form.status,
        email: form.email,
        phone: form.phone,
        maintenance: Number(form.maintenance) || 0,
        properties: form.properties,
        bank: { account: form.account ? (form.account.startsWith("****") ? form.account : `****${form.account.slice(-4)}`) : "" },
        notes: form.notes,
        files: form.files,
      });
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save owner");
    } finally {
      setSaving(false);
    }
  };

  const field = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium";
  const labelCls = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">{isEdit ? "Edit Owner" : "Add Property Owner"}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelCls}>Owner Name</label>
            <input className={field} value={form.name} onChange={set("name")} placeholder="e.g. J. Whitfield or Acme Holdings" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Type</label>
              <select className={field} value={form.type} onChange={set("type")}>
                <option value="individual">Individual</option>
                <option value="company">Company</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={field} value={form.status} onChange={set("status")}>
                {OWNER_STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Email</label><input type="email" className={field} value={form.email} onChange={set("email")} /></div>
            <div><label className={labelCls}>Phone</label><input className={field} value={form.phone} onChange={set("phone")} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Maintenance (£)</label><input type="number" step="0.01" min="0" className={field} value={form.maintenance} onChange={set("maintenance")} placeholder="300" /></div>
            <div><label className={labelCls}>Account No.</label><input className={field} value={form.account} onChange={set("account")} placeholder="12348842" /></div>
          </div>

          <div>
            <label className={labelCls}>Properties</label>
            {propertyOptions.length === 0 ? (
              <p className="text-[11px] text-gray-400 font-medium">No properties yet — add properties first to link them.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {propertyOptions.map((p) => {
                  const on = form.properties.includes(p.name);
                  return (
                    <button key={p._id || p.name} type="button" onClick={() => toggleProperty(p.name)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${on ? "bg-[#F47C3C] text-white border-[#F47C3C]" : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100"}`}>
                      {p.name}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-gray-400 font-medium mt-1.5">{form.properties.length} propert{form.properties.length === 1 ? "y" : "ies"} selected</p>
          </div>

          {/* Files */}
          <div>
            <label className={labelCls}>Files</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.files.map((f) => (
                <span key={f} className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 bg-gray-100 rounded-full pl-2.5 pr-1.5 py-1">
                  <FileText size={12} />{f}
                  <button type="button" onClick={() => removeFile(f)} className="text-gray-400 hover:text-red-500"><X size={12} /></button>
                </span>
              ))}
              {form.files.length === 0 && <span className="text-xs text-gray-300 font-medium">No files attached</span>}
            </div>
            <label className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-500 cursor-pointer hover:bg-gray-100">
              <Paperclip size={14} /> Add files
              <input type="file" multiple className="hidden" onChange={addFiles} />
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea rows={3} className={field} value={form.notes} onChange={set("notes")} placeholder="Internal notes about this owner…" />
          </div>

          <button type="submit" disabled={saving} className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 size={18} className="animate-spin" />}
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Owner"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminOwners() {
  const [owners, setOwners] = useState([]);
  const [propertyOptions, setPropertyOptions] = useState([]);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null); // null | {} (create) | owner (edit)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOwners = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/owners");
      setOwners(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load owners");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProperties = useCallback(async () => {
    try {
      const res = await api.get("/properties", { params: { limit: 100 } });
      setPropertyOptions(res.data?.data || []);
    } catch {
      /* property picker is optional context; ignore */
    }
  }, []);

  useEffect(() => { fetchOwners(); fetchProperties(); }, [fetchOwners, fetchProperties]);

  // Create or update, then refresh. Throws on failure so the modal shows it.
  const save = async (payload) => {
    if (modal && modal._id) {
      await api.put(`/owners/${modal._id}`, payload);
    } else {
      await api.post("/owners", payload);
    }
    await fetchOwners();
    setModal(null);
  };

  const remove = async (o) => {
    if (!confirm(`Delete owner "${o.name}"?`)) return;
    try {
      await api.delete(`/owners/${o._id}`);
      await fetchOwners();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const list = owners.filter((o) => o.name?.toLowerCase().includes(q.toLowerCase()) || (o.email || "").toLowerCase().includes(q.toLowerCase()));
  const totalIncome = owners.reduce((s, o) => s + (o.monthlyIncome || 0), 0);
  const totalProperties = owners.reduce((s, o) => s + (o.properties?.length || 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Property Owners"
        subtitle="Landlords, portfolios and payouts"
        action={
          <button onClick={() => setModal({})} className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
            <Plus size={18} /> Add Owner
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Owners", value: owners.length },
          { label: "Properties managed", value: totalProperties },
          { label: "Monthly rent roll", value: money(totalIncome) },
          { label: "Live", value: owners.filter((o) => o.status === "live").length },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-2xl font-bold text-[#0F253B]">{s.value}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search owners…" className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]" />
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <p className="font-bold">Error loading owners</p>
          <p className="text-sm">{error}</p>
          <button onClick={fetchOwners} className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm font-bold">Retry</button>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-center">Properties</th>
                <th className="px-5 py-3">Property Names</th>
                <th className="px-5 py-3 text-right">Monthly Income</th>
                <th className="px-5 py-3">Payout</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin inline text-[#F47C3C]" /></td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">No owners found</td></tr>
              ) : (
                list.map((o) => {
                  const sm = statusMeta(o.status);
                  const propNames = o.properties || [];
                  return (
                    <tr key={o._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#0F253B] text-white flex items-center justify-center text-xs font-bold shrink-0">{initials(o.name)}</div>
                          <div className="min-w-0">
                            <p className="font-bold text-[#0F253B] truncate">{o.name}</p>
                            <p className="text-[11px] text-gray-400">{o.company ? "Company" : "Individual"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3"><Badge tone={sm.tone}>{sm.label}</Badge></td>
                      <td className="px-5 py-3 text-center">
                        <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full bg-orange-50 text-[#F47C3C] font-bold">{propNames.length}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {propNames.length ? propNames.map((p) => (
                            <span key={p} className="text-[11px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">{p}</span>
                          )) : <span className="text-xs text-gray-300">—</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-[#0F253B]">{money(o.monthlyIncome || 0)}</td>
                      <td className="px-5 py-3"><Badge tone={PAYOUT_TONE[o.payoutStatus] || "gray"}>{o.payoutStatus}</Badge></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setModal(o)} className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg"><Pencil size={16} /></button>
                          <button onClick={() => remove(o)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal !== null && (
        <OwnerModal
          initial={modal._id ? modal : null}
          propertyOptions={propertyOptions}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}
