"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus, Pencil, Trash2, X, ArrowLeft, MapPin, UserRound } from "lucide-react";
import api from "../api/api";

const ROOM_TYPES = ["single", "double", "ensuite"];
const ROOM_STATUS = ["vacant", "occupied", "maint"];
const ROOM_STATUS_BADGE = {
  vacant: "bg-emerald-100 text-emerald-700",
  occupied: "bg-[#F47C3C] text-white",
  maint: "bg-amber-100 text-amber-700",
};

function RoomModal({ propertyId, initial, onClose, onSaved }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    roomNumber: initial?.roomNumber || "",
    roomType: initial?.roomType || "single",
    capacity: initial?.capacity ?? 1,
    rentAmount: initial?.rentAmount ?? "",
    status: initial?.status || "vacant",
    availableFrom: initial?.availableFrom ? initial.availableFrom.slice(0, 10) : "",
    amenities: (initial?.amenities || []).join(", "),
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        roomNumber: form.roomNumber,
        roomType: form.roomType,
        capacity: Number(form.capacity),
        status: form.status,
      };
      if (form.rentAmount !== "") body.rentAmount = String(form.rentAmount);
      if (form.availableFrom) body.availableFrom = form.availableFrom;
      body.amenities = form.amenities.split(",").map((s) => s.trim()).filter(Boolean);

      if (isEdit) {
        await api.patch(`/properties/${propertyId}/rooms/${initial._id}`, body);
      } else {
        await api.post(`/properties/${propertyId}/rooms`, body);
      }
      onSaved();
    } catch (err) {
      const d = err.response?.data;
      setError(d?.details?.[0]?.message || d?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const field =
    "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium";
  const labelCls = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">{isEdit ? "Edit Room" : "Add Room"}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Room Number</label>
              <input className={field} value={form.roomNumber} onChange={set("roomNumber")} required />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select className={field} value={form.roomType} onChange={set("roomType")}>
                {ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Capacity</label>
              <input type="number" min={1} className={field} value={form.capacity} onChange={set("capacity")} />
            </div>
            <div>
              <label className={labelCls}>Rent (£)</label>
              <input className={field} value={form.rentAmount} onChange={set("rentAmount")} placeholder="650.00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Status</label>
              <select className={field} value={form.status} onChange={set("status")}>
                {ROOM_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Available From</label>
              <input type="date" className={field} value={form.availableFrom} onChange={set("availableFrom")} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Amenities (comma separated)</label>
            <input className={field} value={form.amenities} onChange={set("amenities")} placeholder="Wifi, Desk, Wardrobe" />
          </div>

          <button type="submit" disabled={saving} className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center">
            {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : isEdit ? "Save Changes" : "Create Room"}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Reusable property detail + rooms surface.
 * @param {string} basePath - route prefix for the back link (e.g. "/admin/properties").
 */
export default function PropertyRoomsManager({ basePath }) {
  const { id } = useParams();
  const [property, setProperty] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pRes, rRes] = await Promise.all([
        api.get(`/properties/${id}`),
        api.get(`/properties/${id}/rooms`, { params: { limit: 100, sort: "roomNumber" } }),
      ]);
      setProperty(pRes.data.data);
      setRooms(rRes.data.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load property");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const remove = async (room) => {
    if (!confirm(`Delete room ${room.roomNumber}?`)) return;
    try {
      await api.delete(`/properties/${id}/rooms/${room._id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-32"><div className="w-8 h-8 border-2 border-[#F47C3C]/30 border-t-[#F47C3C] rounded-full animate-spin" /></div>;
  }
  if (error) {
    return <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-bold rounded">{error}</div>;
  }

  return (
    <div className="space-y-5">
      <Link href={basePath} className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-[#0F253B]">
        <ArrowLeft size={16} /> Back to properties
      </Link>

      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#0F253B]">{property.name}</h1>
            <div className="mt-2 space-y-1 text-sm text-gray-500 font-medium">
              <p className="flex items-center gap-1.5"><MapPin size={14} className="text-gray-300" />{[property.addressLine1, property.city, property.postcode].filter(Boolean).join(", ") || "No address"}</p>
              <p className="flex items-center gap-1.5"><UserRound size={14} className="text-gray-300" />Owner: {property.ownerId?.name || "—"}</p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold capitalize bg-gray-100 text-gray-600">{property.totalRooms || rooms.length} rooms</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[#0F253B]">Rooms</h2>
        <button onClick={() => setModal({})} className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
          <Plus size={18} /> Add Room
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3">Room</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Capacity</th>
                <th className="px-5 py-3">Rent</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No rooms yet</td></tr>
              ) : (
                rooms.map((r) => (
                  <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-bold text-[#0F253B]">{r.roomNumber}</td>
                    <td className="px-5 py-3 text-gray-500 capitalize">{r.roomType || "—"}</td>
                    <td className="px-5 py-3 text-gray-500">{r.capacity ?? "—"}</td>
                    <td className="px-5 py-3 text-gray-500">{r.rentAmount ? `£${r.rentAmount}` : "—"}</td>
                    <td className="px-5 py-3"><span className={`px-2.5 py-1 rounded-full text-[11px] font-bold capitalize ${ROOM_STATUS_BADGE[r.status] || "bg-gray-100"}`}>{r.status}</span></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setModal(r)} className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg"><Pencil size={16} /></button>
                        <button onClick={() => remove(r)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal !== null && (
        <RoomModal
          propertyId={id}
          initial={modal._id ? modal : null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
