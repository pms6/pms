"use client";

import { useEffect, useState } from "react";
import { X, Loader2, UserRound } from "lucide-react";
import api from "../../../api/api";

// Helper for ImportExcelModal compatibility
export function toOccupancyPayload(f) {
  return {
    propertyId: f.propertyId,
    roomId: f.roomId,
    tenantId: f.tenantId,
    tenant: f.tenant,
    tenantEmail: f.tenantEmail || undefined,
    rent: f.rent ? Number(f.rent) : 0,
    startDate: f.startDate || null,
    fixedTermEnd: f.fixedTermEnd || null,
    periodicStart: f.periodicStart || null,
    status: f.tenancyStatus || "Fixed Term",
    availability: f.availability || "Occupied",
    onboarded: false,
  };
}

const inputCls = "w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#F47C3C] focus:border-transparent";
const labelCls = "block text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1";

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className={labelCls}>
        {label} {required && <span className="text-[#F47C3C]">*</span>}
      </span>
      {children}
    </label>
  );
}

export default function AddOccupancyModal({ onClose, onCreated }) {
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);

  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [tenantMode, setTenantMode] = useState("new"); // "existing" | "new"
  const [selectedTenantId, setSelectedTenantId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    tenant: "",
    tenantEmail: "",
    rent: "",
    startDate: "",
    fixedTermEnd: "",
    periodicStart: "",
    tenancyStatus: "Fixed Term",
    availability: "Occupied",
    createAccount: true,
  });

  // Load Properties & Tenants
  useEffect(() => {
    const loadData = async () => {
      try {
        const [propRes, tenantRes] = await Promise.all([
          api.get("/properties"),
          api.get("/tenants")
        ]);
        setProperties(propRes.data?.data || []);
        setTenants(tenantRes.data?.data || []);
      } catch (err) {
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Load Rooms when property changes
  useEffect(() => {
    if (!selectedPropertyId) {
      setRooms([]);
      return;
    }
    api.get(`/rooms/property/${selectedPropertyId}`)
      .then(res => setRooms(res.data?.data || []))
      .catch(err => console.error(err));
  }, [selectedPropertyId]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!selectedPropertyId) return setError("Property is required");
    if (!selectedRoomId) return setError("Room is required");

    let tenantName = "";
    let tenantEmail = form.tenantEmail || "";
    let tenantId = null;

    if (tenantMode === "existing") {
      const selectedTenant = tenants.find(t => t._id === selectedTenantId);
      if (!selectedTenant) return setError("Tenant not found");
      tenantName = `${selectedTenant.firstName || ""} ${selectedTenant.lastName || ""}`.trim();
      tenantEmail = selectedTenant.email || tenantEmail;
      tenantId = selectedTenant._id;
    } else {
      tenantName = form.tenant.trim();
      if (!tenantName) return setError("Tenant name is required");
    }

    setSaving(true);

    try {
      const payload = {
        ...toOccupancyPayload({
          propertyId: selectedPropertyId,
          roomId: selectedRoomId,
          tenantId,
          tenant: tenantName,
          tenantEmail,
          rent: form.rent,
          startDate: form.startDate,
          fixedTermEnd: form.fixedTermEnd,
          periodicStart: form.periodicStart,
          tenancyStatus: form.tenancyStatus,
          availability: form.availability,
        }),
        // Emails the tenant: new user → login credentials, existing user → confirmation.
        createAccount: form.createAccount && !!tenantEmail,
      };

      const res = await api.post("/tenancies", payload);

      alert(res.data?.message || "Occupancy assigned successfully!");
      onCreated?.();
      onClose?.();
    } catch (err) {
      console.error(err.response?.data);
      setError(err.response?.data?.message || "Failed to assign occupancy");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 sm:p-6 pb-4 border-b flex justify-between items-start shrink-0">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-[#0F253B]">Assign Occupancy</h3>
            <p className="text-xs text-gray-400">Create new tenancy</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Property & Room */}
          <Field label="Property" required>
            <select 
              className={inputCls} 
              value={selectedPropertyId} 
              onChange={e => setSelectedPropertyId(e.target.value)}
            >
              <option value="">Select Property</option>
              {properties.map(p => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Room / Unit" required>
            <select 
              className={inputCls} 
              value={selectedRoomId} 
              onChange={e => setSelectedRoomId(e.target.value)} 
              disabled={!selectedPropertyId}
            >
              <option value="">Select Room</option>
              {rooms.map(r => (
                <option key={r._id} value={r._id}>
                  {r.roomName || r.title} {r.roomNumber ? `(${r.roomNumber})` : ""}
                </option>
              ))}
            </select>
          </Field>

          {/* Tenant Selection */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold flex items-center gap-2">
                <UserRound size={16} /> Tenant
              </span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                {["new", "existing"].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTenantMode(m)}
                    className={`px-4 py-1 text-sm rounded-md font-medium transition-all ${tenantMode === m ? "bg-white shadow" : ""}`}
                  >
                    {m === "new" ? "New Tenant" : "Existing"}
                  </button>
                ))}
              </div>
            </div>

            {tenantMode === "existing" ? (
              <select 
                className={inputCls} 
                value={selectedTenantId} 
                onChange={e => setSelectedTenantId(e.target.value)}
              >
                <option value="">Select Existing Tenant</option>
                {tenants.map(t => (
                  <option key={t._id} value={t._id}>
                    {t.firstName} {t.lastName}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-4">
                <Field label="Full Name" required>
                  <input 
                    name="tenant" 
                    className={inputCls} 
                    value={form.tenant} 
                    onChange={handleInputChange} 
                    required 
                  />
                </Field>
                <Field label="Email">
                  <input 
                    name="tenantEmail" 
                    type="email" 
                    className={inputCls} 
                    value={form.tenantEmail} 
                    onChange={handleInputChange} 
                  />
                </Field>
              </div>
            )}
          </div>

          {/* Tenancy Details */}
          <div className="pt-4 border-t border-gray-100 space-y-4">
            <Field label="Rent (£)">
              <input 
                name="rent" 
                type="number" 
                className={inputCls} 
                value={form.rent} 
                onChange={handleInputChange} 
                placeholder="0.00" 
              />
            </Field>

            <Field label="Start Date" required>
              <input 
                name="startDate" 
                type="date" 
                className={inputCls} 
                value={form.startDate} 
                onChange={handleInputChange} 
                required 
              />
            </Field>

            <Field label="Status">
              <select 
                name="tenancyStatus" 
                className={inputCls} 
                value={form.tenancyStatus} 
                onChange={handleInputChange}
              >
                <option value="Fixed Term">Fixed Term</option>
                <option value="Becoming Periodic">Becoming Periodic</option>
                <option value="Periodic">Periodic</option>
                <option value="Ending">Ending</option>
              </select>
            </Field>

            {form.tenancyStatus === "Fixed Term" && (
              <Field label="Fixed Term End Date">
                <input 
                  name="fixedTermEnd" 
                  type="date" 
                  className={inputCls} 
                  value={form.fixedTermEnd} 
                  onChange={handleInputChange} 
                />
              </Field>
            )}

            {(form.tenancyStatus === "Periodic" || form.tenancyStatus === "Becoming Periodic") && (
              <Field label="Periodic Start Date">
                <input 
                  name="periodicStart" 
                  type="date" 
                  className={inputCls} 
                  value={form.periodicStart} 
                  onChange={handleInputChange} 
                />
              </Field>
            )}

            <Field label="Availability">
              <input 
                name="availability" 
                className={inputCls} 
                value={form.availability} 
                onChange={handleInputChange} 
                placeholder="Occupied" 
              />
            </Field>

            <label className="flex items-start gap-2.5 cursor-pointer rounded-xl bg-gray-50 p-3">
              <input
                type="checkbox"
                name="createAccount"
                checked={form.createAccount}
                onChange={handleInputChange}
                className="mt-0.5 accent-[#F47C3C]"
              />
              <span className="text-sm">
                <span className="font-medium text-[#0F253B]">Notify tenant by email</span>
                <span className="block text-xs text-gray-400 mt-0.5">
                  New tenants get an account with login credentials; existing tenants get a
                  tenancy confirmation. Requires an email address.
                </span>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-[#F47C3C] text-white font-bold rounded-xl hover:bg-[#e06d30] transition flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : null}
            {saving ? "Assigning..." : "Assign Occupancy"}
          </button>
        </form>
      </div>
    </div>
  );
}