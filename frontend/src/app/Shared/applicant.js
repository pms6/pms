// Screening answers captured on the website request form and stored on the
// Lead as `applicant`. Shared so every surface that renders them — the Leads
// board, the Applicants table — shows the same fields in the same order.

export const APPLICANT_FIELDS = [
  { key: "age", label: "Age" },
  { key: "gender", label: "Gender" },
  { key: "nationality", label: "Nationality" },
  { key: "moveInDate", label: "Move-in date" },
  { key: "occupancy", label: "Single or couple" },
  { key: "workStatus", label: "Work status" },
  { key: "minimumStayMonths", label: "Minimum stay", format: (v) => `${v} months` },
  { key: "smoking", label: "Smoking" },
  { key: "pet", label: "Pet" },
];

// Only the answers actually given — a lead an operator typed in by hand has none.
export function applicantEntries(applicant) {
  if (!applicant) return [];
  return APPLICANT_FIELDS.filter(({ key }) => {
    const v = applicant[key];
    return v !== undefined && v !== null && v !== "";
  }).map(({ key, label, format }) => ({
    key,
    label,
    value: format ? format(applicant[key]) : String(applicant[key]),
  }));
}
