"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, MapPin, UserRound, Plus, Pencil, Trash2, BedDouble, PoundSterling, Users, X, CalendarClock, Wrench, ClipboardCheck, ShieldCheck, Star, ChevronRight } from "lucide-react";
import { Badge } from "../../../Shared/ui";
import TenantSelect from "../../_components/TenantSelect";
import TenancyPanel from "../../_components/TenancyPanel";
import RoomManagementPanel from "../../_components/RoomManagementPanel";
import { properties, RENTAL_TYPES, GUARANTOR_REQ, LETTING_STATUS, LETTING_STATUS_TONE, viewings, maintenance, inspections, deposits, reviews, money } from "../../_data/dummy";

const typeTone = (v) => RENTAL_TYPES.find((t) => t.v === v)?.tone || "orange";
const FIELD = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

function RoomModal({ initial, onClose, onSave }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    name: initial?.name || "",
    rent: initial?.rent ?? "",
    moneyHeld: initial?.moneyHeld ?? "",
    guarantor: initial?.guarantor || "Not Required",
    status: initial?.status || "Available",
    tenant: initial?.tenant || "",
    availableFrom: initial?.availableFrom || "",
    floor: initial?.floor || "",
    furnished: initial?.furnished || "Furnished",
    billsIncluded: initial?.billsIncluded || "Yes",
    notes: initial?.notes || "",
  });
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Room name is required"); return; }
    onSave({
      id: initial?.id || `r${Date.now()}`,
      name: form.name.trim(),
      rent: Number(form.rent) || 0,
      moneyHeld: Number(form.moneyHeld) || 0,
      guarantor: form.guarantor,
      status: form.status,
      tenant: form.status === "Occupied" ? form.tenant : null,
      availableFrom: form.availableFrom,
      floor: form.floor,
      furnished: form.furnished,
      billsIncluded: form.billsIncluded,
      notes: form.notes.trim(),
      image: initial?.image,
    });
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
          <div><label className={LABEL}>Room Name</label><input className={FIELD} value={form.name} onChange={set("name")} placeholder="Room 1" required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Monthly Rent (£)</label><input type="number" min="0" className={FIELD} value={form.rent} onChange={set("rent")} placeholder="650" /></div>
            <div><label className={LABEL}>Tenant Money Held (£)</label><input type="number" min="0" className={FIELD} value={form.moneyHeld} onChange={set("moneyHeld")} placeholder="750" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Guarantor Requirement</label><select className={FIELD} value={form.guarantor} onChange={set("guarantor")}>{GUARANTOR_REQ.map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
            <div><label className={LABEL}>Room Status</label><select className={FIELD} value={form.status} onChange={set("status")}>{LETTING_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          {form.status === "Occupied" && (
            <TenantSelect label="Assign Tenant" value={form.tenant} onChange={(name) => setForm({ ...form, tenant: name })} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Available From</label><input type="date" className={FIELD} value={form.availableFrom} onChange={set("availableFrom")} /></div>
            <div><label className={LABEL}>Floor</label><input className={FIELD} value={form.floor} onChange={set("floor")} placeholder="First" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={LABEL}>Furnished</label><select className={FIELD} value={form.furnished} onChange={set("furnished")}><option>Furnished</option><option>Part Furnished</option><option>Unfurnished</option></select></div>
            <div><label className={LABEL}>Bills Included</label><select className={FIELD} value={form.billsIncluded} onChange={set("billsIncluded")}><option>Yes</option><option>No</option><option>Some Bills</option></select></div>
          </div>
          <div><label className={LABEL}>Room Notes</label><textarea className={`${FIELD} min-h-24 resize-none`} value={form.notes} onChange={set("notes")} placeholder="Add room features, access notes, or viewing instructions" /></div>
          <button type="submit" className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98]">{isEdit ? "Save Room" : "Add Room"}</button>
        </form>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-sm font-bold text-[#0F253B] mt-0.5">{value}</p>
    </div>
  );
}

const roomPropertyAliases = (property) => {
  const aliases = [property.name, property.addressLine1].filter(Boolean);
  if (property.name.includes("Elm")) aliases.push("Elm Court HMO");
  if (property.name.includes("Maple")) aliases.push("Maple House");
  if (property.name.includes("Riverside")) aliases.push("Riverside Apartments");
  return aliases.map((v) => v.toLowerCase());
};

const matchesRoom = (item, property, room) => {
  const aliases = roomPropertyAliases(property);
  const propertyName = String(item.property || "").toLowerCase();
  const roomName = String(item.room || item.unit || "").toLowerCase();
  return aliases.includes(propertyName) && roomName === room.name.toLowerCase();
};

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

function RoomDetail({ room, property, onEdit, onManage }) {
  const roomViewings = viewings.filter((v) => matchesRoom(v, property, room));
  const roomMaintenance = maintenance.filter((m) => matchesRoom(m, property, room));
  const roomInspections = inspections.filter((i) => matchesRoom(i, property, room));
  const roomDeposits = deposits.filter((d) => matchesRoom(d, property, room));
  const roomReviews = reviews.filter((r) => matchesRoom(r, property, room));

  return (
    <div className="bg-gray-50 border border-gray-100 rounded-3xl p-4 sm:p-5 space-y-5">
      <div className="flex flex-col lg:flex-row gap-5">
        <div className="lg:w-80 bg-white border border-gray-100 rounded-2xl overflow-hidden shrink-0">
          <div className="relative h-44 bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {room.image && <img src={room.image} alt={room.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
            <div className="absolute top-3 right-3"><Badge tone={LETTING_STATUS_TONE[room.status] || "gray"}>{room.status}</Badge></div>
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
            <Badge tone="gray">{property.tenantType}</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Info label="Tenant Money Held" value={money(room.moneyHeld || 0)} />
            <Info label="Guarantor" value={room.guarantor || "Not Required"} />
            <Info label="Available From" value={room.availableFrom || "Not set"} />
            <Info label="Floor" value={room.floor || "Not set"} />
            <Info label="Furnished" value={room.furnished || "Furnished"} />
            <Info label="Bills Included" value={room.billsIncluded || "Yes"} />
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

export default function AdminPropertyDetail() {
  const { id } = useParams();
  const property = properties.find((p) => p.id === id);
  const [rooms, setRooms] = useState(property ? property.rooms : []);
  const [modal, setModal] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [tenancy, setTenancy] = useState(null);
  const [manageRoom, setManageRoom] = useState(null);

  if (!property) {
    return (
      <div className="space-y-4">
        <Link href="/admin/properties" className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-[#0F253B]"><ArrowLeft size={16} /> Back</Link>
        <p className="text-gray-400">Property not found.</p>
      </div>
    );
  }

  const isHMO = property.type === "HMO";
  const income = rooms.filter((r) => r.status === "Occupied").reduce((s, r) => s + r.rent, 0);
  const occupied = rooms.filter((r) => r.status === "Occupied").length;

  const saveRoom = (room) => {
    setRooms((prev) => (prev.some((r) => r.id === room.id) ? prev.map((r) => (r.id === room.id ? room : r)) : [...prev, room]));
    setSelectedRoomId(room.id);
    setModal(null);
  };
  const removeRoom = (room) => {
    if (confirm(`Delete ${room.name}?`)) {
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
      if (selectedRoomId === room.id) setSelectedRoomId(null);
    }
  };
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  // Active tenancies for this property (occupied rooms, or an occupied single let).
  const activeTenancies = isHMO
    ? rooms.filter((r) => r.status === "Occupied" && r.tenant).map((r) => ({ tenant: r.tenant, unit: r.name, rent: r.rent }))
    : property.type === "Single Let" && property.letting?.status === "Occupied" && property.letting?.tenant
    ? [{ tenant: property.letting.tenant, unit: "Whole property", rent: property.letting.rent }]
    : [];
  const tenantInitials = (n) => n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

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
            <Badge tone="gray">{property.tenantType}</Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">{property.name}</h1>
          <p className="text-white/80 text-sm flex items-center gap-1.5 mt-1"><MapPin size={14} />{[property.area, property.city].filter(Boolean).join(", ") || "No area"}</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: BedDouble, label: isHMO ? "Rooms" : "Units", value: isHMO ? `${occupied}/${rooms.length}` : "1" },
          { icon: PoundSterling, label: "Monthly income", value: money(isHMO ? income : property.letting?.status === "Occupied" ? property.letting.rent : 0) },
          { icon: UserRound, label: "Owner", value: property.owner, small: true },
          { icon: Users, label: "Tenant type", value: property.tenantType, small: true },
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.image && <img src={r.image} alt={r.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
                    <div className="absolute top-2 right-2"><Badge tone={LETTING_STATUS_TONE[r.status] || "gray"}>{r.status}</Badge></div>
                  </div>
                  <div className="p-4">
                    <p className="font-bold text-[#0F253B]">{r.name}</p>
                    <p className="text-lg font-bold text-[#0F253B] mt-1">{r.rent ? money(r.rent) : "—"}<span className="text-xs font-medium text-gray-400">/mo</span></p>
                    <p className="text-xs text-gray-400 font-medium mt-1">Held {money(r.moneyHeld || 0)} · {r.guarantor}</p>
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
          {property.type === "Single Let" && property.letting && (
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
          {property.type === "Short-term Let" && (
            <p className="text-sm text-gray-500 font-medium">Short-term let — booked by night/week. Tenant type: <b className="text-[#0F253B]">{property.tenantType}</b>.</p>
          )}
          {property.type === "Block" && property.block && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Info label="Payment Term" value={`${property.block.paymentTermDays} days`} />
              <Info label="Hide Tenant Rent" value={property.block.hideTenantRent} />
              <Info label="Tenant Type" value={property.tenantType} />
            </div>
          )}
        </div>
      )}

      {/* Active Tenancies — open the full tenancy panel */}
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
        <RoomModal initial={modal.id ? modal : null} onClose={() => setModal(null)} onSave={saveRoom} />
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
