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

export const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

export const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

// "YYYY-MM-DD" for <input type="date">.
export const toInputDate = (d) => {
  if (!d) return "";
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().split("T")[0];
};

// Local "YYYY-MM-DDTHH:mm" for <input type="datetime-local">.
// Uses local timezone (not UTC) so the picker matches what the user sees.
export const toInputDateTime = (d) => {
  if (!d) return "";
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
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