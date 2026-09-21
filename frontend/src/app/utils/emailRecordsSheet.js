import { fmtDate } from "./cleaningSheet";

/* ------------------------------------------------------------------ *
 * The Email Records sheet — the property-management communication log:
 *
 *   Sr# | Property | Date | Email To | Email From | Issue | Reply | Follow Up
 *
 * plus the database fields around it (status, category, priority, staff,
 * thread). MUST stay in sync with backend/models/EmailRecord.js.
 * ------------------------------------------------------------------ */

// Fallbacks for the option lists, used until GET /email-records/options lands.
export const DEFAULT_OPTIONS = {
  accounts: [
    { email: "info@roomflog.co.uk", purpose: "General property and management correspondence" },
    { email: "tmhours@gmail.com", purpose: "TM Hours / general correspondence" },
    { email: "maintenancetmh@gmail.com", purpose: "Maintenance and repair correspondence" },
  ],
  statuses: ["Open", "Awaiting Reply", "Follow-Up Required", "Resolved", "Closed"],
  doneStatuses: ["Resolved", "Closed"],
  categories: ["Maintenance", "Tenant Issue", "Inspection", "Compliance", "Contractor", "Payment", "Notice", "General"],
  priorities: ["Low", "Medium", "High", "Urgent"],
  channels: ["Email", "Call", "Text", "WhatsApp", "Note"],
};

export const STATUS_TONE = {
  Open: "blue",
  "Awaiting Reply": "amber",
  "Follow-Up Required": "orange",
  Resolved: "green",
  Closed: "gray",
};

export const PRIORITY_TONE = {
  Low: "gray",
  Medium: "blue",
  High: "amber",
  Urgent: "red",
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const isDone = (row) => DEFAULT_OPTIONS.doneStatuses.includes(row.status);

// Follow-up date already passed on a record that is still open.
export const isOverdue = (row) => {
  if (!row.followUpDate || isDone(row)) return false;
  const d = new Date(row.followUpDate);
  return !Number.isNaN(d.getTime()) && d < startOfToday();
};

export const isDueToday = (row) => {
  if (!row.followUpDate || isDone(row)) return false;
  return new Date(row.followUpDate).toDateString() === new Date().toDateString();
};

// Resolved or closed within the last `days` days.
export const resolvedRecently = (row, days = 7) => {
  const at = row.resolvedAt || row.closedAt;
  if (!at) return false;
  return Date.now() - new Date(at).getTime() <= days * 24 * 60 * 60 * 1000;
};

export const replyText = (row) =>
  row.replyReceived
    ? [fmtDate(row.replyDate), row.replySummary].filter(Boolean).join(" — ") || "Received"
    : "No reply";

export const followUpText = (row) =>
  [row.followUpDate ? fmtDate(row.followUpDate) : "", row.followUpNotes].filter(Boolean).join(" — ");

const SHEET_COLUMNS = [
  "Sr#",
  "Property",
  "Date",
  "Channel",
  "Email To",
  "Email From",
  "Subject",
  "Issue",
  "Category",
  "Priority",
  "Status",
  "Reply",
  "Follow Up",
  "Assigned To",
  "Escalated",
  "Created",
  "Updated",
];

const rowCells = (r, i) => [
  i + 1,
  r.property || "",
  fmtDate(r.date),
  r.channel || "Email",
  r.emailTo || "",
  r.emailFrom || "",
  r.subject || "",
  r.issue || "",
  r.category || "",
  r.priority || "",
  r.status || "",
  replyText(r),
  followUpText(r),
  r.assignedToEmail || "",
  r.escalated ? "Yes" : "",
  fmtDate(r.createdAt),
  fmtDate(r.updatedAt),
];

// Excel: the log itself, plus a second sheet with every thread entry.
export const exportEmailRecordsXlsx = async (rows = []) => {
  const XLSX = await import("xlsx");

  const log = XLSX.utils.aoa_to_sheet([
    ["Email Records — Property Management Email Communication Log"],
    [],
    SHEET_COLUMNS,
    ...rows.map(rowCells),
  ]);
  log["!cols"] = [5, 28, 12, 10, 26, 26, 24, 40, 14, 10, 18, 32, 28, 26, 10, 12, 12].map((wch) => ({ wch }));

  const historyAoa = [["Property", "Record date", "Issue", "Entry date", "Channel", "Direction", "From", "To", "Summary", "Logged by"]];
  for (const r of rows) {
    for (const h of r.history || []) {
      historyAoa.push([
        r.property || "",
        fmtDate(r.date),
        r.issue || "",
        fmtDate(h.date),
        h.channel || "",
        h.direction || "",
        h.from || "",
        h.to || "",
        h.summary || "",
        h.createdByEmail || "",
      ]);
    }
  }
  const history = XLSX.utils.aoa_to_sheet(historyAoa);
  history["!cols"] = [28, 12, 36, 12, 10, 10, 24, 24, 48, 24].map((wch) => ({ wch }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, log, "Email Records");
  XLSX.utils.book_append_sheet(workbook, history, "History");

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `email-records-${stamp}.xlsx`);
};

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// PDF: a print-ready page in a new window; the browser's print dialog saves it
// as a PDF. Returns false if a popup blocker stopped the window opening.
export const printEmailRecordsPdf = (rows = [], { title = "Email Records" } = {}) => {
  const cols = ["Sr#", "Property", "Date", "Email To", "Email From", "Issue", "Reply", "Follow Up", "Status", "Priority"];
  const body = rows
    .map(
      (r, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(r.property)}</td>
        <td>${esc(fmtDate(r.date))}</td>
        <td>${esc(r.emailTo)}</td>
        <td>${esc(r.emailFrom)}</td>
        <td>${esc(r.issue)}</td>
        <td>${esc(replyText(r))}</td>
        <td>${esc(followUpText(r))}</td>
        <td>${esc(r.status)}</td>
        <td>${esc(r.priority)}</td>
      </tr>`
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0F253B; margin: 24px; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      p { font-size: 11px; color: #666; margin: 0 0 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
      th { background: #0F253B; color: #fff; }
      tr:nth-child(even) td { background: #f7f7f7; }
      @page { size: A4 landscape; margin: 12mm; }
    </style></head><body>
    <h1>${esc(title)}</h1>
    <p>Property Management — Email Communication Log · ${rows.length} record${rows.length === 1 ? "" : "s"} · printed ${esc(fmtDate(new Date()))}</p>
    <table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>
    <script>window.onload = () => { window.print(); };</script>
    </body></html>`;

  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
};
