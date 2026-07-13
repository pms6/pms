"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "react-toastify";
import {
  Building2,
  MapPin,
  Calendar,
  Check,
  X,
  ArrowLeft,
  ArrowRight,
  Home,
  Bed,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogIn,
  DoorOpen,
  ShieldAlert,
} from "lucide-react";
import api from "../../api/api";
import { useAuth } from "../../Context/AuthContext";
import {
  RENTAL_TYPE_LABEL,
  isHmo,
  propertyImage,
  roomImage,
  propertyLocation,
  formatMoney,
} from "../../utils/listings";

const FALLBACK = (seed) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed || "pms")}/1200/800`;

export default function PropertyDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activePhoto, setActivePhoto] = useState(0);
  // enquiry === null → closed. { room } → open (room may be null for whole property).
  const [enquiry, setEnquiry] = useState(null);
  // True when the signed-in tenant already has an application in review, in
  // which case they can't request other properties — buttons are disabled.
  const [reviewLock, setReviewLock] = useState(false);

  // Look up the tenant's onboarding to know if they're locked out of requesting.
  useEffect(() => {
    if (user?.role !== "tenant") return;
    let active = true;
    (async () => {
      try {
        const res = await api.get("/onboarding/me");
        const items = res.data?.data || [];
        if (active) setReviewLock(items.some((o) => (o.stageIndex ?? 0) >= 1));
      } catch {
        /* non-blocking — leave requests enabled if this fails */
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      try {
        const res = await api.get(`/public/properties/${id}`);
        if (active) setProperty(res.data?.data || null);
      } catch (err) {
        if (active) {
          setError(
            err.response?.status === 404
              ? "This listing is no longer available."
              : "Could not load this property. Please try again shortly."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  // Gallery = cover + gallery images + any room images (deduped).
  const photos = useMemo(() => {
    if (!property) return [];
    const urls = [
      property.coverImage,
      ...(property.gallery || []),
      ...(property.rooms || []).map((r) => r.images?.[0]?.url),
    ].filter(Boolean);
    const unique = [...new Set(urls)];
    return unique.length ? unique : [FALLBACK(property.propertyCode || property._id)];
  }, [property]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#F47C3C]" size={36} />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-[#0F253B] flex flex-col items-center justify-center px-6 text-center">
        <Building2 className="text-gray-300 mb-4" size={48} />
        <h1 className="text-2xl font-extrabold">{error || "Property not found"}</h1>
        <Link
          href="/#properties"
          className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#F47C3C] text-white font-bold"
        >
          <ArrowLeft size={16} /> Back to listings
        </Link>
      </div>
    );
  }

  const hmo = isHmo(property);
  const rooms = property.rooms || [];
  const typeLabel = RENTAL_TYPE_LABEL[property.rentalType] || property.rentalType;
  const priceLabel = property.minRent != null ? formatMoney(property.minRent) : null;
  const pricePeriod = hmo ? "/room · mo" : "/mo";

  const nextPhoto = () => setActivePhoto((i) => (i + 1) % photos.length);
  const prevPhoto = () => setActivePhoto((i) => (i - 1 + photos.length) % photos.length);

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
          <Link
            href="/#properties"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#0F253B] transition"
          >
            <ArrowLeft size={16} /> Back to listings
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        {/* ============================ TOP SUMMARY ============================ */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <p className="flex items-center gap-1.5 text-sm text-gray-500 font-medium">
              <MapPin size={15} className="text-[#F47C3C]" /> {propertyLocation(property)}
            </p>
            <h1 className="text-3xl md:text-4xl font-extrabold mt-1.5">{property.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0F253B] text-white text-[11px] font-bold">
                {typeLabel}
              </span>
              {priceLabel && (
                <span className="text-2xl font-extrabold text-[#0F253B]">
                  {hmo && <span className="text-sm font-medium text-gray-400">from </span>}
                  {priceLabel}
                  <span className="text-sm font-medium text-gray-400">{pricePeriod}</span>
                </span>
              )}
              {hmo && property.roomStats?.available > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold">
                  <DoorOpen size={12} /> {property.roomStats.available} rooms available
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ============================ GALLERY + BOOKING ============================ */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Media */}
          <div className="lg:col-span-2">
            <div className="relative rounded-3xl overflow-hidden bg-gray-100 aspect-[16/10] shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photos[activePhoto]} alt={property.name} className="w-full h-full object-cover" />
              {photos.length > 1 && (
                <>
                  <button
                    onClick={prevPhoto}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow hover:bg-white"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={nextPhoto}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow hover:bg-white"
                  >
                    <ChevronRight size={20} />
                  </button>
                  <span className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-black/60 text-white text-xs font-bold">
                    {activePhoto + 1} / {photos.length}
                  </span>
                </>
              )}
            </div>

            {photos.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {photos.map((src, i) => (
                  <button
                    key={src + i}
                    onClick={() => setActivePhoto(i)}
                    className={`relative rounded-xl overflow-hidden shrink-0 w-24 h-16 ring-2 transition ${
                      i === activePhoto ? "ring-[#F47C3C]" : "ring-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="thumb" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Booking / request card */}
          <div>
            <div className="lg:sticky lg:top-24 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
              {priceLabel ? (
                <p className="text-3xl font-extrabold">
                  {hmo && <span className="text-sm font-medium text-gray-400">from </span>}
                  {priceLabel}
                  <span className="text-sm font-medium text-gray-400">{pricePeriod}</span>
                </p>
              ) : (
                <p className="text-xl font-extrabold text-gray-400">Enquire for price</p>
              )}

              <div className="mt-4 space-y-2.5 text-sm">
                <Row label="Property type" value={typeLabel} />
                {hmo && <Row label="Total rooms" value={String(property.roomStats?.total ?? 0)} />}
                {hmo && <Row label="Rooms available" value={String(property.roomStats?.available ?? 0)} />}
                {property.tenantType && <Row label="Tenant type" value={titleCase(property.tenantType)} />}
                {property.operator?.name && <Row label="Managed by" value={property.operator.name} />}
              </div>

              {reviewLock && (
                <div className="mt-5 rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs font-semibold text-amber-700">
                  Your application is already in review, so you can&apos;t request other properties right now.
                </div>
              )}
              <button
                onClick={() => setEnquiry({ room: null })}
                disabled={reviewLock}
                title={reviewLock ? "Your application is already in review" : undefined}
                className="mt-3 w-full py-3.5 rounded-xl bg-[#F47C3C] text-white font-bold hover:brightness-105 shadow-lg shadow-[#F47C3C]/30 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <Calendar size={18} /> Request a Viewing
              </button>
              <p className="mt-4 text-center text-[11px] text-gray-400 flex items-center justify-center gap-1.5">
                <ShieldCheck size={13} /> Verified listing · Sign in required to enquire
              </p>
            </div>
          </div>
        </div>

        {/* ============================ CONTENT ============================ */}
        <div className="grid lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2 space-y-6">
            {property.description && (
              <Section title="About This Property">
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {property.description}
                </p>
              </Section>
            )}

            <Section title="Property Details">
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3.5">
                <Row label="Property Type" value={typeLabel} />
                {property.tenantType && <Row label="Tenant Type" value={titleCase(property.tenantType)} />}
                {property.propertyCode && <Row label="Reference" value={property.propertyCode} />}
                {hmo && <Row label="Number of Rooms" value={String(property.roomStats?.total ?? 0)} />}
                {priceLabel && <Row label={hmo ? "Rooms from" : "Monthly Rent"} value={`${priceLabel}${pricePeriod}`} />}
                <Row label="Location" value={propertyLocation(property)} />
              </div>
            </Section>

            {/* Map */}
            {property.location?.lat != null && property.location?.lng != null && (
              <Section title="Map & Location">
                <div className="rounded-2xl overflow-hidden border border-gray-100">
                  <iframe
                    title="Property location"
                    className="w-full h-72"
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${property.location.lng - 0.01}%2C${property.location.lat - 0.005}%2C${property.location.lng + 0.01}%2C${property.location.lat + 0.005}&layer=mapnik&marker=${property.location.lat}%2C${property.location.lng}`}
                  />
                </div>
              </Section>
            )}
          </div>

          {/* Operator column */}
          <div className="space-y-6">
            {property.operator && (
              <div className="lg:sticky lg:top-24">
                <Section title="Operator">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={property.operator.logo || FALLBACK(property.operator.name)}
                      alt={property.operator.name}
                      className="w-14 h-14 rounded-xl object-cover"
                    />
                    <div>
                      <p className="font-bold">{property.operator.name}</p>
                      <p className="text-xs text-gray-500">
                        {property.operator.type === "AGENCY" ? "Letting agency" : "Landlord"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEnquiry({ room: null })}
                    disabled={reviewLock}
                    title={reviewLock ? "Your application is already in review" : undefined}
                    className="mt-4 w-full py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-[#0F253B] hover:bg-gray-50 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Contact operator <ArrowRight size={15} />
                  </button>
                </Section>
              </div>
            )}
          </div>
        </div>

        {/* ============================ ROOMS (HMO) ============================ */}
        {hmo && (
          <>
            <SectionHeading title="Available Rooms in This Property" />
            {rooms.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-400">
                No rooms are currently available in this property.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {rooms.map((r) => (
                  <div
                    key={r._id}
                    className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl transition flex flex-col"
                  >
                    <div className="relative h-44">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={roomImage(r)} alt={r.title || r.roomName} className="w-full h-full object-cover" />
                      <span className="absolute top-3 right-3 px-3 py-1 rounded-full text-[11px] font-bold bg-white/90 text-[#0F253B]">
                        {r.status === "AVAILABLE_SOON" ? "Available soon" : "Available now"}
                      </span>
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold">{r.title || r.roomName}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <Bed size={13} /> {titleCase(r.roomType || "Room")} · {titleCase(r.occupancy || "")}
                          </p>
                        </div>
                        <p className="font-extrabold text-[#0F253B] whitespace-nowrap">
                          {formatMoney(r.monthlyRent)}
                          <span className="text-[11px] text-gray-400">/mo</span>
                        </p>
                      </div>
                      <button
                        onClick={() => setEnquiry({ room: r })}
                        disabled={reviewLock}
                        title={reviewLock ? "Your application is already in review" : undefined}
                        className="mt-4 w-full py-2.5 rounded-xl bg-[#0F253B] text-white text-sm font-bold hover:brightness-125 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Calendar size={15} /> Request this room
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* ============================ FOOTER CTA ============================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <div className="rounded-3xl bg-[#0F253B] text-white px-8 py-10 md:px-12 flex flex-col md:flex-row items-center justify-between gap-5">
          <div>
            <h2 className="text-2xl font-extrabold">Interested in {property.name}?</h2>
            <p className="text-white/70 mt-1">
              Send a viewing request — it only takes a minute.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setEnquiry({ room: null })}
              disabled={reviewLock}
              title={reviewLock ? "Your application is already in review" : undefined}
              className="px-6 py-3.5 rounded-xl bg-[#F47C3C] text-white font-bold hover:brightness-105 transition whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Request a Viewing
            </button>
            <Link
              href="/#properties"
              className="px-6 py-3.5 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/15 transition whitespace-nowrap"
            >
              Keep browsing
            </Link>
          </div>
        </div>
      </section>

      {/* ============================ ENQUIRY MODAL ============================ */}
      {enquiry && (
        <EnquiryModal
          property={property}
          room={enquiry.room}
          onClose={() => setEnquiry(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Enquiry modal — sign-in gated                                       */
/* ------------------------------------------------------------------ */

function EnquiryModal({ property, room, onClose }) {
  const { user, profile, loading } = useAuth();
  // Prefill from the signed-in user's account. The modal only mounts on click,
  // by which point auth has hydrated, so a lazy initializer is enough.
  const [form, setForm] = useState(() => ({
    name:
      [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
      user?.name ||
      "",
    email: user?.email || "",
    phone: "",
    preferredDate: "",
    preferredTime: "",
    message: "",
  }));
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const field =
    "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none text-sm font-medium";

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/public/enquiries", {
        propertyId: property._id,
        roomId: room?._id,
        name: form.name,
        email: form.email,
        phone: form.phone,
        preferredDate: form.preferredDate,
        preferredTime: form.preferredTime,
        message: form.message,
      });
      setSent(true);
      toast.success("Request sent! The operator will be in touch.");
      setTimeout(onClose, 1200);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not send your request.");
    } finally {
      setSubmitting(false);
    }
  };

  const title = room ? `${room.title || room.roomName}` : property.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold">Request a Viewing</h3>
            <p className="text-sm text-gray-400">{title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="animate-spin text-[#F47C3C]" size={28} />
          </div>
        ) : !user ? (
          /* ---------- Sign-in gate ---------- */
          <div className="py-6 text-center">
            <div className="w-14 h-14 rounded-full bg-[#F47C3C]/10 text-[#F47C3C] flex items-center justify-center mx-auto mb-4">
              <LogIn size={26} />
            </div>
            <p className="font-bold text-lg">Sign in to continue</p>
            <p className="text-sm text-gray-500 mt-1">
              You need an account to send a viewing request. It only takes a moment.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link
                href="/login"
                className="w-full py-3.5 rounded-xl bg-[#F47C3C] text-white font-bold hover:brightness-105 transition flex items-center justify-center gap-2"
              >
                <LogIn size={18} /> Sign in
              </Link>
              <Link
                href="/signup"
                className="w-full py-3.5 rounded-xl border border-gray-200 text-[#0F253B] font-bold hover:bg-gray-50 transition"
              >
                Create an account
              </Link>
            </div>
          </div>
        ) : user.role !== "tenant" ? (
          /* ---------- Tenant-only gate ---------- */
          <div className="py-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert size={26} />
            </div>
            <p className="font-bold text-lg">Tenant account required</p>
            <p className="text-sm text-gray-500 mt-1">
              You&apos;re signed in as an operator account. Only tenant accounts can send
              viewing requests. Sign in with a tenant account to enquire.
            </p>
            <button
              onClick={onClose}
              className="mt-6 w-full py-3.5 rounded-xl border border-gray-200 text-[#0F253B] font-bold hover:bg-gray-50 transition"
            >
              Close
            </button>
          </div>
        ) : sent ? (
          /* ---------- Success ---------- */
          <div className="py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <Check size={28} />
            </div>
            <p className="font-bold">Request sent!</p>
            <p className="text-sm text-gray-500 mt-1">The operator will contact you shortly.</p>
          </div>
        ) : (
          /* ---------- Form ---------- */
          <form onSubmit={submit} className="space-y-3">
            <input
              className={field}
              placeholder="Full name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              type="email"
              className={field}
              placeholder="Email address"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              type="tel"
              className={field}
              placeholder="Phone number"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                className={field}
                value={form.preferredDate}
                onChange={(e) => setForm({ ...form, preferredDate: e.target.value })}
              />
              <select
                className={field}
                value={form.preferredTime}
                onChange={(e) => setForm({ ...form, preferredTime: e.target.value })}
              >
                <option value="">Preferred time</option>
                <option>Morning</option>
                <option>Afternoon</option>
                <option>Evening</option>
              </select>
            </div>
            <textarea
              className={field}
              rows={3}
              placeholder="Message (optional)"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-[#F47C3C] text-white font-bold hover:brightness-105 disabled:opacity-70 transition flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : "Send Request"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function titleCase(s) {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

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
