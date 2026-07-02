"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, MapPin, UserRound, Plus, Pencil, Trash2, BedDouble, PoundSterling, Users, X } from "lucide-react";
import { Badge } from "../../../Shared/ui";
import { properties, RENTAL_TYPES, img, money } from "../../_data/dummy";

const typeTone = (v) => RENTAL_TYPES.find((t) => t.v === v)?.tone || "orange";

const ROOM_TONE = { occupied: "orange", vacant: "green", maintenance: "amber" };
const ROOM_TYPES = ["single", "double", "ensuite", "house"];
const ROOM_STATUS = ["vacant", "occupied", "maintenance"];

/* Separate modal for a single room — each room carries its own price. */
function RoomModal({ initial, onClose, onSave }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    number: initial?.number || "",
    type: initial?.type || "single",
    rent: initial?.rent ?? "",
    status: initial?.status || "vacant",
    tenant: initial?.tenant || "",
  });
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (!form.number.trim()) { setError("Room number/name is required"); return; }
    onSave({
      id: initial?.id || `r${Date.now()}`,
      number: form.number.trim(),
      type: form.type,
      rent: Number(form.rent) || 0,
      status: form.status,
      tenant: form.status === "occupied" ? (form.tenant || "Tenant") : null,
      image: initial?.image || img(`room-${Math.floor(Math.random() * 1) + Date.now() % 90}`, 600, 400),
    });
  };

  const field = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium";
  const labelCls = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">{isEdit ? "Edit Room" : "Add Room"}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>
        {error && <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Room Number / Name</label><input className={field} value={form.number} onChange={set("number")} placeholder="Room 4" required /></div>
            <div><label className={labelCls}>Type</label>
              <select className={field} value={form.type} onChange={set("type")}>
                {ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Monthly Rent (£)</label><input type="number" step="0.01" min="0" className={field} value={form.rent} onChange={set("rent")} placeholder="650" /></div>
            <div><label className={labelCls}>Status</label>
              <select className={field} value={form.status} onChange={set("status")}>
                {ROOM_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {form.status === "occupied" && (
            <div><label className={labelCls}>Tenant</label><input className={field} value={form.tenant} onChange={set("tenant")} placeholder="Tenant name" /></div>
          )}
          <button type="submit" className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98]">{isEdit ? "Save Room" : "Add Room"}</button>
        </form>
      </div>
    </div>
  );
}

export default function AdminPropertyDetail() {
  const { id } = useParams();
  const property = properties.find((p) => p.id === id);
  const [rooms, setRooms] = useState(property ? property.rooms : []);
  const [modal, setModal] = useState(null); // null | {} (add) | room (edit)

  if (!property) {
    return (
      <div className="space-y-4">
        <Link href="/admin/properties" className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-[#0F253B]"><ArrowLeft size={16} /> Back</Link>
        <p className="text-gray-400">Property not found.</p>
      </div>
    );
  }

  const income = rooms.filter((r) => r.status === "occupied").reduce((s, r) => s + r.rent, 0);
  const occupied = rooms.filter((r) => r.status === "occupied").length;

  const saveRoom = (room) => {
    setRooms((prev) => (prev.some((r) => r.id === room.id) ? prev.map((r) => (r.id === room.id ? room : r)) : [...prev, room]));
    setModal(null);
  };
  const removeRoom = (room) => { if (confirm(`Delete ${room.number}?`)) setRooms((prev) => prev.filter((r) => r.id !== room.id)); };

  return (
    <div className="space-y-5">
      <Link href="/admin/properties" className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-[#0F253B]">
        <ArrowLeft size={16} /> Back to properties
      </Link>

      {/* Cover */}
      <div className="relative rounded-3xl overflow-hidden h-56 bg-gradient-to-br from-[#0F253B] to-[#1c3e5e]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={property.image} alt={property.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Badge tone={typeTone(property.type)}>{property.type}</Badge>
            <Badge tone="green">{property.status}</Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{property.name}</h1>
          <p className="text-white/80 text-sm flex items-center gap-1.5 mt-1"><MapPin size={14} />{property.addressLine1}, {property.city}, {property.postcode}</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: BedDouble, label: "Rooms", value: `${occupied}/${rooms.length}` },
          { icon: PoundSterling, label: "Monthly income", value: money(income) },
          { icon: UserRound, label: "Owner", value: property.owner, small: true },
          { icon: Users, label: "Rent range", value: rooms.length ? `${money(Math.min(...rooms.map((r) => r.rent)))}–${money(Math.max(...rooms.map((r) => r.rent)))}` : "—", small: true },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#F47C3C] flex items-center justify-center shrink-0"><s.icon size={18} /></div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{s.label}</p>
              <p className={`font-bold text-[#0F253B] truncate ${s.small ? "text-sm" : "text-lg"}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Rooms */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#0F253B]">Rooms <span className="text-gray-300 font-medium">({rooms.length})</span></h2>
        <button onClick={() => setModal({})} className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
          <Plus size={18} /> Add Room
        </button>
      </div>

      {rooms.length === 0 ? (
        <div className="text-center py-16 text-gray-400 font-medium border-2 border-dashed border-gray-100 rounded-2xl">No rooms yet — add your first room.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((r) => (
            <div key={r.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden group">
              <div className="relative h-36 bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.image} alt={r.number} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                <div className="absolute top-2 right-2"><Badge tone={ROOM_TONE[r.status] || "gray"}>{r.status}</Badge></div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-[#0F253B]">{r.number}</p>
                  <span className="text-xs font-medium text-gray-400 capitalize">{r.type}</span>
                </div>
                <p className="text-lg font-bold text-[#0F253B] mt-1">{r.rent ? money(r.rent) : "—"}<span className="text-xs font-medium text-gray-400">/mo</span></p>
                <p className="text-xs text-gray-400 font-medium mt-1 flex items-center gap-1"><UserRound size={12} />{r.tenant || "Vacant"}</p>
                <div className="mt-3 flex justify-end gap-1">
                  <button onClick={() => setModal(r)} className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg"><Pencil size={15} /></button>
                  <button onClick={() => removeRoom(r)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <RoomModal initial={modal.id ? modal : null} onClose={() => setModal(null)} onSave={saveRoom} />
      )}
    </div>
  );
}
