// utils/voidMath.js
//
// The one implementation of the void calculation.
//
// It was previously written out three times — the model's pre-validate hook,
// the controller, and the admin page — which is how the stored daily rate and
// the figure on screen were free to disagree. Both server copies now call this;
// the frontend mirrors it in src/app/admin/void/page.js for the live preview.
//
//   daily rent = monthly rent / 30      e.g. 700 / 30 = 23.3333
//   total void = daily rent x void days

// A month is treated as 30 days flat, whatever the calendar month actually is.
// That is the convention the business asked for, and it keeps a February void
// costing the same per day as an August one.
export const DAYS_IN_MONTH = 30;

// The daily rate is REPORTED to 4 decimal places, because 700/30 is 23.3333 and
// showing 23.33 makes the arithmetic on screen look wrong.
export const RATE_DP = 4;

const MS_PER_DAY = 86400000;

/** Round to `dp` decimal places, returning a Number rather than a string. */
const round = (value, dp) => Number(Number(value || 0).toFixed(dp));

/** Money is always 2dp — it is what actually gets invoiced. */
export const toMoney = (value) => round(value, 2);

/** The unrounded daily rate. Use this for arithmetic, never for display. */
export const exactDailyRent = (rentAmount) =>
  Number(rentAmount || 0) / DAYS_IN_MONTH;

/** The daily rate as it is stored and shown: 700/30 -> 23.3333. */
export const dailyRentOf = (rentAmount) => round(exactDailyRent(rentAmount), RATE_DP);

/**
 * Void days, counting BOTH end dates — a void from the 1st to the 3rd is three
 * days without rent, not two.
 */
export const voidDaysBetween = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  const diffMs = Math.max(0, end.getTime() - start.getTime());
  return Math.max(1, Math.round(diffMs / MS_PER_DAY) + 1);
};

/**
 * Everything the void record stores, from a monthly rent and a date range.
 *
 * The total is computed from the UNROUNDED daily rate and only then rounded to
 * pence. Multiplying the rounded 23.33 by 30 gives £699.90 — a tenth of a pound
 * short of the month that was actually lost, and the error grows with the
 * length of the void.
 */
export const calculateVoidMetrics = (rentAmount, startDate, endDate) => {
  const dailyRent = dailyRentOf(rentAmount);
  const voidDays = voidDaysBetween(startDate, endDate);

  if (!voidDays) {
    return { dailyRent, voidDays: 0, totalVoid: 0 };
  }

  return {
    dailyRent,
    voidDays,
    totalVoid: toMoney(exactDailyRent(rentAmount) * voidDays),
  };
};
