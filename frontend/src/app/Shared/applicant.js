// Screening answers captured on the website request form and on the Leads
// board form, stored on the Lead as `applicant`. Shared so every surface that
// renders them — the Leads board, the Applicants table, the lead detail modal —
// shows the same fields in the same order.

// Not every source fills every field: the website form asks for `nationality`
// and `occupancy`, the Leads board form asks for `maritalStatus`,
// `passportCountry` and `rentPayment`. applicantEntries() drops the blanks, so
// each lead shows only what was actually asked of it.
export const APPLICANT_FIELDS = [
  { key: "age", label: "Age" },
  { key: "gender", label: "Gender" },
  { key: "maritalStatus", label: "Marital status" },
  { key: "nationality", label: "Nationality" },
  { key: "passportCountry", label: "Passport country" },
  { key: "moveInDate", label: "Move-in date" },
  { key: "occupancy", label: "Single or couple" },
  { key: "workStatus", label: "Work status" },
  { key: "rentPayment", label: "How rent is paid" },
  { key: "minimumStayMonths", label: "Minimum stay", format: (v) => `${v} months` },
  { key: "smoking", label: "Smoking" },
  { key: "pet", label: "Pet" },
];

// Only the answers actually given — leads created before a question was
// added to either form carry no value for it.
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
