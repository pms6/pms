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

/**
 * How long a client has been with us overall — from their FIRST move-in date to
 * today, not from the contract they happen to be on.
 *
 * This is deliberately not `contractDuration(contractStart, contractEnd)`. A
 * renewal writes new contract dates; it does not touch firstMoveInDate, so the
 * overall stay carries straight through a renewal instead of resetting to zero.
 *
 * `days` is whole elapsed days, counted between UTC midnights so a time of day
 * stored on either date cannot shift the count by one. The calendar breakdown
 * beside it is the same arithmetic contractDuration uses, so "2 years 8 months
 * 17 days" and the day count always describe the same span.
 *
 * Returns null for a missing, unparseable or future first move-in date — a
 * client cannot have stayed for a negative number of days.
 */
export const stayDuration = (firstMoveIn, asOf = new Date()) => {
  if (!firstMoveIn) return null;

  const from = new Date(firstMoveIn);
  const to = new Date(asOf);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return null;

  const midnight = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const days = Math.floor((midnight(to) - midnight(from)) / 86400000);

  const calendar = contractDuration(from, to) || { years: 0, months: 0, days: 0 };

  return {
    // The headline: total days since the first move-in.
    days,
    // The same span read as a calendar, for the months/years view.
    years: calendar.years,
    months: calendar.months,
    dayPart: calendar.days,
    // Whole months elapsed — "he has been with us 32 months".
    totalMonths: calendar.years * 12 + calendar.months,
  };
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
