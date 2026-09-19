// utils/cleaningPlan.js
//
// The rules behind the automatic cleaning schedule, and the code that applies
// them. The office's rules are:
//
//   - Cleaning Schedule: two properties cleaned each day, Sundays excluded, the
//     whole portfolio rotating through.
//   - Fridge Cleaning:           once a month, per property.
//   - Washing Machine Descaling: once a month, per property.
//   - Self Inspection:           every 3 months, for every room.
//
// Dates are UTC midnights throughout, matching how the board stores them (an
// <input type="date"> value becomes a UTC-midnight Date) and how the month
// filter in the controller reads them.
import Property from "../models/Property.js";
import Room from "../models/room.js";
import CleaningSchedule from "../models/CleaningSchedule.js";

export const PROPERTIES_PER_DAY = 2;

// Categories that repeat on a calendar interval rather than in the daily
// rotation. MUST match the names in CLEANING_CATEGORIES on the model.
export const RECURRING = {
  "Fridge Cleaning": { months: 1 },
  "Washing Machine Descaling": { months: 1 },
  "Self Inspection": { months: 3 },
};

const ROTATION = "Cleaning Schedule";
const DAY_MS = 24 * 60 * 60 * 1000;

// How far ahead of its due date a repeat task is put on the board.
const RECURRING_LOOKAHEAD_DAYS = 30;

/* ------------------------------------------------------------------ *
 * Date helpers
 * ------------------------------------------------------------------ */
export const utcDay = (value = new Date()) => {
  const d = new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

export const addDays = (date, n) => new Date(utcDay(date).getTime() + n * DAY_MS);

const isSunday = (date) => new Date(date).getUTCDay() === 0;

// The Monday strictly after `from` — a Monday itself moves on to the next one.
export const nextMonday = (from = new Date()) => {
  const d = utcDay(from);
  return addDays(d, ((8 - d.getUTCDay()) % 7) || 7);
};

// Sunday is never a working day for the rotation, so a date that lands on one
// moves to the Monday.
export const nextWorkingDay = (date) => (isSunday(date) ? addDays(date, 1) : utcDay(date));

// Calendar-month arithmetic that clamps rather than overflows: 31 Jan + 1 month
// is 28/29 Feb, not 3 March.
export const addMonths = (date, months) => {
  const d = utcDay(date);
  const target = d.getUTCMonth() + months;
  const year = d.getUTCFullYear() + Math.floor(target / 12);
  const month = ((target % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(d.getUTCDate(), lastDay)));
};

// 1970-01-05 was a Monday. Working days are numbered from there with Sundays
// skipped, so the gap between two dates in working days is a subtraction.
const MONDAY_EPOCH = Date.UTC(1970, 0, 5);
export const workIndex = (date) => {
  const n = Math.floor((utcDay(date).getTime() - MONDAY_EPOCH) / DAY_MS);
  return Math.floor(n / 7) * 6 + Math.min(((n % 7) + 7) % 7, 6);
};

export const addWorkingDays = (date, count) => {
  let d = utcDay(date);
  let left = count;
  while (left > 0) {
    d = addDays(d, 1);
    if (!isSunday(d)) left--;
  }
  return d;
};

// Every non-Sunday from `from` to `to`, inclusive.
const workingDaysBetween = (from, to) => {
  const days = [];
  for (let d = utcDay(from); d <= to; d = addDays(d, 1)) {
    if (!isSunday(d)) days.push(d);
  }
  return days;
};

const dayKey = (date) => utcDay(date).toISOString().slice(0, 10);

/* ------------------------------------------------------------------ *
 * Next due date
 * ------------------------------------------------------------------ */

// Working days between two cleans of the same property. With two properties a
// day, a portfolio of N properties comes round every N / 2 working days —
// 21 properties, 10 working days.
export const cycleWorkingDays = (propertyCount) =>
  Math.max(1, Math.floor(Number(propertyCount || 0) / PROPERTIES_PER_DAY));

/**
 * When a task recorded for `date` is due again. Fridge and washing machine are
 * a month on, a self inspection three months on, and a rotation clean one full
 * turn of the portfolio on.
 */
export const computeNextDue = (category, date, cycleDays) => {
  if (!date) return null;
  const rule = RECURRING[category];
  if (rule) return addMonths(date, rule.months);
  return addWorkingDays(date, cycleDays || 1);
};

/* ------------------------------------------------------------------ *
 * Generation
 * ------------------------------------------------------------------ */

// Assigns rotation cleans to working days across the horizon, two a day. A
// property becomes eligible again once a full turn of working days has passed
// since its last clean; each day takes the properties that have waited longest.
// Existing rows — done, pending or hand-entered — count both as slots already
// taken and as the property's last clean, so re-running never doubles anything.
const planRotation = async ({ organizationId, properties, start, horizon, cycle }) => {
  const existing = await CleaningSchedule.find({
    organizationId,
    isDeleted: false,
    category: ROTATION,
    date: { $gte: addDays(start, -90) },
  })
    .select("propertyId date")
    .lean();

  const perDay = new Map();
  const lastIdx = new Map();
  for (const row of existing) {
    const key = dayKey(row.date);
    perDay.set(key, (perDay.get(key) || 0) + 1);
    if (row.propertyId) {
      const id = String(row.propertyId);
      lastIdx.set(id, Math.max(lastIdx.get(id) ?? -Infinity, workIndex(row.date)));
    }
  }

  const docs = [];
  for (const day of workingDaysBetween(start, horizon)) {
    const key = dayKey(day);
    const free = PROPERTIES_PER_DAY - (perDay.get(key) || 0);
    if (free <= 0) continue;

    const idx = workIndex(day);
    const due = properties
      .filter((p) => {
        const last = lastIdx.get(String(p._id));
        return last === undefined || idx - last >= cycle;
      })
      .sort(
        (a, b) =>
          (lastIdx.get(String(a._id)) ?? -Infinity) - (lastIdx.get(String(b._id)) ?? -Infinity) ||
          a.name.localeCompare(b.name)
      )
      .slice(0, free);

    for (const p of due) {
      lastIdx.set(String(p._id), idx);
      perDay.set(key, (perDay.get(key) || 0) + 1);
      docs.push({
        propertyId: p._id,
        property: p.name,
        category: ROTATION,
        date: day,
        nextDueDate: addWorkingDays(day, cycle),
      });
    }
  }
  return docs;
};

// Fridge, washing machine and self-inspection. Each *subject* (a property, or a
// room for inspections) keeps exactly one open task: when its latest one is
// finished, the next is put on the board at latest date + interval.
const planRecurring = async ({ organizationId, properties, start }) => {
  const propIds = properties.map((p) => p._id);
  const rooms = await Room.find({ organizationId, propertyId: { $in: propIds } })
    .select("propertyId title roomName")
    .lean();

  // Latest row per (category, property, room), and whether it is still open.
  const latest = await CleaningSchedule.aggregate([
    {
      $match: {
        organizationId,
        isDeleted: false,
        category: { $in: Object.keys(RECURRING) },
        propertyId: { $in: propIds },
      },
    },
    { $sort: { date: -1 } },
    {
      $group: {
        _id: { c: "$category", p: "$propertyId", r: "$roomId" },
        date: { $first: "$date" },
        status: { $first: "$status" },
      },
    },
  ]);
  const latestBy = new Map(
    latest.map((l) => [`${l._id.c}|${l._id.p}|${l._id.r || ""}`, l])
  );

  const monthly = workingDaysBetween(start, addDays(start, 30));
  const quarterly = workingDaysBetween(start, addDays(start, 90));
  const spread = (days, index, total, shift = 0) =>
    days[(Math.floor((index * days.length) / total) + shift) % days.length];

  const docs = [];
  const consider = ({ category, property, index, room }) => {
    const { months } = RECURRING[category];
    const key = `${category}|${property._id}|${room?._id || ""}`;
    // A hand-entered inspection for the whole property, made before rooms were
    // tracked, still counts as this room's latest.
    const last = latestBy.get(key) || (room ? latestBy.get(`${category}|${property._id}|`) : null);

    let date;
    if (!last) {
      // Never scheduled: spread the portfolio over the interval rather than
      // stacking everything on the first day.
      const days = months === 1 ? monthly : quarterly;
      const shift = category === "Washing Machine Descaling" ? Math.floor(days.length / 2) : 0;
      date = spread(days, index, properties.length, shift);
    } else if (last.status === "DONE") {
      let due = addMonths(last.date, months);
      if (due < start) due = start;
      due = nextWorkingDay(due);
      if (due > addDays(start, RECURRING_LOOKAHEAD_DAYS)) return;
      date = due;
    } else {
      return; // still open — nothing to add
    }

    docs.push({
      propertyId: property._id,
      property: property.name,
      ...(room ? { roomId: room._id, room: room.title || room.roomName || "" } : {}),
      category,
      date,
      nextDueDate: addMonths(date, months),
    });
  };

  properties.forEach((property, index) => {
    consider({ category: "Fridge Cleaning", property, index });
    consider({ category: "Washing Machine Descaling", property, index });

    const own = rooms.filter((r) => String(r.propertyId) === String(property._id));
    if (own.length) own.forEach((room) => consider({ category: "Self Inspection", property, index, room }));
    else consider({ category: "Self Inspection", property, index });
  });

  return docs;
};

// Rows that pre-date next-due tracking get one worked out, once.
const backfillNextDue = async (organizationId, cycle) => {
  const missing = await CleaningSchedule.find({
    organizationId,
    isDeleted: false,
    nextDueDate: null,
  })
    .select("category date")
    .lean();
  if (!missing.length) return;

  await CleaningSchedule.bulkWrite(
    missing.map((r) => ({
      updateOne: {
        filter: { _id: r._id },
        update: { $set: { nextDueDate: computeNextDue(r.category || ROTATION, r.date, cycle) } },
      },
    })),
    { ordered: false }
  );
};

/**
 * Bring one organization's schedule up to date. Safe to run as often as you
 * like — it only ever adds what is missing.
 *
 * @returns {{ created: number }}
 */
export const generateSchedule = async ({
  organizationId,
  createdBy = null,
  horizonDays = 28,
  today = new Date(),
  // Where the schedule begins, when that should not be today — the first run
  // starts on the coming Monday rather than part-way through a week.
  startDate = null,
  dryRun = false,
}) => {
  const properties = await Property.find({ organizationId, isDeleted: false, status: "ACTIVE" })
    .select("name")
    .sort({ name: 1 })
    .lean();
  if (!properties.length) return { created: 0 };

  // Today is never scheduled — whatever is happening today was settled before
  // it began — so by default the schedule picks up from tomorrow.
  const start = utcDay(startDate || addDays(today, 1));
  const horizon = addDays(start, horizonDays);
  const cycle = cycleWorkingDays(properties.length);

  await backfillNextDue(organizationId, cycle);

  const planned = [
    ...(await planRotation({ organizationId, properties, start, horizon, cycle })),
    ...(await planRecurring({ organizationId, properties, start })),
  ];
  if (!planned.length) return { created: 0 };
  if (dryRun) return { created: 0, planned: planned.length, start };

  const docs = planned.map((d) => ({
    ...d,
    organizationId,
    createdBy,
    auto: true,
    status: "PENDING",
  }));

  // The partial unique index on auto rows makes a concurrent run (two people
  // opening the board at once) lose the race harmlessly: the duplicates are
  // rejected and everything else lands.
  try {
    const inserted = await CleaningSchedule.insertMany(docs, { ordered: false });
    return { created: inserted.length };
  } catch (error) {
    if (error?.code === 11000 || error?.writeErrors) {
      return { created: error.insertedDocs?.length ?? error.result?.insertedCount ?? 0 };
    }
    throw error;
  }
};
