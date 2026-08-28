"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import api from "../api/api";

export const LEAD_STAGES = ["new", "qualified", "viewing", "converted", "lost"];

const SOURCES = ["Rightmove", "Zoopla", "SpareRoom", "OpenRent", "Website", "Referral"];

// propertyId / roomId come back populated ({ _id, name }) on a saved lead but
// go out as plain ids, so the form always works with the id.
const idOf = (v) => (v && typeof v === "object" ? v._id : v) || "";

const roomLabel = (room) => {
  if (!room) return "";
  return room.roomName || room.title || room.name || "Unnamed Room";
};

/**
 * Create OR edit a lead.
 *
 * `lead` null  -> POST /leads
 * `lead` given -> PUT /leads/:id
 *
 * Used by every staff board (admin, manager, agent, finance) so the two flows
 * cannot drift apart.
 */
export default function LeadFormModal({ lead, properties = [], onClose, onSaved }) {
  const isEdit = Boolean(lead?._id);

  const [form, setForm] = useState({
    name: lead?.name || "",
    email: lead?.email || "",
    phone: lead?.phone || "",
    source: lead?.source || "Website",
    propertyId: idOf(lead?.propertyId),
    roomId: idOf(lead?.roomId),
    interestedIn: lead?.interestedIn || "",
    budget: lead?.budget ? String(lead.budget) : "",
    status: lead?.status || "new",
    assignedTo: lead?.assignedTo || "",
    notes: lead?.notes || "",
    lostReason: lead?.lostReason || "",
  });

  const [rooms, setRooms] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Only ever fetches. Clearing the previously picked room belongs to the
  // property <select> below, not here — on an edit this effect's first run must
  // keep the room the lead already has.
  useEffect(() => {
    if (!form.propertyId) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await api.get(`/rooms/property/${form.propertyId}`);
        if (!cancelled) setRooms(res.data.data || []);
      } catch {
        if (!cancelled) setRooms([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [form.propertyId]);

  const handleChange = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  // Changing property invalidates both the room list and the chosen room.
  const handlePropertyChange = (e) => {
    const propertyId = e.target.value;
    setRooms([]);
    setForm((prev) => ({ ...prev, propertyId, roomId: "" }));
  };

  const submit = async (e) => {
    e.preventDefault();

    // The backend rejects "lost" without a reason on both create and update,
    // so catch it here rather than round-tripping for the error.
    if (form.status === "lost" && !form.lostReason.trim()) {
      setError("A reason is required when marking a lead as lost.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        source: form.source,
        propertyId: form.propertyId || undefined,
        roomId: form.roomId || undefined,
        interestedIn: form.interestedIn || undefined,
        budget: Number(form.budget) || 0,
        status: form.status,
        assignedTo: form.assignedTo || undefined,
        notes: form.notes || undefined,
        lostReason: form.status === "lost" ? form.lostReason.trim() : "",
      };

      const res = isEdit
        ? await api.put(`/leads/${lead._id}`, payload)
        : await api.post("/leads", payload);

      onSaved(res.data.data, isEdit);
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message || `Failed to ${isEdit ? "update" : "create"} lead`
      );
    } finally {
      setSaving(false);
    }
  };

  const field =
    "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium";
  const labelCls =
    "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">
            {isEdit ? "Edit Lead" : "New Lead"}
          </h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelCls}>Name *</label>
            <input
              className={field}
              value={form.name}
              onChange={handleChange("name")}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Email</label>
              <input className={field} value={form.email} onChange={handleChange("email")} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input className={field} value={form.phone} onChange={handleChange("phone")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Source</label>
              <select className={field} value={form.source} onChange={handleChange("source")}>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Budget (£)</label>
              <input
                className={field}
                type="number"
                value={form.budget}
                onChange={handleChange("budget")}
                placeholder="650"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Property</label>
              <select
                className={field}
                value={form.propertyId}
                onChange={handlePropertyChange}
              >
                <option value="">— Any Property —</option>
                {properties.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Room</label>
              <select
                className={field}
                value={form.roomId}
                onChange={handleChange("roomId")}
                disabled={!form.propertyId}
              >
                <option value="">— Any Room —</option>
                {rooms.map((r) => (
                  <option key={r._id} value={r._id}>
                    {roomLabel(r)}
                    {r.monthlyRent ? ` • £${r.monthlyRent}` : ""}
                  </option>
                ))}
                {rooms.length === 0 && form.propertyId && (
                  <option disabled>No rooms found</option>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Assigned To</label>
              <input
                className={field}
                value={form.assignedTo}
                onChange={handleChange("assignedTo")}
                placeholder="e.g. Ella Moore"
              />
            </div>
            <div>
              <label className={labelCls}>Stage</label>
              <select className={field} value={form.status} onChange={handleChange("status")}>
                {LEAD_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {form.status === "lost" && (
            <div>
              <label className={labelCls}>Reason lost *</label>
              <textarea
                className={`${field} min-h-[76px] resize-y`}
                value={form.lostReason}
                onChange={handleChange("lostReason")}
                placeholder="Why did this lead not convert?"
              />
            </div>
          )}

          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              className={`${field} min-h-[76px] resize-y`}
              value={form.notes}
              onChange={handleChange("notes")}
              placeholder="Anything worth remembering about this enquiry"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {saving ? (isEdit ? "Saving..." : "Adding...") : isEdit ? "Save Changes" : "Add Lead"}
          </button>
        </form>
      </div>
    </div>
  );
}
