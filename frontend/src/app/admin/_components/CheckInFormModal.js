"use client";

// The check-in form — creating or editing one tenant moving in.
//
// Lifted out of its own page so every screen that shows these records can edit
// the record itself rather than a copy of it: the client database and the
// deposit register both open this form, and there is one place to change the
// fields.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import api from "../../api/api";
import {
  dateInput,
  GENDERS,
  BANKS,
} from "../../utils/registers";

const FIELD =
  "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";
const CONTROL =
  "px-3.5 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]";

const emptyForm = {
  propertyId: "",
  roomId: "",
  property: "",
  room: "",
  tenant: "",
  email: "",
  phone: "",
  gender: "",
  nationality: "",
  roomType: "",
  rent: "",
  deposit: "",
  paymentDueDay: "",
  bank: "",
  agent: "",
  roomRentedDate: "",
  checkInDate: "",
  contractStart: "",
  contractEnd: "",
  notes: "",
};

export default function CheckInFormModal({ initial, properties, onClose, onSave }) {
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
      roomRentedDate: dateInput(initial.roomRentedDate),
      checkInDate: dateInput(initial.checkInDate),
      contractStart: dateInput(initial.contractStart),
      contractEnd: dateInput(initial.contractEnd),
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
    let active = true;
    if (!form.propertyId) {
      setRooms([]);
      return;
    }
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
    if (!form.tenant.trim()) return setError("A tenant name is required.");
    if (!form.checkInDate) return setError("A check-in date is required.");

    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save the check-in.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold text-[#0F253B]">{isEdit ? "Check-in" : "New Check-in"}</h3>
            <p className="text-xs text-gray-400 font-medium">A tenant moving into a room</p>
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
              <select className={FIELD} value={form.roomId} onChange={pickRoom} disabled={!form.propertyId}>
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
              <input className={FIELD} value={form.roomType} onChange={set("roomType")} placeholder="Double Room" />
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
              <input type="number" min="0" step="1" className={FIELD} value={form.rent} onChange={set("rent")} />
            </div>
            <div>
              <label className={LABEL}>Deposit £</label>
              <input type="number" min="0" step="1" className={FIELD} value={form.deposit} onChange={set("deposit")} />
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
              <input className={FIELD} list="register-banks" value={form.bank} onChange={set("bank")} />
              <datalist id="register-banks">
                {BANKS.map((b) => <option key={b} value={b} />)}
              </datalist>
            </div>
            <div>
              <label className={LABEL}>Agent</label>
              <input className={FIELD} value={form.agent} onChange={set("agent")} />
            </div>
          </div>

          {/* When */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Room rented date</label>
              <input type="date" className={FIELD} value={form.roomRentedDate} onChange={set("roomRentedDate")} />
            </div>
            <div>
              <label className={LABEL}>Check-in date *</label>
              <input type="date" className={FIELD} value={form.checkInDate} onChange={set("checkInDate")} required />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Contract start</label>
              <input type="date" className={FIELD} value={form.contractStart} onChange={set("contractStart")} />
            </div>
            <div>
              <label className={LABEL}>Contract end</label>
              <input type="date" className={FIELD} value={form.contractEnd} onChange={set("contractEnd")} />
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
              {saving ? "Saving…" : isEdit ? "Save changes" : "Record check-in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
