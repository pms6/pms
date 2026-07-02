"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Plus, MapPin, BedDouble, Search, X, ShieldCheck, UploadCloud } from "lucide-react";
import { PageHeader, Badge } from "../../Shared/ui";
import { properties, owners, RENTAL_TYPES, img, money } from "../_data/dummy";

const typeMeta = (v) => RENTAL_TYPES.find((t) => t.v === v);
const typeTone = (v) => typeMeta(v)?.tone || "gray";

const FIELD = "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium";
const LABEL = "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";

function TextField({ label, ...props }) {
  return <div><label className={LABEL}>{label}</label><input className={FIELD} {...props} /></div>;
}
function SelectField({ label, value, onChange, options, placeholder }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <select className={FIELD} value={value} onChange={onChange}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function SectionTitle({ children }) {
  return <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C] pt-2">{children}</p>;
}

function PropertyModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    name: "", type: "HMO Room", owner: "", status: "active", notes: "",
    addressLine1: "", city: "", postcode: "", councilTaxBand: "", epc: "",
    // Whole Property
    bedrooms: "", bathrooms: "", furnished: "Furnished", sizeSqft: "", rent: "", deposit: "", availableFrom: "", parking: "No", garden: "No",
    // HMO Room
    totalRooms: "", maxOccupants: "", floors: "", sharedBath: "", sharedKitchen: "", licenceRequired: true, licenceNumber: "", licenceExpiry: "", billsIncluded: "Yes", rentFrom: "",
    // Block Booking
    orgName: "", unitsBooked: "", bookingStart: "", bookingEnd: "", bookingRef: "", ratePerRoom: "", occupants: "", billingContact: "",
    // Short-Term Stay
    nightlyRate: "", weeklyRate: "", cleaningFee: "", minNights: "", maxGuests: "", checkIn: "15:00", checkOut: "11:00", platforms: "",
    // Serviced Accommodation
    units: "", minStay: "", servicesIncluded: "", amenities: "",
    // Commercial
    useClass: "", floorAreaSqft: "", businessRates: "", leaseTermYears: "", rentPerYear: "", serviceCharge: "", parkingSpaces: "",
  });
  const [images, setImages] = useState([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const readFiles = (fileList) => {
    Array.from(fileList || [])
      .filter((f) => f.type.startsWith("image/"))
      .forEach((f) => {
        const reader = new FileReader();
        reader.onload = (ev) => setImages((prev) => [...prev, ev.target.result]);
        reader.readAsDataURL(f);
      });
  };
  const onDrop = (e) => { e.preventDefault(); setDragging(false); readFiles(e.dataTransfer.files); };
  const removeImage = (i) => setImages((prev) => prev.filter((_, idx) => idx !== i));

  const num = (x) => Number(x) || 0;

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Property name is required"); return; }
    const seed = form.name.toLowerCase().replace(/\s+/g, "-");
    const primaryRent = num(form.rent) || num(form.rentFrom) || num(form.ratePerRoom) || num(form.nightlyRate) || num(form.rentPerYear);
    const roomCount = num(form.totalRooms) || num(form.bedrooms) || num(form.unitsBooked) || num(form.units) || 0;
    onCreate({
      id: `p${Date.now()}`,
      name: form.name,
      image: images[0] || img(seed),
      images,
      addressLine1: form.addressLine1,
      city: form.city,
      postcode: form.postcode,
      type: form.type,
      status: form.status,
      owner: form.owner || "Unassigned",
      rentFrom: primaryRent,
      rentTo: primaryRent,
      totalRooms: roomCount,
      occupied: 0,
      rooms: [],
      licence: form.type === "HMO Room" ? { required: form.licenceRequired, number: form.licenceNumber, expiry: form.licenceExpiry } : null,
      councilTaxBand: form.councilTaxBand,
      epc: form.epc,
      notes: form.notes,
      details: { ...form },
    });
  };

  const meta = typeMeta(form.type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xl font-bold text-[#0F253B]">Add Property</h3>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          {/* Basics — common to all types */}
          <SectionTitle>Basics</SectionTitle>
          <TextField label="Property Name" value={form.name} onChange={set("name")} placeholder="e.g. Elm Court" required />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Rental Type" value={form.type} onChange={set("type")} options={RENTAL_TYPES.map((t) => t.v)} />
            <SelectField label="Owner" value={form.owner} onChange={set("owner")} options={owners.map((o) => o.name)} placeholder="Select owner…" />
          </div>
          {meta && <p className="text-[11px] text-gray-400 font-medium -mt-2">{meta.desc} · <span className="text-gray-300">e.g. {meta.eg}</span></p>}

          {/* Photos */}
          <div>
            <label className={LABEL}>Photos</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${dragging ? "border-[#F47C3C] bg-orange-50" : "border-gray-200 hover:border-[#F47C3C] hover:bg-gray-50"}`}
            >
              <div className="w-11 h-11 mx-auto rounded-xl bg-orange-50 text-[#F47C3C] flex items-center justify-center mb-2"><UploadCloud size={22} /></div>
              <p className="text-sm font-bold text-[#0F253B]">Drag &amp; drop images here</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">or click to browse · PNG, JPG</p>
              <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => readFiles(e.target.files)} />
            </div>
            {images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                {images.map((src, i) => (
                  <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`upload-${i}`} className="w-full h-full object-cover" />
                    <button type="button" onClick={(e) => { e.stopPropagation(); removeImage(i); }} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                    {i === 0 && <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-[#0F253B] text-white px-1.5 py-0.5 rounded">Cover</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Address — common */}
          <SectionTitle>Address</SectionTitle>
          <TextField label="Address Line 1" value={form.addressLine1} onChange={set("addressLine1")} placeholder="18 Elm Court" />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="City" value={form.city} onChange={set("city")} placeholder="Leeds" />
            <TextField label="Postcode" value={form.postcode} onChange={set("postcode")} placeholder="LS2 9JT" />
          </div>

          {/* ---- Type-specific fields ---- */}

          {form.type === "Whole Property" && (
            <>
              <SectionTitle>Property Details</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Bedrooms" type="number" min="0" value={form.bedrooms} onChange={set("bedrooms")} placeholder="3" />
                <TextField label="Bathrooms" type="number" min="0" value={form.bathrooms} onChange={set("bathrooms")} placeholder="2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Furnished" value={form.furnished} onChange={set("furnished")} options={["Furnished", "Part-furnished", "Unfurnished"]} />
                <TextField label="Size (sq ft)" type="number" min="0" value={form.sizeSqft} onChange={set("sizeSqft")} placeholder="950" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Rent (£/mo)" type="number" min="0" value={form.rent} onChange={set("rent")} placeholder="1450" />
                <TextField label="Deposit (£)" type="number" min="0" value={form.deposit} onChange={set("deposit")} placeholder="1670" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <TextField label="Available From" type="date" value={form.availableFrom} onChange={set("availableFrom")} />
                <SelectField label="Parking" value={form.parking} onChange={set("parking")} options={["No", "Yes", "On-street"]} />
                <SelectField label="Garden" value={form.garden} onChange={set("garden")} options={["No", "Yes", "Shared"]} />
              </div>
            </>
          )}

          {form.type === "HMO Room" && (
            <>
              <SectionTitle>HMO / Layout</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Lettable Rooms" type="number" min="0" value={form.totalRooms} onChange={set("totalRooms")} placeholder="6" />
                <TextField label="Max Occupants" type="number" min="0" value={form.maxOccupants} onChange={set("maxOccupants")} placeholder="6" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <TextField label="Floors" type="number" min="0" value={form.floors} onChange={set("floors")} placeholder="3" />
                <TextField label="Shared Baths" type="number" min="0" value={form.sharedBath} onChange={set("sharedBath")} placeholder="2" />
                <TextField label="Shared Kitchens" type="number" min="0" value={form.sharedKitchen} onChange={set("sharedKitchen")} placeholder="1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Rent From (£/mo)" type="number" min="0" value={form.rentFrom} onChange={set("rentFrom")} placeholder="575" />
                <SelectField label="Bills Included" value={form.billsIncluded} onChange={set("billsIncluded")} options={["Yes", "No", "Part"]} />
              </div>
              <SectionTitle>HMO Licence</SectionTitle>
              <label className="flex items-center gap-2 text-sm font-semibold text-[#0F253B]">
                <input type="checkbox" checked={form.licenceRequired} onChange={(e) => setForm({ ...form, licenceRequired: e.target.checked })} className="w-4 h-4 accent-[#F47C3C]" />
                HMO licence required (5+ occupants → mandatory)
              </label>
              {form.licenceRequired && (
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Licence Number" value={form.licenceNumber} onChange={set("licenceNumber")} placeholder="HMO/2026/0421" />
                  <TextField label="Licence Expiry" type="date" value={form.licenceExpiry} onChange={set("licenceExpiry")} />
                </div>
              )}
            </>
          )}

          {form.type === "Block Booking" && (
            <>
              <SectionTitle>Booking &amp; Contract</SectionTitle>
              <TextField label="Organization / Client" value={form.orgName} onChange={set("orgName")} placeholder="Acme Ltd / University of Leeds" />
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Units / Rooms Booked" type="number" min="0" value={form.unitsBooked} onChange={set("unitsBooked")} placeholder="8" />
                <TextField label="Occupants" type="number" min="0" value={form.occupants} onChange={set("occupants")} placeholder="8" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Booking Start" type="date" value={form.bookingStart} onChange={set("bookingStart")} />
                <TextField label="Booking End" type="date" value={form.bookingEnd} onChange={set("bookingEnd")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Rate / Room (£/mo)" type="number" min="0" value={form.ratePerRoom} onChange={set("ratePerRoom")} placeholder="600" />
                <TextField label="Contract Ref" value={form.bookingRef} onChange={set("bookingRef")} placeholder="BK-2026-018" />
              </div>
              <TextField label="Billing Contact" value={form.billingContact} onChange={set("billingContact")} placeholder="name@company.com" />
            </>
          )}

          {form.type === "Short-Term Stay" && (
            <>
              <SectionTitle>Stay &amp; Pricing</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <TextField label="Nightly (£)" type="number" min="0" value={form.nightlyRate} onChange={set("nightlyRate")} placeholder="95" />
                <TextField label="Weekly (£)" type="number" min="0" value={form.weeklyRate} onChange={set("weeklyRate")} placeholder="550" />
                <TextField label="Cleaning (£)" type="number" min="0" value={form.cleaningFee} onChange={set("cleaningFee")} placeholder="45" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Min Nights" type="number" min="1" value={form.minNights} onChange={set("minNights")} placeholder="2" />
                <TextField label="Max Guests" type="number" min="1" value={form.maxGuests} onChange={set("maxGuests")} placeholder="4" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Check-in" type="time" value={form.checkIn} onChange={set("checkIn")} />
                <TextField label="Check-out" type="time" value={form.checkOut} onChange={set("checkOut")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Bedrooms" type="number" min="0" value={form.bedrooms} onChange={set("bedrooms")} placeholder="2" />
                <TextField label="Bathrooms" type="number" min="0" value={form.bathrooms} onChange={set("bathrooms")} placeholder="1" />
              </div>
              <TextField label="Listing Platforms" value={form.platforms} onChange={set("platforms")} placeholder="Airbnb, Booking.com" />
            </>
          )}

          {form.type === "Serviced Accommodation" && (
            <>
              <SectionTitle>Serviced Details</SectionTitle>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <TextField label="Nightly (£)" type="number" min="0" value={form.nightlyRate} onChange={set("nightlyRate")} placeholder="120" />
                <TextField label="Weekly (£)" type="number" min="0" value={form.weeklyRate} onChange={set("weeklyRate")} placeholder="700" />
                <TextField label="Units" type="number" min="0" value={form.units} onChange={set("units")} placeholder="4" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Min Stay (nights)" type="number" min="1" value={form.minStay} onChange={set("minStay")} placeholder="7" />
                <TextField label="Max Guests" type="number" min="1" value={form.maxGuests} onChange={set("maxGuests")} placeholder="2" />
              </div>
              <TextField label="Services Included" value={form.servicesIncluded} onChange={set("servicesIncluded")} placeholder="Weekly cleaning, linen, reception" />
              <TextField label="Amenities" value={form.amenities} onChange={set("amenities")} placeholder="Wi-Fi, Gym, Parking" />
            </>
          )}

          {form.type === "Commercial" && (
            <>
              <SectionTitle>Commercial Details</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Use Class" value={form.useClass} onChange={set("useClass")} options={["Class E (Commercial)", "B2 (Industrial)", "B8 (Storage)", "Sui Generis"]} placeholder="Select…" />
                <TextField label="Floor Area (sq ft)" type="number" min="0" value={form.floorAreaSqft} onChange={set("floorAreaSqft")} placeholder="1200" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Rent (£/yr)" type="number" min="0" value={form.rentPerYear} onChange={set("rentPerYear")} placeholder="18000" />
                <TextField label="Business Rates (£/yr)" type="number" min="0" value={form.businessRates} onChange={set("businessRates")} placeholder="4200" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <TextField label="Lease Term (yrs)" type="number" min="0" value={form.leaseTermYears} onChange={set("leaseTermYears")} placeholder="5" />
                <TextField label="Service Charge (£/yr)" type="number" min="0" value={form.serviceCharge} onChange={set("serviceCharge")} placeholder="1500" />
                <TextField label="Parking Spaces" type="number" min="0" value={form.parkingSpaces} onChange={set("parkingSpaces")} placeholder="4" />
              </div>
            </>
          )}

          {/* Compliance — shown for residential types */}
          {["Whole Property", "HMO Room", "Block Booking", "Short-Term Stay", "Serviced Accommodation"].includes(form.type) && (
            <>
              <SectionTitle>Compliance</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Council Tax Band" value={form.councilTaxBand} onChange={set("councilTaxBand")} options={["A", "B", "C", "D", "E", "F", "G", "H"]} placeholder="—" />
                <SelectField label="EPC Rating" value={form.epc} onChange={set("epc")} options={["A", "B", "C", "D", "E", "F", "G"]} placeholder="—" />
              </div>
            </>
          )}

          {/* Status + notes — common */}
          <SectionTitle>Status</SectionTitle>
          <SelectField label="Status" value={form.status} onChange={set("status")} options={["active", "archived"]} />
          <div>
            <label className={LABEL}>Notes</label>
            <textarea rows={2} className={FIELD} value={form.notes} onChange={set("notes")} placeholder="Any notes about the property…" />
          </div>

          <button type="submit" className="w-full py-3.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all active:scale-[0.98]">
            Create Property
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
    (p) => p.name.toLowerCase().includes(q.toLowerCase()) || (p.city || "").toLowerCase().includes(q.toLowerCase())
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
          return (
            <Link key={p.id} href={`/admin/properties/${p.id}`} className="group bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <div className="relative h-44 bg-gradient-to-br from-[#0F253B] to-[#1c3e5e]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt={p.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                <div className="absolute top-3 left-3 flex gap-2">
                  <Badge tone={typeTone(p.type)}>{p.type}</Badge>
                  {p.licence?.number && <Badge tone="green">Licensed</Badge>}
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <p className="text-white font-bold text-lg leading-tight">{p.name}</p>
                  <p className="text-white/80 text-xs flex items-center gap-1"><MapPin size={11} />{[p.city, p.postcode].filter(Boolean).join(", ") || "No address"}</p>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Rent from</p>
                    <p className="text-xl font-bold text-[#0F253B]">{money(p.rentFrom)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1 justify-end"><BedDouble size={12} />Rooms</p>
                    <p className="text-xl font-bold text-[#0F253B]">{p.occupied}/{p.totalRooms}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <span className="text-gray-400 uppercase tracking-widest">Occupancy</span>
                    <span className="text-[#0F253B]">{occ}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-[#F47C3C] rounded-full" style={{ width: `${occ}%` }} />
                  </div>
                </div>
                {p.licence?.expiry && (
                  <p className="text-[11px] text-gray-400 font-medium mt-3 flex items-center gap-1"><ShieldCheck size={12} className="text-emerald-500" />Licence to {new Date(p.licence.expiry).toLocaleDateString("en-GB")}</p>
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
