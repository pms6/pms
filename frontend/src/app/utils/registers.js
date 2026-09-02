// Shared vocabulary and formatting for the admin "Database" registers —
// Room Status List, Check-in, Deposit and Check-out.
//
// The four screens read the same records from different angles, so the enum
// labels, tones and the money/date formatting live here rather than being
// re-declared (and drifting) on each page.
//
// The enum VALUES must stay in sync with the backend:
//   DEPOSIT_STATUS, CHECKOUT_CONTRACT_STATUS  → backend/models/CheckOut.js
//   ROOM_STATUSES                             → backend/controllers/roomStatus.controller.js
//   REGISTER_STATUS                           → backend/controllers/depositRegister.controller.js

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** £1,234 — whole pounds, as the spreadsheets write it. */
export const money = (n) =>
  "£" + Number(n || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 });

/** 14 Oct 2025. Returns an em dash for a missing date so table cells align. */
export const date = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

/** An ISO yyyy-mm-dd for a <input type="date">, or "" when there is no date. */
export const dateInput = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

/** "1st", "2nd", "23rd" — the rent due day, as a day of the month. */
export const ordinal = (n) => {
  if (n === null || n === undefined || n === "") return "—";
  const day = Number(n);
  if (!Number.isInteger(day)) return "—";
  const suffix =
    day % 100 >= 11 && day % 100 <= 13
      ? "th"
      : { 1: "st", 2: "nd", 3: "rd" }[day % 10] || "th";
  return day + suffix;
};

/** "0 Years 5 Months 27 Days", trimmed of the leading zero units. */
export const duration = (d) => {
  if (!d) return "—";
  const parts = [];
  if (d.years) parts.push(d.years + (d.years === 1 ? " year" : " years"));
  if (d.months) parts.push(d.months + (d.months === 1 ? " month" : " months"));
  if (d.days) parts.push(d.days + (d.days === 1 ? " day" : " days"));
  return parts.length ? parts.join(" ") : "0 days";
};

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The six years the year filters offer, newest first. Matches the backend. */
export const yearOptions = () => {
  const now = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => now - i);
};

// ---------------------------------------------------------------------------
// Room status — Room.status
// ---------------------------------------------------------------------------

export const ROOM_STATUSES = [
  "OCCUPIED",
  "RESERVED",
  "AVAILABLE_SOON",
  "AVAILABLE",
  "MAINTENANCE",
];

export const ROOM_STATUS_LABEL = {
  OCCUPIED: "Occupied",
  RESERVED: "Reserved",
  AVAILABLE_SOON: "Available soon",
  AVAILABLE: "Available",
  MAINTENANCE: "Maintenance",
};

// Tones map onto Badge in Shared/ui.js. Occupied is the healthy state for a
// let room, so it is the green one; an empty room is the one costing money.
export const ROOM_STATUS_TONE = {
  OCCUPIED: "green",
  RESERVED: "blue",
  AVAILABLE_SOON: "amber",
  AVAILABLE: "orange",
  MAINTENANCE: "red",
};

// ---------------------------------------------------------------------------
// Deposits — CheckOut.depositStatus, plus HELD for a deposit not yet settled
// ---------------------------------------------------------------------------

export const DEPOSIT_STATUSES = [
  "PENDING",
  "RETURNED",
  "PARTIALLY_RETURNED",
  "USED_AS_RENT",
  "WITHHELD",
];

export const REGISTER_STATUSES = ["HELD", ...DEPOSIT_STATUSES];

export const DEPOSIT_STATUS_LABEL = {
  HELD: "Held",
  PENDING: "Pending",
  RETURNED: "Returned",
  PARTIALLY_RETURNED: "Part returned",
  USED_AS_RENT: "Used as rent",
  WITHHELD: "Withheld",
};

export const DEPOSIT_STATUS_TONE = {
  HELD: "blue",
  PENDING: "amber",
  RETURNED: "green",
  PARTIALLY_RETURNED: "orange",
  USED_AS_RENT: "gray",
  WITHHELD: "red",
};

// ---------------------------------------------------------------------------
// Check-out — contract outcome, checklist and inspection
// ---------------------------------------------------------------------------

export const CONTRACT_STATUSES = ["ONGOING", "COMPLETED", "BREAK", "CANCELLED"];

export const CONTRACT_STATUS_LABEL = {
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
  BREAK: "Break clause",
  CANCELLED: "Cancelled",
};

export const CONTRACT_STATUS_TONE = {
  ONGOING: "blue",
  COMPLETED: "green",
  BREAK: "amber",
  CANCELLED: "red",
};

export const INSPECTION_STATUSES = ["PENDING", "DONE", "NOT_REQUIRED"];

export const INSPECTION_LABEL = {
  PENDING: "Pending",
  DONE: "Done",
  NOT_REQUIRED: "Not required",
};

export const INSPECTION_TONE = {
  PENDING: "amber",
  DONE: "green",
  NOT_REQUIRED: "gray",
};

// The move-out checklist, in the order the check-out sheet lists it. `key`
// matches the CheckOut field; the form and the table both read this array so
// adding a column is a one-line change.
export const CHECKLIST = [
  { key: "pictures", label: "Pictures" },
  { key: "videos", label: "Videos" },
  { key: "fridgeCleaning", label: "Fridge cleaning" },
  { key: "bedsheets", label: "Bedsheets" },
  { key: "cupboardClean", label: "Cupboard clean" },
  { key: "roomClean", label: "Room clean" },
];

/** How many checklist items are answered YES, out of how many there are. */
export const checklistScore = (row) => ({
  done: CHECKLIST.filter((c) => row[c.key] === "YES").length,
  total: CHECKLIST.length,
});

// ---------------------------------------------------------------------------
// Reference data — ReferenceData.exLandlord / employer / nextOfKin
//
// Values MUST stay in sync with REFERENCE_STATUS and KIN_RELATIONSHIPS in
// backend/models/ReferenceData.js.
// ---------------------------------------------------------------------------

export const REFERENCE_STATUSES = ["PENDING", "VERIFIED", "FAILED", "NOT_REQUIRED"];

export const REFERENCE_STATUS_LABEL = {
  PENDING: "Pending",
  VERIFIED: "Verified",
  FAILED: "Failed",
  NOT_REQUIRED: "Not required",
};

export const REFERENCE_STATUS_TONE = {
  PENDING: "amber",
  VERIFIED: "green",
  FAILED: "red",
  NOT_REQUIRED: "gray",
};

// The three references the sheet collects, in its own column order. `key`
// matches the ReferenceData field, so the form and the table both read this
// array and adding a fourth reference is a one-line change.
export const REFERENCE_BLOCKS = [
  { key: "exLandlord", label: "Ex Landlord" },
  { key: "employer", label: "Job" },
  { key: "nextOfKin", label: "Next of Kin" },
];

// Suggestions only — the field is free text, so an unusual relationship is
// recorded as the office wrote it.
export const KIN_RELATIONSHIPS = [
  "Parent",
  "Mother",
  "Father",
  "Sibling",
  "Sister",
  "Brother",
  "Partner",
  "Spouse",
  "Girlfriend",
  "Boyfriend",
  "Friend",
  "Colleague",
  "Other",
];

/** A reference counts as collected once there is any way to reach anyone. */
export const isCollected = (block) =>
  Boolean(block && (block.contact || block.email || block.name || block.note));

export const GENDERS = [
  { value: "", label: "—" },
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

// Suggestions only — the field is a free string, because the sheets spell the
// same bank several ways and historic rows have to import unchanged.
export const BANKS = ["Monzo", "TSB", "HSBC", "Barclays", "Lloyds", "NatWest", "Starling", "Revolut"];

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

/**
 * Download `rows` as a CSV. `columns` is [{ header, value }] where value is a
 * function of the row — the same shape the tables render from.
 *
 * A leading =, +, - or @ is prefixed with a single quote: Excel would otherwise
 * treat the cell as a formula, and these registers carry operator free text.
 */
export const exportCsv = (filename, columns, rows) => {
  return writeCsv(filename, columns, rows);
};

/**
 * Download a single row, using the same column definition as the full export
 * so the two can never describe a record differently.
 *
 * `name` becomes part of the filename — a tenant or property, whatever
 * identifies the row — so a folder of these is still readable later.
 */
export const exportRowCsv = (prefix, name, columns, row) => {
  const safe = String(name || "record")
    .replace(/[^a-zA-Z0-9-_ ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60) || "record";
  return writeCsv(`${prefix}-${safe}.csv`, columns, [row]);
};

const writeCsv = (filename, columns, rows) => {
  const escape = (value) => {
    let s = value === null || value === undefined ? "" : String(value);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };

  const lines = [
    columns.map((c) => escape(c.header)).join(","),
    ...rows.map((row) => columns.map((c) => escape(c.value(row))).join(",")),
  ];

  // The BOM makes Excel open the file as UTF-8 — without it the tenant names
  // in these registers come out mangled.
  const blob = new Blob(["﻿" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
