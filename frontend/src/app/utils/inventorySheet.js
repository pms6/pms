"use client";

// Export the organisation's inventory as an .xlsx sheet — one row per item,
// grouped the way the table shows it (property, then room, then item).
//
// xlsx is imported lazily so the library only reaches the browser when someone
// actually exports — the same pattern internetSheet.js and maintenanceSheet.js
// use.

import { conditionLabel } from "./inventory";

export const SHEET_COLUMNS = [
  "Item",
  "Location",
  "Property",
  "Room / Scope",
  "Qty",
  "Condition",
  "Unit Price",
  "Value",
  "Checked On",
  "Checked By",
  "Notes",
  "Photos",
];

const COLUMN_WIDTHS = [30, 18, 26, 22, 6, 12, 12, 12, 14, 18, 40, 40];

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB");
};

const formatMoney = (value) =>
  typeof value === "number" && !Number.isNaN(value) ? `£${value.toFixed(2)}` : "";

export const scopeLabel = (row) =>
  row.scopeType === "room" ? row.roomName || "Room" : "Whole property";

const rowToCells = (row) => [
  row.item || "",
  row.location || "",
  row.propertyName || "",
  scopeLabel(row),
  Number(row.quantity) || 0,
  conditionLabel(row.condition),
  row.price == null ? "" : formatMoney(Number(row.price)),
  formatMoney(Number(row.value) || 0),
  formatDate(row.checkedOn),
  row.checkedBy || "",
  row.notes || "",
  (row.images || []).map((img) => img.url).filter(Boolean).join("\n"),
];

/**
 * Build and download the sheet. `rows` is whatever the table is currently
 * showing, in the order it shows it — the search box and the property /
 * condition filters are part of the export.
 */
export const exportInventorySheet = async (rows = []) => {
  const XLSX = await import("xlsx");

  const aoa = [["Inventory — Schedule of Condition"], [], SHEET_COLUMNS];
  rows.forEach((row) => aoa.push(rowToCells(row)));

  // A total line, so the sheet answers "what is this portfolio worth" on its own.
  const total = rows.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
  aoa.push([]);
  aoa.push(["", "", "", "", "", "Total", "", formatMoney(total)]);

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = COLUMN_WIDTHS.map((wch) => ({ wch }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `inventory-${stamp}.xlsx`);
};
