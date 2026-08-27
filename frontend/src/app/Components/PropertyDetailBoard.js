"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, UserRound, Plus, Pencil, Trash2, BedDouble, PoundSterling, Users, CalendarClock, Wrench, ClipboardCheck, ShieldCheck, Star, ChevronRight } from "lucide-react";
import { Badge } from "../Shared/ui";
import TenancyPanel from "../admin/_components/TenancyPanel";
import { ContractSection, ContractModal } from "./PropertyContract";
import RoomManagementPanel from "../admin/_components/RoomManagementPanel";
import { RENTAL_TYPES, LETTING_STATUS_TONE, viewings, maintenance, inspections, deposits, reviews, money } from "../admin/_data/dummy";
import api from "@/app/api/api";

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
  },

  async deleteProperty(id) {
    try {
      const response = await api.delete(`/properties/${id}`);
      return response.data;
    } catch (error) {
      console.error('Delete property error:', error);
      throw error.response?.data || error;
    }
  },

  async updateProperty(id, payload) {
    try {
      const response = await api.put(`/properties/${id}`, payload);
      return response.data;
    } catch (error) {
      console.error('Update property error:', error);
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
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={onManage} className="px-3 py-1.5 bg-[#0F253B] hover:bg-[#1c3e5e] text-white text-xs font-bold rounded-lg">Manage</button>
                <button
                  onClick={onEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-100 hover:bg-gray-50 text-[#0F253B] text-xs font-bold rounded-lg transition-all"
                >
                  <Pencil size={14} /> Edit Room
                </button>
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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [property, setProperty] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [tenancy, setTenancy] = useState(null);
  const [manageRoom, setManageRoom] = useState(null);
  const [editingContract, setEditingContract] = useState(false);
  // Deleting archives the property, so it is confirmed in a dialog rather than
  // fired straight off the header button.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
        contract: propertyData.contract || null,
        documents: propertyData.documents || [],
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

  // Add/edit happen on their own pages now — navigating back remounts this
  // board, so the list refetches rather than being patched in place.
  const roomsHref = `${basePath}/${id}/rooms`;
  const editRoom = (room) => router.push(`${roomsHref}/${room.id}`);

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

  // What blocks a delete — mirrors the check deleteProperty runs server-side.
  const occupiedRooms = rooms.filter((r) => r.status === "OCCUPIED");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href={basePath} className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-[#0F253B]">
          <ArrowLeft size={16} /> Back to properties
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`${basePath}/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-100 hover:bg-gray-50 text-[#0F253B] font-bold text-sm rounded-xl transition-all"
          >
            <Pencil size={16} /> Edit Property
          </Link>
          <button
            type="button"
            onClick={() => { setDeleteError(""); setConfirmingDelete(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-100 hover:bg-red-50 hover:border-red-200 text-red-600 font-bold text-sm rounded-xl transition-all"
          >
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      {confirmingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !deleting && setConfirmingDelete(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-7 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#0F253B]">
                  Delete {property.name}?
                </h2>
                <p className="text-sm text-gray-500 font-medium mt-1">
                  It is archived rather than erased — its {rooms.length} room
                  {rooms.length === 1 ? "" : "s"}, tenancies and history stay in
                  the database, and it disappears from the properties list and
                  the public site.
                </p>
              </div>
            </div>

            {/* The API refuses to delete a property while any room is still
                OCCUPIED. Say so before the button is pressed rather than after,
                and name the rooms that are in the way. */}
            {occupiedRooms.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-xs font-bold text-amber-800">
                  {occupiedRooms.length} room
                  {occupiedRooms.length === 1 ? " is" : "s are"} still occupied
                </p>
                <p className="text-[11px] font-medium text-amber-700 mt-1">
                  {occupiedRooms.map((r) => r.name).join(", ")} — a property
                  cannot be deleted while anyone is living in it. End those
                  tenancies, or set the room
                  {occupiedRooms.length === 1 ? "" : "s"} to another status
                  first.
                </p>
              </div>
            )}

            {deleteError && (
              <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmingDelete(false)}
                className="px-4 py-2.5 bg-white border border-gray-100 hover:bg-gray-50 text-[#0F253B] font-bold text-sm rounded-xl disabled:opacity-60 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting || occupiedRooms.length > 0}
                onClick={async () => {
                  setDeleting(true);
                  setDeleteError("");
                  try {
                    await apiService.deleteProperty(id);
                    router.push(basePath);
                  } catch (err) {
                    // The API refuses while any room is still OCCUPIED — show
                    // that reason rather than a generic failure.
                    setDeleteError(err.message || "Failed to delete this property.");
                    setDeleting(false);
                  }
                }}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl disabled:opacity-60 transition-all"
              >
                {deleting ? "Deleting…" : "Delete property"}
              </button>
            </div>
          </div>
        </div>
      )}

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
            <Link href={`${roomsHref}/new`} className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
              <Plus size={18} /> Add Room
            </Link>
          </div>

          {rooms.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-2xl">
              <p className="text-gray-400 font-medium">No rooms yet — add your first room.</p>
              <Link href={`${roomsHref}/new`} className="inline-block mt-4 px-6 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all">
                Add Room
              </Link>
            </div>
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
                      <button onClick={(e) => { e.stopPropagation(); editRoom(r); }} className="p-2 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg"><Pencil size={15} /></button>
                      <button onClick={(e) => { e.stopPropagation(); removeRoom(r); }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={15} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {selectedRoom && <RoomDetail room={selectedRoom} property={property} onEdit={() => editRoom(selectedRoom)} onManage={() => setManageRoom(selectedRoom)} />}
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

      {/* Contract */}
      <ContractSection
        property={property}
        onEdit={() => setEditingContract(true)}
      />

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

      {tenancy && (
        <TenancyPanel tenancy={tenancy} propertyName={property.name} onClose={() => setTenancy(null)} />
      )}

      {manageRoom && (
        <RoomManagementPanel room={manageRoom} property={property} onEdit={() => editRoom(manageRoom)} onClose={() => setManageRoom(null)} />
      )}

      {editingContract && (
        <ContractModal
          property={property}
          onClose={() => setEditingContract(false)}
          onSave={async (payload) => {
            await apiService.updateProperty(property._id, payload);
            setEditingContract(false);
            await fetchPropertyData();
          }}
        />
      )}
    </div>
  );
}