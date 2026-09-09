"use client";

// Export the maintenance booklet as an .xlsx sheet laid out like the
// "Maintenance Sheet" document this section was built from: a title row, a
// header row, then one row per entry with the Solution column carrying the
// procedure heading and its numbered steps as a single wrapped cell.
//
// xlsx is imported lazily so the library only reaches the browser when someone
// actually exports — the same pattern internetSheet.js and the occupancy
// importer use.

// The first seven columns are the original document's, left to right. The rest
// are fields the app records that the handwritten sheet had nowhere to put.
export const SHEET_COLUMNS = [
  "Sr#",
  "Property",
  "Date",
  "Issue",
  "Status",
  "Cost",
  "Solution",
  "Room / Area",
  "Category",
  "Priority",
  "Reported By",
  "Supplier",
  "Ref",
  "Attachments",
];

// Roughly the proportions of the original — Solution is the wide one.
const COLUMN_WIDTHS = [6, 24, 12, 26, 12, 10, 90, 18, 14, 10, 18, 20, 10, 40];

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB");
};

const formatCost = (value) =>
  typeof value === "number" && !Number.isNaN(value) ? `£${value.toFixed(2)}` : "";

const nice = (s) => String(s || "").replace(/_/g, " ");

/**
 * The Solution cell, as the document prints it: the procedure title, then each
 * step numbered with its heading and detail on the following line.
 */
export const solutionText = (row) => {
  const steps = Array.isArray(row.solutionSteps) ? row.solutionSteps : [];
  const lines = [];
  if (row.solutionTitle) lines.push(row.solutionTitle);
  steps.forEach((s, i) => {
    if (s.title) lines.push(`${i + 1}. ${s.title}`);
    if (s.detail) lines.push(s.detail);
  });
  return lines.join("\n");
};

// Attachments are URLs; one per line keeps the cell readable and each link
// clickable once the sheet is opened.
const attachmentsText = (row) => {
  const media = Array.isArray(row.media) ? row.media : [];
  const urls = media.map((f) => f.url).filter(Boolean);
  if (row.image && !urls.includes(row.image)) urls.unshift(row.image);
  return urls.join("\n");
};

const rowToCells = (row, srNo) => [
  srNo,
  row.property || "",
  formatDate(row.date),
  row.title || "",
  nice(row.status),
  formatCost(row.cost),
  solutionText(row),
  row.room || "",
  row.category || "",
  row.priority || "",
  row.reportedBy || "",
  row.supplier || "",
  row.ref || "",
  attachmentsText(row),
];

/**
 * Build and download the sheet. `rows` is whatever the booklet is currently
 * showing, in the order it shows it — the search box and status filter are part
 * of the export, so an operator can hand over just the pending work.
 */
export const exportMaintenanceSheet = async (rows = []) => {
  const XLSX = await import("xlsx");

  const aoa = [["Maintenance Booklet"], [], SHEET_COLUMNS];
  // Sr# is the row's position in this export — 1..N, no gaps from removed rows.
  rows.forEach((row, i) => aoa.push(rowToCells(row, i + 1)));

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = COLUMN_WIDTHS.map((wch) => ({ wch }));

  // The Solution cell is multi-line, so it needs wrapping and a taller row to
  // open the way it reads in the original document.
  const headerRows = 3;
  worksheet["!rows"] = aoa.map((_, i) => (i < headerRows ? {} : { hpt: 90 }));
  for (let i = 0; i < rows.length; i += 1) {
    const address = XLSX.utils.encode_cell({ r: headerRows + i, c: 6 });
    const cell = worksheet[address];
    if (cell) cell.s = { alignment: { wrapText: true, vertical: "top" } };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Maintenance");

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `maintenance-booklet-${stamp}.xlsx`);
};
