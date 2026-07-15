"use client";

import { useState } from "react";
import { X } from "lucide-react";

function ViewingModal({ onClose, onCreate, leads, properties }) {
  const [form, setForm] = useState({
    date: "2026-07-09",
    time: "10:00",
    leadId: "",
    propertyId: "",
    status: "scheduled"
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const field = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl p-7" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-5">Schedule Viewing</h3>
        <form onSubmit={(e) => { e.preventDefault(); onCreate(form); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input type="date" className={field} value={form.date} onChange={set("date")} required />
            <input type="time" className={field} value={form.time} onChange={set("time")} required />
          </div>
          <select className={field} value={form.leadId} onChange={set("leadId")} required>
            <option value="">Select Lead…</option>
            {leads.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
          </select>
          <select className={field} value={form.propertyId} onChange={set("propertyId")} required>
            <option value="">Select Property…</option>
            {properties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <button type="submit" className="w-full py-3.5 bg-[#F47C3C] text-white font-bold rounded-xl">Schedule</button>
        </form>
      </div>
    </div>
  );
}

export default ViewingModal;