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
// On top of those frequencies, two rules shape which day a task lands on:
//
//   - One task type per day: a date holds at most two properties, and both are
//     the same category. A due task that doesn't fit waits for a later day.
//   - A 10-day cooldown per property, across every category: once a property
//     has any task, it gets no other within 10 days either side of it.
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
const FRIDGE = "Fridge Cleaning";
const WASHER = "Washing Machine Descaling";
const INSPECTION = "Self Inspection";
const DAY_MS = 24 * 60 * 60 * 1000;

// Calendar days a property must go between any two tasks, whatever their
// category: a task on 25 Sep means the next can be 5 Oct at the earliest.
export const COOLDOWN_DAYS = 10;

// Nothing is planned before this date. 24 Sep 2026's tasks were settled by
// hand before the one-type-per-day / cooldown rules came in, so the first date
// those rules plan is the 25th. Harmless once that date has passed.
export const SCHEDULE_FLOOR = new Date(Date.UTC(2026, 8, 25));

// Tie-break between categories that are equally overdue on the same day.
const CATEGORY_ORDER = [ROTATION, FRIDGE, WASHER, INSPECTION];

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

// The last day of the calendar month `date` falls in. A UK office's calendar
// date never disagrees with its UTC one — a UTC midnight is already the next
// local instant, not the previous local day — so this needs no timezone
// conversion despite the properties all being in Europe/London.
export const endOfMonth = (date) => {
  const d = utcDay(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
};

// The schedule is planned a month at a time, from one PLAN_DAY to the next:
// the run on the 24th covers the 25th through the 24th of the next month.
// MUST match the day in the cleaning-schedule cron in index.js.
export const PLAN_DAY = 24;

// The last day a run starting on `start` plans to: the first PLAN_DAY on or
// after it. So a top-up mid-cycle (a task marked done on 10 Oct) only fills
// the current cycle, up to 24 Oct, and never reaches into the next one.
export const planPeriodEnd = (start) => {
  const d = utcDay(start);
  const thisMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), PLAN_DAY));
  return d <= thisMonth
    ? thisMonth
    : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, PLAN_DAY));
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

// Whole days since the epoch — the cooldown is a plain subtraction on these.
const dayNum = (date) => Math.round(utcDay(date).getTime() / DAY_MS);

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

// Where every property stands in the rotation: the working-day index of its
// latest clean. A property is due again once a full turn of working days has
// passed since then. Existing rows — done, pending or hand-entered — all count,
// so re-running never doubles anything.
export const rotationState = async ({ organizationId, start }) => {
  const existing = await CleaningSchedule.find({
    organizationId,
    isDeleted: false,
    category: ROTATION,
    date: { $gte: addDays(start, -90) },
  })
    .select("propertyId date")
    .lean();

  const lastIdx = new Map();
  for (const row of existing) {
    if (!row.propertyId) continue;
    const id = String(row.propertyId);
    lastIdx.set(id, Math.max(lastIdx.get(id) ?? -Infinity, workIndex(row.date)));
  }
  return lastIdx;
};

// Fridge, washing machine and self-inspection. Each *subject* (a property, or a
// room for inspections) keeps exactly one open task: when its latest one is
// finished, the next falls due at latest date + interval.
//
// Returns each subject that is due this period with the earliest date it may
// go on — not the date itself. The allocator below picks the actual day, which
// may be later when the property is cooling down or the days are taken.
//
// Bounded to the current period (to the next 24th): a subject that isn't due
// until after it is left for the next period's run to add, rather than pre-planned now. That keeps a
// single run from ever flooding the board with weeks of lookahead. The one
// exception, as before, is a first-ever Self Inspection, which is placed on
// its spot in the quarter straight away.
export const recurringDue = async ({ organizationId, properties, start, monthEnd }) => {
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

  // This period's remaining working days: spreads a never-scheduled Fridge
  // Cleaning / Washing Machine Descaling across the month (their cycle IS a
  // month, so that's the whole window), and is the cutoff for any recomputed
  // due date regardless of category.
  const monthDays = workingDaysBetween(start, monthEnd);
  // A first-ever Self Inspection has no due date to anchor to, so rather than
  // cram a whole portfolio's worth of first inspections into whatever's left
  // of the current month, it gets spread across its actual 3-month cycle —
  // matching how every inspection after it will be spaced once it has a real
  // history to recur from.
  const quarterDays = workingDaysBetween(start, addDays(start, 90));
  const spread = (days, index, total, shift = 0) =>
    days.length ? days[(Math.floor((index * days.length) / total) + shift) % days.length] : null;

  const due = [];
  const consider = ({ category, property, index, room }) => {
    const { months } = RECURRING[category];
    const key = `${category}|${property._id}|${room?._id || ""}`;
    // A hand-entered inspection for the whole property, made before rooms were
    // tracked, still counts as this room's latest.
    const last = latestBy.get(key) || (room ? latestBy.get(`${category}|${property._id}|`) : null);

    let earliest;
    if (!last) {
      // Never scheduled: spread the portfolio over its natural cycle rather
      // than stacking everything on the first day — a month for Fridge and
      // Washing Machine, a full quarter for a first-ever Self Inspection.
      const days = category === INSPECTION ? quarterDays : monthDays;
      const shift = category === WASHER ? Math.floor(days.length / 2) : 0;
      earliest = spread(days, index, properties.length, shift);
      if (!earliest) return; // no working days available to place it
    } else if (last.status === "DONE") {
      let at = addMonths(last.date, months);
      if (at < start) at = start;
      at = nextWorkingDay(at);
      // Due after this period: the next period's own run will add it when it
      // comes round, rather than this run reaching ahead for it.
      if (at > monthEnd) return;
      earliest = at;
    } else {
      return; // still open — nothing to add
    }

    due.push({ category, property, index, room, earliest });
  };

  properties.forEach((property, index) => {
    consider({ category: FRIDGE, property, index });
    consider({ category: WASHER, property, index });

    const own = rooms.filter((r) => String(r.propertyId) === String(property._id));
    if (own.length) own.forEach((room) => consider({ category: INSPECTION, property, index, room }));
    else consider({ category: INSPECTION, property, index });
  });

  return due;
};

// What is already on the board around the planning window, from every
// category and every source (auto or by hand, done or pending):
//   - byDay:     per date, the categories and properties it already holds;
//   - taskDays:  per property, every day it has a task — the cooldown's input.
// Reaches COOLDOWN_DAYS either side of the window, so a task just before it
// (e.g. today's) or just after it blocks the days it should.
export const boardState = async ({ organizationId, start, horizon }) => {
  const rows = await CleaningSchedule.find({
    organizationId,
    isDeleted: false,
    date: {
      $gt: addDays(start, -COOLDOWN_DAYS),
      $lt: addDays(horizon, COOLDOWN_DAYS),
    },
  })
    .select("propertyId property category date")
    .lean();

  const byDay = new Map();
  const taskDays = new Map();
  for (const row of rows) {
    const key = dayKey(row.date);
    if (!byDay.has(key)) byDay.set(key, { categories: new Set(), properties: new Set() });
    const slot = byDay.get(key);
    slot.categories.add(row.category || ROTATION);
    // A row for an address not in the portfolio has no id; its text still
    // takes one of the day's places.
    slot.properties.add(row.propertyId ? String(row.propertyId) : `name:${row.property}`);

    if (row.propertyId) {
      const id = String(row.propertyId);
      if (!taskDays.has(id)) taskDays.set(id, []);
      taskDays.get(id).push(dayNum(row.date));
    }
  }
  return { byDay, taskDays };
};

// Orders candidates longest-waiting first. Ranks are working-day indexes, and
// -Infinity (never done) sorts ahead of everything.
const byRank = (a, b) => (a.rank === b.rank ? 0 : a.rank < b.rank ? -1 : 1);

/**
 * The last day a run may place anything: the end of the month, or further on
 * when a first-ever Self Inspection's spot in its quarter lies beyond it — with
 * a month's slack after that spot, so one landing on a busy stretch still finds
 * a day rather than being re-spread (and pushed on again) by the next run.
 */
export const planUntil = (recurring, horizon) =>
  recurring.reduce(
    (until, s) => (s.earliest > horizon ? new Date(Math.max(until, addDays(s.earliest, 31))) : until),
    utcDay(horizon)
  );

/**
 * Places due work on the working days `start`..`until`, one day at a time:
 *
 *   1. A day already holding two categories (from before these rules), or two
 *      properties, is left alone. A day holding one category only ever takes
 *      more of that category.
 *   2. For each category the day may take, the candidates are the properties
 *      due by that day that are not in their cooldown.
 *   3. The day goes to the category whose longest-waiting candidate has
 *      waited longest; ties go to the category that fills more of the day,
 *      then to CATEGORY_ORDER.
 *   4. Up to the day's free places are filled from that category only.
 *
 * Anything due but not placed simply stays due and is looked at again the
 * next day, and the next run after that — it is never dropped or forced.
 * Past `horizon` (the period's last day) only those early first inspections
 * are placed; the rotation and everything else wait for their own period's run.
 *
 * Pure: takes the state loaded above, returns the rows to insert.
 */
export const allocate = ({
  properties,
  start,
  horizon,
  until = horizon,
  cycle,
  lastIdx,
  recurring,
  byDay,
  taskDays,
}) => {
  // A property's inspection covers all its rooms due this month in one visit
  // — one place on the day, one cooldown — so recurring subjects are grouped
  // per (category, property). The group is due from its earliest room.
  const jobs = new Map();
  for (const s of recurring) {
    const key = `${s.category}|${s.property._id}`;
    if (!jobs.has(key)) {
      jobs.set(key, { category: s.category, property: s.property, index: s.index, rooms: [], earliest: s.earliest });
    }
    const job = jobs.get(key);
    job.rooms.push(s.room || null);
    if (s.earliest < job.earliest) job.earliest = s.earliest;
  }
  const open = [...jobs.values()];

  // The cooldown. Both ways: a task already on the board a few days *after*
  // this one blocks it just as one before does.
  const coolingDown = (id, n) =>
    (taskDays.get(id) || []).some((t) => Math.abs(t - n) < COOLDOWN_DAYS);

  const docs = [];
  for (const day of workingDaysBetween(start, until)) {
    const key = dayKey(day);
    const n = dayNum(day);
    const idx = workIndex(day);
    const inMonth = day <= horizon;
    if (!inMonth && !open.some((j) => j.earliest > horizon)) break;
    if (!byDay.has(key)) byDay.set(key, { categories: new Set(), properties: new Set() });
    const slot = byDay.get(key);

    if (slot.categories.size > 1) continue;
    const free = PROPERTIES_PER_DAY - slot.properties.size;
    if (free <= 0) continue;

    const available = (id) => !slot.properties.has(id) && !coolingDown(id, n);
    const allowed = slot.categories.size ? [...slot.categories] : CATEGORY_ORDER;

    const options = [];
    for (const category of allowed) {
      let candidates;
      if (category === ROTATION) {
        if (!inMonth) continue;
        candidates = properties
          .filter((p) => {
            const last = lastIdx.get(String(p._id));
            return (last === undefined || idx - last >= cycle) && available(String(p._id));
          })
          .map((p) => {
            const last = lastIdx.get(String(p._id));
            return { property: p, rank: last === undefined ? -Infinity : last + cycle };
          })
          .sort((a, b) => byRank(a, b) || a.property.name.localeCompare(b.property.name));
      } else if (RECURRING[category]) {
        candidates = open
          .filter(
            (j) =>
              j.category === category &&
              j.earliest <= day &&
              (inMonth || j.earliest > horizon) &&
              available(String(j.property._id))
          )
          .map((j) => ({ property: j.property, job: j, rank: workIndex(j.earliest) }))
          .sort((a, b) => byRank(a, b) || a.job.index - b.job.index);
      } else {
        continue; // a hand-entered category the plan doesn't generate
      }
      if (candidates.length) options.push({ category, picks: candidates.slice(0, free) });
    }
    if (!options.length) continue;

    options.sort(
      (a, b) =>
        byRank(a.picks[0], b.picks[0]) ||
        b.picks.length - a.picks.length ||
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
    );
    const { category, picks } = options[0];

    for (const { property, job } of picks) {
      const id = String(property._id);
      if (category === ROTATION) {
        lastIdx.set(id, idx);
        docs.push({
          propertyId: property._id,
          property: property.name,
          category,
          date: day,
          nextDueDate: addWorkingDays(day, cycle),
        });
      } else {
        open.splice(open.indexOf(job), 1);
        for (const room of job.rooms) {
          docs.push({
            propertyId: property._id,
            property: property.name,
            ...(room ? { roomId: room._id, room: room.title || room.roomName || "" } : {}),
            category,
            date: day,
            nextDueDate: addMonths(day, RECURRING[category].months),
          });
        }
      }
      slot.categories.add(category);
      slot.properties.add(id);
      if (!taskDays.has(id)) taskDays.set(id, []);
      taskDays.get(id).push(n);
    }
  }
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
 * Bounded to one planning period (see planPeriodEnd): the run on the 24th
 * plans the 25th through the next 24th, and never past it. The next period's
 * own run (the monthly sweep on the 24th) picks up from there. In between,
 * this is still called when a task is marked done, so its successor is added
 * straight away within the current period rather than a month later.
 *
 * @returns {{ created: number }}
 */
export const generateSchedule = async ({
  organizationId,
  createdBy = null,
  today = new Date(),
  // Where the schedule begins, when that should not be today — the first run
  // starts on the coming Monday rather than part-way through a week.
  startDate = null,
  dryRun = false,
}) => {
  const properties = await Property.find({ organizationId, isDeleted: false, status: "ACTIVE" })
    .select("name cleaningRotationOrder")
    // An organization can pin its rotation to a specific order (e.g. matching
    // how the office has always read its sheet) via cleaningRotationOrder;
    // everyone else leaves it null and keeps the old alphabetical order.
    .sort({ cleaningRotationOrder: 1, name: 1 })
    .lean();
  if (!properties.length) return { created: 0 };

  // Today is never scheduled — whatever is happening today was settled before
  // it began — so by default the schedule picks up from tomorrow — and never
  // before SCHEDULE_FLOOR.
  const requested = utcDay(startDate || addDays(today, 1));
  const start = requested < SCHEDULE_FLOOR ? SCHEDULE_FLOOR : requested;
  const horizon = planPeriodEnd(start);
  const cycle = cycleWorkingDays(properties.length);

  await backfillNextDue(organizationId, cycle);

  const [lastIdx, recurring] = await Promise.all([
    rotationState({ organizationId, start }),
    recurringDue({ organizationId, properties, start, monthEnd: horizon }),
  ]);
  const until = planUntil(recurring, horizon);
  const { byDay, taskDays } = await boardState({ organizationId, start, horizon: until });

  const planned = allocate({
    properties,
    start,
    horizon,
    until,
    cycle,
    lastIdx,
    recurring,
    byDay,
    taskDays,
  });
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
