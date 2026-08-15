"use client";

import { useState, useEffect } from "react";
import {
  Search, Mail, Phone, MapPin, UserRound, Home, Briefcase,
  ShieldCheck, FileText, X, PoundSterling, CalendarClock, CheckCircle2,
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

const fmtDate = (d) => {
  if (!d) return "";
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime())
    ? String(d) // some onboarding dates are free-text strings
    : parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const initials = (n) =>
  n ? n.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "?";

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

const apiService = {
  async getOnboardings() {
    try {
      const response = await api.get("/onboarding");
      return response.data;
    } catch (error) {
      console.error("Get onboardings error:", error);
      throw error.response?.data || error;
    }
  },
};

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

function Section({ title, children }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C] mb-4">{title}</p>
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

// Everything on record for one completed onboarding.
function TenantDetail({ tenant, onClose }) {
  const { employment, rightToRent, references, guarantor, tenancy, depositScheme, documents } = tenant;
  // Screening answers from the website request form, carried over from the lead.
  const a = tenant.applicantDetails;
  const hasApplicantDetails =
    a && Object.values(a).some((v) => v !== null && v !== undefined && v !== "");

  return (
    <div className="space-y-4">
      {/* Identity */}
      <div className="bg-gray-50 border border-gray-100 rounded-3xl p-5">
        <div className="flex items-start gap-4">
          <Avatar src={tenant.profileImage} name={tenant.name} size={64} rounded="rounded-2xl" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-[#0F253B] truncate">{tenant.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge tone="green">Onboarding complete</Badge>
              {tenancy?.property && tenancy.property !== "—" && (
                <Badge tone="gray">{tenancy.property}</Badge>
              )}
            </div>
            <p className="text-xs text-gray-400 font-medium mt-2">
              Completed {fmtDate(tenant.completedAt)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 shrink-0" title="Close">
            <X size={20} />
          </button>
        </div>
      </div>

      <Section title="Contact">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Info label="Email" value={tenant.email} icon={Mail} />
          <Info label="Phone" value={tenant.phone} icon={Phone} />
          <Info label="Date of birth" value={fmtDate(tenant.dob)} />
          <Info label="Nationality" value={tenant.nationality} />
          <Info label="Previous address" value={tenant.currentAddress} icon={MapPin} />
        </div>
      </Section>

      {hasApplicantDetails && (
        <Section title="Applicant details (from request)">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Info label="Age" value={a.age} />
            <Info label="Gender" value={a.gender} />
            <Info label="Nationality" value={a.nationality} />
            <Info label="Move-in date" value={fmtDate(a.moveInDate)} icon={CalendarClock} />
            <Info label="Single or couple" value={a.occupancy} />
            <Info label="Work status" value={a.workStatus} />
            <Info
              label="Minimum stay"
              value={a.minimumStayMonths ? `${a.minimumStayMonths} months` : ""}
            />
            <Info label="Smoking" value={a.smoking} />
            <Info label="Pet" value={a.pet} />
          </div>
        </Section>
      )}

      <Section title="Tenancy">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Info label="Property" value={tenancy?.property} icon={Home} />
          <Info label="Room" value={tenancy?.room} />
          <Info
            label="Rent"
            value={tenancy?.rent ? `${formatMoney(tenancy.rent)} ${tenancy.frequency || "monthly"}` : ""}
            icon={PoundSterling}
          />
          <Info label="Deposit" value={tenancy?.deposit ? formatMoney(tenancy.deposit) : ""} />
          <Info label="Start date" value={fmtDate(tenancy?.startDate)} icon={CalendarClock} />
          <Info label="Term" value={tenancy?.termMonths ? `${tenancy.termMonths} months` : ""} />
          <Info
            label="Holding deposit"
            value={tenant.holdingDeposit ? formatMoney(tenant.holdingDeposit) : ""}
          />
        </div>
      </Section>

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
    </div>
  );
}

/**
 * Tenants — everyone whose onboarding has been completed (i.e. they moved in).
 * Reads GET /onboarding and filters on completedAt, so no new endpoint is
 * needed: a completed onboarding carries the full tenant record.
 */
export default function TenantsBoard() {
  const [tenants, setTenants] = useState([]);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiService.getOnboardings();
        if (cancelled) return;
        // Only completed onboardings — anyone still in the pipeline is an
        // applicant, and lives on the Onboarding page.
        setTenants((res.data || []).filter((o) => o.completedAt));
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load tenants");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const needle = q.trim().toLowerCase();
  const list = tenants.filter((t) => {
    if (!needle) return true;
    return (
      t.name?.toLowerCase().includes(needle) ||
      t.email?.toLowerCase().includes(needle) ||
      t.phone?.toLowerCase().includes(needle) ||
      t.tenancy?.property?.toLowerCase().includes(needle) ||
      t.tenancy?.room?.toLowerCase().includes(needle)
    );
  });

  const selected = tenants.find((t) => t._id === selectedId);
  const rentRoll = tenants.reduce((sum, t) => sum + (t.tenancy?.rent || 0), 0);

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Tenants" subtitle="Tenants who have completed onboarding" />
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
      <PageHeader title="Tenants" subtitle="Tenants who have completed onboarding" />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <p className="font-bold">Error loading tenants</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {!error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: CheckCircle2, label: "Onboarded tenants", value: tenants.length },
              { icon: PoundSterling, label: "Rent roll", value: rentRoll ? formatMoney(rentRoll) : "—" },
              {
                icon: FileText,
                label: "Documents on file",
                value: tenants.reduce((sum, t) => sum + (t.documents?.length || 0), 0),
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

          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email or property…"
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
            />
          </div>

          {list.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl">
              <p className="text-gray-500 font-medium">
                {tenants.length === 0 ? "No onboarded tenants yet" : "No tenants match your search"}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {tenants.length === 0
                  ? "Tenants appear here once their onboarding is completed at Move-in."
                  : "Try a different name, email or property."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-5 items-start">
              {/* Cards */}
              <div className="space-y-3">
                {list.map((t) => (
                  <button
                    key={t._id}
                    onClick={() => setSelectedId(t._id === selectedId ? null : t._id)}
                    className={`w-full text-left bg-white border rounded-2xl p-4 transition-all hover:shadow-md hover:-translate-y-0.5 ${t._id === selectedId ? "border-[#F47C3C] ring-2 ring-orange-100" : "border-gray-100"}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar src={t.profileImage} name={t.name} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[#0F253B] truncate">{t.name}</p>
                        <p className="text-xs text-gray-400 font-medium truncate">
                          {t.tenancy?.property && t.tenancy.property !== "—" ? t.tenancy.property : "No property"}
                          {t.tenancy?.room && t.tenancy.room !== "—" ? ` · ${t.tenancy.room}` : ""}
                        </p>
                      </div>
                      {t.tenancy?.rent ? (
                        <span className="text-sm font-bold text-[#0F253B] shrink-0">
                          {formatMoney(t.tenancy.rent)}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                      <Badge tone="green">Onboarded</Badge>
                      <span className="text-[11px] text-gray-400 font-medium truncate">
                        {fmtDate(t.completedAt)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Detail */}
              {selected ? (
                <TenantDetail tenant={selected} onClose={() => setSelectedId(null)} />
              ) : (
                <div className="hidden lg:flex flex-col items-center justify-center text-center bg-gray-50 rounded-3xl py-20 px-6">
                  <div className="w-12 h-12 rounded-2xl bg-white text-[#F47C3C] flex items-center justify-center mb-3">
                    <UserRound size={22} />
                  </div>
                  <p className="text-gray-500 font-medium">Click a tenant to see all their details</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Contact, tenancy, employment, checks, guarantor and documents.
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
