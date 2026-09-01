"use client";

// Export the broadband register as an .xlsx sheet laid out like the
// "Internet Details" document this section was built from: one title row, one
// header row, then a section per provider (carrying the provider's support
// number, as the original does) with Sr. No restarting at 1 inside each.
//
// xlsx is imported lazily so the library only reaches the browser when someone
// actually exports — this is the same pattern the occupancy importer uses.

// Column order is the sheet's own, left to right. The last column is unheaded
// in the original document; it holds the email the account sits under, so it is
// named here rather than left blank. Router Photo is ours — the original had
// nowhere to put one.
export const SHEET_COLUMNS = [
  "Sr. No",
  "Property Name",
  "Account#",
  "Area Ref",
  "Account Holder",
  "Provider Name",
  "Contract Start",
  "Contract End",
  "Amount",
  "Payment Method",
  "Company Name",
  "Bank Name",
  "Bank Details",
  "Security Question",
  "User Name",
  "Password",
  "Router Location",
  "Account Email",
  "Router Photo",
];

// Roughly the proportions of the original, so the export opens readable rather
// than as nineteen identical columns.
const COLUMN_WIDTHS = [
  6, 34, 14, 10, 16, 16, 14, 14, 10, 14, 26, 12, 26, 24, 14, 16, 22, 24, 40,
];

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const formatAmount = (value) =>
  typeof value === "number" && !Number.isNaN(value) ? `£${value.toFixed(2)}` : "";

const rowToCells = (row, srNo) => [
  srNo,
  row.propertyName || "",
  row.accountNumber || "",
  row.areaRef || "",
  row.accountHolder || "",
  row.providerName || "",
  formatDate(row.contractStart),
  formatDate(row.contractEnd),
  formatAmount(row.amount),
  row.paymentMethod || "",
  row.companyName || "",
  row.bankName || "",
  row.bankDetails || "",
  row.securityQuestion || "",
  row.userName || "",
  row.password || "",
  row.routerLocation || "",
  row.accountEmail || "",
  row.routerImage?.url || "",
];

/**
 * Group rows by provider, preserving the order they arrive in (the API already
 * sorts by provider then property).
 */
export const groupByProvider = (rows = []) => {
  const groups = [];
  const index = new Map();

  for (const row of rows) {
    const key = row.providerName || "Unspecified";
    if (!index.has(key)) {
      index.set(key, groups.length);
      groups.push({ provider: key, phone: row.providerPhone || "", rows: [] });
    }
    const group = groups[index.get(key)];
    // The support number lives on the section heading in the original, so the
    // first row that carries one supplies it for the whole group.
    if (!group.phone && row.providerPhone) group.phone = row.providerPhone;
    group.rows.push(row);
  }

  return groups;
};

/**
 * Build and download the sheet. `rows` is the API's list; nothing is filtered
 * here, so whatever the page is showing is what gets exported.
 */
export const exportInternetSheet = async (rows = []) => {
  const XLSX = await import("xlsx");

  const aoa = [["Internet Details"], [], SHEET_COLUMNS];

  for (const group of groupByProvider(rows)) {
    const heading = group.phone
      ? `${group.provider} — ${group.phone}`
      : group.provider;
    aoa.push([heading]);

    group.rows.forEach((row, i) => aoa.push(rowToCells(row, i + 1)));
  }

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = COLUMN_WIDTHS.map((wch) => ({ wch }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Internet Details");

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `internet-details-${stamp}.xlsx`);
};
