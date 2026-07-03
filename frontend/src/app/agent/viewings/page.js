"use client";

import { useState } from "react";
import { Plus, X, Clock, MapPin, User } from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import { viewings as seedViewings, leads, properties } from "../_data/dummy";

const STATUS_TONE = { scheduled: "orange", done: "green", cancelled: "gray" };

function prettyDay(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
}

function ViewingModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ date: "2026-07-02", time: "10:00", lead: "", property: "", room: "", agent: "Ella Moore", status: "scheduled" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const field = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium";
  const labelCls = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">Schedule Viewing</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onCreate({ ...form, id: `v${Date.now()}` }); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Date</label><input type="date" className={field} value={form.date} onChange={set("date")} required /></div>
            <div><label className={labelCls}>Time</label><input type="time" className={field} value={form.time} onChange={set("time")} required /></div>
          </div>
          <div><label className={labelCls}>Lead</label>
            <select className={field} value={form.lead} onChange={set("lead")} required>
              <option value="">Select lead…</option>
              {leads.map((l) => <option key={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Property</label>
              <select className={field} value={form.property} onChange={set("property")}>
                <option value="">—</option>
                {properties.map((p) => <option key={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Room</label><input className={field} value={form.room} onChange={set("room")} placeholder="Room 2" /></div>
          </div>
          <button type="submit" className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98]">Schedule</button>
        </form>
      </div>
    </div>
  );
}

export default function AdminViewings() {
  const [viewings, setViewings] = useState(seedViewings);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const shown = filter ? viewings.filter((v) => v.status === filter) : viewings;
  const days = [...new Set(shown.map((v) => v.date))].sort();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Viewings"
        subtitle="Scheduled property viewings"
        action={
          <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
            <Plus size={18} /> Schedule
          </button>
        }
      />

      <div className="flex gap-2 flex-wrap">
        {["", "scheduled", "done", "cancelled"].map((s) => (
          <button key={s || "all"} onClick={() => setFilter(s)} className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all capitalize ${filter === s ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {days.map((day) => (
          <div key={day}>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">{prettyDay(day)}</p>
            <div className="space-y-2">
              {shown.filter((v) => v.date === day).sort((a, b) => a.time.localeCompare(b.time)).map((v) => (
                <div key={v.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-all">
                  <div className="flex flex-col items-center justify-center w-16 shrink-0 border-r border-gray-100 pr-4">
                    <Clock size={14} className="text-[#F47C3C]" />
                    <span className="text-sm font-bold text-[#0F253B] mt-1">{v.time}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#0F253B] flex items-center gap-1.5"><User size={14} className="text-gray-300" />{v.lead}</p>
                    <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5 mt-0.5"><MapPin size={12} />{v.property} · {v.room}</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold text-gray-500">{v.agent}</p>
                  </div>
                  <Badge tone={STATUS_TONE[v.status] || "gray"}>{v.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        ))}
        {shown.length === 0 && <p className="text-center text-gray-400 font-medium py-16">No viewings.</p>}
      </div>

      {open && <ViewingModal onClose={() => setOpen(false)} onCreate={(v) => { setViewings([...viewings, v]); setOpen(false); }} />}
    </div>
  );
}
