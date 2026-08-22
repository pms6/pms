"use client";

import { useState, useEffect } from "react";
import {
  Search, Mail, Phone, MapPin, UserRound, Home, Briefcase,
  ShieldCheck, FileText, X, PoundSterling, CalendarClock,
  BedDouble, Bath, Layers, Ruler, History, Clock, Users, DoorOpen,
  Building2, Link2Off,
} from "lucide-react";
import { PageHeader, Badge } from "../Shared/ui";
import { formatMoney } from "@/app/utils/listings";
import api from "@/app/api/api";

// Status → Badge tone, across right-to-rent, references, guarantor and deposit.
const CHECK_TONE = {
  verified: "green", passed: "green", approved: "green", protected: "green",
  pending: "amber", not_started: "gray", not_required: "gray", "n/a": "gray",
  failed: "red",
};

// The occupancy states the directory endpoint derives, plus an "all" catch-all.
const TABS = [
  { key: "current", label: "Current", icon: Users },
  { key: "past", label: "Past", icon: History },
  { key: "upcoming", label: "Upcoming", icon: Clock },
  { key: "all", label: "All", icon: UserRound },
];

const STATE_BADGE = {
  current: { label: "Current tenant", tone: "green" },
  past: { label: "Past tenant", tone: "gray" },
  upcoming: { label: "Moving in", tone: "amber" },
};

const fmtDate = (d) => {
  if (!d) return "";
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime())
    ? String(d) // some onboarding dates are free-text strings
    : parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const initials = (n) =>
  n ? n.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "?";

// Turn "SINGLE_LET" / "not_started" into "Single let" / "Not started".
const humanise = (v) =>
  !v ? "" : String(v).replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

// One line out of the Property.address sub-document.
const addressLine = (a) =>
  !a ? "" : [a.line1, a.line2, a.area, a.city, a.postcode].filter(Boolean).join(", ");

// Room rent is advertised per calendar month or per week — say which.
const rentLabel = (amount, period) =>
  amount || amount === 0
    ? `${formatMoney(amount)} ${String(period || "MONTHLY").toLowerCase() === "weekly" ? "weekly" : "monthly"}`
    : "";

// How long is left, or how long ago it ended. daysRemaining is null for a
// periodic tenancy, which has no end date to count to.
const termLabel = ({ daysRemaining }) => {
  if (daysRemaining === null || daysRemaining === undefined) return "";
  if (daysRemaining > 0) return `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`;
  if (daysRemaining === 0) return "Ends today";
  const gone = Math.abs(daysRemaining);
  return `Ended ${gone} day${gone === 1 ? "" : "s"} ago`;
};

/**
 * Profile photo, falling back to initials when the tenant has no account photo
 * or the image fails to load.
 */
function Avatar({ src, name, size = 44, rounded = "rounded-full" }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };

  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name}
        style={style}
        onError={() => setBroken(true)}
        className={`${rounded} object-cover shrink-0 bg-gray-100`}
      />
    );
  }

  return (
    <div
      style={style}
      className={`${rounded} bg-[#0F253B] text-white flex items-center justify-center font-bold shrink-0`}
    >
      {initials(name)}
    </div>
  );
}

function Info({ label, value, icon: Icon }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-sm font-bold text-[#0F253B] mt-0.5 flex items-center gap-1.5 break-words">
        {Icon && <Icon size={13} className="text-[#F47C3C] shrink-0" />}
        {value || "—"}
      </p>
    </div>
  );
}

function Section({ title, children, action }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C]">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function Check({ label, value }) {
  if (!value) return null;
  return (
    <span className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
      {label}
      <Badge tone={CHECK_TONE[value] || "gray"}>{String(value).replace(/_/g, " ")}</Badge>
    </span>
  );
}

/**
 * Shown when a tenancy predates the propertyId/roomId links and only the typed
 * name survives — explains the gap rather than rendering a grid of dashes.
 */
function UnlinkedNote({ what }) {
  return (
    <p className="flex items-start gap-2 text-xs font-medium text-gray-400 bg-gray-50 border border-gray-100 rounded-xl p-3">
      <Link2Off size={14} className="text-gray-300 shrink-0 mt-0.5" />
      This tenancy stores the {what} name as text only — it was created before
      records were linked, so there are no further details to show.
    </p>
  );
}

// Everything on record for one tenancy: who, where, and the onboarding file.
function TenantDetail({ row, onClose }) {
  const { property, room, tenancy, tenantProfile, onboarding } = row;
  const ob = onboarding || {};
  const { employment, rightToRent, references, guarantor, depositScheme, documents } = ob;
  const state = STATE_BADGE[row.occupancyState] || STATE_BADGE.current;

  return (
    <div className="space-y-4">
      {/* Identity */}
      <div className="bg-gray-50 border border-gray-100 rounded-3xl p-5">
        <div className="flex items-start gap-4">
          <Avatar src={row.profileImage} name={row.name} size={64} rounded="rounded-2xl" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-[#0F253B] truncate">{row.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge tone={state.tone}>{state.label}</Badge>
              <Badge tone="gray">{tenancy.status}</Badge>
              {ob.completedAt && <Badge tone="green">Onboarded</Badge>}
            </div>
            <p className="text-xs text-gray-400 font-medium mt-2">
              {tenancy.startDate ? `Moved in ${fmtDate(tenancy.startDate)}` : "No start date recorded"}
              {termLabel(tenancy) ? ` · ${termLabel(tenancy)}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 shrink-0" title="Close">
            <X size={20} />
          </button>
        </div>
      </div>

      <Section title="Contact">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Info label="Email" value={row.email} icon={Mail} />
          <Info label="Phone" value={row.phone} icon={Phone} />
          <Info label="Date of birth" value={fmtDate(ob.dob || tenantProfile?.birthdate)} />
          <Info label="Nationality" value={ob.nationality || tenantProfile?.nationality} />
          <Info label="Gender" value={tenantProfile?.gender} />
          <Info
            label="Occupation"
            value={[humanise(tenantProfile?.occupationType), tenantProfile?.jobTitle].filter(Boolean).join(" · ")}
            icon={Briefcase}
          />
          <Info label="Previous address" value={ob.currentAddress} icon={MapPin} />
        </div>
      </Section>

      {/* PROPERTY */}
      <Section
        title="Property"
        action={
          property.propertyCode ? (
            <span className="text-[10px] font-bold text-gray-400">{property.propertyCode}</span>
          ) : null
        }
      >
        {property.linked ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Info label="Name" value={property.name} icon={Home} />
              <Info label="Rental type" value={humanise(property.rentalType)} icon={Building2} />
              <Info label="Tenant type" value={humanise(property.tenantType)} />
              <Info label="Status" value={humanise(property.status)} />
            </div>
            {addressLine(property.address) && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <Info label="Address" value={addressLine(property.address)} icon={MapPin} />
              </div>
            )}
          </>
        ) : (
          <>
            <Info label="Property" value={property.name} icon={Home} />
            <div className="mt-3">
              <UnlinkedNote what="property" />
            </div>
          </>
        )}
      </Section>

      {/* ROOM */}
      <Section
        title="Room"
        action={
          room.roomNumber ? (
            <span className="text-[10px] font-bold text-gray-400">#{room.roomNumber}</span>
          ) : null
        }
      >
        {room.linked ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Info label="Room" value={room.roomName || room.roomLabel} icon={DoorOpen} />
              <Info label="Type" value={humanise(room.roomType)} icon={BedDouble} />
              <Info label="Occupancy" value={humanise(room.occupancy)} icon={Users} />
              <Info label="Bathroom" value={humanise(room.bathroomType)} icon={Bath} />
              <Info label="Floor" value={room.floor} icon={Layers} />
              <Info label="Size" value={room.roomSize} icon={Ruler} />
              <Info
                label="Furnished"
                value={room.furnished === undefined ? "" : room.furnished ? "Yes" : "No"}
              />
              <Info label="Room status" value={humanise(room.status)} />
              <Info
                label="Advertised rent"
                value={rentLabel(room.monthlyRent, room.rentPeriod)}
                icon={PoundSterling}
              />
              <Info
                label="Security deposit"
                value={room.securityDeposit ? formatMoney(room.securityDeposit) : ""}
                icon={ShieldCheck}
              />
              <Info label="Bills included" value={humanise(room.billsOption)} />
            </div>

            {room.roomAmenities?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Room amenities
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {room.roomAmenities.map((a) => (
                    <span key={a} className="text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                      {humanise(a)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <Info label="Unit" value={room.roomName} icon={DoorOpen} />
            <div className="mt-3">
              <UnlinkedNote what="room" />
            </div>
          </>
        )}
      </Section>

      {/* TENANCY TERMS */}
      <Section title="Tenancy">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Info label="Status" value={tenancy.status} />
          <Info label="Rent charged" value={tenancy.rent ? formatMoney(tenancy.rent) : ""} icon={PoundSterling} />
          <Info label="Start date" value={fmtDate(tenancy.startDate)} icon={CalendarClock} />
          <Info
            label={tenancy.fixedTermEnd ? "Fixed term ends" : "Periodic from"}
            value={fmtDate(tenancy.fixedTermEnd || tenancy.periodicStart)}
          />
          <Info label="Availability" value={tenancy.availability} />
          <Info label="Term length" value={tenancy.durationDays ? `${tenancy.durationDays} days` : ""} />
          <Info label="Onboarding invite" value={fmtDate(tenancy.invitedAt)} />
          <Info
            label="Holding deposit"
            value={ob.holdingDeposit ? formatMoney(ob.holdingDeposit) : ""}
          />
        </div>
        {tenancy.isDeleted && (
          <p className="mt-4 pt-4 border-t border-gray-100 text-xs font-bold text-red-500">
            This tenancy was removed{tenancy.deletedAt ? ` on ${fmtDate(tenancy.deletedAt)}` : ""}.
          </p>
        )}
      </Section>

      {/* Everything below comes from the onboarding file, which only exists for
          tenants taken through the onboarding pipeline. */}
      {onboarding ? (
        <>
          <Section title="Employment">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Info label="Employer" value={employment?.employer} icon={Briefcase} />
              <Info label="Job title" value={employment?.jobTitle} />
              <Info label="Type" value={employment?.type} />
              <Info
                label="Annual income"
                value={employment?.annualIncome ? formatMoney(employment.annualIncome) : ""}
              />
              <Info label="Started" value={fmtDate(employment?.startDate)} />
            </div>
          </Section>

          <Section title="Checks">
            <div className="flex flex-wrap gap-3">
              <Check label="Right to rent" value={rightToRent?.status} />
              <Check label="Previous landlord" value={references?.previousLandlord} />
              <Check label="Employer reference" value={references?.employer} />
              <Check label="Credit" value={references?.credit} />
              <Check label="Guarantor" value={guarantor?.status} />
              <Check label="Deposit" value={depositScheme?.status} />
            </div>

            {(rightToRent?.docType || rightToRent?.shareCode) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
                <Info label="ID document" value={rightToRent.docType} />
                <Info label="Document no." value={rightToRent.docNumber} />
                <Info label="Expires" value={fmtDate(rightToRent.expiry)} />
                <Info label="Share code" value={rightToRent.shareCode} />
              </div>
            )}

            {depositScheme?.provider && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
                <Info label="Deposit scheme" value={depositScheme.provider} icon={ShieldCheck} />
                <Info label="Scheme reference" value={depositScheme.ref} />
              </div>
            )}
          </Section>

          {guarantor?.name && (
            <Section title="Guarantor">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Info label="Name" value={guarantor.name} icon={UserRound} />
                <Info label="Relationship" value={guarantor.relationship} />
                <Info label="Phone" value={guarantor.phone} icon={Phone} />
                <Info
                  label="Annual income"
                  value={guarantor.annualIncome ? formatMoney(guarantor.annualIncome) : ""}
                />
                <Info label="Address" value={guarantor.address} icon={MapPin} />
              </div>
            </Section>
          )}

          <Section title={`Documents (${documents?.length || 0})`}>
            {documents?.length ? (
              <div className="space-y-2">
                {documents.map((d) => (
                  <div key={d._id || d.name} className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl p-3">
                    <div className="w-9 h-9 rounded-lg bg-white text-[#F47C3C] flex items-center justify-center shrink-0">
                      <FileText size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      {d.url ? (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-bold text-[#0F253B] truncate hover:text-[#F47C3C] block"
                        >
                          {d.name}
                        </a>
                      ) : (
                        <p className="text-sm font-bold text-[#0F253B] truncate">{d.name}</p>
                      )}
                      <p className="text-xs text-gray-400 font-medium">
                        {d.type || "Document"} · {fmtDate(d.uploadedAt)}
                      </p>
                    </div>
                    <Badge tone={CHECK_TONE[d.status] || "gray"}>{d.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 font-medium">No documents on file.</p>
            )}
          </Section>
        </>
      ) : (
        <Section title="Onboarding file">
          <p className="text-sm text-gray-400 font-medium">
            No onboarding record for this tenancy — it was added straight from
            Occupancy rather than taken through the onboarding pipeline, so there
            is no employment, referencing, guarantor or document history.
          </p>
        </Section>
      )}
    </div>
  );
}

/**
 * Tenants — every tenancy the organization has on record, current and past.
 *
 * Reads GET /tenancies/directory, which is keyed on Tenancy rather than
 * Onboarding. That matters: a tenant added straight from Occupancy has no
 * onboarding record, and the old onboarding-only view left them out entirely.
 * Each row arrives with the property, room, tenant profile and onboarding file
 * already resolved.
 */
export default function TenantsBoard() {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ total: 0, current: 0, past: 0, upcoming: 0, currentRentRoll: 0 });
  const [tab, setTab] = useState("current");
  const [q, setQ] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/tenancies/directory");
        if (cancelled) return;
        setRows(res.data?.data || []);
        setStats(res.data?.stats || {});
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || err.message || "Failed to load tenants");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Distinct properties across every tenancy, so the filter covers past ones too.
  const properties = [...new Set(rows.map((r) => r.property?.name).filter((n) => n && n !== "—"))].sort();

  const needle = q.trim().toLowerCase();
  const list = rows.filter((r) => {
    if (tab !== "all" && r.occupancyState !== tab) return false;
    if (propertyFilter && r.property?.name !== propertyFilter) return false;
    if (!needle) return true;
    return (
      r.name?.toLowerCase().includes(needle) ||
      r.email?.toLowerCase().includes(needle) ||
      r.phone?.toLowerCase().includes(needle) ||
      r.property?.name?.toLowerCase().includes(needle) ||
      r.property?.propertyCode?.toLowerCase().includes(needle) ||
      r.room?.roomName?.toLowerCase().includes(needle)
    );
  });

  const selected = rows.find((r) => r._id === selectedId);

  const counts = { ...stats, all: stats.total };

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Tenants" subtitle="Current and past tenants, with their property and room" />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#F47C3C] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-gray-600 font-medium">Loading tenants...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Tenants" subtitle="Current and past tenants, with their property and room" />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <p className="font-bold">Error loading tenants</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {!error && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: Users, label: "Current tenants", value: stats.current ?? 0 },
              { icon: History, label: "Past tenants", value: stats.past ?? 0 },
              { icon: Clock, label: "Moving in", value: stats.upcoming ?? 0 },
              {
                icon: PoundSterling,
                label: "Current rent roll",
                value: stats.currentRentRoll ? formatMoney(stats.currentRentRoll) : "—",
              },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#F47C3C] flex items-center justify-center shrink-0">
                  <s.icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{s.label}</p>
                  <p className="text-lg font-bold text-[#0F253B] truncate">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Current / Past / Upcoming / All */}
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); setSelectedId(null); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    active
                      ? "bg-[#0F253B] text-white"
                      : "bg-white border border-gray-100 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  <t.icon size={14} className={active ? "text-[#F47C3C]" : "text-gray-300"} />
                  {t.label}
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${active ? "bg-white/15" : "bg-gray-100"}`}>
                    {counts[t.key] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, email, property or room…"
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
              />
            </div>
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-xs font-bold text-[#0F253B] outline-none focus:ring-2 focus:ring-[#F47C3C] sm:w-56"
            >
              <option value="">All properties</option>
              {properties.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {list.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl">
              <p className="text-gray-500 font-medium">
                {rows.length === 0 ? "No tenancies yet" : "No tenants match this view"}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {rows.length === 0
                  ? "Tenants appear here once a tenancy is created, from Occupancy or from a completed onboarding."
                  : "Try another tab, property or search term."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-5 items-start">
              {/* Cards */}
              <div className="space-y-3">
                {list.map((r) => {
                  const state = STATE_BADGE[r.occupancyState] || STATE_BADGE.current;
                  const past = r.occupancyState === "past";
                  return (
                    <button
                      key={r._id}
                      onClick={() => setSelectedId(r._id === selectedId ? null : r._id)}
                      className={`w-full text-left bg-white border rounded-2xl p-4 transition-all hover:shadow-md hover:-translate-y-0.5 ${
                        r._id === selectedId ? "border-[#F47C3C] ring-2 ring-orange-100" : "border-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={past ? "opacity-60" : ""}>
                          <Avatar src={r.profileImage} name={r.name} size={44} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[#0F253B] truncate">{r.name}</p>
                          <p className="text-xs text-gray-400 font-medium truncate">
                            {r.property?.name && r.property.name !== "—" ? r.property.name : "No property"}
                            {r.room?.roomName && r.room.roomName !== "—" ? ` · ${r.room.roomName}` : ""}
                          </p>
                        </div>
                        {r.tenancy?.rent ? (
                          <span className="text-sm font-bold text-[#0F253B] shrink-0">
                            {formatMoney(r.tenancy.rent)}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                        <Badge tone={state.tone}>{state.label}</Badge>
                        <span className="text-[11px] text-gray-400 font-medium truncate">
                          {termLabel(r.tenancy) ||
                            (r.tenancy?.startDate ? fmtDate(r.tenancy.startDate) : r.tenancy?.status)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Detail */}
              {selected ? (
                <TenantDetail row={selected} onClose={() => setSelectedId(null)} />
              ) : (
                <div className="hidden lg:flex flex-col items-center justify-center text-center bg-gray-50 rounded-3xl py-20 px-6">
                  <div className="w-12 h-12 rounded-2xl bg-white text-[#F47C3C] flex items-center justify-center mb-3">
                    <UserRound size={22} />
                  </div>
                  <p className="text-gray-500 font-medium">Click a tenant to see all their details</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Contact, property, room, tenancy terms, employment, checks, guarantor and documents.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
