"use client";

import { useState } from "react";
import { Plus, Search, X, Pencil, Trash2, FileText, Paperclip } from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import { owners as seedOwners, properties as allProperties, OWNER_STATUS, money } from "../_data/dummy";

const PAYOUT_TONE = { paid: "green", due: "amber", pending: "blue" };
const statusMeta = (v) => OWNER_STATUS.find((s) => s.v === v) || { label: v, tone: "gray" };
function initials(name) { return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase(); }

function OwnerModal({ initial, onClose, onSave }) {
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
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const toggleProperty = (name) =>
    setForm((f) => ({ ...f, properties: f.properties.includes(name) ? f.properties.filter((p) => p !== name) : [...f.properties, name] }));

  const addFiles = (e) => {
    const names = Array.from(e.target.files || []).map((f) => f.name);
    if (names.length) setForm((f) => ({ ...f, files: [...f.files, ...names] }));
  };
  const removeFile = (n) => setForm((f) => ({ ...f, files: f.files.filter((x) => x !== n) }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Owner name is required"); return; }
    onSave({
      id: initial?.id || `ow${Date.now()}`,
      name: form.name,
      company: form.type === "company",
      status: form.status,
      email: form.email,
      phone: form.phone,
      avatarSeed: form.name,
      properties: form.properties,
      propertyCount: form.properties.length,
      maintenance: Number(form.maintenance) || 0,
      monthlyIncome: initial?.monthlyIncome ?? 0,
      bank: { account: form.account ? (form.account.startsWith("****") ? form.account : `****${form.account.slice(-4)}`) : "—" },
      payoutStatus: initial?.payoutStatus || "pending",
      notes: form.notes,
      files: form.files,
    });
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
            <div className="flex flex-wrap gap-2">
              {allProperties.map((p) => {
                const on = form.properties.includes(p.name);
                return (
                  <button key={p.id} type="button" onClick={() => toggleProperty(p.name)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${on ? "bg-[#F47C3C] text-white border-[#F47C3C]" : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100"}`}>
                    {p.name}
                  </button>
                );
              })}
            </div>
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

          <button type="submit" className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98]">
            {isEdit ? "Save Changes" : "Create Owner"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminOwners() {
  const [owners, setOwners] = useState(seedOwners);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null); // null | {} (create) | owner (edit)

  const list = owners.filter((o) => o.name.toLowerCase().includes(q.toLowerCase()) || (o.email || "").toLowerCase().includes(q.toLowerCase()));
  const totalIncome = owners.reduce((s, o) => s + o.monthlyIncome, 0);

  // Mutate the shared `owners` store (not just local state) so newly added
  // owners appear in other screens too (e.g. the Add Property owner dropdown).
  const save = (owner) => {
    const idx = seedOwners.findIndex((o) => o.id === owner.id);
    if (idx >= 0) seedOwners[idx] = owner;
    else seedOwners.unshift(owner);
    setOwners([...seedOwners]);
    setModal(null);
  };
  const remove = (o) => {
    if (!confirm(`Delete owner "${o.name}"?`)) return;
    const idx = seedOwners.findIndex((x) => x.id === o.id);
    if (idx >= 0) seedOwners.splice(idx, 1);
    setOwners([...seedOwners]);
  };

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
          { label: "Properties managed", value: owners.reduce((s, o) => s + o.propertyCount, 0) },
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
              {list.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400">No owners found</td></tr>
              ) : (
                list.map((o) => {
                  const sm = statusMeta(o.status);
                  return (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/50">
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
                        <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full bg-orange-50 text-[#F47C3C] font-bold">{o.propertyCount}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {o.properties.length ? o.properties.map((p) => (
                            <span key={p} className="text-[11px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">{p}</span>
                          )) : <span className="text-xs text-gray-300">—</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-[#0F253B]">{money(o.monthlyIncome)}</td>
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
        <OwnerModal initial={modal.id ? modal : null} onClose={() => setModal(null)} onSave={save} />
      )}
    </div>
  );
}
