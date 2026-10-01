// Tenant Case vocabulary — MUST stay in sync with backend/models/TenantCase.js.

export const CASE_STATUSES = ["Open", "In Progress", "Pending", "Resolved", "Closed"];
export const CASE_DONE_STATUSES = ["Resolved", "Closed"];

export const CASE_CATEGORIES = [
  "Complaint",
  "Maintenance",
  "Rent / Payment",
  "Deposit",
  "Notice",
  "Anti-social Behaviour",
  "Tenancy",
  "Other",
];

export const CASE_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

export const CASE_STATUS_TONE = {
  Open: "blue",
  "In Progress": "orange",
  Pending: "amber",
  Resolved: "green",
  Closed: "gray",
};

export const CASE_PRIORITY_TONE = { Low: "gray", Medium: "blue", High: "amber", Urgent: "red" };

export const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
