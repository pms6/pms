"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  RefreshCw,
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Trophy,
  AlertTriangle,
  CalendarDays,
  Table as TableIcon,
  BarChart3,
} from "lucide-react";
import api from "@/app/api/api";

/* ------------------------------------------------------------------ *
 * Team Working Hours — the reporting board.
 *
 * Reads GET /time-reports/work-hours, which derives working time from the
 * monitored shifts (see backend/controllers/timeReport.controller.js). Owner,
 * admin and manager may read it; nothing here touches a screenshot.
 *
 * Shared so the admin and manager portals report identically.
 * ------------------------------------------------------------------ */

/* --- palette ------------------------------------------------------- *
 * The categorical order is fixed and validated (adjacent-pair CVD ΔE 9.1,
 * normal-vision ΔE 19.6 on a light surface). Hues are assigned by slot and
 * never cycled — a member keeps their colour when the filter changes the
 * number of series. Three of these sit under 3:1 on white, so every chart
 * that uses them ships direct labels and a table view.
 * ------------------------------------------------------------------ */
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];
const MAX_SERIES = SERIES.length;
const PRIMARY = "#2a78d6";
const PREVIOUS = "#9ca3af"; // previous period is a reference, not an identity
const GRID = "#eef1f4";
const AXIS_INK = "#94a3b8";

/* --- formatting ---------------------------------------------------- */
const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

/** "38h 30m" — how a timesheet reads. */
const fmtHours = (hours) => {
  const total = Math.round((Number(hours) || 0) * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h && !m) return "0h";
  return m ? `${h}h ${m}m` : `${h}h`;
};

/** Compact form for an axis tick. */
const fmtAxis = (hours) => `${round1(hours)}h`;

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString("en-GB") : "—");
const fmtTime = (v) =>
  v ? new Date(v).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—";

/** The part of an email that reads as a name on a chart label. */
const shortName = (email) => {
  const local = String(email || "").split("@")[0];
  if (!local) return "Unknown";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
};

const initials = (email) =>
  shortName(email)
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/* --- the period the whole board is scoped to ----------------------- */
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const PRESETS = [
  {
    key: "today",
    label: "Today",
    granularity: "day",
    range: () => {
      const to = new Date();
      return [startOfDay(to), to];
    },
  },
  {
    key: "week",
    label: "This week",
    granularity: "day",
    range: () => {
      const to = new Date();
      const from = startOfDay(to);
      const back = (from.getDay() + 6) % 7; // Monday starts the week
      from.setDate(from.getDate() - back);
      return [from, to];
    },
  },
  {
    key: "month",
    label: "This month",
    granularity: "day",
    range: () => {
      const to = new Date();
      const from = startOfDay(to);
      from.setDate(1);
      return [from, to];
    },
  },
  {
    key: "d30",
    label: "Last 30 days",
    granularity: "day",
    range: () => {
      const to = new Date();
      const from = startOfDay(to);
      from.setDate(from.getDate() - 29);
      return [from, to];
    },
  },
  {
    key: "d90",
    label: "Last 90 days",
    granularity: "week",
    range: () => {
      const to = new Date();
      const from = startOfDay(to);
      from.setDate(from.getDate() - 89);
      return [from, to];
    },
  },
  {
    key: "y1",
    label: "Last 12 months",
    granularity: "month",
    range: () => {
      const to = new Date();
      const from = startOfDay(to);
      from.setMonth(from.getMonth() - 11);
      from.setDate(1);
      return [from, to];
    },
  },
];

const GRANULARITIES = [
  { key: "day", label: "Daily" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
];

/* ------------------------------------------------------------------ *
 * Small pieces
 * ------------------------------------------------------------------ */

/** A change against the previous period. Always carries an arrow and a word,
 *  so the direction is never colour alone. */
function Delta({ hours, percent, className = "" }) {
  const h = Number(hours) || 0;
  const flat = Math.abs(h) < 0.05;
  const up = h > 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const tone = flat ? "text-gray-400" : up ? "text-emerald-600" : "text-red-500";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${tone} ${className}`}>
      <Icon size={13} />
      {flat ? "No change" : `${up ? "+" : "−"}${fmtHours(Math.abs(h))}`}
      {percent !== null && percent !== undefined && !flat && (
        <span className="text-gray-400 font-semibold">({up ? "+" : ""}{percent}%)</span>
      )}
    </span>
  );
}

/** A headline figure. The number is the chart — no plot behind it. */
function StatTile({ icon: Icon, label, value, sub, footer, tone = "light" }) {
  const wrap =
    tone === "navy"
      ? "bg-[#0F253B] text-white"
      : "bg-white border border-gray-100 text-[#0F253B]";
  const iconWrap = tone === "navy" ? "bg-white/10 text-white" : "bg-orange-50 text-[#F47C3C]";
  const labelInk = tone === "navy" ? "text-white/50" : "text-gray-400";
  const subInk = tone === "navy" ? "text-white/70" : "text-gray-400";

  return (
    <div className={`rounded-2xl p-5 shadow-sm ${wrap}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${labelInk}`}>{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight truncate">{value}</p>
          {sub && <p className={`text-xs font-medium mt-0.5 truncate ${subInk}`}>{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}

/** A chart card with a title and an optional table-view toggle. Every chart on
 *  this board has a table twin — the values are never locked behind a hover. */
function ChartCard({ title, subtitle, legend, children, table }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-[#0F253B]">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 font-medium mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {legend}
          {table && (
            <button
              onClick={() => setShowTable((v) => !v)}
              title={showTable ? "Show the chart" : "Show the numbers"}
              className="flex items-center gap-1.5 rounded-lg border border-gray-100 bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-500 hover:bg-gray-50"
            >
              {showTable ? <BarChart3 size={13} /> : <TableIcon size={13} />}
              {showTable ? "Chart" : "Table"}
            </button>
          )}
        </div>
      </div>
      <div className="p-5">{showTable && table ? table : children}</div>
    </div>
  );
}

/** One legend entry. The swatch carries identity; the text stays in ink. */
function LegendKey({ color, label, dashed = false }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
      <span
        className="inline-block h-0.5 w-4 rounded-full"
        style={{
          backgroundColor: dashed ? "transparent" : color,
          backgroundImage: dashed ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)` : "none",
        }}
      />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Trend chart — hours over time, current period against the previous one.
 * Two series, so a legend is always present and the current series is
 * direct-labelled at its endpoint.
 * ------------------------------------------------------------------ */
const CHART_W = 760;
const CHART_H = 260;
const PAD = { top: 18, right: 22, bottom: 34, left: 46 };

function TrendChart({ buckets, previousBuckets, label = "Hours" }) {
  const [hover, setHover] = useState(null);

  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;
  const n = buckets.length;

  const max = Math.max(
    1,
    ...buckets.map((b) => b.hours),
    ...previousBuckets.map((b) => b.hours)
  );
  // Four gridlines is enough to read a value off; more is noise.
  const ticks = [0, max / 3, (max * 2) / 3, max];

  const x = (i) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v) => PAD.top + plotH - (v / max) * plotH;

  const path = (rows) =>
    rows.map((b, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(b.hours)}`).join(" ");

  const area = (rows) =>
    `${path(rows)} L ${x(rows.length - 1)} ${PAD.top + plotH} L ${x(0)} ${PAD.top + plotH} Z`;

  // The previous period rarely has the same bucket count; it is plotted across
  // the same width so the shapes can be compared, and it is dashed and gray so
  // it never reads as a second category.
  const prev = useMemo(() => {
    if (!previousBuckets.length || n < 2) return [];
    return buckets.map((_, i) => {
      const at = Math.round((i / (n - 1)) * (previousBuckets.length - 1));
      return previousBuckets[at] || { hours: 0 };
    });
  }, [buckets, previousBuckets, n]);

  if (!n) {
    return <p className="py-16 text-center text-sm text-gray-400">No hours recorded in this period</p>;
  }

  // Every ~nth label only, so the axis never collides with itself.
  const labelEvery = Math.max(1, Math.ceil(n / 12));
  const last = buckets[n - 1];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" style={{ height: "auto" }} role="img"
        aria-label={`${label} per period, current against previous`}>
        {/* recessive grid — solid hairlines, one shade off the surface */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={CHART_W - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill={AXIS_INK} style={{ fontVariantNumeric: "tabular-nums" }}>
              {fmtAxis(t)}
            </text>
          </g>
        ))}

        {prev.length > 1 && (
          <path d={path(prev)} fill="none" stroke={PREVIOUS} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />
        )}

        <path d={area(buckets)} fill={PRIMARY} fillOpacity="0.08" />
        <path d={path(buckets)} fill="none" stroke={PRIMARY} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* markers only when they can breathe */}
        {n <= 32 &&
          buckets.map((b, i) => (
            <circle key={b.key} cx={x(i)} cy={y(b.hours)} r={hover === i ? 5 : 3.5}
              fill="#fff" stroke={PRIMARY} strokeWidth="2" />
          ))}

        {/* the endpoint is direct-laballed; the rest live in the axis and tooltip */}
        {n > 1 && (
          <text x={x(n - 1)} y={y(last.hours) - 12} textAnchor="end" fontSize="11" fontWeight="700" fill="#0F253B">
            {fmtAxis(last.hours)}
          </text>
        )}

        {buckets.map((b, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={`l-${b.key}`} x={x(i)} y={CHART_H - 12} textAnchor="middle" fontSize="10" fill={AXIS_INK}>
              {b.label}
            </text>
          ) : null
        )}

        {/* crosshair */}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke={AXIS_INK} strokeWidth="1" />
        )}

        {/* hit areas — a full-height band per bucket, so hovering is easy */}
        {buckets.map((b, i) => (
          <rect
            key={`h-${b.key}`}
            x={x(i) - (n <= 1 ? plotW / 2 : plotW / (n - 1) / 2)}
            y={PAD.top}
            width={n <= 1 ? plotW : plotW / (n - 1)}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 rounded-xl border border-gray-100 bg-white px-3 py-2 shadow-lg"
          style={{ left: `${(x(hover) / CHART_W) * 100}%`, top: 8, transform: "translateX(-50%)" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{buckets[hover].label}</p>
          <p className="text-sm font-bold text-[#0F253B]">{fmtHours(buckets[hover].hours)}</p>
          {prev[hover] && (
            <p className="text-[11px] font-semibold text-gray-400">Previous {fmtHours(prev[hover].hours)}</p>
          )}
          {buckets[hover].headcount !== undefined && (
            <p className="text-[11px] font-semibold text-gray-400">
              {buckets[hover].headcount} {buckets[hover].headcount === 1 ? "person" : "people"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Member comparison — a ranked bar per person.
 * One hue for every bar: colour follows the entity, not the rank, so the
 * extremes are called out in words rather than by repainting a bar.
 * ------------------------------------------------------------------ */
function MemberBars({ members, highestId, lowestId, onSelect }) {
  const max = Math.max(1, ...members.map((m) => m.hours));

  if (!members.length) {
    return <p className="py-16 text-center text-sm text-gray-400">Nobody recorded hours in this period</p>;
  }

  return (
    <ul className="space-y-2.5">
      {members.map((m) => {
        const pct = (m.hours / max) * 100;
        const isHigh = m.userId === highestId;
        const isLow = m.userId === lowestId;
        return (
          <li key={m.userId}>
            <button
              onClick={() => onSelect?.(m.userId)}
              title={`${m.email} · ${fmtHours(m.hours)} over ${m.daysWorked} day${m.daysWorked === 1 ? "" : "s"}`}
              className="group flex w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left hover:bg-gray-50"
            >
              <span className="w-32 shrink-0 truncate text-xs font-bold text-[#0F253B]">
                {shortName(m.email)}
              </span>

              <span className="relative h-5 flex-1 rounded-full bg-gray-100">
                <span
                  className="absolute inset-y-0 left-0 rounded-full transition-all"
                  style={{ width: `${Math.max(pct, 1.5)}%`, backgroundColor: PRIMARY }}
                />
              </span>

              <span className="w-20 shrink-0 text-right text-xs font-bold text-[#0F253B]" style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmtHours(m.hours)}
              </span>

              <span className="w-16 shrink-0 text-right">
                {isHigh && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    <Trophy size={10} /> High
                  </span>
                )}
                {isLow && !isHigh && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    <AlertTriangle size={10} /> Low
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ *
 * Per-member trend — up to six people on one axis, to read the difference
 * between them over time. Hues are assigned by slot in fixed order and each
 * line is direct-labelled at its endpoint.
 * ------------------------------------------------------------------ */
function MemberTrendChart({ members }) {
  const [hover, setHover] = useState(null);

  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;
  const buckets = members[0]?.buckets || [];
  const n = buckets.length;

  const max = Math.max(1, ...members.flatMap((m) => m.buckets.map((b) => b.hours)));
  const ticks = [0, max / 3, (max * 2) / 3, max];

  const x = (i) => PAD.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v) => PAD.top + plotH - (v / max) * plotH;

  if (!members.length || !n) {
    return <p className="py-16 text-center text-sm text-gray-400">Nothing to compare in this period</p>;
  }

  const labelEvery = Math.max(1, Math.ceil(n / 12));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full" style={{ height: "auto" }} role="img"
        aria-label="Working hours per person over time">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={CHART_W - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill={AXIS_INK} style={{ fontVariantNumeric: "tabular-nums" }}>
              {fmtAxis(t)}
            </text>
          </g>
        ))}

        {members.map((m, mi) => (
          <g key={m.userId}>
            <path
              d={m.buckets.map((b, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(b.hours)}`).join(" ")}
              fill="none"
              stroke={SERIES[mi % MAX_SERIES]}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={hover === null || hover === mi ? 1 : 0.25}
            />
            {/* a 2px surface ring keeps overlapping endpoints readable */}
            <circle
              cx={x(n - 1)}
              cy={y(m.buckets[n - 1]?.hours || 0)}
              r="4"
              fill={SERIES[mi % MAX_SERIES]}
              stroke="#fff"
              strokeWidth="2"
              opacity={hover === null || hover === mi ? 1 : 0.25}
            />
          </g>
        ))}

        {buckets.map((b, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={b.key} x={x(i)} y={CHART_H - 12} textAnchor="middle" fontSize="10" fill={AXIS_INK}>
              {b.label}
            </text>
          ) : null
        )}
      </svg>

      {/* legend doubles as the highlight control — identity is never colour alone */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {members.map((m, mi) => (
          <button
            key={m.userId}
            onMouseEnter={() => setHover(mi)}
            onMouseLeave={() => setHover(null)}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-500 hover:text-[#0F253B]"
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SERIES[mi % MAX_SERIES] }} />
            {shortName(m.email)}
            <span className="font-semibold text-gray-400" style={{ fontVariantNumeric: "tabular-nums" }}>
              {fmtHours(m.hours)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * This period against the last — a pair of bars per person.
 * Two series, so a legend is present; a 2px surface gap separates the pair.
 * ------------------------------------------------------------------ */
function PeriodComparison({ members }) {
  const max = Math.max(1, ...members.flatMap((m) => [m.hours, m.previousHours]));

  if (!members.length) {
    return <p className="py-16 text-center text-sm text-gray-400">Nothing to compare</p>;
  }

  return (
    <ul className="space-y-4">
      {members.map((m) => (
        <li key={m.userId}>
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-xs font-bold text-[#0F253B]">{shortName(m.email)}</span>
            <Delta hours={m.deltaHours} percent={m.deltaPercent} />
          </div>
          <div className="mt-1.5 space-y-0.5">
            <div className="flex items-center gap-2" title={`This period ${fmtHours(m.hours)}`}>
              <span className="relative h-3 flex-1 rounded-full bg-gray-50">
                <span className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${Math.max((m.hours / max) * 100, 1)}%`, backgroundColor: PRIMARY }} />
              </span>
              <span className="w-16 shrink-0 text-right text-[11px] font-bold text-[#0F253B]" style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmtHours(m.hours)}
              </span>
            </div>
            <div className="flex items-center gap-2" title={`Previous period ${fmtHours(m.previousHours)}`}>
              <span className="relative h-3 flex-1 rounded-full bg-gray-50">
                <span className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${Math.max((m.previousHours / max) * 100, 1)}%`, backgroundColor: PREVIOUS }} />
              </span>
              <span className="w-16 shrink-0 text-right text-[11px] font-semibold text-gray-400" style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmtHours(m.previousHours)}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ *
 * Table twins
 * ------------------------------------------------------------------ */
const TH = "px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400";
const TD = "px-4 py-3 text-sm";
const NUM = { fontVariantNumeric: "tabular-nums" };

function BucketTable({ buckets, previousBuckets }) {
  return (
    <div className="max-h-72 overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-gray-100">
            <th className={TH}>Period</th>
            <th className={`${TH} text-right`}>Hours</th>
            <th className={`${TH} text-right`}>People</th>
            <th className={`${TH} text-right`}>Previous</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b, i) => (
            <tr key={b.key} className="border-b border-gray-50">
              <td className={`${TD} font-semibold text-[#0F253B]`}>{b.label}</td>
              <td className={`${TD} text-right font-bold text-[#0F253B]`} style={NUM}>{fmtHours(b.hours)}</td>
              <td className={`${TD} text-right text-gray-500`} style={NUM}>{b.headcount ?? "—"}</td>
              <td className={`${TD} text-right text-gray-400`} style={NUM}>
                {previousBuckets[i] ? fmtHours(previousBuckets[i].hours) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MemberTable({ members, highestId, lowestId }) {
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-gray-100">
            <th className={TH}>Team member</th>
            <th className={`${TH} text-right`}>Hours</th>
            <th className={`${TH} text-right`}>Days</th>
            <th className={`${TH} text-right`}>Avg / day</th>
            <th className={`${TH} text-right`}>Sessions</th>
            <th className={`${TH} text-right`}>Previous</th>
            <th className={`${TH} text-right`}>Change</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.userId} className="border-b border-gray-50 hover:bg-gray-50/50">
              <td className={TD}>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0F253B] text-[10px] font-bold text-white">
                    {initials(m.email)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#0F253B]">{shortName(m.email)}</p>
                    <p className="truncate text-[11px] text-gray-400">{m.email}</p>
                  </div>
                  {m.userId === highestId && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Highest</span>
                  )}
                  {m.userId === lowestId && m.userId !== highestId && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Lowest</span>
                  )}
                </div>
              </td>
              <td className={`${TD} text-right font-bold text-[#0F253B]`} style={NUM}>{fmtHours(m.hours)}</td>
              <td className={`${TD} text-right text-gray-500`} style={NUM}>{m.daysWorked}</td>
              <td className={`${TD} text-right text-gray-500`} style={NUM}>{fmtHours(m.avgHoursPerDay)}</td>
              <td className={`${TD} text-right text-gray-500`} style={NUM}>{m.sessions}</td>
              <td className={`${TD} text-right text-gray-400`} style={NUM}>{fmtHours(m.previousHours)}</td>
              <td className={`${TD} text-right`}><Delta hours={m.deltaHours} percent={m.deltaPercent} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AttendanceTable({ rows }) {
  if (!rows.length) {
    return <p className="py-12 text-center text-sm text-gray-400">No attendance recorded in this period</p>;
  }
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-gray-100">
            <th className={TH}>Date</th>
            <th className={TH}>Team member</th>
            <th className={`${TH} text-right`}>First in</th>
            <th className={`${TH} text-right`}>Last out</th>
            <th className={`${TH} text-right`}>Sessions</th>
            <th className={`${TH} text-right`}>Hours</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.userId}-${r.date}`} className="border-b border-gray-50 hover:bg-gray-50/50">
              <td className={`${TD} font-semibold text-[#0F253B] whitespace-nowrap`}>{fmtDate(r.date)}</td>
              <td className={TD}>
                <p className="font-semibold text-[#0F253B]">{shortName(r.email)}</p>
                <p className="text-[11px] text-gray-400">{r.role || "—"}</p>
              </td>
              <td className={`${TD} text-right text-gray-500`} style={NUM}>{fmtTime(r.firstIn)}</td>
              <td className={`${TD} text-right text-gray-500`} style={NUM}>{fmtTime(r.lastOut)}</td>
              <td className={`${TD} text-right text-gray-500`} style={NUM}>{r.sessions}</td>
              <td className={`${TD} text-right font-bold text-[#0F253B]`} style={NUM}>{fmtHours(r.hours)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The board
 * ------------------------------------------------------------------ */
export default function WorkHoursReport({
  subtitle = "Working hours across the team, from the monitored shifts",
}) {
  const [preset, setPreset] = useState("d30");
  const [granularity, setGranularity] = useState("day");
  const [member, setMember] = useState(""); // "" = the whole team
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [from, to] = useMemo(
    () => (PRESETS.find((p) => p.key === preset) || PRESETS[3]).range(),
    [preset]
  );

  // Bumping this refetches the same slice — what the Refresh button does.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    api
      .get("/time-reports/work-hours", {
        params: { from: from.toISOString(), to: to.toISOString(), granularity },
      })
      .then((res) => {
        if (!active) return;
        setReport(res.data?.data || null);
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err.response?.status === 403
            ? "Your account cannot view working-hours reports."
            : err.response?.data?.message || "Failed to load the working-hours report"
        );
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [from, to, granularity, reloadToken]);

  const load = () => {
    setRefreshing(true);
    setReloadToken((n) => n + 1);
  };

  // Choosing a preset moves the granularity to the one that reads best for it;
  // the operator can still override it afterwards.
  const choosePreset = (key) => {
    setPreset(key);
    const p = PRESETS.find((x) => x.key === key);
    if (p) setGranularity(p.granularity);
  };

  const team = report?.team;
  const allMembers = useMemo(() => report?.members || [], [report]);

  // One filter row scopes everything: picking a person narrows every chart and
  // table below rather than each card carrying its own control.
  const members = useMemo(
    () => (member ? allMembers.filter((m) => m.userId === member) : allMembers),
    [allMembers, member]
  );

  const attendance = useMemo(
    () => (member ? (report?.attendance || []).filter((r) => r.userId === member) : report?.attendance || []),
    [report, member]
  );

  // The scoped roll-up. With a person selected these describe that person, so
  // the headline figures always match what is on screen.
  const scoped = useMemo(() => {
    const worked = members.filter((m) => m.hours > 0);
    const totalHours = round1(worked.reduce((s, m) => s + m.hours, 0));
    const previousHours = round1(members.reduce((s, m) => s + m.previousHours, 0));
    const buckets = (members[0]?.buckets || []).map((b, i) => ({
      key: b.key,
      label: b.label,
      hours: round1(members.reduce((s, m) => s + (m.buckets[i]?.hours || 0), 0)),
      headcount: members.filter((m) => (m.buckets[i]?.hours || 0) > 0).length,
    }));
    return {
      worked,
      totalHours,
      previousHours,
      deltaHours: round1(totalHours - previousHours),
      deltaPercent: previousHours > 0 ? Math.round(((totalHours - previousHours) / previousHours) * 100) : null,
      averageHours: worked.length ? round1(totalHours / worked.length) : 0,
      highest: worked[0] || null,
      lowest: worked.length ? worked[worked.length - 1] : null,
      buckets: member ? buckets : team?.buckets || buckets,
    };
  }, [members, member, team]);

  // At most six lines on one axis — past the palette's fixed slots the rest
  // fold into the table rather than being given invented hues.
  const trendMembers = useMemo(() => members.slice(0, MAX_SERIES), [members]);
  const foldedCount = Math.max(0, members.length - MAX_SERIES);

  const rangeLabel = `${fmtDate(from)} – ${fmtDate(to)}`;
  const previousLabel = report
    ? `${fmtDate(report.previousRange.from)} – ${fmtDate(report.previousRange.to)}`
    : "";

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#F47C3C]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0F253B]">Team Working Hours</h1>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* One filter row above everything it scopes. */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => choosePreset(p.key)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
                preset === p.key
                  ? "border-[#0F253B] bg-[#0F253B] text-white"
                  : "border-gray-100 bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <span className="h-6 w-px bg-gray-100" />

        <div className="flex gap-1.5">
          {GRANULARITIES.map((g) => (
            <button
              key={g.key}
              onClick={() => setGranularity(g.key)}
              className={`rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
                granularity === g.key
                  ? "border-[#F47C3C] bg-orange-50 text-[#F47C3C]"
                  : "border-gray-100 bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <select
          value={member}
          onChange={(e) => setMember(e.target.value)}
          className="ml-auto rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-[#F47C3C]/30"
        >
          <option value="">Whole team</option>
          {allMembers.map((m) => (
            <option key={m.userId} value={m.userId}>{shortName(m.email)}</option>
          ))}
        </select>
      </div>

      <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-400">
        <CalendarDays size={13} />
        {rangeLabel}
        <span className="text-gray-300">·</span>
        compared against {previousLabel}
        {member && (
          <>
            <span className="text-gray-300">·</span>
            <button onClick={() => setMember("")} className="font-bold text-[#F47C3C] hover:underline">
              Back to the whole team
            </button>
          </>
        )}
      </p>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
          <button onClick={load} className="ml-3 rounded-lg bg-red-100 px-3 py-1 text-xs font-bold hover:bg-red-200">
            Retry
          </button>
        </div>
      )}

      {/* Headline figures — the number is the chart. */}
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${refreshing ? "opacity-60 transition-opacity" : ""}`}>
        <StatTile
          tone="navy"
          icon={Clock}
          label={member ? "Hours worked" : "Total hours"}
          value={fmtHours(scoped.totalHours)}
          sub={`${scoped.worked.length} ${scoped.worked.length === 1 ? "person" : "people"} · ${team?.activeDays || 0} active days`}
          footer={<Delta hours={scoped.deltaHours} percent={scoped.deltaPercent} />}
        />
        <StatTile
          icon={Users}
          label={member ? "Average per day" : "Average per person"}
          value={fmtHours(member ? scoped.worked[0]?.avgHoursPerDay || 0 : scoped.averageHours)}
          sub={member ? `over ${scoped.worked[0]?.daysWorked || 0} days worked` : "across everyone who worked"}
        />
        <StatTile
          icon={TrendingUp}
          label="Highest hours"
          value={scoped.highest ? fmtHours(scoped.highest.hours) : "—"}
          sub={scoped.highest ? shortName(scoped.highest.email) : "Nobody recorded hours"}
        />
        <StatTile
          icon={TrendingDown}
          label="Lowest hours"
          value={scoped.lowest ? fmtHours(scoped.lowest.hours) : "—"}
          sub={scoped.lowest ? shortName(scoped.lowest.email) : "Nobody recorded hours"}
        />
      </div>

      {/* Trend, current against previous */}
      <ChartCard
        title={member ? `${shortName(scoped.worked[0]?.email || "")} — hours over time` : "Team hours over time"}
        subtitle={`${GRANULARITIES.find((g) => g.key === granularity)?.label} totals for ${rangeLabel}`}
        legend={
          <div className="flex items-center gap-3">
            <LegendKey color={PRIMARY} label="This period" />
            <LegendKey color={PREVIOUS} label="Previous" dashed />
          </div>
        }
        table={<BucketTable buckets={scoped.buckets} previousBuckets={team?.previousBuckets || []} />}
      >
        <TrendChart buckets={scoped.buckets} previousBuckets={team?.previousBuckets || []} />
      </ChartCard>

      {!member && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard
            title="Hours by team member"
            subtitle="Ranked for the selected period — click a bar for that person's report"
            table={<MemberTable members={members} highestId={team?.highest?.userId} lowestId={team?.lowest?.userId} />}
          >
            <MemberBars
              members={members}
              highestId={team?.highest?.userId}
              lowestId={team?.lowest?.userId}
              onSelect={setMember}
            />
          </ChartCard>

          <ChartCard
            title="This period vs the previous"
            subtitle={`${rangeLabel} against ${previousLabel}`}
            legend={
              <div className="flex items-center gap-3">
                <LegendKey color={PRIMARY} label="This" />
                <LegendKey color={PREVIOUS} label="Previous" />
              </div>
            }
            table={<MemberTable members={members} highestId={team?.highest?.userId} lowestId={team?.lowest?.userId} />}
          >
            <PeriodComparison members={members} />
          </ChartCard>
        </div>
      )}

      {!member && (
        <ChartCard
          title="Working-hour trends per person"
          subtitle={
            foldedCount
              ? `The six highest, over time · ${foldedCount} more in the table`
              : "Each person's hours over time, on one axis"
          }
          table={<MemberTable members={members} highestId={team?.highest?.userId} lowestId={team?.lowest?.userId} />}
        >
          <MemberTrendChart members={trendMembers} />
        </ChartCard>
      )}

      <ChartCard
        title={member ? "Attendance" : "Attendance & working-time records"}
        subtitle="One row per person per day worked — first in, last out, and the hours between"
      >
        <AttendanceTable rows={attendance} />
      </ChartCard>

      {!member && (
        <ChartCard title="Individual working-hour reports" subtitle="Every team member, with their change against the previous period">
          <MemberTable members={members} highestId={team?.highest?.userId} lowestId={team?.lowest?.userId} />
        </ChartCard>
      )}
    </div>
  );
}
