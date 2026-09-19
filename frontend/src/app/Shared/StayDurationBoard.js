"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Loader2,
  Search,
  RefreshCw,
  CalendarDays,
  Hourglass,
  Trophy,
  Users,
  Link2,
  AlertTriangle,
  Download,
} from "lucide-react";
import { PageHeader } from "./ui";
import api from "@/app/api/api";

/* ------------------------------------------------------------------ *
 * Overall Stay Duration — one section for clients and tenants together.
 *
 * Reads GET /stay-duration, which measures today minus each person's FIRST
 * move-in date on both registers. The current contract or tenancy is shown
 * beside it and never folded into it: a renewal moves those dates and leaves
 * the overall stay exactly where it was.
 *
 * The two registers are independent by design, so this lists both and flags an
 * overlap rather than merging anyone. Read-only — a date is edited on whichever
 * register owns the row.
 *
 * Shared so the admin and manager portals read identically.
 * ------------------------------------------------------------------ */

const SOURCES = [
  { key: "", label: "Everyone" },
  { key: "client", label: "Clients" },
  { key: "tenant", label: "Tenants" },
];

const UNITS = [
  { key: "days", label: "Days" },
  { key: "months", label: "Months" },
  { key: "years", label: "Years" },
];

const SOURCE_STYLE = {
  client: "bg-blue-50 text-blue-700",
  tenant: "bg-orange-50 text-[#F47C3C]",
};

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString("en-GB") : "—");

const fmtDays = (n) => `${(n || 0).toLocaleString("en-GB")} ${n === 1 ? "day" : "days"}`;

/** The calendar form — "2 years 8 months 17 days". */
const stayLong = (s) => {
  if (!s) return "—";
  const parts = [];
  if (s.years) parts.push(`${s.years} ${s.years === 1 ? "year" : "years"}`);
  if (s.months) parts.push(`${s.months} ${s.months === 1 ? "month" : "months"}`);
  if (s.dayPart) parts.push(`${s.dayPart} ${s.dayPart === 1 ? "day" : "days"}`);
  return parts.length ? parts.join(" ") : "0 days";
};

/** The same measurement, said in whichever unit the section is reading in. */
const stayIn = (s, unit) => {
  if (!s) return "—";
  if (unit === "months") {
    const m = s.totalMonths || 0;
    return `${m} ${m === 1 ? "month" : "months"}`;
  }
  if (unit === "years") return stayLong(s);
  return fmtDays(s.days);
};

const initials = (name) =>
  String(name || "?")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/* --- pieces ------------------------------------------------------- */

function StatTile({ icon: Icon, label, value, sub, tone = "light" }) {
  const wrap =
    tone === "navy" ? "bg-[#0F253B] text-white" : "bg-white border border-gray-100 text-[#0F253B]";
  const iconWrap = tone === "navy" ? "bg-white/10 text-white" : "bg-orange-50 text-[#F47C3C]";
  const labelInk = tone === "navy" ? "text-white/50" : "text-gray-400";
  const subInk = tone === "navy" ? "text-white/70" : "text-gray-400";

  return (
    <div className={`rounded-2xl p-5 shadow-sm ${wrap}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${labelInk}`}>{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight truncate">{value}</p>
          {sub && <p className={`mt-0.5 truncate text-xs font-medium ${subInk}`}>{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

/** A bar showing this stay against the longest one on the sheet, so the column
 *  reads as a comparison and not just a list of numbers. */
function StayBar({ days, longest }) {
  const pct = longest > 0 ? Math.max((days / longest) * 100, 1.5) : 0;
  return (
    <span className="relative mt-1 block h-1.5 w-28 rounded-full bg-gray-100">
      <span className="absolute inset-y-0 left-0 rounded-full bg-[#2a78d6]" style={{ width: `${pct}%` }} />
    </span>
  );
}

const TH = "px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400";
const NUM = { fontVariantNumeric: "tabular-nums" };

/* --- the board ---------------------------------------------------- */

export default function StayDurationBoard({ basePath = "/admin" }) {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [properties, setProperties] = useState([]);

  const [source, setSource] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [search, setSearch] = useState("");
  const [unit, setUnit] = useState("days");
  const [reloadToken, setReloadToken] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get("/properties", { params: { limit: 100 } })
      .then((res) => {
        if (active) setProperties(res.data?.data || []);
      })
      .catch(() => {
        /* the property filter is optional context */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    api
      .get("/stay-duration", { params: { source, propertyId, search } })
      .then((res) => {
        if (!active) return;
        setRows(res.data?.data || []);
        setSummary(res.data?.summary || {});
        setError("");
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Failed to load stay durations");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [source, propertyId, search, reloadToken]);

  const reload = () => {
    setRefreshing(true);
    setReloadToken((n) => n + 1);
  };

  const longestDays = summary.longest?.stay?.days || 0;

  // Where a row's dates are actually edited, so the register is one click away.
  const editHref = (r) =>
    r.source === "client" ? `${basePath}/client-database` : `${basePath}/tenants`;

  const exportCsv = () => {
    const header = [
      "Source",
      "Name",
      "Email",
      "Property",
      "Room/Unit",
      "First Move-In Date",
      "Overall Stay (Days)",
      "Overall Stay (Months)",
      "Overall Stay",
      "Current Start",
      "Current End",
      "Status",
    ];
    const body = rows.map((r) => [
      r.source === "client" ? "Client" : "Tenant",
      r.name,
      r.email,
      r.property,
      r.unit,
      fmtDate(r.firstMoveInDate),
      r.stay ? r.stay.days : "",
      r.stay ? r.stay.totalMonths : "",
      r.stay ? stayLong(r.stay) : "",
      fmtDate(r.currentStart),
      fmtDate(r.currentEnd),
      r.status,
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `stay-duration-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const missing = summary.missingDate || 0;

  const tiles = useMemo(
    () => [
      {
        tone: "navy",
        icon: Users,
        label: "People",
        value: summary.people ?? 0,
        sub: `${summary.clients ?? 0} clients · ${summary.tenants ?? 0} tenants`,
      },
      {
        icon: Trophy,
        label: "Longest stay",
        value: summary.longest ? fmtDays(summary.longest.stay.days) : "—",
        sub: summary.longest ? summary.longest.name : "Nobody has a first move-in date yet",
      },
      {
        icon: Hourglass,
        label: "Average stay",
        value: summary.averageDays ? fmtDays(summary.averageDays) : "—",
        sub: `across ${summary.measured ?? 0} ${summary.measured === 1 ? "person" : "people"}`,
      },
      {
        icon: CalendarDays,
        label: "Shortest stay",
        value: summary.shortest ? fmtDays(summary.shortest.stay.days) : "—",
        sub: summary.shortest ? summary.shortest.name : "—",
      },
    ],
    [summary]
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#F47C3C]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overall Stay Duration"
        subtitle="How long each client and tenant has been with us, counted from their first move-in"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={rows.length === 0}
              className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-4 py-2.5 text-sm font-bold text-[#0F253B] transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={18} /> Export
            </button>
            <button
              onClick={reload}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-4 py-2.5 text-sm font-bold text-[#0F253B] transition-all hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
          <button onClick={reload} className="ml-3 rounded-lg bg-red-100 px-3 py-1 text-xs font-bold hover:bg-red-200">
            Retry
          </button>
        </div>
      )}

      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${refreshing ? "opacity-60 transition-opacity" : ""}`}>
        {tiles.map((t) => (
          <StatTile key={t.label} {...t} />
        ))}
      </div>

      {missing > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-sm font-medium text-amber-800">
            {missing} {missing === 1 ? "person has" : "people have"} no first move-in date recorded, so
            no stay can be counted for {missing === 1 ? "them" : "them"}. They are listed at the bottom —
            add the date on their own register and the stay appears here.
          </p>
        </div>
      )}

      {/* One filter row above everything it scopes. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, property or room…"
            className="w-full rounded-xl border border-gray-100 bg-white py-2.5 pl-9 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>

        <div className="flex gap-1.5">
          {SOURCES.map((s) => (
            <button
              key={s.key || "all"}
              onClick={() => setSource(s.key)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
                source === s.key
                  ? "border-[#0F253B] bg-[#0F253B] text-white"
                  : "border-gray-100 bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <select
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="rounded-xl border border-gray-100 bg-white px-3.5 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
        >
          <option value="">All properties</option>
          {properties.map((p) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>

        {/* One measurement; this only changes how it reads. */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Show in</span>
          <div className="flex gap-1">
            {UNITS.map((u) => (
              <button
                key={u.key}
                onClick={() => setUnit(u.key)}
                className={`rounded-lg border px-2.5 py-2 text-xs font-bold transition-all ${
                  unit === u.key
                    ? "border-[#F47C3C] bg-orange-50 text-[#F47C3C]"
                    : "border-gray-100 bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className={TH}>Person</th>
                <th className={TH}>Register</th>
                <th className={TH}>Property</th>
                <th className={TH}>First move-in</th>
                <th className={TH}>Overall stay</th>
                <th className={TH}>Current agreement</th>
                <th className={`${TH} text-right`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center text-sm text-gray-400">
                    {search || source || propertyId
                      ? "Nobody matches these filters"
                      : "No clients or tenants on either register yet"}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={`${r.source}-${r._id}`} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0F253B] text-[10px] font-bold text-white">
                          {initials(r.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-[#0F253B]">{r.name}</p>
                          <p className="truncate text-[11px] text-gray-400">{r.email || r.unit || "—"}</p>
                        </div>
                        {r.inBothRegisters && (
                          <span
                            title="This email is on both the client register and the tenancy register. They are kept separately on purpose — neither corrects the other."
                            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500"
                          >
                            <Link2 size={10} /> Both
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-3">
                      <Link
                        href={editHref(r)}
                        className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold hover:underline ${SOURCE_STYLE[r.source]}`}
                      >
                        {r.source === "client" ? "Client" : "Tenant"}
                      </Link>
                    </td>

                    <td className="px-5 py-3 text-gray-500">
                      {r.property || "—"}
                      {r.unit ? <span className="block text-[11px] text-gray-400">{r.unit}</span> : null}
                    </td>

                    <td className="px-5 py-3 text-gray-500" style={NUM}>
                      {fmtDate(r.firstMoveInDate)}
                    </td>

                    <td className="px-5 py-3">
                      {r.stay ? (
                        <>
                          <p className="text-[13px] font-bold text-[#0F253B]" style={NUM} title={stayLong(r.stay)}>
                            {stayIn(r.stay, unit)}
                          </p>
                          <StayBar days={r.stay.days} longest={longestDays} />
                        </>
                      ) : (
                        <span className="text-xs font-semibold text-amber-600" title="Add a first move-in date on this person's own register">
                          No move-in date
                        </span>
                      )}
                    </td>

                    {/* The current agreement, carried alongside the stay and never
                        subtracted from it — a renewal moves these dates only. */}
                    <td className="px-5 py-3">
                      {r.currentStart || r.currentEnd ? (
                        <p className="text-[11px] font-semibold text-gray-500" style={NUM}>
                          {fmtDate(r.currentStart)} → {fmtDate(r.currentEnd)}
                        </p>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    <td className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-widest text-gray-400">
                      {r.status || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs font-medium text-gray-400">
        The overall stay is counted from each person&apos;s first move-in and is never reset by a renewal.
        The current agreement beside it is the contract or tenancy running now. Dates are edited on the{" "}
        <Link href={`${basePath}/client-database`} className="font-bold text-[#F47C3C] hover:underline">
          client register
        </Link>{" "}
        or the{" "}
        <Link href={`${basePath}/tenants`} className="font-bold text-[#F47C3C] hover:underline">
          tenants board
        </Link>
        .
      </p>
    </div>
  );
}
