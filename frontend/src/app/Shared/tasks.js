"use client";

/* Shared constants and helpers for Task Management, used by the admin
   dashboard and by the member "My Tasks" view. */

// MUST stay in sync with TASK_PRIORITIES / TASK_STATUSES in
// backend/models/Task.js.
export const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

// "Overdue" is derived on read from dueDate. "Done" replaces legacy
// "Completed". "Cancelled" is an explicit terminal cancel.
export const TASK_STATUSES = [
  "Not Started",
  "In Progress",
  "Done",
  "Cancelled",
  "Overdue",
];

// The statuses a person can actually set. "Overdue" is derived from the due
// date by the backend, never chosen, so it is deliberately not offered.
export const SETTABLE_STATUSES = [
  "Not Started",
  "In Progress",
  "Done",
  "Cancelled",
];

/** Map legacy stored value "Completed" → "Done". */
export const normalizeStatus = (s) => (s === "Completed" ? "Done" : s);

/**
 * A task that falls due today and is still open. `daysUntilDue` comes from the
 * backend (0 = today). Done / Cancelled tasks are never "due today".
 * MUST stay in sync with isDueToday in backend/controllers/task.controller.js.
 */
export const isDueToday = (task) => {
  const s = normalizeStatus(task?.effectiveStatus || task?.status);
  return s !== "Done" && s !== "Cancelled" && task?.daysUntilDue === 0;
};

export const PRIORITY_TONE = {
  Low: "bg-slate-100 text-slate-600",
  Medium: "bg-blue-100 text-blue-700",
  High: "bg-amber-100 text-amber-700",
  Urgent: "bg-red-100 text-red-700",
};

export const STATUS_TONE = {
  "Not Started": "bg-slate-100 text-slate-600",
  "In Progress": "bg-blue-100 text-blue-700",
  Done: "bg-emerald-100 text-emerald-700",
  Completed: "bg-emerald-100 text-emerald-700", // legacy alias
  Cancelled: "bg-gray-100 text-gray-500",
  Overdue: "bg-red-100 text-red-700",
};

// Ring colour for the priority dot on a task card.
export const PRIORITY_DOT = {
  Low: "bg-slate-300",
  Medium: "bg-blue-400",
  High: "bg-amber-400",
  Urgent: "bg-red-500",
};

/* ---------------------------------------------------------------------------
 * Dates and times
 *
 * The business runs in the UK, so every task time is shown on a UK clock and
 * entered on a UK clock — NOT on whatever timezone the viewer's machine happens
 * to be set to. A task due "9:00 am" means 9am in London whether the person
 * reading it is in Manchester, Lahore or on a laptop still set to US Pacific
 * from a trip. Pinning the timezone is what stops the same task showing two
 * different due times to two people.
 *
 * Times display in 12-hour form ("9:00 am"), which is how the office writes and
 * says them.
 * ------------------------------------------------------------------------- */

export const UK_TZ = "Europe/London";

const pad = (n) => String(n).padStart(2, "0");

const asDate = (d) => {
  if (!d) return null;
  const parsed = d instanceof Date ? d : new Date(d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// The year/month/day/hour/minute of `date` as they read on a UK clock.
const ukParts = (date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const p = {};
  for (const { type, value } of parts) if (type !== "literal") p[type] = value;

  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    // Some engines render midnight as hour 24 under hourCycle h23.
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    second: Number(p.second),
  };
};

// Milliseconds UK time is ahead of UTC at that instant (0 in winter, +1h in BST).
const ukOffsetMs = (date) => {
  const p = ukParts(date);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) -
    Math.floor(date.getTime() / 1000) * 1000;
};

/**
 * A UK wall-clock reading → the instant it refers to.
 *
 * Resolved twice because the offset depends on the instant we are still
 * working out: the first pass uses the offset at the naive guess, the second
 * uses the offset at the instant that produced — which is what makes the two
 * clock changes a year land on the right side.
 */
export const ukToDate = ({ year, month, day, hour = 0, minute = 0 }) => {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const first = new Date(naive - ukOffsetMs(new Date(naive)));
  return new Date(naive - ukOffsetMs(first));
};

/** "5 Sep 2026" on a UK clock. */
export const fmtDate = (d) => {
  const date = asDate(d);
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: UK_TZ,
  });
};

/** "9:00 am" on a UK clock. */
export const fmtTime = (d) => {
  const date = asDate(d);
  if (!date) return "—";
  return date
    .toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: UK_TZ,
    })
    .toLowerCase();
};

/** "5 Sep 2026, 9:00 am" on a UK clock. */
export const fmtDateTime = (d) => {
  const date = asDate(d);
  if (!date) return "—";
  return `${fmtDate(date)}, ${fmtTime(date)}`;
};

/** "Fri, 5 Sep 2026 at 9:00 am" — the long read-back under a picker. */
export const fmtDateTimeLong = (d) => {
  const date = asDate(d);
  if (!date) return "";
  const day = date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: UK_TZ,
  });
  return `${day} at ${fmtTime(date)}`;
};

// "YYYY-MM-DD" for <input type="date">, on a UK clock.
export const toInputDate = (d) => {
  const date = asDate(d);
  if (!date) return "";
  const p = ukParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
};

/**
 * Split an instant into the pieces the date + 12-hour time picker binds to.
 * Returns blanks for no date so an empty field stays empty.
 */
export const toUkPickerParts = (d) => {
  const date = asDate(d);
  if (!date) return { date: "", hour: "", minute: "", meridiem: "am" };
  const p = ukParts(date);
  const meridiem = p.hour >= 12 ? "pm" : "am";
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    hour: String(hour12),
    minute: pad(p.minute),
    meridiem,
  };
};

/**
 * The picker's pieces → an ISO instant for the API, or "" when there is no
 * date. A date with no time chosen is treated as 9:00 am, the start of the
 * working day, rather than midnight — "due Friday" almost never means 00:00.
 */
export const ukPickerPartsToISO = ({ date, hour, minute, meridiem }) => {
  if (!date) return "";
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return "";

  const h12 = Number(hour || 9);
  const mins = Number(minute || 0);
  const pm = (meridiem || "am") === "pm";
  const hour24 = h12 === 12 ? (pm ? 12 : 0) : pm ? h12 + 12 : h12;

  return ukToDate({ year, month, day, hour: hour24, minute: mins }).toISOString();
};

// Team members have no name field on the User record — the whole app
// identifies them by email — so derive something readable for a card.
export const displayName = (email) => (email ? email.split("@")[0] : "Unassigned");

/**
 * Plain-English deadline. daysUntilDue comes from the backend and is null when
 * the task has no due date.
 */
export const dueLabel = (task) => {
  const status = normalizeStatus(task?.effectiveStatus || task?.status);
  if (status === "Done" || status === "Cancelled") return status;

  const d = task?.daysUntilDue;
  if (d === null || d === undefined) return "No due date";
  if (d < 0) return `${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} overdue`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `Due in ${d} days`;
};

export const FIELD =
  "w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#F47C3C] focus:bg-white outline-none transition-all text-sm font-medium text-[#0F253B]";
export const LABEL =
  "block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5";