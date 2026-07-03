"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Plus, MapPin, BedDouble, Search, X, UploadCloud, UserRound, DoorOpen, Trash2, ShieldCheck } from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import TenantSelect from "../_components/TenantSelect";
import { properties, owners, RENTAL_TYPES, TENANT_TYPES, GUARANTOR_REQ, LETTING_STATUS, LETTING_STATUS_TONE, img, money } from "../_data/dummy";

const typeMeta = (v) => RENTAL_TYPES.find((t) => t.v === v);
const typeTone = (v) => typeMeta(v)?.tone || "gray";

const FIELD = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

function SectionTitle({ children }) {
  return <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C] pt-1">{children}</p>;
}
function TextField({ label, ...props }) {
  return <div><label className={LABEL}>{label}</label><input className={FIELD} {...props} /></div>;
}
function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <select className={FIELD} value={value} onChange={onChange}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function Segmented({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(o)}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${value === o ? "bg-[#0F253B] text-white border-[#0F253B]" : "bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100"}`}>
          {o}
        </button>
      ))}
    </div>
  );
}

const emptyRoom = { name: "", rent: "", moneyHeld: "", guarantor: "Not Required", status: "Available", tenant: "" };

function PropertyModal({ onClose, onCreate }) {
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [owner, setOwner] = useState("");
  const [type, setType] = useState("HMO");
  const [tenantType, setTenantType] = useState("Any");

  // HMO rooms
  const [rooms, setRooms] = useState([]);
  const [draft, setDraft] = useState(emptyRoom);

  // Single Let
  const [letting, setLetting] = useState({ rent: "", moneyHeld: "", guarantor: "Not Required", status: "Available", tenant: "" });

  // Block
  const [block, setBlock] = useState({ paymentTermDays: "14", hideTenantRent: "No" });

  const [images, setImages] = useState([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const [error, setError] = useState("");

  const num = (x) => Number(x) || 0;

  const readFiles = (fileList) => {
    Array.from(fileList || []).filter((f) => f.type.startsWith("image/")).forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) => setImages((prev) => [...prev, ev.target.result]);
      reader.readAsDataURL(f);
    });
  };
  const onDrop = (e) => { e.preventDefault(); setDragging(false); readFiles(e.dataTransfer.files); };
  const removeImage = (i) => setImages((prev) => prev.filter((_, idx) => idx !== i));

  const addRoom = () => {
    if (!draft.name.trim()) { setError("Enter a room name to add it"); return; }
    setRooms((prev) => [...prev, { ...draft, id: `r${Date.now()}`, rent: num(draft.rent), moneyHeld: num(draft.moneyHeld) }]);
    setDraft(emptyRoom);
    setError("");
  };
  const removeRoom = (id) => setRooms((prev) => prev.filter((r) => r.id !== id));

  const submit = (e) => {
    e.preventDefault();
    if (!address.trim()) { setError("Property address is required"); return; }
    const seed = address.toLowerCase().replace(/\s+/g, "-");
    const isHMO = type === "HMO";
    const isSingle = type === "Single Let";
    const totalRooms = isHMO ? rooms.length : isSingle ? 1 : 0;
    const occupied = isHMO ? rooms.filter((r) => r.status === "Occupied").length : isSingle && letting.status === "Occupied" ? 1 : 0;
    const rentFrom = isHMO ? (rooms.length ? Math.min(...rooms.map((r) => r.rent)) : 0) : isSingle ? num(letting.rent) : 0;
    const rentTo = isHMO ? (rooms.length ? Math.max(...rooms.map((r) => r.rent)) : 0) : rentFrom;

    onCreate({
      id: `p${Date.now()}`,
      name: address,
      addressLine1: address,
      area,
      city: area,
      postcode: "",
      image: images[0] || img(seed),
      images,
      type,
      tenantType,
      owner: owner || "Unassigned",
      status: "active",
      rentFrom,
      rentTo,
      totalRooms,
      occupied,
      rooms: isHMO ? rooms : [],
      letting: isSingle ? { ...letting, rent: num(letting.rent), moneyHeld: num(letting.moneyHeld) } : null,
      block: type === "Block" ? { paymentTermDays: num(block.paymentTermDays), hideTenantRent: block.hideTenantRent } : null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">New Property</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>}

        <form onSubmit={submit} className="space-y-5">
          {/* Property */}
          <SectionTitle>Property</SectionTitle>
          <TextField label="Property Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="18 Elm Court, Leeds LS2 9JT" required />
          <TextField label="Area (optional)" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Woodhouse" />

          {/* Assign Owner */}
          <SectionTitle>Assign Owner</SectionTitle>
          <div>
            <label className={LABEL}>Property Owner</label>
            <select className={FIELD} value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Unassigned</option>
              {owners.map((o) => <option key={o.id} value={o.name}>{o.name}{o.company ? " (Company)" : ""}</option>)}
            </select>
            <p className="text-[11px] text-gray-400 font-medium mt-1.5">Choose the landlord this property belongs to, or leave unassigned.</p>
          </div>

          {/* Photos (optional) */}
          <div>
            <label className={LABEL}>Photos (optional)</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${dragging ? "border-[#F47C3C] bg-orange-50" : "border-gray-200 hover:border-[#F47C3C] hover:bg-gray-50"}`}
            >
              <div className="w-10 h-10 mx-auto rounded-xl bg-orange-50 text-[#F47C3C] flex items-center justify-center mb-2"><UploadCloud size={20} /></div>
              <p className="text-sm font-bold text-[#0F253B]">Drag &amp; drop images</p>
              <p className="text-xs text-gray-400 font-medium">or click to browse</p>
              <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => readFiles(e.target.files)} />
            </div>
            {images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                {images.map((src, i) => (
                  <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`upload-${i}`} className="w-full h-full object-cover" />
                    <button type="button" onClick={(e) => { e.stopPropagation(); removeImage(i); }} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"><X size={12} /></button>
                    {i === 0 && <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-[#0F253B] text-white px-1.5 py-0.5 rounded">Cover</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rental Type */}
          <SectionTitle>Rental Type</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {RENTAL_TYPES.map((t) => {
              const on = type === t.v;
              return (
                <button key={t.v} type="button" onClick={() => setType(t.v)}
                  className={`text-left p-3 rounded-2xl border transition-all ${on ? "border-[#F47C3C] bg-orange-50 ring-1 ring-[#F47C3C]/30" : "border-gray-100 hover:bg-gray-50"}`}>
                  <p className="font-bold text-sm text-[#0F253B]">{t.v}</p>
                  <p className="text-[11px] text-gray-400 font-medium leading-tight mt-0.5">{t.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Tenant Type — all types */}
          <div>
            <label className={LABEL}>Tenant Type</label>
            <Segmented options={TENANT_TYPES} value={tenantType} onChange={setTenantType} />
          </div>

          {/* ---- HMO: Rooms ---- */}
          {type === "HMO" && (
            <>
              <SectionTitle>Rooms <span className="text-gray-300 normal-case tracking-normal font-medium">· optional, add one or more</span></SectionTitle>

              {rooms.length > 0 && (
                <div className="space-y-2">
                  {rooms.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-[#F47C3C] shrink-0"><DoorOpen size={15} /></div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#0F253B] truncate">{r.name}</p>
                          <p className="text-[11px] text-gray-400 font-medium">{money(r.rent)}/mo · held {money(r.moneyHeld)}{r.tenant ? ` · ${r.tenant}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge tone={LETTING_STATUS_TONE[r.status]}>{r.status}</Badge>
                        <button type="button" onClick={() => removeRoom(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Room draft */}
              <div className="p-4 rounded-2xl border border-dashed border-gray-200 space-y-3">
                <TextField label="Room Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Room 1" />
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Monthly Rent (£)" type="number" min="0" value={draft.rent} onChange={(e) => setDraft({ ...draft, rent: e.target.value })} placeholder="650" />
                  <TextField label="Tenant Money Held (£)" type="number" min="0" value={draft.moneyHeld} onChange={(e) => setDraft({ ...draft, moneyHeld: e.target.value })} placeholder="750" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Guarantor Requirement" value={draft.guarantor} onChange={(e) => setDraft({ ...draft, guarantor: e.target.value })} options={GUARANTOR_REQ} />
                  <SelectField label="Room Status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} options={LETTING_STATUS} />
                </div>
                {draft.status === "Occupied" && (
                  <TenantSelect label="Assign Tenant" value={draft.tenant} onChange={(name) => setDraft({ ...draft, tenant: name })} />
                )}
                <button type="button" onClick={addRoom} className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#0F253B] hover:bg-[#1c3e5e] text-white text-sm font-bold rounded-xl transition-all">
                  <Plus size={16} /> Add Room
                </button>
              </div>
            </>
          )}

          {/* ---- Single Let ---- */}
          {type === "Single Let" && (
            <>
              <SectionTitle>Letting</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Monthly Rent (£)" type="number" min="0" value={letting.rent} onChange={(e) => setLetting({ ...letting, rent: e.target.value })} placeholder="1450" />
                <TextField label="Tenant Money Held (£)" type="number" min="0" value={letting.moneyHeld} onChange={(e) => setLetting({ ...letting, moneyHeld: e.target.value })} placeholder="1670" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Guarantor Requirement" value={letting.guarantor} onChange={(e) => setLetting({ ...letting, guarantor: e.target.value })} options={GUARANTOR_REQ} />
                <SelectField label="Property Status" value={letting.status} onChange={(e) => setLetting({ ...letting, status: e.target.value })} options={LETTING_STATUS} />
              </div>
              {letting.status === "Occupied" && (
                <TenantSelect label="Assign Tenant" value={letting.tenant} onChange={(name) => setLetting({ ...letting, tenant: name })} />
              )}
            </>
          )}

          {/* ---- Short-term Let ---- (only tenant type, nothing extra) */}
          {type === "Short-term Let" && (
            <p className="text-xs text-gray-400 font-medium bg-gray-50 rounded-xl p-3">Short-term lets are booked by night/week — no rent schedule is set here.</p>
          )}

          {/* ---- Block ---- */}
          {type === "Block" && (
            <>
              <SectionTitle>Block Settings</SectionTitle>
              <TextField label="Payment Term (Days)" type="number" min="0" value={block.paymentTermDays} onChange={(e) => setBlock({ ...block, paymentTermDays: e.target.value })} placeholder="14" />
              <p className="text-[11px] text-gray-400 font-medium -mt-2">Days after the due date before rent is marked overdue.</p>
              <div>
                <label className={LABEL}>Hide Tenant Rent</label>
                <Segmented options={["No", "Yes"]} value={block.hideTenantRent} onChange={(v) => setBlock({ ...block, hideTenantRent: v })} />
                <p className="text-[11px] text-gray-400 font-medium mt-1.5">If Yes, tenants can't see rent info or receive rent notifications.</p>
              </div>
            </>
          )}

          <button type="submit" className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98]">
            Save Property
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminProperties() {
  const [items, setItems] = useState(properties);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const list = items.filter(
    (p) => p.name.toLowerCase().includes(q.toLowerCase()) || (p.area || p.city || "").toLowerCase().includes(q.toLowerCase())
  );

  const create = (p) => {
    properties.unshift(p);
    setItems([...properties]);
    setOpen(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Properties"
        subtitle="Your portfolio — rooms, rent and occupancy"
        action={
          <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]">
            <Plus size={18} /> Add Property
          </button>
        }
      />

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search properties…" className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {list.map((p) => {
          const occ = p.totalRooms ? Math.round((p.occupied / p.totalRooms) * 100) : 0;
          const isHMO = p.type === "HMO";
          const isSingle = p.type === "Single Let";
          const tenants = isHMO
            ? (p.rooms || []).filter((r) => r.tenant).map((r) => r.tenant)
            : p.letting?.tenant ? [p.letting.tenant] : [];
          const tenantLabel = tenants.length === 1 ? tenants[0] : tenants.length > 1 ? `${tenants.length} tenants` : null;
          return (
            <Link key={p.id} href={`/agent/properties/${p.id}`} className="group bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <div className="relative h-44 bg-gradient-to-br from-[#0F253B] to-[#1c3e5e]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt={p.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                <div className="absolute top-3 left-3 flex gap-2">
                  <Badge tone={typeTone(p.type)}>{p.type}</Badge>
                  <Badge tone="gray">{p.tenantType}</Badge>
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <p className="text-white font-bold text-lg leading-tight">{p.name}</p>
                  <p className="text-white/80 text-xs flex items-center gap-1"><MapPin size={11} />{[p.area, p.city].filter(Boolean).join(", ") || "No area"}</p>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{isHMO ? "Rent from" : "Rent"}</p>
                    <p className="text-xl font-bold text-[#0F253B]">{p.rentFrom ? money(p.rentFrom) : "—"}</p>
                  </div>
                  {isHMO ? (
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1 justify-end"><BedDouble size={12} />Rooms</p>
                      <p className="text-xl font-bold text-[#0F253B]">{p.occupied}/{p.totalRooms}</p>
                    </div>
                  ) : (
                    <Badge tone={isSingle ? LETTING_STATUS_TONE[p.letting?.status] || "gray" : "gray"}>
                      {isSingle ? p.letting?.status || "—" : p.type}
                    </Badge>
                  )}
                </div>
                {isHMO && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                      <span className="text-gray-400 uppercase tracking-widest">Occupancy</span>
                      <span className="text-[#0F253B]">{occ}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-[#F47C3C] rounded-full" style={{ width: `${occ}%` }} />
                    </div>
                  </div>
                )}
                {tenantLabel && (
                  <p className="text-[11px] text-gray-500 font-semibold mt-3 flex items-center gap-1.5"><UserRound size={12} className="text-[#F47C3C]" />{tenantLabel}</p>
                )}
                {p.type === "Block" && p.block && (
                  <p className="text-[11px] text-gray-400 font-medium mt-2 flex items-center gap-1"><ShieldCheck size={12} className="text-[#F47C3C]" />Payment term {p.block.paymentTermDays}d · Rent {p.block.hideTenantRent === "Yes" ? "hidden" : "visible"}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {open && <PropertyModal onClose={() => setOpen(false)} onCreate={create} />}
    </div>
  );
}
