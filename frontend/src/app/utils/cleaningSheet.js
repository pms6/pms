"use client";

// Export the cleaning schedule as an .xlsx laid out like the "Cleaning Messages
// Schedule" Google Sheet it replaces: a title row, a month band, the header
// row, then the rows for that month — repeated per month when the table is
// showing more than one.
//
// xlsx is imported lazily so the library only reaches the browser when someone
// actually exports — the same pattern internetSheet.js and maintenanceSheet.js
// use.

export const SHEET_COLUMNS = ["Property", "Category", "Date", "Day", "Status"];

// Roughly the proportions of the original — Property is the wide one.
const COLUMN_WIDTHS = [38, 22, 14, 14, 12, 20, 10, 46, 40];

// The sheet writes 20/05/2026.
export const fmtDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB");
};

// The weekday is derived from the date, never stored, so the two can't drift.
export const dayName = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { weekday: "long" });
};

// "2026-05" — the key the month band and the API filter share.
export const monthKey = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// "May 2026" — the band across the top of each month's block.
export const monthLabel = (key) => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(key || ""));
  if (!m) return "";
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
};

// The sheet leaves the cell blank rather than writing "Pending".
const statusText = (status) => (status === "DONE" ? "Done" : "");

/**
 * Group rows into the sheet's month blocks, newest month first, preserving the
 * order rows arrive in (the API already sorts by date).
 */
export const groupByMonth = (rows = []) => {
  const groups = [];
  const index = new Map();

  for (const row of rows) {
    const key = monthKey(row.date);
    if (!index.has(key)) {
      index.set(key, groups.length);
      groups.push({ month: key, label: monthLabel(key), rows: [] });
    }
    groups[index.get(key)].rows.push(row);
  }

  return groups;
};

/**
 * Build and download the sheet. `rows` is whatever the table is showing, in the
 * order it shows it — the search box and the month / status filters are part of
 * the export.
 *
 * `extended` adds the Contact, Message and Notes columns the app records
 * but the handwritten sheet had nowhere to put.
 */
const contactText = (row) =>
  [
    row.emailSent && `Email${row.contactEmail ? `: ${row.contactEmail}` : ""}`,
    row.callMade && `Call${row.contactPhone ? `: ${row.contactPhone}` : ""}`,
  ]
    .filter(Boolean)
    .join(" / ");

// Rows written before categories existed read as the schema's default, so the
// export never leaves the column blank.
const categoryText = (row) => row.category || "Fridge Cleaning";

// The files themselves cannot go in a spreadsheet, so the count is what is
// worth carrying — it says which visits have evidence behind them.
const filesCount = (row) => (Array.isArray(row.files) ? row.files.length : 0);

export const exportCleaningSheet = async (rows = [], { extended = true } = {}) => {
  const XLSX = await import("xlsx");

  const columns = extended
    ? [...SHEET_COLUMNS, "Contact", "Files", "Message", "Notes"]
    : SHEET_COLUMNS;
  const aoa = [["Cleaning Messages Schedule"], []];

  for (const group of groupByMonth(rows)) {
    aoa.push([group.label || "Undated"]);
    aoa.push(columns);
    for (const row of group.rows) {
      const cells = [
        row.property || "",
        categoryText(row),
        fmtDate(row.date),
        dayName(row.date),
        statusText(row.status),
      ];
      if (extended)
        cells.push(
          contactText(row),
          filesCount(row) || "",
          row.message || "",
          row.notes || ""
        );
      aoa.push(cells);
    }
    aoa.push([]);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = COLUMN_WIDTHS.slice(0, columns.length).map((wch) => ({ wch }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Cleaning Schedule");

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `cleaning-schedule-${stamp}.xlsx`);
};
