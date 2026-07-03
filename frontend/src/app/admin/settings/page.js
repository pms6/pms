"use client";

import { useState } from "react";
import { Save, Check } from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import { subscriptionPlans as PLANS } from "../_data/dummy";

export default function AdminSettings() {
  const [form, setForm] = useState({
    name: "Northern Lettings Ltd",
    type: "agency",
    contactEmail: "admin@northernlettings.com",
  });
  const [saved, setSaved] = useState(false);
  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setSaved(false); };
  const field = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium";
  const labelCls = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Account Settings" subtitle="Organisation profile and plan" />

      {/* Plans */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map((p) => (
          <div key={p.name} className={`rounded-2xl p-5 border ${p.current ? "border-[#F47C3C] ring-2 ring-[#F47C3C]/20 bg-white" : "border-gray-100 bg-white"}`}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-[#0F253B]">{p.name}</p>
              {p.current && <Badge tone="orange">Current</Badge>}
            </div>
            <p className="text-2xl font-bold text-[#0F253B] mt-2">{p.price}<span className="text-xs font-medium text-gray-400">/mo</span></p>
            <ul className="mt-3 space-y-1.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs font-medium text-gray-500"><Check size={13} className="text-emerald-500" />{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Account form */}
      <form onSubmit={(e) => { e.preventDefault(); setSaved(true); }} className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5">
        {saved && <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 text-xs font-bold rounded">Account updated (demo)</div>}
        <div><label className={labelCls}>Account Name</label><input className={field} value={form.name} onChange={set("name")} /></div>
        <div><label className={labelCls}>Account Type</label>
          <select className={field} value={form.type} onChange={set("type")}>
            <option value="landlord">Landlord</option>
            <option value="agency">Agency</option>
          </select>
        </div>
        <div><label className={labelCls}>Contact Email</label><input type="email" className={field} value={form.contactEmail} onChange={set("contactEmail")} /></div>
        <button type="submit" className="flex items-center gap-2 px-5 py-3 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
          <Save size={18} /> Save Changes
        </button>
      </form>
    </div>
  );
}
