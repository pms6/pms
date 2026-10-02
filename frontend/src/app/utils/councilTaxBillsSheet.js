import { fmtDate } from "./cleaningSheet";

/* ------------------------------------------------------------------ *
 * The Council Tax and Bills sheets, printed the way the office's PDFs read:
 *
 *   Council Tax   Sr# | Property | Council | Account Holder Name |
 *                 Account# | Move in Date | Email | Details | Total |
 *                 Instalments | Paid | Outstanding | Next Due
 *   Bills Record  Sr# | Name of property | Date | Type | Payment name |
 *                 Amount | Status | Bill
 *
 * MUST stay in sync with backend/models/CouncilTax.js and
 * backend/models/BillRecord.js.
 * ------------------------------------------------------------------ */

// Blank stays blank on the sheet — an unknown instalment is not £0.00.
export const moneyOrBlank = (n) =>
  n === null || n === undefined || n === ""
    ? ""
    : `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// A council tax row's instalments. Rows entered before instalments became a
// list carry two fixed amounts and one status for the whole row instead, so
// those are read back as a list of up to two.
export const installmentsOf = (row) => {
  if (Array.isArray(row?.installments) && row.installments.length) return row.installments;
  return [row?.firstInstallment, row?.secondInstallment]
    .filter((amount) => amount !== null && amount !== undefined && amount !== "")
    .map((amount) => ({
      amount,
      dueDate: null,
      paidAt: row.status === "Paid" ? row.paidAt || null : null,
    }));
};

// A total typed in by hand, or null when none was entered.
const enteredTotal = (row) => {
  const v = row?.totalAmount;
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// What a row's instalments add up to. An instalment is paid once it has a
// paidAt; `nextDue` is the earliest due date still unpaid ("" when none).
// The total is the one entered by hand when there is one, otherwise the sum of
// the instalments; outstanding is whatever of it is not yet paid.
export const installmentSummary = (row) => {
  const list = installmentsOf(row);
  const sum = (items) => items.reduce((total, i) => total + Number(i.amount || 0), 0);
  const unpaid = list.filter((i) => !i.paidAt);
  const paid = sum(list.filter((i) => i.paidAt));
  const manualTotal = enteredTotal(row);
  const total = manualTotal ?? sum(list);
  const outstanding = Math.max(0, total - paid);
  const nextDue = unpaid
    .map((i) => i.dueDate)
    .filter(Boolean)
    .sort((a, b) => new Date(a) - new Date(b))[0];

  return {
    list,
    total,
    paid,
    outstanding,
    // Whether the total came from the bill rather than the instalments.
    manualTotal: manualTotal !== null,
    // Entered total minus what the instalments list (negative when they list
    // more than the bill does) — 0 when there is no entered total.
    unscheduled: manualTotal === null ? 0 : manualTotal - sum(list),
    paidCount: list.length - unpaid.length,
    nextDue: nextDue || "",
  };
};

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// Multi-line cells (the council tax "Details") keep their line breaks.
const multiline = (v) => esc(v).replace(/\n/g, "<br>");

const COUNCIL_TAX_COLUMNS = [
  "Sr#",
  "Property",
  "Council",
  "Account Holder Name",
  "Account#",
  "Move in Date",
  "Email",
  "Details",
  "Total",
  "Instalments",
  "Paid",
  "Outstanding",
  "Next Due",
];

// One line per instalment: "1. £120.00 - due 01/10/2026 - paid 03/10/2026".
const installmentLine = (inst, i) =>
  [
    `${i + 1}. ${moneyOrBlank(inst.amount) || "—"}`,
    inst.dueDate ? `due ${fmtDate(inst.dueDate)}` : "",
    inst.paidAt ? `paid ${fmtDate(inst.paidAt)}` : "unpaid",
    Array.isArray(inst.files) && inst.files.length ? `proof attached (${inst.files.length})` : "",
  ]
    .filter(Boolean)
    .join(" - ");

const councilTaxCells = (r, i) => {
  const s = installmentSummary(r);
  const any = s.list.length > 0 || s.manualTotal;
  return [
    i + 1,
    esc(r.property),
    esc(r.councilName),
    esc(r.accountHolder),
    esc(r.accountNumber),
    esc(fmtDate(r.moveInDate)),
    esc(r.email),
    multiline(r.details),
    esc(any ? moneyOrBlank(s.total) : ""),
    multiline(s.list.map(installmentLine).join("\n")),
    esc(any ? moneyOrBlank(s.paid) : ""),
    esc(any ? moneyOrBlank(s.outstanding) : ""),
    esc(fmtDate(s.nextDue)),
  ];
};

const BILL_COLUMNS = [
  "Sr#",
  "Name of property",
  "Date",
  "Type (Octopus Energy, Gas, Water, Electricity)",
  "Payment name",
  "Amount",
  "Status",
  "Bill",
];

const billCells = (r, i) => [
  i + 1,
  esc(r.property),
  esc(fmtDate(r.date)),
  esc(r.type),
  multiline(r.paymentName),
  esc(moneyOrBlank(r.amount)),
  esc(r.status),
  esc(r.bill),
];

// A print-ready page in a new window; the browser's print dialog saves it as a
// PDF. Returns false if a popup blocker stopped the window opening.
const printSheet = ({ company, title, columns, rows }) => {
  const body = rows
    .map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0F253B; margin: 24px; }
      .company { text-align: center; font-size: 16px; font-weight: bold; margin: 0; }
      h1 { text-align: center; font-size: 14px; font-weight: bold; margin: 2px 0 14px; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      th, td { border: 1px solid #999; padding: 5px 6px; text-align: left; vertical-align: top; }
      th { background: #e8e8e8; }
      td:first-child, th:first-child { width: 28px; text-align: center; }
      .empty { text-align: center; color: #888; padding: 20px; }
      @page { size: A4 landscape; margin: 12mm; }
    </style></head><body>
    ${company ? `<p class="company">${esc(company)}</p>` : ""}
    <h1>${esc(title)}</h1>
    <table>
      <thead><tr>${columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>${body || `<tr><td class="empty" colspan="${columns.length}">No entries</td></tr>`}</tbody>
    </table>
    <script>window.onload = () => { window.print(); };</script>
    </body></html>`;

  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
};

export const printCouncilTaxPdf = (rows = [], { company = "" } = {}) =>
  printSheet({
    company,
    title: "Council Tax",
    columns: COUNCIL_TAX_COLUMNS,
    rows: rows.map(councilTaxCells),
  });

// `title` carries the month when the list is filtered to one ("Bills Record - Sep").
export const printBillsPdf = (rows = [], { company = "", title = "Bills Record" } = {}) =>
  printSheet({
    company,
    title,
    columns: BILL_COLUMNS,
    rows: rows.map(billCells),
  });
