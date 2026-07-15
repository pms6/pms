"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, MapPin, UserRound, Plus, Pencil, Trash2, BedDouble, PoundSterling, Users, X, CalendarClock, Wrench, ClipboardCheck, ShieldCheck, Star, ChevronRight, Loader2, UploadCloud } from "lucide-react";
import { Badge } from "../Shared/ui";
import TenancyPanel from "../admin/_components/TenancyPanel";
import RoomManagementPanel from "../admin/_components/RoomManagementPanel";
import { RENTAL_TYPES, LETTING_STATUS_TONE, viewings, maintenance, inspections, deposits, reviews, money } from "../admin/_data/dummy";
import api from "@/app/api/api";
import uploadToCloudinary from "@/app/utils/uploadToCloudinary";

// API Service for Property Details
const apiService = {
  async getPropertyById(id) {
    try {
      const response = await api.get(`/properties/${id}`);
      return response.data;
    } catch (error) {
      console.error('Get property error:', error);
      throw error.response?.data || error;
    }
  },

  async getRoomsByProperty(propertyId) {
    try {
      const response = await api.get(`/rooms/property/${propertyId}`);
      return response.data;
    } catch (error) {
      console.error('Get rooms error:', error);
      throw error.response?.data || error;
    }
  },

  async createRoom(roomData) {
    try {
      const response = await api.post('/rooms', roomData);
      return response.data;
    } catch (error) {
      console.error('Create room error:', error);
      throw error.response?.data || error;
    }
  },

  async updateRoom(id, roomData) {
    try {
      const response = await api.put(`/rooms/${id}`, roomData);
      return response.data;
    } catch (error) {
      console.error('Update room error:', error);
      throw error.response?.data || error;
    }
  },

  async deleteRoom(id) {
    try {
      const response = await api.delete(`/rooms/${id}`);
      return response.data;
    } catch (error) {
      console.error('Delete room error:', error);
      throw error.response?.data || error;
    }
  },

  async updateRoomStatus(id, status) {
    try {
      const response = await api.patch(`/rooms/${id}/status`, { status });
      return response.data;
    } catch (error) {
      console.error('Update room status error:', error);
      throw error.response?.data || error;
    }
  }
};

// Helper to get display name for rental type
const getRentalTypeDisplay = (type) => {
  const map = {
    "HMO": "HMO",
    "SINGLE_LET": "Single Let",
    "SHORT_TERM": "Short-term Let",
    "BLOCK": "Block"
  };
  return map[type] || type;
};

// Helper to get display name for tenant type
const getTenantTypeDisplay = (type) => {
  const map = {
    "ANY": "Any",
    "PROFESSIONAL": "Professionals",
    "STUDENT": "Students",
    "SOCIAL": "Social"
  };
  return map[type] || type;
};

const typeTone = (v) => {
  const found = RENTAL_TYPES.find((t) => t.v === v);
  return found?.tone || "orange";
};

const FIELD = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

// Room Modal Component (matches backend schema)
function RoomModal({ initial, propertyId, onClose, onSave }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    title: initial?.title || "",
    roomName: initial?.roomName || "",
    roomNumber: initial?.roomNumber || "",
    description: initial?.description || "",
    monthlyRent: initial?.monthlyRent ?? "",
    securityDeposit: initial?.securityDeposit ?? "",
    holdingDeposit: initial?.holdingDeposit ?? "",
    status: initial?.status || "AVAILABLE",
    availableFrom: initial?.availableFrom ? new Date(initial.availableFrom).toISOString().split('T')[0] : "",
    floor: initial?.floor || "",
    furnished: initial?.furnished !== undefined ? initial.furnished : true,
    billsIncluded: initial?.billsIncluded || { gas: false, electricity: false, water: false, internet: false },
    roomType: initial?.roomType || "STANDARD",
    occupancy: initial?.occupancy || "SINGLE",
    notes: initial?.notes || "",
  });
  const [images, setImages] = useState(initial?.images || []);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const set = (k) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [k]: value });
  };

  // Upload selected files to Cloudinary and append them as { url, alt } objects
  // (matching the Room model's images schema).
  const handleImageUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploadingImages(true);
    setError("");
    try {
      const uploaded = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        if (file.size > 10 * 1024 * 1024) {
          setError(`File ${file.name} exceeds 10MB limit`);
          continue;
        }
        const result = await uploadToCloudinary(file);
        uploaded.push({ url: result.url, alt: file.name });
      }
      if (uploaded.length) setImages((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err.message || "Failed to upload images");
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index) => setImages((prev) => prev.filter((_, i) => i !== index));

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleImageUpload(e.dataTransfer.files);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.roomName.trim()) {
      setError("Room name is required");
      return;
    }
    if (!form.monthlyRent || Number(form.monthlyRent) <= 0) {
      setError("Monthly rent is required and must be greater than 0");
      return;
    }

    setLoading(true);
    try {
      const roomData = {
        propertyId,
        title: form.title || form.roomName,
        roomName: form.roomName.trim(),
        roomNumber: form.roomNumber || undefined,
        description: form.description || undefined,
        roomType: form.roomType,
        occupancy: form.occupancy,
        furnished: form.furnished,
        floor: form.floor || undefined,
        monthlyRent: Number(form.monthlyRent),
        securityDeposit: form.securityDeposit ? Number(form.securityDeposit) : undefined,
        holdingDeposit: form.holdingDeposit ? Number(form.holdingDeposit) : undefined,
        billsIncluded: form.billsIncluded,
        status: form.status,
        availableFrom: form.availableFrom || undefined,
        notes: form.notes || undefined,
        images,
      };

      let response;
      if (isEdit && initial._id) {
        response = await apiService.updateRoom(initial._id, roomData);
      } else {
        response = await apiService.createRoom(roomData);
      }

      // Transform response to match frontend room structure
      const savedRoom = {
        id: response.data._id,
        _id: response.data._id,
        name: response.data.roomName,
        title: response.data.title,
        rent: response.data.monthlyRent,
        moneyHeld: response.data.securityDeposit || 0,
        status: response.data.status,
        tenant: response.data.currentTenant?.name || null,
        availableFrom: response.data.availableFrom,
        floor: response.data.floor,
        furnished: response.data.furnished,
        billsIncluded: response.data.billsIncluded,
        notes: response.data.notes,
        image: response.data.images?.[0]?.url || null,
        images: response.data.images || [],
        roomType: response.data.roomType,
        occupancy: response.data.occupancy,
        securityDeposit: response.data.securityDeposit,
        holdingDeposit: response.data.holdingDeposit,
        roomNumber: response.data.roomNumber,
        _apiData: response.data
      };

      onSave(savedRoom);
    } catch (err) {
      setError(err.message || 'Failed to save room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">{isEdit ? "Edit Room" : "Add Room"}</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>
        {error && <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={LABEL}>Room Name *</label>
            <input className={FIELD} value={form.roomName} onChange={set("roomName")} placeholder="Room 1" required />
          </div>
          <div>
            <label className={LABEL}>Room Title (optional)</label>
            <input className={FIELD} value={form.title} onChange={set("title")} placeholder="e.g., Spacious Double Room" />
          </div>
          <div>
            <label className={LABEL}>Room Number (optional)</label>
            <input className={FIELD} value={form.roomNumber} onChange={set("roomNumber")} placeholder="e.g., 101, A1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Monthly Rent (£) *</label>
              <input type="number" min="0" step="0.01" className={FIELD} value={form.monthlyRent} onChange={set("monthlyRent")} placeholder="650" required />
            </div>
            <div>
              <label className={LABEL}>Security Deposit (£)</label>
              <input type="number" min="0" step="0.01" className={FIELD} value={form.securityDeposit} onChange={set("securityDeposit")} placeholder="750" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Room Type</label>
              <select className={FIELD} value={form.roomType} onChange={set("roomType")}>
                <option value="STANDARD">Standard</option>
                <option value="ENSUITE">Ensuite</option>
                <option value="STUDIO">Studio</option>
                <option value="MASTER">Master</option>
                <option value="DOUBLE">Double</option>
                <option value="SINGLE">Single</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Occupancy</label>
              <select className={FIELD} value={form.occupancy} onChange={set("occupancy")}>
                <option value="SINGLE">Single</option>
                <option value="DOUBLE">Double</option>
                <option value="TWIN">Twin</option>
                <option value="FAMILY">Family</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Status</label>
              <select className={FIELD} value={form.status} onChange={set("status")}>
                <option value="AVAILABLE">Available</option>
                <option value="AVAILABLE_SOON">Available Soon</option>
                <option value="RESERVED">Reserved</option>
                <option value="OCCUPIED">Occupied</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Available From</label>
              <input type="date" className={FIELD} value={form.availableFrom} onChange={set("availableFrom")} />
            </div>
          </div>
          <div>
            <label className={LABEL}>Floor</label>
            <input className={FIELD} value={form.floor} onChange={set("floor")} placeholder="e.g., First, 2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Furnished</label>
              <select className={FIELD} value={form.furnished ? "true" : "false"} onChange={(e) => setForm({ ...form, furnished: e.target.value === "true" })}>
                <option value="true">Furnished</option>
                <option value="false">Unfurnished</option>
              </select>
            </div>
          </div>
          <div>
            <label className={LABEL}>Bills Included</label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.billsIncluded.gas} onChange={(e) => setForm({ ...form, billsIncluded: { ...form.billsIncluded, gas: e.target.checked } })} />
                Gas
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.billsIncluded.electricity} onChange={(e) => setForm({ ...form, billsIncluded: { ...form.billsIncluded, electricity: e.target.checked } })} />
                Electricity
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.billsIncluded.water} onChange={(e) => setForm({ ...form, billsIncluded: { ...form.billsIncluded, water: e.target.checked } })} />
                Water
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.billsIncluded.internet} onChange={(e) => setForm({ ...form, billsIncluded: { ...form.billsIncluded, internet: e.target.checked } })} />
                Internet
              </label>
            </div>
          </div>
          <div>
            <label className={LABEL}>Room Notes</label>
            <textarea className={`${FIELD} min-h-24 resize-none`} value={form.notes} onChange={set("notes")} placeholder="Add room features, access notes, or viewing instructions" />
          </div>

          {/* Room Images (Cloudinary upload) */}
          <div>
            <label className={LABEL}>Room Images {uploadingImages && <Loader2 size={14} className="inline animate-spin ml-2" />}</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${dragging ? "border-[#F47C3C] bg-orange-50" : "border-gray-200 hover:border-[#F47C3C] hover:bg-gray-50"}`}
            >
              <div className="w-10 h-10 mx-auto rounded-xl bg-orange-50 text-[#F47C3C] flex items-center justify-center mb-2">
                {uploadingImages ? <Loader2 size={20} className="animate-spin" /> : <UploadCloud size={20} />}
              </div>
              <p className="text-sm font-bold text-[#0F253B]">Drag &amp; drop images</p>
              <p className="text-xs text-gray-400 font-medium">or click to browse (max 10MB each)</p>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleImageUpload(e.target.files)}
                disabled={uploadingImages}
              />
            </div>

            {images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                {images.map((im, i) => (
                  <div key={im.url || i} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-100">
                    <img src={im.url} alt={im.alt || `room-${i}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                    {i === 0 && <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-[#0F253B] text-white px-1.5 py-0.5 rounded">Cover</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="submit" disabled={loading || uploadingImages} className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {(loading || uploadingImages) && <Loader2 size={18} className="animate-spin" />}
            {loading ? 'Saving...' : uploadingImages ? 'Uploading Images...' : isEdit ? 'Save Room' : 'Add Room'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Info Component
function Info({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-sm font-bold text-[#0F253B] mt-0.5">{value || "—"}</p>
    </div>
  );
}

// MiniList Component
function MiniList({ icon: Icon, title, items, empty, render }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#F47C3C] flex items-center justify-center"><Icon size={17} /></div>
        <h3 className="font-bold text-[#0F253B]">{title}</h3>
      </div>
      {items.length ? <div className="space-y-3">{items.map(render)}</div> : <p className="text-sm text-gray-400 font-medium">{empty}</p>}
    </div>
  );
}

// RoomDetail Component
function RoomDetail({ room, property, onEdit, onManage }) {
  // Use dummy data for viewings, maintenance, etc. or fetch from API
  const roomViewings = viewings.filter((v) => v.room === room.name);
  const roomMaintenance = maintenance.filter((m) => m.room === room.name);
  const roomInspections = inspections.filter((i) => i.room === room.name);
  const roomDeposits = deposits.filter((d) => d.room === room.name);
  const roomReviews = reviews.filter((r) => r.room === room.name);

  const statusTone = {
    "AVAILABLE": "green",
    "AVAILABLE_SOON": "blue",
    "RESERVED": "amber",
    "OCCUPIED": "purple",
    "MAINTENANCE": "red"
  };

  return (
    <div className="bg-gray-50 border border-gray-100 rounded-3xl p-4 sm:p-5 space-y-5">
      <div className="flex flex-col lg:flex-row gap-5">
        <div className="lg:w-80 bg-white border border-gray-100 rounded-2xl overflow-hidden shrink-0">
          <div className="relative h-44 bg-gray-100">
            {room.image && <img src={room.image} alt={room.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
            <div className="absolute top-3 right-3">
              <Badge tone={statusTone[room.status] || "gray"}>{room.status}</Badge>
            </div>
          </div>
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Selected Room</p>
                <h2 className="text-xl font-bold text-[#0F253B]">{room.name}</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={onManage} className="px-3 py-1.5 bg-[#0F253B] hover:bg-[#1c3e5e] text-white text-xs font-bold rounded-lg">Manage</button>
                <button onClick={onEdit} className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg" title="Edit room"><Pencil size={17} /></button>
              </div>
            </div>
            <p className="text-2xl font-bold text-[#0F253B] mt-4">{room.rent ? money(room.rent) : "-"}<span className="text-xs font-medium text-gray-400">/mo</span></p>
            {room.tenant && <p className="text-sm text-[#0F253B] font-semibold mt-2 flex items-center gap-1.5"><UserRound size={14} className="text-[#F47C3C]" />{room.tenant}</p>}
            {room.notes && <p className="text-sm text-gray-500 font-medium mt-4 leading-6">{room.notes}</p>}
          </div>
        </div>

        <div className="flex-1 bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-bold text-[#0F253B]">Room Details</h3>
            <Badge tone="gray">{getTenantTypeDisplay(property.tenantType)}</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Info label="Security Deposit" value={room.securityDeposit ? money(room.securityDeposit) : "Not set"} />
            <Info label="Room Type" value={room.roomType || "Standard"} />
            <Info label="Occupancy" value={room.occupancy || "Single"} />
            <Info label="Available From" value={room.availableFrom || "Not set"} />
            <Info label="Floor" value={room.floor || "Not set"} />
            <Info label="Furnished" value={room.furnished ? "Yes" : "No"} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MiniList icon={CalendarClock} title="Viewings" items={roomViewings} empty="No viewings booked for this room." render={(v) => (
          <div key={v.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
            <div><p className="text-sm font-bold text-[#0F253B]">{v.lead}</p><p className="text-xs text-gray-400 font-medium">{v.date} at {v.time} - {v.agent}</p></div>
            <Badge tone={v.status === "scheduled" ? "blue" : v.status === "done" ? "green" : "gray"}>{v.status}</Badge>
          </div>
        )} />
        <MiniList icon={Wrench} title="Maintenance" items={roomMaintenance} empty="No maintenance logged for this room." render={(m) => (
          <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
            <div><p className="text-sm font-bold text-[#0F253B]">{m.title}</p><p className="text-xs text-gray-400 font-medium">{m.ref} - {m.date}</p></div>
            <Badge tone={m.priority === "urgent" ? "red" : m.priority === "high" ? "amber" : "gray"}>{m.status}</Badge>
          </div>
        )} />
        <MiniList icon={ClipboardCheck} title="Inspections" items={roomInspections} empty="No inspections scheduled for this room." render={(i) => (
          <div key={i.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
            <div><p className="text-sm font-bold text-[#0F253B]">{i.type}</p><p className="text-xs text-gray-400 font-medium">{i.date} - {i.inspector}</p></div>
            <Badge tone={i.status === "Completed" ? "green" : i.status === "Overdue" ? "red" : "blue"}>{i.status}</Badge>
          </div>
        )} />
        <MiniList icon={ShieldCheck} title="Deposits" items={roomDeposits} empty="No deposit record linked to this room." render={(d) => (
          <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
            <div><p className="text-sm font-bold text-[#0F253B]">{d.tenant}</p><p className="text-xs text-gray-400 font-medium">{d.scheme} - {money(d.amount)}</p></div>
            <Badge tone={d.status === "Active" ? "green" : d.status === "Pending" ? "amber" : "gray"}>{d.status}</Badge>
          </div>
        )} />
      </div>

      <MiniList icon={Star} title="Reviews" items={roomReviews} empty="No tenant reviews for this room yet." render={(r) => (
        <div key={r.id} className="rounded-xl bg-white border border-gray-100 p-4">
          <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-[#0F253B]">{r.tenant}</p><p className="text-xs font-bold text-[#F47C3C]">{r.rating}/5</p></div>
          <p className="text-xs text-gray-400 font-medium mt-1">{r.date}</p>
          <p className="text-sm text-gray-500 font-medium mt-2 leading-6">{r.text}</p>
        </div>
      )} />
    </div>
  );
}

/**
 * Reusable property-detail surface — the full admin rooms manager.
 * @param {string} basePath - route prefix used for the "Back to properties"
 *                            links (e.g. "/admin/properties" or "/manager/properties").
 */
export default function PropertyDetailBoard({ basePath = "/admin/properties" }) {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [property, setProperty] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [modal, setModal] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [tenancy, setTenancy] = useState(null);
  const [manageRoom, setManageRoom] = useState(null);

  const fetchPropertyData = async () => {
    try {
      setLoading(true);
      setError("");

      // Fetch property details
      const propertyResponse = await apiService.getPropertyById(id);
      const propertyData = propertyResponse.data;

      // Transform property data to match frontend structure
      const transformedProperty = {
        id: propertyData._id,
        _id: propertyData._id,
        name: propertyData.name,
        type: propertyData.rentalType,
        tenantType: propertyData.tenantType || "ANY",
        owner: propertyData.ownerName || "Unassigned",
        addressLine1: propertyData.address?.line1 || propertyData.name,
        area: propertyData.address?.city || "",
        city: propertyData.address?.city || "",
        postcode: propertyData.address?.postcode || "",
        image: propertyData.coverImage || `https://via.placeholder.com/400x300?text=${encodeURIComponent(propertyData.name)}`,
        status: propertyData.status,
        description: propertyData.description,
        letting: propertyData.letting || null,
        block: propertyData.block || null,
        _apiData: propertyData
      };

      setProperty(transformedProperty);

      // Fetch rooms for this property
      try {
        const roomsResponse = await apiService.getRoomsByProperty(id);
        const roomsData = roomsResponse.data || [];

        // Transform rooms to match frontend structure
        const transformedRooms = roomsData.map(room => ({
          id: room._id,
          _id: room._id,
          name: room.roomName,
          title: room.title,
          rent: room.monthlyRent,
          moneyHeld: room.securityDeposit || 0,
          status: room.status,
          tenant: room.currentTenant?.name || null,
          availableFrom: room.availableFrom,
          floor: room.floor,
          furnished: room.furnished,
          billsIncluded: room.billsIncluded,
          notes: room.notes,
          image: room.images?.[0]?.url || null,
          images: room.images || [],
          roomType: room.roomType,
          occupancy: room.occupancy,
          securityDeposit: room.securityDeposit,
          holdingDeposit: room.holdingDeposit,
          roomNumber: room.roomNumber,
          _apiData: room
        }));

        setRooms(transformedRooms);
      } catch (roomErr) {
        console.error('Error fetching rooms:', roomErr);
        // Don't fail completely if rooms fail
      }

    } catch (err) {
      console.error('Error fetching property:', err);
      setError(err.message || 'Failed to load property');
    } finally {
      setLoading(false);
    }
  };

  // Fetch property and rooms on mount
  useEffect(() => {
    if (id) {
      fetchPropertyData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const saveRoom = (room) => {
    setRooms((prev) => {
      const existing = prev.some((r) => r.id === room.id);
      if (existing) {
        return prev.map((r) => (r.id === room.id ? room : r));
      }
      return [...prev, room];
    });
    setSelectedRoomId(room.id);
    setModal(null);
  };

  const removeRoom = async (room) => {
    if (!confirm(`Delete ${room.name}?`)) return;

    try {
      await apiService.deleteRoom(room.id);
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
      if (selectedRoomId === room.id) setSelectedRoomId(null);
    } catch (err) {
      alert(`Failed to delete room: ${err.message}`);
    }
  };

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  if (loading) {
    return (
      <div className="space-y-4">
        <Link href={basePath} className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-[#0F253B]">
          <ArrowLeft size={16} /> Back to properties
        </Link>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#F47C3C] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading property details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="space-y-4">
        <Link href={basePath} className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-[#0F253B]">
          <ArrowLeft size={16} /> Back to properties
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-red-700 font-bold">{error || "Property not found."}</p>
          <button
            onClick={fetchPropertyData}
            className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm font-bold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isHMO = property.type === "HMO";
  const income = rooms.filter((r) => r.status === "OCCUPIED").reduce((s, r) => s + r.rent, 0);
  const occupied = rooms.filter((r) => r.status === "OCCUPIED").length;

  // Active tenancies for this property
  const activeTenancies = isHMO
    ? rooms.filter((r) => r.status === "OCCUPIED" && r.tenant).map((r) => ({ tenant: r.tenant, unit: r.name, rent: r.rent }))
    : property.type === "SINGLE_LET" && property.letting?.status === "OCCUPIED" && property.letting?.tenant
    ? [{ tenant: property.letting.tenant, unit: "Whole property", rent: property.letting.rent }]
    : [];

  const tenantInitials = (n) => n ? n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "?";

  // Status display mapping
  const statusDisplay = {
    "AVAILABLE": "Available",
    "AVAILABLE_SOON": "Available Soon",
    "RESERVED": "Reserved",
    "OCCUPIED": "Occupied",
    "MAINTENANCE": "Maintenance"
  };

  const statusTone = {
    "AVAILABLE": "green",
    "AVAILABLE_SOON": "blue",
    "RESERVED": "amber",
    "OCCUPIED": "purple",
    "MAINTENANCE": "red"
  };

  return (
    <div className="space-y-5">
      <Link href={basePath} className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-[#0F253B]">
        <ArrowLeft size={16} /> Back to properties
      </Link>

      {/* Cover */}
      <div className="relative rounded-3xl overflow-hidden h-56 bg-gradient-to-br from-[#0F253B] to-[#1c3e5e]">
        <img src={property.image} alt={property.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Badge tone={typeTone(property.type)}>{getRentalTypeDisplay(property.type)}</Badge>
            <Badge tone="gray">{getTenantTypeDisplay(property.tenantType)}</Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{property.name}</h1>
          <p className="text-white/80 text-sm flex items-center gap-1.5 mt-1"><MapPin size={14} />{[property.area, property.city].filter(Boolean).join(", ") || "No area"}</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: BedDouble, label: isHMO ? "Rooms" : "Units", value: isHMO ? `${occupied}/${rooms.length}` : "1" },
          { icon: PoundSterling, label: "Monthly income", value: money(isHMO ? income : property.letting?.status === "OCCUPIED" ? property.letting.rent : 0) },
          { icon: UserRound, label: "Owner", value: property.owner, small: true },
          { icon: Users, label: "Tenant type", value: getTenantTypeDisplay(property.tenantType), small: true },
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

      {/* HMO → rooms manager */}
      {isHMO ? (
        <>
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
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedRoomId(r.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedRoomId(r.id); }}
                  className={`bg-white border rounded-2xl overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md ${selectedRoomId === r.id ? "border-[#F47C3C] ring-2 ring-orange-100" : "border-gray-100"}`}
                >
                  <div className="relative h-32 bg-gray-100">
                    {r.image && <img src={r.image} alt={r.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                    <div className="absolute top-2 right-2">
                      <Badge tone={statusTone[r.status] || "gray"}>{statusDisplay[r.status] || r.status}</Badge>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="font-bold text-[#0F253B]">{r.name}</p>
                    <p className="text-lg font-bold text-[#0F253B] mt-1">{r.rent ? money(r.rent) : "—"}<span className="text-xs font-medium text-gray-400">/mo</span></p>
                    <p className="text-xs text-gray-400 font-medium mt-1">Held {money(r.moneyHeld || 0)}</p>
                    {r.tenant && <p className="text-xs text-[#0F253B] font-semibold mt-1 flex items-center gap-1"><UserRound size={12} className="text-[#F47C3C]" />{r.tenant}</p>}
                    <div className="mt-3 flex justify-end gap-1">
                      <button onClick={(e) => { e.stopPropagation(); setModal(r); }} className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg"><Pencil size={15} /></button>
                      <button onClick={(e) => { e.stopPropagation(); removeRoom(r); }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={15} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {selectedRoom && <RoomDetail room={selectedRoom} property={property} onEdit={() => setModal(selectedRoom)} onManage={() => setManageRoom(selectedRoom)} />}
        </>
      ) : (
        /* Non-HMO → letting / settings summary */
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-[#0F253B] mb-4">Letting Details</h2>
          {property.type === "SINGLE_LET" && property.letting && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Info label="Monthly Rent" value={money(property.letting.rent)} />
              <Info label="Tenant Money Held" value={money(property.letting.moneyHeld)} />
              <Info label="Guarantor" value={property.letting.guarantor} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Status</p>
                <div className="mt-1"><Badge tone={LETTING_STATUS_TONE[property.letting.status] || "gray"}>{property.letting.status}</Badge></div>
              </div>
            </div>
          )}
          {property.type === "SHORT_TERM" && (
            <p className="text-sm text-gray-500 font-medium">Short-term let — booked by night/week. Tenant type: <b className="text-[#0F253B]">{getTenantTypeDisplay(property.tenantType)}</b>.</p>
          )}
          {property.type === "BLOCK" && property.block && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Info label="Payment Term" value={`${property.block.paymentTermDays} days`} />
              <Info label="Hide Tenant Rent" value={property.block.hideTenantRent} />
              <Info label="Tenant Type" value={getTenantTypeDisplay(property.tenantType)} />
            </div>
          )}
        </div>
      )}

      {/* Active Tenancies */}
      {activeTenancies.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-[#0F253B] mb-3">Active Tenancies <span className="text-gray-300 font-medium">({activeTenancies.length})</span></h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTenancies.map((t, i) => (
              <button
                key={i}
                onClick={() => setTenancy({ ...t, property: property.name })}
                className="text-left bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="w-11 h-11 rounded-full bg-[#0F253B] text-white flex items-center justify-center text-sm font-bold shrink-0">{tenantInitials(t.tenant)}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[#0F253B] truncate">{t.tenant}</p>
                  <p className="text-xs text-gray-400 font-medium truncate">{t.unit} · {money(t.rent)}/mo</p>
                </div>
                <span className="flex items-center gap-0.5 text-xs font-bold text-[#F47C3C] shrink-0">View <ChevronRight size={14} /></span>
              </button>
            ))}
          </div>
        </div>
      )}

      {modal !== null && (
        <RoomModal
          initial={modal.id ? (modal._apiData || modal) : null}
          propertyId={property.id}
          onClose={() => setModal(null)}
          onSave={saveRoom}
        />
      )}

      {tenancy && (
        <TenancyPanel tenancy={tenancy} propertyName={property.name} onClose={() => setTenancy(null)} />
      )}

      {manageRoom && (
        <RoomManagementPanel room={manageRoom} property={property} onEdit={() => setModal(manageRoom)} onClose={() => setManageRoom(null)} />
      )}
    </div>
  );
}