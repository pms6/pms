"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { tenants } from "../_data/dummy";

const FIELD = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

/**
 * Assign a tenant from the central registry, or add a new one.
 * Controlled by `value` (tenant name) + `onChange(name)`.
 * New tenants are pushed into the shared `tenants` store so they're reusable.
 */
export default function TenantSelect({ value, onChange, label = "Tenant" }) {
  const [list, setList] = useState(tenants);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const addNew = () => {
    const name = draft.trim();
    if (!name) return;
    if (!tenants.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      tenants.unshift({ id: `t${Date.now()}`, name, email: "", phone: "", status: "Assigned" });
    }
    setList([...tenants]);
    onChange(name);
    setDraft("");
    setAdding(false);
  };

  return (
    <div>
      <label className={LABEL}>{label}</label>
      {adding ? (
        <div className="flex gap-2">
          <input autoFocus className={FIELD} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="New tenant name" />
          <button type="button" onClick={addNew} className="px-3 rounded-xl bg-[#0F253B] text-white text-sm font-bold shrink-0">Add</button>
          <button type="button" onClick={() => { setAdding(false); setDraft(""); }} className="px-2 text-gray-400 hover:text-gray-600 shrink-0"><X size={18} /></button>
        </div>
      ) : (
        <div className="flex gap-2">
          <select className={FIELD} value={value || ""} onChange={(e) => onChange(e.target.value)}>
            <option value="">Select tenant…</option>
            {list.map((t) => (
              <option key={t.id} value={t.name}>{t.name}{t.status !== "Assigned" ? ` (${t.status})` : ""}</option>
            ))}
            {value && !list.some((t) => t.name === value) && <option value={value}>{value}</option>}
          </select>
          <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 px-3 rounded-xl bg-gray-50 border border-gray-100 text-[#F47C3C] text-xs font-bold shrink-0 hover:bg-gray-100">
            <Plus size={14} /> New
          </button>
        </div>
      )}
    </div>
  );
}
