"use client";

import { CalendarDays, Clock } from "lucide-react";
import { LABEL, fmtDateTimeLong, toUkPickerParts, ukPickerPartsToISO } from "./tasks";

/* ---------------------------------------------------------------------------
 * A date + 12-hour time picker for task dates.
 *
 * Replaces <input type="datetime-local">, which had two problems for this
 * business: it renders 24-hour on a UK browser with no way to ask for 12-hour,
 * and it reads and writes in the VIEWER's timezone, so the same task showed a
 * different due time to somebody whose laptop was set elsewhere.
 *
 * Hour / minute / am-pm are explicit <select>s rather than a native time input
 * so the 12-hour format is guaranteed regardless of browser or OS locale, and
 * the value is always interpreted as a UK clock reading. The line underneath
 * reads the choice back in full, so there is no ambiguity about what was set.
 * ------------------------------------------------------------------------- */

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
// Five-minute granularity — task deadlines are not set to the minute, and a
// short list is far quicker to pick from than 60 rows.
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

const CONTROL =
  "px-3 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";

export default function DateTimeField({
  label,
  value, // ISO string, Date, or ""
  onChange, // (isoString) => void — "" when the date is cleared
  min, // ISO string; the date input won't offer anything earlier
  hint,
  required = false,
}) {
  const parts = toUkPickerParts(value);

  const emit = (next) => {
    const merged = { ...parts, ...next };
    // Clearing the date clears the whole value — a time with no day is not a
    // deadline.
    if (!merged.date) return onChange("");
    // First time a date is picked, default the clock to 9:00 am rather than
    // leaving the selects blank.
    if (!merged.hour) merged.hour = "9";
    if (!merged.minute) merged.minute = "00";
    onChange(ukPickerPartsToISO(merged));
  };

  const readback = fmtDateTimeLong(value);

  return (
    <div>
      <label className={LABEL}>
        {label}
        {!required && (
          <span className="text-gray-300 normal-case tracking-normal"> (optional)</span>
        )}
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
            value={parts.date}
            min={min ? toUkPickerParts(min).date || undefined : undefined}
            onChange={(e) => emit({ date: e.target.value })}
            required={required}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Clock size={14} className="text-gray-300 shrink-0" />
          <select
            className={CONTROL}
            value={parts.hour || "9"}
            disabled={!parts.date}
            onChange={(e) => emit({ hour: e.target.value })}
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
            disabled={!parts.date}
            onChange={(e) => emit({ minute: e.target.value })}
            aria-label={`${label} — minutes`}
          >
            {MINUTES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            className={CONTROL}
            value={parts.meridiem}
            disabled={!parts.date}
            onChange={(e) => emit({ meridiem: e.target.value })}
            aria-label={`${label} — am or pm`}
          >
            <option value="am">am</option>
            <option value="pm">pm</option>
          </select>
        </div>

        {parts.date && !required && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="px-3 py-2 text-[11px] font-bold text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            Clear
          </button>
        )}
      </div>

      <p className="mt-1.5 text-[11px] font-medium text-gray-400">
        {readback ? (
          <>
            <span className="text-[#0F253B] font-bold">{readback}</span> · UK time
          </>
        ) : (
          hint || "No date set"
        )}
      </p>
    </div>
  );
}
