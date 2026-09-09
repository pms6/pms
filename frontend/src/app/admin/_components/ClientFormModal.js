"use client";

// The client database form — adding or editing one client by hand.
//
// Deliberately NOT CheckInFormModal. The client database is its own register
// now: a client typed here never becomes a check-in, and a check-in never
// appears here. Sharing one form would put the two back together, because the
// form is what decides which record a screen writes to.
//
// The difference in the fields is the point of the split: this form has no
// room rented date and no check-in date. The contract's start and end are the
// only dates this register keeps — the other two are managed on the check-in.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import api from "../../api/api";
import { dateInput, GENDERS, BANKS } from "../../utils/registers";
import { guardModalClose } from "@/app/Shared/modalGuard";

const FIELD =
  "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

const emptyForm = {
  propertyId: "",
  roomId: "",
  property: "",
  room: "",
  roomType: "",
  tenant: "",
  email: "",
  phone: "",
  gender: "",
  nationality: "",
  rent: "",
  deposit: "",
  paymentDueDay: "",
  bank: "",
  agent: "",
  contractStart: "",
  contractEnd: "",
  status: "ACTIVE",
  notes: "",
};

export default function ClientFormModal({ initial, properties, onClose, onSave }) {
  const isEdit = Boolean(initial?._id);

  const [form, setForm] = useState(() => {
    if (!initial?._id) return emptyForm;
    return {
      ...emptyForm,
      ...initial,
      propertyId: initial.propertyId || "",
      roomId: initial.roomId || "",
      rent: initial.rent ?? "",
      deposit: initial.deposit ?? "",
      paymentDueDay: initial.paymentDueDay ?? "",
      contractStart: dateInput(initial.contractStart),
      contractEnd: dateInput(initial.contractEnd),
      status: initial.status || "ACTIVE",
    };
  });

  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Rooms follow the chosen property. A row typed off the spreadsheet may name
  // a property that has no Room records at all, which is why the room is a
  // free-text field beside the picker rather than only a picker.
  useEffect(() => {
    if (!form.propertyId) return;
    let active = true;
    (async () => {
      try {
        const res = await api.get(`/rooms/property/${form.propertyId}`);
        if (active) setRooms(res.data.data || []);
      } catch {
        if (active) setRooms([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [form.propertyId]);

  const pickProperty = (e) => {
    const id = e.target.value;
    const property = properties.find((p) => p._id === id);
    setForm((f) => ({
      ...f,
      propertyId: id,
      // Clear the room: it belonged to the property being replaced.
      roomId: "",
      room: "",
      property: property ? property.name : f.property,
    }));
    // And clear the list it was picked from, so the dropdown cannot offer a
    // room belonging to the property that was just replaced.
    if (!id) setRooms([]);
  };

  const pickRoom = (e) => {
    const id = e.target.value;
    const room = rooms.find((r) => r._id === id);
    setForm((f) => ({
      ...f,
      roomId: id,
      room: room ? room.roomName || room.title || "" : "",
      // Prefill the money from the room's own figures, but only where the
      // operator has not already typed something.
      rent: f.rent === "" && room?.monthlyRent ? room.monthlyRent : f.rent,
      deposit: f.deposit === "" && room?.securityDeposit ? room.securityDeposit : f.deposit,
      roomType: f.roomType || room?.roomType || "",
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.property.trim()) return setError("A property is required.");
    if (!form.tenant.trim()) return setError("A client name is required.");

    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save the client.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={guardModalClose(onClose)}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold text-[#0F253B]">
              {isEdit ? "Client" : "New Client"}
            </h3>
            <p className="text-xs text-gray-400 font-medium">
              A record in the client database — separate from the check-in register
            </p>
          </div>
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
          {/* Where */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Property record</label>
              <select className={FIELD} value={form.propertyId} onChange={pickProperty}>
                <option value="">Not linked</option>
                {properties.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Property name *</label>
              <input className={FIELD} value={form.property} onChange={set("property")} required />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Room record</label>
              <select
                className={FIELD}
                value={form.roomId}
                onChange={pickRoom}
                disabled={!form.propertyId}
              >
                <option value="">Not linked</option>
                {rooms.map((r) => (
                  <option key={r._id} value={r._id}>{r.roomName || r.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Room</label>
              <input className={FIELD} value={form.room} onChange={set("room")} placeholder="Room A1" />
            </div>
            <div>
              <label className={LABEL}>Room type</label>
              <input
                className={FIELD}
                value={form.roomType}
                onChange={set("roomType")}
                placeholder="Double Room"
              />
            </div>
          </div>

          {/* Who */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Client name *</label>
              <input className={FIELD} value={form.tenant} onChange={set("tenant")} required />
            </div>
            <div>
              <label className={LABEL}>Contact number</label>
              <input className={FIELD} value={form.phone} onChange={set("phone")} />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Email</label>
              <input type="email" className={FIELD} value={form.email} onChange={set("email")} />
            </div>
            <div>
              <label className={LABEL}>Gender</label>
              <select className={FIELD} value={form.gender} onChange={set("gender")}>
                {GENDERS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Nationality</label>
              <input className={FIELD} value={form.nationality} onChange={set("nationality")} />
            </div>
          </div>

          {/* Money */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Rent £</label>
              <input
                type="number"
                min="0"
                step="1"
                className={FIELD}
                value={form.rent}
                onChange={set("rent")}
              />
            </div>
            <div>
              <label className={LABEL}>Deposit £</label>
              <input
                type="number"
                min="0"
                step="1"
                className={FIELD}
                value={form.deposit}
                onChange={set("deposit")}
              />
            </div>
            <div>
              <label className={LABEL}>Rent due day</label>
              <input
                type="number"
                min="1"
                max="31"
                className={FIELD}
                value={form.paymentDueDay}
                onChange={set("paymentDueDay")}
                placeholder="1–31"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Bank rent is paid to</label>
              <input
                className={FIELD}
                list="client-banks"
                value={form.bank}
                onChange={set("bank")}
              />
              <datalist id="client-banks">
                {BANKS.map((b) => <option key={b} value={b} />)}
              </datalist>
            </div>
            <div>
              <label className={LABEL}>Agent</label>
              <input className={FIELD} value={form.agent} onChange={set("agent")} />
            </div>
          </div>

          {/* Period of contract — the only dates this register keeps. The room
              rented and check-in dates live on the check-in record. */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Contract start</label>
              <input
                type="date"
                className={FIELD}
                value={form.contractStart}
                onChange={set("contractStart")}
              />
            </div>
            <div>
              <label className={LABEL}>Contract end</label>
              <input
                type="date"
                className={FIELD}
                value={form.contractEnd}
                onChange={set("contractEnd")}
              />
            </div>
            <div>
              <label className={LABEL}>Status</label>
              <select className={FIELD} value={form.status} onChange={set("status")}>
                <option value="ACTIVE">Current client</option>
                <option value="PAST">Past client</option>
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL}>Notes</label>
            <textarea rows={2} className={FIELD} value={form.notes} onChange={set("notes")} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white border border-gray-100 hover:bg-gray-50 text-[#0F253B] font-bold text-sm rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
