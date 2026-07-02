"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Search, Mail } from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import { team as seedTeam } from "../_data/dummy";

const ROLE_TONE = { admin: "orange", manager: "navy", agent: "blue", finance: "green", tenant: "gray" };
function initials(name) { return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase(); }

export default function AdminTeam() {
  const [q, setQ] = useState("");
  const list = seedTeam.filter((u) => u.name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Team"
        subtitle="Manage user accounts and roles"
        action={
          <button className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
            <Plus size={18} /> Add Member
          </button>
        }
      />

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search team…" className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map((u) => (
          <div key={u.id} className="bg-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#0F253B] text-white flex items-center justify-center font-bold">{initials(u.name)}</div>
                <div>
                  <p className="font-bold text-[#0F253B]">{u.name}</p>
                  <Badge tone={ROLE_TONE[u.role] || "gray"}>{u.role}</Badge>
                </div>
              </div>
              <Badge tone={u.status === "active" ? "green" : "amber"}>{u.status}</Badge>
            </div>
            <p className="text-xs text-gray-400 font-medium mt-4 flex items-center gap-1.5"><Mail size={12} />{u.email}</p>
            <div className="flex justify-end gap-1 mt-3 pt-3 border-t border-gray-50">
              <button className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg"><Pencil size={15} /></button>
              <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
