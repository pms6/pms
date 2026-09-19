"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, Timer, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import api from "@/app/api/api";

/* ------------------------------------------------------------------ *
 * The dashboard's window onto team working hours — this week's totals,
 * who is highest and lowest, and a link into the full report.
 *
 * Reads the same endpoint as WorkHoursReport. A 403 (a seat that may not
 * read hours) hides the card rather than showing an error on a dashboard
 * nobody asked to be warned on.
 * ------------------------------------------------------------------ */

const PRIMARY = "#2a78d6";

const fmtHours = (hours) => {
  const total = Math.round((Number(hours) || 0) * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h && !m) return "0h";
  return m ? `${h}h ${m}m` : `${h}h`;
};

const shortName = (email) => {
  const local = String(email || "").split("@")[0];
  if (!local) return "Unknown";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
};

/** Monday to now — the week the rota is read in. */
const thisWeek = () => {
  const to = new Date();
  const from = new Date(to);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - ((from.getDay() + 6) % 7));
  return [from, to];
};

export default function WorkHoursSummaryCard({ basePath = "/admin" }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let active = true;
    const [from, to] = thisWeek();
    api
      .get("/time-reports/work-hours", {
        params: { from: from.toISOString(), to: to.toISOString(), granularity: "day" },
      })
      .then((res) => {
        if (active) setReport(res.data?.data || null);
      })
      .catch(() => {
        // Not allowed to read hours, or the report failed — either way the
        // dashboard simply does without the card rather than showing an error
        // on a screen nobody asked to be warned on.
        if (active) setHidden(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (hidden) return null;

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-gray-100 bg-white">
        <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
      </div>
    );
  }

  const team = report?.team;
  const buckets = team?.buckets || [];
  const max = Math.max(1, ...buckets.map((b) => b.hours));
  const delta = team?.deltaHours || 0;
  const flat = Math.abs(delta) < 0.05;
  const DeltaIcon = flat ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const deltaInk = flat ? "text-gray-400" : delta > 0 ? "text-emerald-600" : "text-red-500";

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-[#F47C3C]">
            <Timer size={18} />
          </span>
          <div>
            <h3 className="text-base font-bold text-[#0F253B]">Team Working Hours</h3>
            <p className="text-xs font-medium text-gray-400">This week so far</p>
          </div>
        </div>
        <Link
          href={`${basePath}/work-hours`}
          className="text-[10px] font-bold uppercase tracking-widest text-[#F47C3C] hover:underline"
        >
          Full report
        </Link>
      </div>

      <div className="p-5">
        {!team || team.memberCount === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No monitored hours recorded this week</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <p className="text-3xl font-semibold tracking-tight text-[#0F253B]">
                  {fmtHours(team.totalHours)}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-[#0F253B]">{fmtHours(team.averageHours)}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Average · {team.memberCount} {team.memberCount === 1 ? "person" : "people"}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1 text-xs font-bold ${deltaInk}`}>
                <DeltaIcon size={14} />
                {flat ? "No change" : `${delta > 0 ? "+" : "−"}${fmtHours(Math.abs(delta))}`}
                <span className="font-semibold text-gray-400">vs last week</span>
              </span>
            </div>

            {/* A week is few enough bars to label the axis under every one. */}
            <div className="mt-5 flex h-20 items-end gap-2">
              {buckets.map((b) => (
                <div key={b.key} className="flex flex-1 flex-col items-center gap-1.5" title={`${b.label} · ${fmtHours(b.hours)}`}>
                  <div className="flex w-full flex-1 items-end rounded bg-gray-50">
                    <div
                      className="w-full rounded"
                      style={{
                        height: `${Math.max((b.hours / max) * 100, 2)}%`,
                        backgroundColor: PRIMARY,
                        opacity: b.hours ? 1 : 0.25,
                      }}
                    />
                  </div>
                  <span className="text-[9px] font-bold text-gray-400">{b.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-50/60 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Highest</p>
                <p className="truncate text-sm font-bold text-[#0F253B]">
                  {team.highest ? shortName(team.highest.email) : "—"}
                </p>
                <p className="text-xs font-semibold text-gray-500">
                  {team.highest ? fmtHours(team.highest.hours) : "No hours recorded"}
                </p>
              </div>
              <div className="rounded-xl bg-amber-50/60 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Lowest</p>
                <p className="truncate text-sm font-bold text-[#0F253B]">
                  {team.lowest ? shortName(team.lowest.email) : "—"}
                </p>
                <p className="text-xs font-semibold text-gray-500">
                  {team.lowest ? fmtHours(team.lowest.hours) : "No hours recorded"}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
