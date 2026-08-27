"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Building2,
  Clock,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  PencilLine,
  Zap,
} from "lucide-react";
import api from "../../api/api";
import PublicPropertyForm from "../../Components/PublicPropertyForm";
import PropertyCsvImport from "../../Components/PropertyCsvImport";

// ---------------------------------------------------------------------------
// /list-property/<organization>
//
// The public page a letting agent or landlord lands on when an organization
// invites them to list a property. The organization is resolved from the slug
// in the URL — that slug is the ONLY thing tying the property to an
// organization, so a wrong or unknown one has to fail loudly rather than fall
// back to some default.
//
// No sign-in, and no review queue: whatever is sent from here becomes a live
// property immediately, so the link itself is the access control.
// ---------------------------------------------------------------------------

const PERKS = [
  {
    icon: Clock,
    title: "Takes about ten minutes",
    body: "Your progress is saved in this browser as you go, so you can finish it later.",
  },
  {
    icon: KeyRound,
    title: "Owner details included",
    body: "Tell us who owns the property and how they want to be paid — it saves a round of emails.",
  },
  {
    icon: Zap,
    title: "Live as soon as you send it",
    body: "No waiting on a review - the property goes onto their books straight away.",
  },
];

export default function ListPropertyPage() {
  const { org } = useParams();
  const slug = Array.isArray(org) ? org[0] : org;

  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // "form" for one property at a time, "csv" for a whole portfolio at once.
  const [mode, setMode] = useState("form");

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get(`/public/organizations/${encodeURIComponent(slug)}`);
        if (!cancelled) setOrganization(res.data?.data || null);
      } catch (err) {
        console.error("Organization lookup failed:", err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={28} className="mx-auto text-[#F47C3C] animate-spin" />
          <p className="mt-3 text-sm font-medium text-gray-400">Loading the form…</p>
        </div>
      </div>
    );
  }

  if (notFound || !organization) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-8 max-w-md text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto">
            <Building2 size={24} />
          </div>
          <h1 className="text-lg font-bold text-[#0F253B]">
            We couldn&apos;t find that agency
          </h1>
          <p className="text-sm text-gray-500 font-medium">
            The link may be out of date, or the name in it may have changed. Ask
            whoever sent it to you for a fresh link.
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 bg-[#0F253B] text-white text-sm font-bold rounded-xl hover:bg-[#183a5a] transition-all"
          >
            Go to the homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F253B]">
      {/* Branded header — the agent needs to see who they are submitting to. */}
      <header className="bg-[#0F253B] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex items-center gap-3">
            {organization.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={organization.logo}
                alt={organization.name}
                className="w-11 h-11 rounded-xl object-cover bg-white/10"
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-[#F47C3C] flex items-center justify-center">
                <Building2 size={20} />
              </div>
            )}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                {organization.type === "LANDLORD" ? "Landlord" : "Letting agency"}
              </p>
              <p className="font-bold leading-tight">
                {organization.name || "Property management"}
              </p>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold mt-6">
            List a property with {organization.name || "us"}
          </h1>
          <p className="text-sm text-white/60 font-medium mt-2 max-w-xl">
            Send us the property, its owner and its rooms — photos, amenities,
            rent and paperwork. It goes onto their books straight away.
          </p>

          <div className="grid sm:grid-cols-3 gap-3 mt-7">
            {PERKS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-white/5 rounded-2xl p-4">
                <Icon size={18} className="text-[#F47C3C]" />
                <p className="text-xs font-bold mt-2">{title}</p>
                <p className="text-[11px] text-white/50 font-medium mt-1 leading-relaxed">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        {/* One property at a time, or a spreadsheet of them. */}
        <div className="bg-white border border-gray-100 rounded-2xl p-2 flex gap-2">
          {[
            ["form", "Fill in the form", PencilLine, "One property"],
            ["csv", "Import a CSV", FileSpreadsheet, "A whole portfolio"],
          ].map(([key, label, Icon, hint]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                mode === key
                  ? "bg-[#0F253B] text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <Icon size={18} className={mode === key ? "text-[#F47C3C]" : ""} />
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{label}</p>
                <p
                  className={`text-[10px] font-medium truncate ${
                    mode === key ? "text-white/50" : "text-gray-400"
                  }`}
                >
                  {hint}
                </p>
              </div>
            </button>
          ))}
        </div>

        {mode === "form" ? (
          <PublicPropertyForm slug={slug} organization={organization} />
        ) : (
          <PropertyCsvImport slug={slug} organization={organization} />
        )}
      </main>

      <footer className="max-w-4xl mx-auto px-4 sm:px-6 pb-10">
        <p className="text-[11px] text-gray-400 font-medium text-center">
          Submitted through PMS on behalf of {organization.name || "the agency"}
          {organization.phone ? ` · ${organization.phone}` : ""}
        </p>
      </footer>
    </div>
  );
}
