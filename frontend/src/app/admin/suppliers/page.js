"use client";

import { useState } from "react";
import { Plus, Upload, Download, Search, X, Star, Eye, Pencil, Archive, FileText, Paperclip, Check } from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import { suppliers as seed, SPECIALISMS, SUPPLIER_PERMISSIONS } from "../_data/dummy";

const FIELD = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

function SupplierModal({ initial, onClose, onSave }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    company: initial?.company || "",
    contactForename: initial?.contactForename || "",
    contactSurname: initial?.contactSurname || "",
    email: initial?.email || "",
    phone: initial?.phone || "",
    preferred: initial?.preferred || false,
    notes: initial?.notes || "",
    documents: initial?.documents || [],
    specialisms: initial?.specialisms || [],
    tags: (initial?.tags || []).join(", "),
    permissions: { ...{ "Quote Submission": false, "Invoice Submission": false, "Date Proposal": false, "Job Completion": false }, ...(initial?.permissions || {}) },
  });
  const [error, setError] = useState("");
  const [newSpec, setNewSpec] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const toggleSpec = (s) => setForm((f) => ({ ...f, specialisms: f.specialisms.includes(s) ? f.specialisms.filter((x) => x !== s) : [...f.specialisms, s] }));
  const addSpec = () => { const s = newSpec.trim(); if (s && !form.specialisms.includes(s)) setForm((f) => ({ ...f, specialisms: [...f.specialisms, s] })); setNewSpec(""); };
  const togglePerm = (p) => setForm((f) => ({ ...f, permissions: { ...f.permissions, [p]: !f.permissions[p] } }));
  const addDocs = (e) => { const names = Array.from(e.target.files || []).map((x) => x.name); if (names.length) setForm((f) => ({ ...f, documents: [...f.documents, ...names] })); };
  const removeDoc = (n) => setForm((f) => ({ ...f, documents: f.documents.filter((x) => x !== n) }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.company.trim()) { setError("Company name is required"); return; }
    onSave({
      id: initial?.id || `sp${Date.now()}`,
      company: form.company, contactForename: form.contactForename, contactSurname: form.contactSurname,
      email: form.email, phone: form.phone, preferred: form.preferred, notes: form.notes,
      documents: form.documents, specialisms: form.specialisms,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      permissions: form.permissions,
      unpaidInvoices: initial?.unpaidInvoices || 0, archived: initial?.archived || false,
    });
  };

  const allSpecs = [...new Set([...SPECIALISMS, ...form.specialisms])];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">{isEdit ? "Supplier" : "New Supplier"}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>
        {error && <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div><label className={LABEL}>Company Name</label><input className={FIELD} value={form.company} onChange={set("company")} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Contact Forename</label><input className={FIELD} value={form.contactForename} onChange={set("contactForename")} /></div>
            <div><label className={LABEL}>Contact Surname</label><input className={FIELD} value={form.contactSurname} onChange={set("contactSurname")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Email Address</label><input type="email" className={FIELD} value={form.email} onChange={set("email")} /></div>
            <div><label className={LABEL}>Contact Number</label><input className={FIELD} value={form.phone} onChange={set("phone")} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-[#0F253B]">
            <input type="checkbox" checked={form.preferred} onChange={(e) => setForm({ ...form, preferred: e.target.checked })} className="w-4 h-4 accent-[#F47C3C]" />
            Mark as Preferred Supplier
          </label>
          <div><label className={LABEL}>Notes</label><textarea rows={2} className={FIELD} value={form.notes} onChange={set("notes")} placeholder="Internal notes about this supplier…" /></div>

          {/* Private Documents */}
          <div>
            <label className={LABEL}>Private Documents</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.documents.map((d) => (
                <span key={d} className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 bg-gray-100 rounded-full pl-2.5 pr-1.5 py-1"><FileText size={12} />{d}<button type="button" onClick={() => removeDoc(d)} className="text-gray-400 hover:text-red-500"><X size={12} /></button></span>
              ))}
              {form.documents.length === 0 && <span className="text-xs text-gray-300 font-medium">Insurance, licences, contracts…</span>}
            </div>
            <label className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-500 cursor-pointer hover:bg-gray-100"><Paperclip size={14} /> Add documents<input type="file" multiple className="hidden" onChange={addDocs} /></label>
          </div>

          {/* Permissions */}
          <div>
            <label className={LABEL}>Permissions — steps this supplier may skip</label>
            <div className="grid grid-cols-2 gap-2">
              {SUPPLIER_PERMISSIONS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm font-medium text-[#0F253B] bg-gray-50 rounded-xl px-3 py-2 cursor-pointer">
                  <input type="checkbox" checked={form.permissions[p]} onChange={() => togglePerm(p)} className="w-4 h-4 accent-[#F47C3C]" />{p}
                </label>
              ))}
            </div>
          </div>

          {/* Specialisms */}
          <div>
            <label className={LABEL}>Specialisms</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {allSpecs.map((s) => {
                const on = form.specialisms.includes(s);
                return <button key={s} type="button" onClick={() => toggleSpec(s)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${on ? "bg-[#F47C3C] text-white border-[#F47C3C]" : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100"}`}>{s}</button>;
              })}
            </div>
            <div className="flex gap-2">
              <input className={FIELD} value={newSpec} onChange={(e) => setNewSpec(e.target.value)} placeholder="Create new specialism" />
              <button type="button" onClick={addSpec} className="px-3 rounded-xl bg-[#0F253B] text-white text-sm font-bold shrink-0">Add</button>
            </div>
          </div>

          <div><label className={LABEL}>Tags (comma separated)</label><input className={FIELD} value={form.tags} onChange={set("tags")} placeholder="Vetted, Gas Safe" /></div>

          <button type="submit" className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98]">{isEdit ? "Save Supplier" : "Create Supplier"}</button>
        </form>
      </div>
    </div>
  );
}

export default function AdminSuppliers() {
  const [list, setList] = useState(seed);
  const [q, setQ] = useState("");
  const [specF, setSpecF] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [modal, setModal] = useState(null);

  const rows = list.filter((s) => {
    const t = q.toLowerCase();
    return (
      (showArchived ? s.archived : !s.archived) &&
      (!specF || s.specialisms.includes(specF)) &&
      (!unpaidOnly || s.unpaidInvoices > 0) &&
      (!t || s.company.toLowerCase().includes(t) || `${s.contactForename} ${s.contactSurname}`.toLowerCase().includes(t) || s.email.toLowerCase().includes(t))
    );
  });

  const save = (sup) => {
    setList((prev) => (prev.some((s) => s.id === sup.id) ? prev.map((s) => (s.id === sup.id ? sup : s)) : [sup, ...prev]));
    setModal(null);
  };
  const archive = (s) => { if (confirm(`${s.archived ? "Restore" : "Archive"} ${s.company}?`)) setList((prev) => prev.map((x) => (x.id === s.id ? { ...x, archived: !x.archived } : x))); };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Suppliers"
        subtitle="Contractors, service providers & maintenance suppliers"
        action={
          <div className="flex flex-wrap gap-2">
            <button onClick={() => alert("Import Suppliers (demo)")} className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-100 hover:bg-gray-50 text-[#0F253B] font-bold text-sm rounded-xl"><Upload size={16} /> Import</button>
            <button onClick={() => alert("Supplier list — CSV export (demo)")} className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-gray-100 hover:bg-gray-50 text-[#0F253B] font-bold text-sm rounded-xl"><Download size={16} /> Export</button>
            <button onClick={() => setModal({})} className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"><Plus size={18} /> Add Supplier</button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company, contact or email…" className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]" />
        </div>
        <select value={specF} onChange={(e) => setSpecF(e.target.value)} className="px-3.5 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]">
          <option value="">All specialisms</option>
          {SPECIALISMS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => setUnpaidOnly((v) => !v)} className={`px-3.5 py-2.5 text-sm font-bold rounded-xl border transition-all ${unpaidOnly ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"}`}>Unpaid Invoices</button>
        <button onClick={() => setShowArchived((v) => !v)} className={`px-3.5 py-2.5 text-sm font-bold rounded-xl border transition-all ${showArchived ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"}`}>Archived</button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3">Company</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Specialisms</th>
                <th className="px-5 py-3">Tags</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No suppliers match these filters</td></tr>
              ) : (
                rows.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <p className="font-bold text-[#0F253B] flex items-center gap-1.5">{s.company}{s.preferred && <Star size={13} className="text-[#F47C3C] fill-[#F47C3C]" />}</p>
                      <p className="text-[11px] text-gray-400">{s.email}{s.unpaidInvoices > 0 && <span className="ml-2 text-red-600 font-bold">{s.unpaidInvoices} unpaid</span>}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{`${s.contactForename} ${s.contactSurname}`.trim() || "—"}</td>
                    <td className="px-5 py-3 text-gray-500">{s.phone}</td>
                    <td className="px-5 py-3"><div className="flex flex-wrap gap-1">{s.specialisms.map((sp) => <span key={sp} className="text-[10px] font-bold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{sp}</span>)}</div></td>
                    <td className="px-5 py-3"><div className="flex flex-wrap gap-1">{s.tags.length ? s.tags.map((t) => <span key={t} className="text-[10px] font-bold text-blue-600 bg-blue-50 rounded-full px-2 py-0.5">{t}</span>) : <span className="text-gray-300">—</span>}</div></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setModal(s)} className="p-2 text-gray-400 hover:text-[#0F253B] hover:bg-gray-100 rounded-lg" title="View"><Eye size={16} /></button>
                        <button onClick={() => setModal(s)} className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg" title="Edit"><Pencil size={16} /></button>
                        <button onClick={() => archive(s)} className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title={s.archived ? "Restore" : "Archive"}><Archive size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal !== null && <SupplierModal initial={modal.id ? modal : null} onClose={() => setModal(null)} onSave={save} />}
    </div>
  );
}
