/**
 * The Database sheet's "Total Duration" column, split into years / months /
 * days. Calendar arithmetic rather than a day count, so a six-month contract
 * reads "6 Months 0 Days" regardless of which months it spans.
 *
 * Shared by the room status list and the client database, which both render
 * the column — one implementation, so the two screens cannot disagree about
 * how long the same contract is.
 *
 * Returns null for a missing, unparseable or reversed pair of dates.
 */
export const contractDuration = (start, end) => {
  if (!start || !end) return null;

  const from = new Date(start);
  const to = new Date(end);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return null;

  let years = to.getUTCFullYear() - from.getUTCFullYear();
  let months = to.getUTCMonth() - from.getUTCMonth();
  let days = to.getUTCDate() - from.getUTCDate();

  if (days < 0) {
    months -= 1;
    // Day 0 of a month is the last day of the month before it, which gives the
    // length of the month we are borrowing from.
    days += new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 0)).getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, days };
};

/** The sheet writes gender and nationality in one cell: "Female: British". */
export const genderAndNationality = (record) => {
  const raw = record?.gender || "";
  const gender = raw ? raw.charAt(0) + raw.slice(1).toLowerCase() : "";
  const nationality = record?.nationality || "";
  if (gender && nationality) return gender + ": " + nationality;
  return gender || nationality || "";
};

export default contractDuration;
