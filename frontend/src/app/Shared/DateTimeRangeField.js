"use client";

import { CalendarDays, Clock } from "lucide-react";
import { LABEL, fmtDate, fmtTime, toUkPickerParts, ukPickerPartsToISO } from "./tasks";

/* ---------------------------------------------------------------------------
 * One date, plus a start time and an end time on that same day — for a task
 * that happens within a single day's window ("paint the flat, 3–5pm") rather
 * than one that runs from one day to another.
 *
 * Emits ISO instants for startDate/dueDate, both pinned to the one date
 * picked here, on the same UK-clock reading DateTimeField uses.
 * ------------------------------------------------------------------------- */

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

const CONTROL =
  "px-3 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";

function TimeSelect({ label, parts, disabled, defaultHour, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <Clock size={14} className="text-gray-300 shrink-0" />
      <select
        className={CONTROL}
        value={parts.hour || defaultHour}
        disabled={disabled}
        onChange={(e) => onChange({ hour: e.target.value })}
        aria-label={`${label} — hour`}
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="font-bold text-gray-300">:</span>
      <select
        className={CONTROL}
        value={parts.minute || "00"}
        disabled={disabled}
        onChange={(e) => onChange({ minute: e.target.value })}
        aria-label={`${label} — minutes`}
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select
        className={CONTROL}
        value={parts.meridiem}
        disabled={disabled}
        onChange={(e) => onChange({ meridiem: e.target.value })}
        aria-label={`${label} — am or pm`}
      >
        <option value="am">am</option>
        <option value="pm">pm</option>
      </select>
    </div>
  );
}

export default function DateTimeRangeField({
  startDate, // ISO string or ""
  dueDate, // ISO string or ""
  onChange, // ({ startDate, dueDate }) => void — both ISO strings, or "" to clear
  hint,
}) {
  const startParts = toUkPickerParts(startDate);
  const endParts = toUkPickerParts(dueDate);
  const date = startParts.date || endParts.date;

  const emit = (nextDate, nextStart, nextEnd) => {
    if (!nextDate) return onChange({ startDate: "", dueDate: "" });
    const sp = { ...nextStart, date: nextDate };
    const ep = { ...nextEnd, date: nextDate };
    if (!sp.hour) sp.hour = "9";
    if (!sp.minute) sp.minute = "00";
    if (!ep.hour) ep.hour = "5";
    if (!ep.minute) ep.minute = "00";
    if (!ep.meridiem) ep.meridiem = "pm";
    onChange({
      startDate: ukPickerPartsToISO(sp),
      dueDate: ukPickerPartsToISO(ep),
    });
  };

  const startIso = date ? ukPickerPartsToISO({ ...startParts, date }) : "";
  const endIso = date ? ukPickerPartsToISO({ ...endParts, date }) : "";

  return (
    <div>
      <label className={LABEL}>
        Date <span className="text-gray-300 normal-case tracking-normal">(optional)</span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[150px]">
          <CalendarDays
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none"
          />
          <input
            type="date"
            className={`${CONTROL} w-full pl-9`}
            value={date}
            onChange={(e) => emit(e.target.value, startParts, endParts)}
          />
        </div>
        {date && (
          <button
            type="button"
            onClick={() => onChange({ startDate: "", dueDate: "" })}
            className="px-3 py-2 text-[11px] font-bold text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
            Start time
          </p>
          <TimeSelect
            label="Start time"
            parts={startParts}
            disabled={!date}
            defaultHour="9"
            onChange={(patch) => emit(date, { ...startParts, ...patch }, endParts)}
          />
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
            End time
          </p>
          <TimeSelect
            label="End time"
            parts={endParts}
            disabled={!date}
            defaultHour="5"
            onChange={(patch) => emit(date, startParts, { ...endParts, ...patch })}
          />
        </div>
      </div>

      <p className="mt-1.5 text-[11px] font-medium text-gray-400">
        {date ? (
          <>
            <span className="text-[#0F253B] font-bold">
              {fmtDate(startIso)} · {fmtTime(startIso)} – {fmtTime(endIso)}
            </span>{" "}
            · UK time
          </>
        ) : (
          hint || "No date set"
        )}
      </p>
    </div>
  );
}
