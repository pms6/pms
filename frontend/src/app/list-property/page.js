"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileSpreadsheet,
  Loader2,
  Search,
} from "lucide-react";
import api from "../api/api";

// ---------------------------------------------------------------------------
// /list-property
//
// The submission form itself lives at /list-property/<organization>, so this
// bare path would otherwise 404. Agents normally arrive on a link that already
// names the agency; this page is for the ones who trimmed the URL or typed it
// from memory. Pick the organization from the list and it forwards you to
// their form — every organization's link is shown too, so it can be copied and
// passed on.
// ---------------------------------------------------------------------------

const slugify = (name = "") =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function ListPropertyIndex() {
  const router = useRouter();

  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get("/public/organizations");
        if (!cancelled) setOrganizations(res.data?.data || []);
      } catch (err) {
        console.error("Organization list failed:", err);
        if (!cancelled) setLoadError("We couldn't load the list of agencies.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Filtering here rather than server-side: the list is small enough to hold in
  // memory and typing stays instant.
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return organizations;
    return organizations.filter(
      (o) =>
        o.name.toLowerCase().includes(query) || o.slug.includes(slugify(query))
    );
  }, [organizations, search]);

  const go = (e) => {
    e.preventDefault();
    if (!selected) {
      setError("Choose the agency or landlord you are listing with.");
      return;
    }
    router.push(`/list-property/${selected}`);
  };

  const copyLink = async (slug) => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/list-property/${slug}`
      );
      setCopied(slug);
      setTimeout(() => setCopied(""), 2000);
    } catch (err) {
      console.error("Clipboard error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F253B] flex flex-col">
      <header className="bg-[#0F253B] text-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F47C3C] flex items-center justify-center">
              <Building2 size={19} />
            </div>
            <p className="font-bold">PMS</p>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mt-6">List a property</h1>
          <p className="text-sm text-white/60 font-medium mt-2">
            Each agency has its own submission form. Choose who you are listing
            with and we&apos;ll take you to theirs.
          </p>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-8 space-y-5">
        <form
          onSubmit={go}
          className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4"
        >
          <div>
            <label
              htmlFor="organization"
              className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5"
            >
              Agency or landlord
            </label>

            {loading ? (
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl">
                <Loader2 size={15} className="text-[#F47C3C] animate-spin" />
                <span className="text-sm font-medium text-gray-400">
                  Loading agencies…
                </span>
              </div>
            ) : organizations.length === 0 ? (
              <div className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl">
                <p className="text-sm font-medium text-gray-500">
                  {loadError || "No agencies are signed up yet."}
                </p>
              </div>
            ) : (
              <div className="relative">
                <select
                  id="organization"
                  value={selected}
                  onChange={(e) => {
                    setSelected(e.target.value);
                    setError("");
                  }}
                  className="w-full appearance-none pl-4 pr-10 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]"
                >
                  <option value="">Select an agency…</option>
                  {organizations.map((organization) => (
                    <option key={organization.slug} value={organization.slug}>
                      {organization.name}
                      {organization.type === "LANDLORD" ? " (landlord)" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
            )}

            {selected && (
              <p className="text-[11px] text-gray-400 font-medium mt-1.5">
                Your form: /list-property/{selected}
              </p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || organizations.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-[#F47C3C] hover:bg-[#e06a2b] text-white font-bold text-sm rounded-xl disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            Continue <ArrowRight size={17} />
          </button>
        </form>

        {/* Every organization and the link its form lives at. */}
        {organizations.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#F47C3C]">
                All submission links ({organizations.length})
              </p>
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search agencies…"
                  className="pl-9 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#F47C3C] focus:bg-white w-full sm:w-56"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 font-medium">
                Nothing matches &quot;{search.trim()}&quot;.
              </p>
            ) : (
              <div className="space-y-2">
                {filtered.map((organization) => (
                  <div
                    key={organization.slug}
                    className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5"
                  >
                    {organization.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={organization.logo}
                        alt={organization.name}
                        className="w-9 h-9 rounded-lg object-cover border border-gray-100 shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0">
                        <Building2 size={16} className="text-gray-300" />
                      </div>
                    )}

                    <Link
                      href={`/list-property/${organization.slug}`}
                      className="flex-1 min-w-0"
                    >
                      <p className="text-sm font-bold text-[#0F253B] truncate">
                        {organization.name}
                      </p>
                      <p className="text-[11px] text-gray-400 font-medium truncate">
                        /list-property/{organization.slug}
                      </p>
                    </Link>

                    <button
                      type="button"
                      onClick={() => copyLink(organization.slug)}
                      title="Copy link"
                      className="p-2 text-gray-400 hover:text-[#0F253B] shrink-0"
                    >
                      {copied === organization.slug ? (
                        <Check size={15} className="text-emerald-600" />
                      ) : (
                        <Copy size={15} />
                      )}
                    </button>

                    <Link
                      href={`/list-property/${organization.slug}`}
                      className="px-3.5 py-2 bg-[#0F253B] hover:bg-[#183a5a] text-white text-[11px] font-bold rounded-lg transition-all shrink-0"
                    >
                      Open
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-start gap-3">
          <FileSpreadsheet size={18} className="text-[#F47C3C] mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold text-[#0F253B]">
              Listing a whole portfolio?
            </p>
            <p className="text-[11px] text-gray-500 font-medium mt-1 leading-relaxed">
              Every agency&apos;s form also takes a spreadsheet — one row per
              room, with each property&apos;s rooms sharing a{" "}
              <code className="text-[#0F253B]">propertyRef</code>. Grab a sample
              to see how the columns are arranged, then upload it on their page.
            </p>
            <a
              href="/samples/property-import-sample.csv"
              download
              className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-[#F47C3C] hover:text-[#0F253B]"
            >
              <Download size={14} /> Download the sample CSV
            </a>
          </div>
        </div>

        <p className="text-xs text-gray-400 font-medium text-center">
          Managing properties yourself?{" "}
          <Link href="/signup" className="font-bold text-[#F47C3C] hover:text-[#0F253B]">
            Create an account
          </Link>{" "}
          and get your own submission link.
        </p>
      </main>
    </div>
  );
}
