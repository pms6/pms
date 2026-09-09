"use client";

// Export the Available Rooms Status list as an .xlsx laid out like the office
// sheet it replaces: a title row, then a block per status heading (Available,
// then Let Agreed) with the header row and that group's rows beneath it.
//
// xlsx is imported lazily so the library only reaches the browser when someone
// actually exports — the same pattern cleaningSheet.js uses.

export const SHEET_COLUMNS = [
  "Sr. No",
  "Property Name",
  "Ex-Tenant",
  "Paint",
  "Bedsheet",
  "Keys",
  "Issues",
  "Empty Room Date",
  "Room Ready Date",
  "Within 7 Working Days",
];

// Roughly the proportions of the original — Property and Issues are the wide ones.
const COLUMN_WIDTHS = [7, 34, 14, 10, 12, 10, 30, 16, 16, 18];

// The two headings the sheet groups rows under.
export const STATUS_ORDER = ["AVAILABLE", "LET_AGREED"];
export const STATUS_LABEL = { AVAILABLE: "Available", LET_AGREED: "Let Agreed" };

// The sheet writes 20/05/2026.
export const fmtDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB");
};

// The checklist columns read "Done" when ticked and are left blank otherwise —
// the way the handwritten sheet does it.
const tickText = (v) => (v === "DONE" ? "Done" : "");

/**
 * Group rows by status heading, in STATUS_ORDER, preserving row order within
 * each group.
 */
export const groupByStatus = (rows = []) => {
  const groups = STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABEL[status],
    rows: [],
  }));
  const index = new Map(groups.map((g, i) => [g.status, i]));

  for (const row of rows) {
    const i = index.has(row.status) ? index.get(row.status) : 0;
    groups[i].rows.push(row);
  }

  return groups.filter((g) => g.rows.length);
};

/**
 * Build and download the sheet. `rows` is whatever the table is showing, in the
 * order it shows it — the search and status filter are part of the export.
 */
export const exportEmptyRoomSheet = async (rows = []) => {
  const XLSX = await import("xlsx");

  const aoa = [["Available Rooms Status"], []];

  for (const group of groupByStatus(rows)) {
    aoa.push([group.label]);
    aoa.push(SHEET_COLUMNS);
    group.rows.forEach((row, i) => {
      aoa.push([
        i + 1,
        row.property || "",
        row.exTenant || "",
        tickText(row.paint),
        tickText(row.bedsheet),
        tickText(row.keys),
        row.issues || "",
        fmtDate(row.emptyRoomDate),
        fmtDate(row.roomReadyDate),
        row.withinSevenDays ? "Yes" : "",
      ]);
    });
    aoa.push([]);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = COLUMN_WIDTHS.map((wch) => ({ wch }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Available Rooms Status");

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `available-rooms-status-${stamp}.xlsx`);
};
