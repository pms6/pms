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

// "25/09/2026, 14:30" — thread entries carry a time as well as a date.
export const fmtDateTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("en-GB")}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
};

// The value a <input type="datetime-local"> wants, in local time.
export const toInputDateTime = (value) => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// "YYYY-MM" for the current month, the <input type="month"> format.
export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// "September 2026" for "2026-09".
export const monthLabel = (month) => {
  const [y, m] = String(month || "").split("-").map(Number);
  if (!y || !m) return "";
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};

// Whether a date falls in a "YYYY-MM" month (local time). An empty month
// matches everything.
export const inMonth = (value, month) => {
  if (!month) return true;
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === month;
};

// A record belongs to a month when anything in its conversation happened
// then — the original message or any later reply or message.
export const recordInMonth = (row, month) =>
  !month || inMonth(row.date, month) || (row.history || []).some((h) => inMonth(h.date, month));

// Every message in one record, oldest first: the original email / call /
// message, then everything in its thread.
export const recordEvents = (row) => {
  const list = [
    {
      key: `${row._id}-root`,
      date: row.date,
      record: row,
      original: true,
      entry: {
        channel: row.channel,
        direction: "Original",
        from: row.emailFrom,
        to: row.emailTo,
        summary: [row.subject, row.issue].filter(Boolean).join(" — "),
        files: row.files || [],
        createdByEmail: "",
        emailStatus: row.emailStatus || "",
        emailSentAt: row.emailSentAt,
        emailError: row.emailError || "",
      },
    },
    ...(row.history || []).map((h) => ({ key: h._id, date: h.date, record: row, entry: h })),
  ];
  return list.sort((a, b) => new Date(a.date) - new Date(b.date));
};

const lower = (v) => String(v || "").trim().toLowerCase();

// Groups the log into one conversation per tenant. A record belongs to a
// tenant when it is linked to their tenancy, or — so nothing slips through
// unlinked — when the tenant's email address is on its To / From line.
//
// `tenancies` is GET /tenancies; ended tenancies are no longer in it, so
// their conversations are still found through the name and email the record
// copied in when it was linked.
export const groupByTenant = (rows = [], tenancies = []) => {
  const byId = new Map(tenancies.map((t) => [String(t._id), t]));
  const byEmail = new Map();
  for (const t of tenancies) if (t.tenantEmail) byEmail.set(lower(t.tenantEmail), t);

  const groups = new Map();
  const add = (key, info, row) => {
    if (!groups.has(key)) groups.set(key, { key, ...info, records: [] });
    groups.get(key).records.push(row);
  };

  for (const r of rows) {
    if (r.tenancyId) {
      const t = byId.get(String(r.tenancyId));
      add(`t:${r.tenancyId}`, {
        tenancyId: String(r.tenancyId),
        name: t?.tenant || r.tenantName || "Tenant",
        email: t?.tenantEmail || r.tenantEmail || "",
        property: t?.property || r.property || "",
        current: Boolean(t),
      }, r);
      continue;
    }
    const match = byEmail.get(lower(r.emailFrom)) || byEmail.get(lower(r.emailTo));
    if (match) {
      add(`t:${match._id}`, {
        tenancyId: String(match._id),
        name: match.tenant,
        email: match.tenantEmail,
        property: match.property || "",
        current: true,
      }, r);
    }
  }

  return [...groups.values()].map((g) => ({
    ...g,
    events: g.records.flatMap(recordEvents).sort((a, b) => new Date(a.date) - new Date(b.date)),
  }));
};

const SHEET_COLUMNS = [
  "Sr#",
  "Property",
  "Tenant",
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
  r.tenantName || "",
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

const fileLinks = (files) => (files || []).map((f) => f.url).filter(Boolean).join("\n");

const HISTORY_HEADER = [
  "Property", "Tenant", "Issue", "Date & time", "Channel", "Direction", "From", "To",
  "Message", "Reply", "Attachments", "Logged by",
];
const HISTORY_COLS = [28, 22, 36, 18, 10, 10, 24, 24, 48, 7, 40, 24];

// One row per message — the original and every entry in its thread — with
// its date, time and attachment links.
const historyAoa = (rows) => {
  const aoa = [HISTORY_HEADER];
  for (const r of rows) {
    for (const ev of recordEvents(r)) {
      const h = ev.entry;
      aoa.push([
        r.property || "",
        r.tenantName || "",
        r.issue || "",
        fmtDateTime(ev.date),
        h.channel || "",
        h.direction || "",
        h.from || "",
        h.to || "",
        h.summary || "",
        h.isReply ? "Yes" : "",
        fileLinks(h.files),
        h.createdByEmail || "",
      ]);
    }
  }
  return aoa;
};

// Excel: one tenant's full conversation, message by message.
export const exportTenantConversationXlsx = async (tenant, events = [], month = "") => {
  const XLSX = await import("xlsx");
  const aoa = [
    [`Tenant conversation — ${tenant.name}${month ? ` — ${monthLabel(month)}` : ""}`],
    [[tenant.email, tenant.property].filter(Boolean).join(" · ")],
    [],
    ["Date & time", "Property", "Issue", "Channel", "Direction", "From", "To", "Message", "Reply", "Status", "Attachments", "Logged by"],
    ...events.map((ev) => [
      fmtDateTime(ev.date),
      ev.record.property || "",
      ev.record.issue || "",
      ev.entry.channel || "",
      ev.entry.direction || "",
      ev.entry.from || "",
      ev.entry.to || "",
      ev.entry.summary || "",
      ev.entry.isReply ? "Yes" : "",
      ev.record.status || "",
      fileLinks(ev.entry.files),
      ev.entry.createdByEmail || "",
    ]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = [18, 26, 32, 10, 10, 24, 24, 50, 7, 14, 40, 24].map((wch) => ({ wch }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Conversation");
  const slug = String(tenant.name || "tenant").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  XLSX.writeFile(workbook, `tenant-conversation-${slug}${month ? `-${month}` : ""}.xlsx`);
};

// Excel: the log itself, plus a second sheet with every thread entry.
export const exportEmailRecordsXlsx = async (rows = []) => {
  const XLSX = await import("xlsx");

  const log = XLSX.utils.aoa_to_sheet([
    ["Email Records — Property Management Email Communication Log"],
    [],
    SHEET_COLUMNS,
    ...rows.map(rowCells),
  ]);
  log["!cols"] = [5, 28, 22, 12, 10, 26, 26, 24, 40, 14, 10, 18, 32, 28, 26, 10, 12, 12].map((wch) => ({ wch }));

  const history = XLSX.utils.aoa_to_sheet(historyAoa(rows));
  history["!cols"] = HISTORY_COLS.map((wch) => ({ wch }));

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
