"use client";

// The check-out form — a move-out and how the deposit was settled.
//
// Lifted out of its own page so every screen that shows these records can edit
// the record itself rather than a copy of it: the client database and the
// deposit register both open this form, and there is one place to change the
// fields.

import { useState } from "react";
import { X } from "lucide-react";
import {
  dateInput,
  DEPOSIT_STATUSES,
  DEPOSIT_STATUS_LABEL,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_LABEL,
  INSPECTION_STATUSES,
  INSPECTION_LABEL,
  CHECKLIST,
} from "../../utils/registers";

const FIELD =
  "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";
const CONTROL =
  "px-3.5 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]";

const emptyForm = {
  checkInId: "",
  propertyId: "",
  property: "",
  room: "",
  tenant: "",
  contractStatus: "COMPLETED",
  contractNote: "",
  rentDueDay: "",
  noticeDate: "",
  movedOutDate: "",
  actualMovedOutDate: "",
  rent: "",
  advanceLicenceFee: "",
  depositStatus: "PENDING",
  depositReturned: "",
  depositDeducted: "",
  depositNote: "",
  keysLocation: "",
  pictures: "",
  videos: "",
  fridgeCleaning: "",
  bedsheets: "",
  cupboardClean: "",
  roomClean: "",
  inspection: "PENDING",
  notes: "",
};

/** Tri-state Yes / No / not-yet control for one checklist row. */
function YesNo({ label, value, onChange }) {
  const options = [
    { v: "YES", text: "Yes" },
    { v: "NO", text: "No" },
    { v: "", text: "—" },
  ];
  return (
    <div className="flex items-center justify-between gap-2 bg-gray-50 rounded-xl px-3 py-2">
      <span className="text-sm font-medium text-[#0F253B]">{label}</span>
      <div className="flex gap-1">
        {options.map((o) => (
          <button
            key={o.text}
            type="button"
            onClick={() => onChange(o.v)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
              value === o.v
                ? "bg-[#0F253B] text-white border-[#0F253B]"
                : "bg-white text-gray-400 border-gray-100 hover:bg-gray-100"
            }`}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The occupant fields a check-in supplies to a check-out. Shared by the picker
 * and by the initial state, so a preselected check-in prefills exactly the same
 * way as one chosen from the dropdown.
 */
const fromCheckIn = (ci, existing = {}) => ({
  checkInId: String(ci._id),
  propertyId: ci.propertyId || "",
  property: ci.property || "",
  room: ci.room || "",
  tenant: ci.tenant || "",
  rent: ci.rent ?? "",
  advanceLicenceFee: ci.deposit ?? "",
  rentDueDay: ci.paymentDueDay ?? "",
  movedOutDate: existing.movedOutDate || dateInput(ci.contractEnd),
});

export default function CheckOutFormModal({
  initial,
  properties,
  openCheckIns = [],
  onClose,
  onSave,
}) {
  const isEdit = Boolean(initial?._id);

  const [form, setForm] = useState(() => {
    if (!initial?._id) {
      // A new check-out can arrive with a check-in already chosen — the deposit
      // register's "Settle deposit" does exactly that. Prefill from it, or the
      // form would open blank and its own required-field check would block a
      // save the server would have accepted.
      const preset = initial?.checkInId
        ? openCheckIns.find((c) => String(c._id) === String(initial.checkInId))
        : null;
      return preset
        ? { ...emptyForm, ...fromCheckIn(preset) }
        : { ...emptyForm, checkInId: initial?.checkInId || "" };
    }
    return {
      ...emptyForm,
      ...initial,
      checkInId: initial.checkInId || "",
      propertyId: initial.propertyId || "",
      rent: initial.rent ?? "",
      advanceLicenceFee: initial.advanceLicenceFee ?? "",
      depositReturned: initial.depositReturned ?? "",
      depositDeducted: initial.depositDeducted ?? "",
      rentDueDay: initial.rentDueDay ?? "",
      noticeDate: dateInput(initial.noticeDate),
      movedOutDate: dateInput(initial.movedOutDate),
      actualMovedOutDate: dateInput(initial.actualMovedOutDate),
    };
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setValue = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  // Picking the occupant fills the whole top half of the form from their
  // check-in — property, room, rent and the deposit that was taken.
  const pickOccupant = (e) => {
    const id = e.target.value;
    const ci = openCheckIns.find((c) => c._id === id);
    if (!ci) {
      setForm((f) => ({ ...f, checkInId: "" }));
      return;
    }
    setForm((f) => ({ ...f, ...fromCheckIn(ci, f) }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.property.trim()) return setError("A property is required.");
    if (!form.tenant.trim()) return setError("A tenant name is required.");

    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save the check-out.");
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
            <h3 className="text-xl font-bold text-[#0F253B]">{isEdit ? "Check-out" : "New Check-out"}</h3>
            <p className="text-xs text-gray-400 font-medium">A tenant moving out, and how their deposit was settled</p>
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
          {!isEdit && (
            <div>
              <label className={LABEL}>Check out a current occupant</label>
              <select className={FIELD} value={form.checkInId} onChange={pickOccupant}>
                <option value="">Not linked — type the details below</option>
                {openCheckIns.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.tenant} — {c.property}{c.room ? ` · ${c.room}` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-gray-400 font-medium">
                Linking closes their check-in and pairs the deposit on the register.
              </p>
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Property record</label>
              <select className={FIELD} value={form.propertyId} onChange={set("propertyId")}>
                <option value="">Not linked</option>
                {properties.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Property name *</label>
              <input className={FIELD} value={form.property} onChange={set("property")} required />
            </div>
            <div>
              <label className={LABEL}>Room</label>
              <input className={FIELD} value={form.room} onChange={set("room")} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Tenant name *</label>
              <input className={FIELD} value={form.tenant} onChange={set("tenant")} required />
            </div>
            <div>
              <label className={LABEL}>Rent due day</label>
              <input type="number" min="1" max="31" className={FIELD} value={form.rentDueDay} onChange={set("rentDueDay")} placeholder="1–31" />
            </div>
          </div>

          {/* Contract */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Contract</label>
              <select className={FIELD} value={form.contractStatus} onChange={set("contractStatus")}>
                {CONTRACT_STATUSES.map((s) => (
                  <option key={s} value={s}>{CONTRACT_STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Contract note</label>
              <input className={FIELD} value={form.contractNote} onChange={set("contractNote")} placeholder="23 Sep 2025 to 22 Sep 2026 break" />
            </div>
          </div>

          {/* Dates */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Notice date</label>
              <input type="date" className={FIELD} value={form.noticeDate} onChange={set("noticeDate")} />
            </div>
            <div>
              <label className={LABEL}>Moved out date</label>
              <input type="date" className={FIELD} value={form.movedOutDate} onChange={set("movedOutDate")} />
            </div>
            <div>
              <label className={LABEL}>Actual moved out date</label>
              <input type="date" className={FIELD} value={form.actualMovedOutDate} onChange={set("actualMovedOutDate")} />
            </div>
          </div>

          {/* Money */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Rent £</label>
              <input type="number" min="0" step="1" className={FIELD} value={form.rent} onChange={set("rent")} />
            </div>
            <div>
              <label className={LABEL}>Advance licence fee £</label>
              <input type="number" min="0" step="1" className={FIELD} value={form.advanceLicenceFee} onChange={set("advanceLicenceFee")} />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Deposit status</label>
              <select className={FIELD} value={form.depositStatus} onChange={set("depositStatus")}>
                {DEPOSIT_STATUSES.map((s) => (
                  <option key={s} value={s}>{DEPOSIT_STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Returned £</label>
              <input type="number" min="0" step="1" className={FIELD} value={form.depositReturned} onChange={set("depositReturned")} />
            </div>
            <div>
              <label className={LABEL}>Deducted £</label>
              <input type="number" min="0" step="1" className={FIELD} value={form.depositDeducted} onChange={set("depositDeducted")} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Deposit note</label>
            <input className={FIELD} value={form.depositNote} onChange={set("depositNote")} placeholder="118 deducted — rubbish left by the bins" />
          </div>

          {/* Move-out checklist */}
          <div>
            <label className={LABEL}>Move-out checklist</label>
            <div className="grid sm:grid-cols-2 gap-2">
              {CHECKLIST.map((c) => (
                <YesNo key={c.key} label={c.label} value={form[c.key]} onChange={setValue(c.key)} />
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Keys location</label>
              <input className={FIELD} value={form.keysLocation} onChange={set("keysLocation")} placeholder="Keysafe" />
            </div>
            <div>
              <label className={LABEL}>Inspection</label>
              <select className={FIELD} value={form.inspection} onChange={set("inspection")}>
                {INSPECTION_STATUSES.map((s) => (
                  <option key={s} value={s}>{INSPECTION_LABEL[s]}</option>
                ))}
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
              {saving ? "Saving…" : isEdit ? "Save changes" : "Record check-out"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
