"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  Building2,
  MapPin,
  Calendar,
  Check,
  X,
  ArrowLeft,
  ArrowRight,
  Users,
  Home,
  Bed,
  Bath,
  Share2,
  Mail,
  Phone,
  Star,
  ShieldCheck,
  Link2,
  Play,
  Ruler,
  ChevronLeft,
  ChevronRight,
  Heart,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Demo data (UI only — no backend)                                    */
/* ------------------------------------------------------------------ */

const img = (seed, w = 1200, h = 800) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

const PROPERTY = {
  name: "Maple House HMO",
  location: "Rivington Street, Shoreditch, London EC2A",
  monthlyRent: "£750",
  rentPeriod: "/room · month",
  billsIncluded: true,
  availableFrom: "1 August 2026",
  deposit: "£865",
  roomType: "Double Room",
  furnished: "Fully Furnished",
  propertyType: "HMO (Shared House)",
  rooms: 6,
  minTenancy: "6 months",
  tenantType: "Professionals",
  genderPref: "Mixed",
  agePref: "21 – 35",
  petsAllowed: false,
  lat: 51.5266,
  lon: -0.0799,
  photos: ["maple-a", "maple-b", "maple-c", "maple-d", "maple-e"],
};

const HOUSE_LIFESTYLE = [
  "Sociable but respectful of quiet time",
  "Tidy shared spaces",
  "Working professionals",
  "Occasional shared dinners",
];

const HOUSEMATES = [
  { name: "Sophie", gender: "Female", age: "25 – 29", job: "Product Designer", interests: ["Yoga", "Cooking", "Live music"], seed: "hm-sophie" },
  { name: "James", gender: "Male", age: "30 – 34", job: "Software Engineer", interests: ["Cycling", "Gaming", "Coffee"], seed: "hm-james" },
  { name: "Aisha", gender: "Female", age: "21 – 24", job: "Marketing Exec", interests: ["Running", "Art", "Travel"], seed: "hm-aisha" },
];

const ROOM_INFO = {
  size: "14 m²",
  location: "First floor, rear of property",
  occupancy: "Single occupancy",
  features: ["Large double bed", "Big sash window (lots of light)", "Fast fibre broadband", "Private desk & chair"],
};

const ABOUT =
  "A beautifully refurbished 6-bedroom house share in the heart of Shoreditch, fully renovated in 2025 with new kitchens, bathrooms and flooring throughout. All bills are included — gas, electricity, water, council tax and superfast 500 Mbps fibre broadband. A professional cleaner visits the shared areas weekly, and the property is fully managed with a 24/7 maintenance line. Old Street station (Northern line) is a 6-minute walk, with buses to the City and West End on the doorstep. You're moments from Boxpark, Spitalfields Market, dozens of cafés and restaurants, a Tesco Express and Sainsbury's Local, gyms, and an NHS GP surgery within 400m.";

const OPERATOR = {
  name: "Urban Nest Lettings",
  tagline: "HMO & co-living specialists · London",
  rating: 4.8,
  reviews: 214,
  listings: 37,
  phone: "+44 20 7946 0123",
  email: "hello@urbannest.co.uk",
  seed: "op-urbannest",
};

const HOME_AMENITIES = [
  "Wi-Fi (500 Mbps)",
  "Living Room",
  "Washing Machine",
  "Tumble Dryer",
  "Dishwasher",
  "Fridge Freezer",
  "Workspace",
  "TV Licence",
  "Parking",
  "Garden",
];

const ROOM_AMENITIES = ["Double Bed", "Wardrobe", "Chest of Drawers", "Desk & Chair", "Bedside Table", "Blackout Blinds"];

const OTHER_ROOMS = [
  { id: 11, title: "Room 2 · Single", price: "£640", status: "Available now", seed: "maple-r2" },
  { id: 12, title: "Room 5 · Double Ensuite", price: "£890", status: "2 Sep 2026", seed: "maple-r5" },
  { id: 13, title: "Room 6 · Double", price: "£760", status: "Available now", seed: "maple-r6" },
];

const SIMILAR = [
  { id: 21, title: "The Old Print Works", location: "Digbeth, Birmingham", price: "£680", seed: "printworks" },
  { id: 22, title: "Willow Court HMO", location: "Fallowfield, Manchester", price: "£620", seed: "willow" },
  { id: 23, title: "Kingsgate Block", location: "Headingley, Leeds", price: "£700", seed: "kingsgate" },
];

const MEDIA_TABS = ["Photos", "Video", "Virtual Tour", "Floor Plan"];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function PropertyListingPage() {
  const [tab, setTab] = useState("Photos");
  const [activePhoto, setActivePhoto] = useState(0);
  const [showViewing, setShowViewing] = useState(false);
  const [saved, setSaved] = useState(false);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const share = (network) => {
    const text = `${PROPERTY.name} — ${PROPERTY.monthlyRent}${PROPERTY.rentPeriod}`;
    const enc = encodeURIComponent(shareUrl);
    const urls = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc}`,
      twitter: `https://twitter.com/intent/tweet?url=${enc}&text=${encodeURIComponent(text)}`,
      email: `mailto:?subject=${encodeURIComponent(PROPERTY.name)}&body=${encodeURIComponent(text + " " + shareUrl)}`,
    };
    if (network === "link") {
      navigator.clipboard?.writeText(shareUrl);
      toast.success("Link copied to clipboard");
      return;
    }
    window.open(urls[network], "_blank", "noopener,noreferrer");
  };

  const nextPhoto = () => setActivePhoto((i) => (i + 1) % PROPERTY.photos.length);
  const prevPhoto = () => setActivePhoto((i) => (i - 1 + PROPERTY.photos.length) % PROPERTY.photos.length);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F253B]">
      {/* ============================= NAVBAR ============================= */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#F47C3C] flex items-center justify-center text-white">
              <Building2 size={18} />
            </div>
            <p className="font-extrabold text-lg tracking-tight">PMS</p>
          </Link>
          <Link href="/#properties" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#0F253B] transition">
            <ArrowLeft size={16} /> Back to listings
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        {/* ============================ TOP SUMMARY ============================ */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <p className="flex items-center gap-1.5 text-sm text-gray-500 font-medium">
              <MapPin size={15} className="text-[#F47C3C]" /> {PROPERTY.location}
            </p>
            <h1 className="text-3xl md:text-4xl font-extrabold mt-1.5">{PROPERTY.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-2xl font-extrabold text-[#0F253B]">
                {PROPERTY.monthlyRent}
                <span className="text-sm font-medium text-gray-400">{PROPERTY.rentPeriod}</span>
              </span>
              {PROPERTY.billsIncluded && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold">
                  <Check size={12} /> Bills included
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-[11px] font-bold">
                <Calendar size={12} /> Available {PROPERTY.availableFrom}
              </span>
            </div>
          </div>

          {/* Share + save */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSaved((s) => !s)}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-bold border transition ${
                saved ? "bg-[#F47C3C]/10 border-[#F47C3C]/30 text-[#F47C3C]" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Heart size={16} className={saved ? "fill-[#F47C3C]" : ""} /> {saved ? "Saved" : "Save"}
            </button>
            <ShareButtons onShare={share} />
          </div>
        </div>

        {/* ============================ GALLERY + BOOKING ============================ */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Media */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-1.5 mb-3 overflow-x-auto">
              {MEDIA_TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition ${
                    tab === t ? "bg-[#0F253B] text-white" : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="relative rounded-3xl overflow-hidden bg-gray-100 aspect-[16/10] shadow-sm">
              {tab === "Photos" && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(PROPERTY.photos[activePhoto])} alt="Property" className="w-full h-full object-cover" />
                  <button onClick={prevPhoto} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow hover:bg-white">
                    <ChevronLeft size={20} />
                  </button>
                  <button onClick={nextPhoto} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow hover:bg-white">
                    <ChevronRight size={20} />
                  </button>
                  <span className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-black/60 text-white text-xs font-bold">
                    {activePhoto + 1} / {PROPERTY.photos.length}
                  </span>
                </>
              )}
              {tab === "Video" && (
                <div className="w-full h-full relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img("maple-video")} alt="Video" className="w-full h-full object-cover brightness-75" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                      <Play size={30} className="text-[#F47C3C] ml-1" />
                    </div>
                  </div>
                  <span className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg bg-black/60 text-white text-sm font-bold">Property walkthrough · 2:14</span>
                </div>
              )}
              {tab === "Virtual Tour" && (
                <div className="w-full h-full relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img("maple-360")} alt="Virtual tour" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0F253B]/40 text-white">
                    <div className="w-16 h-16 rounded-full border-2 border-white/70 flex items-center justify-center mb-3">
                      <span className="text-2xl">360°</span>
                    </div>
                    <p className="font-bold">Launch Virtual Tour</p>
                    <p className="text-xs text-white/70">Explore every room in 3D</p>
                  </div>
                </div>
              )}
              {tab === "Floor Plan" && (
                <div className="w-full h-full flex items-center justify-center bg-white p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img("maple-floorplan", 1000, 700)} alt="Floor plan" className="max-h-full object-contain" />
                </div>
              )}
            </div>

            {/* Thumbnails (photos) */}
            {tab === "Photos" && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {PROPERTY.photos.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => setActivePhoto(i)}
                    className={`relative rounded-xl overflow-hidden shrink-0 w-24 h-16 ring-2 transition ${
                      i === activePhoto ? "ring-[#F47C3C]" : "ring-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img(s, 240, 160)} alt="thumb" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Booking / viewing card */}
          <div>
            <div className="lg:sticky lg:top-24 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              <p className="text-3xl font-extrabold">
                {PROPERTY.monthlyRent}
                <span className="text-sm font-medium text-gray-400">{PROPERTY.rentPeriod}</span>
              </p>
              <div className="mt-4 space-y-2.5 text-sm">
                <Row label="Deposit" value={PROPERTY.deposit} />
                <Row label="Available from" value={PROPERTY.availableFrom} />
                <Row label="Minimum tenancy" value={PROPERTY.minTenancy} />
                <Row label="Bills included" value={PROPERTY.billsIncluded ? "Yes" : "No"} />
              </div>
              <button
                onClick={() => setShowViewing(true)}
                className="mt-5 w-full py-3.5 rounded-xl bg-[#F47C3C] text-white font-bold hover:brightness-105 shadow-lg shadow-[#F47C3C]/30 transition flex items-center justify-center gap-2"
              >
                <Calendar size={18} /> Request a Viewing
              </button>
              <button className="mt-2.5 w-full py-3.5 rounded-xl bg-[#0F253B] text-white font-bold hover:brightness-125 transition flex items-center justify-center gap-2">
                <Mail size={18} /> Contact Operator
              </button>
              <p className="mt-4 text-center text-[11px] text-gray-400 flex items-center justify-center gap-1.5">
                <ShieldCheck size={13} /> Verified listing · Deposit protected
              </p>
            </div>
          </div>
        </div>

        {/* ============================ CONTENT GRID ============================ */}
        <div className="grid lg:grid-cols-3 gap-6 mt-8">
          {/* LEFT / main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Property details */}
            <Section title="Property Details">
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3.5">
                <Row label="Tenant Type" value={PROPERTY.tenantType} />
                <Row label="Gender Preference" value={PROPERTY.genderPref} />
                <Row label="Age Preference" value={PROPERTY.agePref} />
                <Row label="Monthly Rent" value={`${PROPERTY.monthlyRent}${PROPERTY.rentPeriod}`} />
                <Row label="Deposit Required" value={PROPERTY.deposit} />
                <Row label="Room Type" value={PROPERTY.roomType} />
                <Row label="Furnished" value={PROPERTY.furnished} />
                <Row label="Property Type" value={PROPERTY.propertyType} />
                <Row label="Number of Rooms" value={String(PROPERTY.rooms)} />
                <Row label="Minimum Tenancy" value={PROPERTY.minTenancy} />
              </div>
            </Section>

            {/* House rules */}
            <Section title="House Rules">
              <div className="flex flex-wrap gap-2 mb-4">
                <RulePill ok={PROPERTY.petsAllowed} label={PROPERTY.petsAllowed ? "Pets allowed" : "No pets"} />
                <RulePill ok={PROPERTY.billsIncluded} label="Bills included" />
                <RulePill ok label="Professionals only" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Household lifestyle</p>
              <div className="flex flex-wrap gap-2">
                {HOUSE_LIFESTYLE.map((l) => (
                  <span key={l} className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">{l}</span>
                ))}
              </div>
            </Section>

            {/* Current housemates */}
            <Section title="Current Housemates">
              <div className="grid sm:grid-cols-2 gap-4">
                {HOUSEMATES.map((h) => (
                  <div key={h.name} className="flex gap-4 p-4 rounded-2xl border border-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img(h.seed, 200, 200)} alt={h.name} className="w-16 h-16 rounded-full object-cover shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold">{h.name}</p>
                      <p className="text-xs text-gray-500 font-medium">{h.gender} · {h.age} · {h.job}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {h.interests.map((i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full bg-[#F47C3C]/10 text-[#F47C3C] text-[10px] font-bold">{i}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Room information */}
            <Section title="Room Information">
              <div className="grid sm:grid-cols-3 gap-4 mb-4">
                <MiniStat icon={Ruler} label="Size" value={ROOM_INFO.size} />
                <MiniStat icon={MapPin} label="Location" value={ROOM_INFO.location} />
                <MiniStat icon={Bed} label="Occupancy" value={ROOM_INFO.occupancy} />
              </div>
              <ul className="grid sm:grid-cols-2 gap-2">
                {ROOM_INFO.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check size={16} className="text-[#F47C3C] shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </Section>

            {/* About this home */}
            <Section title="About This Home">
              <p className="text-sm text-gray-600 leading-relaxed">{ABOUT}</p>
            </Section>

            {/* Map */}
            <Section title="Map & Location">
              <div className="rounded-2xl overflow-hidden border border-gray-100">
                <iframe
                  title="Property location"
                  className="w-full h-72"
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${PROPERTY.lon - 0.01}%2C${PROPERTY.lat - 0.005}%2C${PROPERTY.lon + 0.01}%2C${PROPERTY.lat + 0.005}&layer=mapnik&marker=${PROPERTY.lat}%2C${PROPERTY.lon}`}
                />
              </div>
              <p className="mt-3 text-xs text-gray-400">
                Old Street station (Northern line) · 6 min walk · Buses to the City & West End nearby.
              </p>
            </Section>

            {/* Home amenities */}
            <Section title="Home Amenities">
              <AmenityGrid items={HOME_AMENITIES} />
            </Section>

            {/* Room amenities */}
            <Section title="Room Amenities">
              <AmenityGrid items={ROOM_AMENITIES} />
            </Section>
          </div>

          {/* RIGHT / operator column */}
          <div className="space-y-6">
            <div className="lg:sticky lg:top-24 space-y-6">
              {/* Operator */}
              <Section title="Operator">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(OPERATOR.seed, 120, 120)} alt={OPERATOR.name} className="w-14 h-14 rounded-xl object-cover" />
                  <div>
                    <p className="font-bold">{OPERATOR.name}</p>
                    <p className="text-xs text-gray-500">{OPERATOR.tagline}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3 text-sm">
                  <span className="inline-flex items-center gap-1 font-bold">
                    <Star size={14} className="fill-[#F47C3C] text-[#F47C3C]" /> {OPERATOR.rating}
                  </span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500">{OPERATOR.reviews} reviews</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500">{OPERATOR.listings} listings</span>
                </div>
                <div className="mt-4 space-y-2 text-sm text-gray-600">
                  <p className="flex items-center gap-2"><Phone size={15} className="text-[#F47C3C]" /> {OPERATOR.phone}</p>
                  <p className="flex items-center gap-2"><Mail size={15} className="text-[#F47C3C]" /> {OPERATOR.email}</p>
                </div>
                <button className="mt-4 w-full py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-[#0F253B] hover:bg-gray-50 transition flex items-center justify-center gap-2">
                  View all listings <ArrowRight size={15} />
                </button>
              </Section>
            </div>
          </div>
        </div>

        {/* ============================ OTHER ROOMS ============================ */}
        <SectionHeading title="Other Available Rooms in This Property" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {OTHER_ROOMS.map((r) => (
            <Link key={r.id} href={`/property/${r.id}`} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition">
              <div className="relative h-44">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img(r.seed, 600, 400)} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                <span className="absolute top-3 right-3 px-3 py-1 rounded-full text-[11px] font-bold bg-white/90 text-[#0F253B]">{r.status}</span>
              </div>
              <div className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold">{r.title}</p>
                  <p className="text-sm text-gray-400">{PROPERTY.name}</p>
                </div>
                <p className="font-extrabold text-[#0F253B]">{r.price}<span className="text-[11px] text-gray-400">/mo</span></p>
              </div>
            </Link>
          ))}
        </div>

        {/* ============================ SIMILAR ============================ */}
        <SectionHeading title="Similar Properties from Urban Nest" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-4">
          {SIMILAR.map((p) => (
            <Link key={p.id} href={`/property/${p.id}`} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition">
              <div className="relative h-44">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img(p.seed, 600, 400)} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
              </div>
              <div className="p-4">
                <p className="font-bold">{p.title}</p>
                <p className="flex items-center gap-1 text-sm text-gray-400 mt-0.5"><MapPin size={13} /> {p.location}</p>
                <p className="mt-2 font-extrabold text-[#0F253B]">{p.price}<span className="text-[11px] text-gray-400">/room · mo</span></p>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* ============================ FOOTER CTA ============================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="rounded-3xl bg-[#0F253B] text-white px-8 py-10 md:px-12 flex flex-col md:flex-row items-center justify-between gap-5">
          <div>
            <h2 className="text-2xl font-extrabold">Interested in {PROPERTY.name}?</h2>
            <p className="text-white/70 mt-1">Arrange a viewing or contact the operator — it only takes a minute.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowViewing(true)} className="px-6 py-3.5 rounded-xl bg-[#F47C3C] text-white font-bold hover:brightness-105 transition whitespace-nowrap">
              Request a Viewing
            </button>
            <Link href="/#properties" className="px-6 py-3.5 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/15 transition whitespace-nowrap">
              Keep browsing
            </Link>
          </div>
        </div>
      </section>

      {/* ============================ VIEWING MODAL ============================ */}
      {showViewing && <ViewingModal onClose={() => setShowViewing(false)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function Section({ title, children }) {
  return (
    <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-lg font-bold mb-4">{title}</h2>
      {children}
    </section>
  );
}

function SectionHeading({ title }) {
  return <h2 className="text-2xl font-extrabold mt-10 mb-5">{title}</h2>;
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-50 pb-1.5">
      <span className="text-gray-400 font-medium">{label}</span>
      <span className="font-bold text-[#0F253B] text-right">{value}</span>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <div className="w-9 h-9 rounded-xl bg-white text-[#F47C3C] flex items-center justify-center mb-2">
        <Icon size={18} />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="font-bold text-sm mt-0.5">{value}</p>
    </div>
  );
}

function AmenityGrid({ items }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {items.map((a) => (
        <div key={a} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-gray-50 text-sm font-semibold text-gray-700">
          <span className="w-5 h-5 rounded-full bg-[#F47C3C]/10 text-[#F47C3C] flex items-center justify-center shrink-0">
            <Check size={12} />
          </span>
          {a}
        </div>
      ))}
    </div>
  );
}

function RulePill({ ok, label }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
      {ok ? <Check size={13} /> : <X size={13} />} {label}
    </span>
  );
}

function ShareButtons({ onShare }) {
  const btn = "w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-[#0F253B] transition";
  return (
    <div className="flex items-center gap-1.5">
      <span className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-gray-400 mr-1"><Share2 size={14} /> Share</span>
      <button onClick={() => onShare("facebook")} className={btn} aria-label="Share on Facebook"><span className="font-black text-sm">f</span></button>
      <button onClick={() => onShare("twitter")} className={btn} aria-label="Share on Twitter"><span className="font-black text-sm">𝕏</span></button>
      <button onClick={() => onShare("email")} className={btn} aria-label="Share by Email"><Mail size={16} /></button>
      <button onClick={() => onShare("link")} className={btn} aria-label="Copy link"><Link2 size={16} /></button>
    </div>
  );
}

function ViewingModal({ onClose }) {
  const [sent, setSent] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    setSent(true);
    toast.success("Viewing request sent! The operator will be in touch.");
    setTimeout(onClose, 900);
  };

  const field = "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none text-sm font-medium";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold">Request a Viewing</h3>
            <p className="text-sm text-gray-400">{PROPERTY.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
        </div>

        {sent ? (
          <div className="py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <Check size={28} />
            </div>
            <p className="font-bold">Request sent!</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input className={field} placeholder="Full name" required />
            <input type="email" className={field} placeholder="Email address" required />
            <input type="tel" className={field} placeholder="Phone number" />
            <div className="grid grid-cols-2 gap-3">
              <input type="date" className={field} required />
              <select className={field} defaultValue="">
                <option value="" disabled>Preferred time</option>
                <option>Morning</option>
                <option>Afternoon</option>
                <option>Evening</option>
              </select>
            </div>
            <textarea className={field} rows={3} placeholder="Message (optional)" />
            <button type="submit" className="w-full py-3.5 rounded-xl bg-[#F47C3C] text-white font-bold hover:brightness-105 transition">
              Send Request
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
