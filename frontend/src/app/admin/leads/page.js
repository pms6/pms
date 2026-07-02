"use client";

import { useState } from "react";
import { Plus, X, Mail, Phone, PoundSterling } from "lucide-react";
import { PageHeader } from "../../Shared/ui";
import { leads as seedLeads, LEAD_STAGES, properties } from "../_data/dummy";

const COLUMNS = [
  { key: "new", label: "New", tone: "bg-blue-500" },
  { key: "qualified", label: "Qualified", tone: "bg-emerald-500" },
  { key: "viewing", label: "Viewing", tone: "bg-[#F47C3C]" },
  { key: "converted", label: "Converted", tone: "bg-[#0F253B]" },
  { key: "lost", label: "Lost", tone: "bg-gray-400" },
];

function initials(name) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function LeadModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", source: "Rightmove", interestedIn: "", budget: "", status: "new" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const field = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium";
  const labelCls = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">New Lead</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onCreate({ ...form, id: `l${Date.now()}`, budget: Number(form.budget) || 0, assignedTo: "Ella Moore", createdAt: "today" }); }} className="space-y-4">
          <div><label className={labelCls}>Name</label><input className={field} value={form.name} onChange={set("name")} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Email</label><input className={field} value={form.email} onChange={set("email")} /></div>
            <div><label className={labelCls}>Phone</label><input className={field} value={form.phone} onChange={set("phone")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Source</label>
              <select className={field} value={form.source} onChange={set("source")}>
                {["Rightmove", "Zoopla", "SpareRoom", "OpenRent", "Website", "Referral"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Budget (£)</label><input className={field} value={form.budget} onChange={set("budget")} placeholder="650" /></div>
          </div>
          <div><label className={labelCls}>Interested in</label>
            <select className={field} value={form.interestedIn} onChange={set("interestedIn")}>
              <option value="">— Any —</option>
              {properties.map((p) => <option key={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Stage</label>
            <select className={field} value={form.status} onChange={set("status")}>
              {LEAD_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button type="submit" className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98]">Add Lead</button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLeads() {
  const [leads, setLeads] = useState(seedLeads);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leads"
        subtitle="Your enquiry pipeline"
        action={
          <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
            <Plus size={18} /> New Lead
          </button>
        }
      />

      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const cards = leads.filter((l) => l.status === col.key);
          return (
            <div key={col.key} className="w-72 shrink-0">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.tone}`} />
                  <span className="text-sm font-bold text-[#0F253B]">{col.label}</span>
                </div>
                <span className="text-xs font-bold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{cards.length}</span>
              </div>
              <div className="space-y-3">
                {cards.map((l) => (
                  <div key={l.id} className="bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#0F253B] text-white flex items-center justify-center text-xs font-bold shrink-0">{initials(l.name)}</div>
                      <div className="min-w-0">
                        <p className="font-bold text-[#0F253B] text-sm truncate">{l.name}</p>
                        <p className="text-[11px] text-gray-400 font-medium">{l.source}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 font-medium mt-3 truncate">{l.interestedIn || "Any property"}</p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400 font-medium">
                      {l.budget > 0 && <span className="flex items-center gap-1"><PoundSterling size={11} />{l.budget}/mo</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50 text-gray-300">
                      {l.email && <Mail size={14} className="hover:text-[#F47C3C] cursor-pointer" />}
                      {l.phone && <Phone size={14} className="hover:text-[#F47C3C] cursor-pointer" />}
                      <span className="ml-auto text-[10px] font-bold text-gray-400">{l.assignedTo}</span>
                    </div>
                  </div>
                ))}
                {cards.length === 0 && <div className="text-center text-xs text-gray-300 font-medium py-6 border-2 border-dashed border-gray-100 rounded-2xl">Empty</div>}
              </div>
            </div>
          );
        })}
      </div>

      {open && <LeadModal onClose={() => setOpen(false)} onCreate={(lead) => { setLeads([lead, ...leads]); setOpen(false); }} />}
    </div>
  );
}
