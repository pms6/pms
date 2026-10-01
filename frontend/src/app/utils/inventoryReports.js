// Shared vocabulary and helpers for Inventory Reports (the professional
// check-in / check-out document). MUST stay in sync with
// backend/models/InventoryReport.js and backend/utils/inventoryTemplates.js.

export const JOB_TYPES = ["Inventory", "Check In", "Check Out", "Mid-Term Inspection"];

export const ROW_CONDITIONS = [
  ["", "Not assessed"],
  ["GOOD", "Good"],
  ["FAIR", "Fair"],
  ["POOR", "Poor/Damaged"],
];

export const CONDITION_LABEL = Object.fromEntries(ROW_CONDITIONS);
export const CONDITION_TONE = { GOOD: "green", FAIR: "amber", POOR: "red", "": "gray" };

export const AREA_TYPES = [
  ["FRONT_OF_PROPERTY", "Front of Property"],
  ["ENTRANCE_HALLWAY", "Entrance and Hallway"],
  ["BEDROOM", "Bedroom"],
  ["EN_SUITE", "En Suite"],
  ["BATHROOM", "Bathroom"],
  ["WC", "WC"],
  ["KITCHEN", "Kitchen"],
  ["RECEPTION", "Reception"],
  ["STAIRWELL", "Stairwell"],
  ["LANDING", "Landing"],
  ["GARDEN", "Garden"],
  ["COMMUNAL", "Communal Area"],
  ["OTHER", "Other"],
];

export const AREA_LABEL = Object.fromEntries(AREA_TYPES);

export const STATUS_TONE = { Draft: "amber", Final: "green" };

/**
 * Ref numbers run continuously through the whole report in row order, with an
 * area's "Additional Items Not Present at Inventory" at the end of that area —
 * the same numbering the PDF prints (numberRows in
 * backend/utils/pdf/inventoryReportPdf.js).
 *
 * Returns a Map of row key → ref.
 */
export const refNumbers = (sections = []) => {
  const refs = new Map();
  let n = 0;
  for (const s of sections) {
    const rows = s.rows || [];
    for (const r of rows.filter((x) => !x.additional)) refs.set(r._key, ++n);
    for (const r of rows.filter((x) => x.additional)) refs.set(r._key, ++n);
  }
  return refs;
};

let seq = 0;
/** A stable client-side key for a row or section that has no _id yet. */
export const newKey = () => `k${Date.now().toString(36)}${(seq++).toString(36)}`;

export const blankRow = (over = {}) => ({
  _key: newKey(),
  item: "",
  description: "",
  condition: "",
  conditionComments: "",
  checkInComments: "",
  checkOutComments: "",
  additional: false,
  photos: [],
  ...over,
});

/** Give every section and row the client key the editor tracks them by. */
export const withKeys = (report) => ({
  ...report,
  sections: (report.sections || []).map((s) => ({
    ...s,
    _key: s._id || newKey(),
    rows: (s.rows || []).map((r) => ({ ...r, _key: r._id || newKey() })),
  })),
});

/** Strip the client keys back off before saving. */
export const forSave = (report) => ({
  ...report,
  sections: (report.sections || []).map(({ _key, rows, ...s }) => ({
    ...s,
    rows: (rows || []).map(({ _key: _k, ...r }) => r),
  })),
});

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");
