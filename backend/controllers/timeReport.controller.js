// controllers/timeReport.controller.js
//
// Team working-hours reporting.
//
// Where the hours come from
// -------------------------
// A monitored shift (ScreenMonitorSession) is the only record this system keeps
// of someone being at work: it starts when the member starts it and ends when
// they stop, the browser drops the share, or the working-hours window closes.
// Its startedAt -> endedAt span is therefore the working time. StaffPresence is
// deliberately not a history (see that model), so it cannot be reported on.
//
// Who may read it
// ---------------
// OWNER / ADMIN / MANAGER. This is a wider audience than the screenshots, which
// stay OWNER / ADMIN only in screenMonitor.controller.js — reading that someone
// worked 38 hours last week is a different power from watching their screen, and
// a manager who cannot see the hours cannot manage the rota. Nothing in this
// file returns a capture, a capture URL, or a count of them.
//
// Everything is bucketed on a UK clock, matching the working-hours window the
// sessions were themselves policed against.

import mongoose from "mongoose";
import ScreenMonitorSession from "../models/ScreenMonitorSession.js";

const REPORT_ROLES = ["OWNER", "ADMIN", "MANAGER"];

const denyNonReporter = (req, res) => {
  const allowed =
    req.user?.role === "Organization" && REPORT_ROLES.includes(req.user?.organizationRole);
  if (!allowed) {
    res.status(403).json({
      success: false,
      message: "Only an owner, admin or manager can view working-hours reports.",
    });
    return true;
  }
  return false;
};

// ---------------------------------------------------------------------------
// UK calendar helpers
//
// Sessions are bucketed by the day they were worked in Europe/London, not by the
// server's timezone — a report that moved with the host would put an evening
// shift on the wrong day for half the year.
// ---------------------------------------------------------------------------
const UK_TZ = "Europe/London";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: UK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const clockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: UK_TZ,
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** "2026-09-18" — the UK day this instant falls in. */
const ukDayKey = (date) => dayFormatter.format(date);

/**
 * Milliseconds from this instant to the next UK midnight.
 *
 * Off by an hour on the two DST changeover days, which shifts the tail of an
 * overnight shift into the neighbouring day twice a year — accepted rather than
 * pulling in a timezone library for it.
 */
const msToNextUkMidnight = (date) => {
  const [h, m, s] = clockFormatter.format(date).split(":").map(Number);
  const secondsIntoDay = h * 3600 + m * 60 + s;
  return (86400 - secondsIntoDay) * 1000 - date.getMilliseconds();
};

/** ISO week key, "2026-W38" — Monday-based, which is how the rota reads. */
const isoWeekKey = (dayKey) => {
  const d = new Date(`${dayKey}T00:00:00Z`);
  const day = d.getUTCDay() || 7; // Sunday counts as 7
  d.setUTCDate(d.getUTCDate() + 4 - day); // the Thursday decides the week's year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

const monthKey = (dayKey) => dayKey.slice(0, 7);

const bucketKeyOf = (dayKey, granularity) =>
  granularity === "month"
    ? monthKey(dayKey)
    : granularity === "week"
    ? isoWeekKey(dayKey)
    : dayKey;

/** How a bucket reads on an axis. */
const bucketLabel = (key, granularity) => {
  if (granularity === "month") {
    const [y, m] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
  }
  if (granularity === "week") return `W${key.split("-W")[1]}`;
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
};

/** Every UK day key touched by [from, to). */
const dayKeysBetween = (from, to) => {
  const keys = [];
  let cursor = new Date(from.getTime());
  let guard = 0;
  while (cursor < to && guard++ < 800) {
    keys.push(ukDayKey(cursor));
    cursor = new Date(cursor.getTime() + msToNextUkMidnight(cursor));
  }
  // A range ending mid-day still includes that day.
  const lastKey = ukDayKey(new Date(to.getTime() - 1));
  if (to > from && keys[keys.length - 1] !== lastKey) keys.push(lastKey);
  return [...new Set(keys)];
};

// ---------------------------------------------------------------------------
// Session -> worked minutes, split across the days it touches
// ---------------------------------------------------------------------------

/**
 * The part of a session inside [from, to), broken into UK days. A shift running
 * past midnight contributes to both days rather than landing wholly on the one
 * it began.
 */
const splitSession = (session, from, to, now) => {
  const start = new Date(session.startedAt);
  // An ACTIVE session has no end yet; it counts up to now, so "hours so far
  // today" is answerable while people are still at their desks.
  const end = session.endedAt ? new Date(session.endedAt) : now;

  const windowStart = start > from ? start : from;
  const windowEnd = end < to ? end : to;
  if (!(windowEnd > windowStart)) return [];

  const parts = [];
  let cursor = windowStart;
  let guard = 0;
  while (cursor < windowEnd && guard++ < 400) {
    const midnight = new Date(cursor.getTime() + msToNextUkMidnight(cursor));
    const sliceEnd = midnight < windowEnd ? midnight : windowEnd;
    parts.push({
      dayKey: ukDayKey(cursor),
      minutes: (sliceEnd - cursor) / 60000,
      start: cursor,
      end: sliceEnd,
    });
    cursor = sliceEnd;
  }
  return parts;
};

const round1 = (n) => Math.round(n * 10) / 10;
const toHours = (minutes) => round1(minutes / 60);

/** Reduce a set of sessions into per-member, per-day totals. */
const buildDayTotals = (sessions, from, to, now) => {
  const byMember = new Map();

  sessions.forEach((s) => {
    const id = String(s.userId);
    if (!byMember.has(id)) {
      byMember.set(id, {
        userId: id,
        email: s.email || "",
        role: s.role || "",
        days: new Map(),
      });
    }
    const member = byMember.get(id);

    splitSession(s, from, to, now).forEach((part) => {
      const day = member.days.get(part.dayKey) || {
        minutes: 0,
        sessions: 0,
        firstIn: part.start,
        lastOut: part.end,
      };
      day.minutes += part.minutes;
      day.sessions += 1;
      if (part.start < day.firstIn) day.firstIn = part.start;
      if (part.end > day.lastOut) day.lastOut = part.end;
      member.days.set(part.dayKey, day);
    });
  });

  return byMember;
};

const totalMinutes = (member) => {
  let minutes = 0;
  member.days.forEach((d) => {
    minutes += d.minutes;
  });
  return minutes;
};

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

// @desc    Team working hours — totals, averages, extremes, trends, comparisons
// @route   GET /api/v1/time-reports/work-hours
// @query   from, to (ISO) · granularity=day|week|month · userId (optional)
export const getWorkHoursReport = async (req, res) => {
  try {
    if (denyNonReporter(req, res)) return;

    const now = new Date();
    const granularity = ["day", "week", "month"].includes(req.query.granularity)
      ? req.query.granularity
      : "day";

    const to = req.query.to ? new Date(req.query.to) : now;
    const from = req.query.from
      ? new Date(req.query.from)
      : new Date(to.getTime() - 27 * 86400000);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      return res.status(400).json({ success: false, message: "Invalid date range." });
    }

    // The period immediately before this one, of the same length — what every
    // "vs previous" figure compares against.
    const span = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - span);
    const prevTo = from;

    const filter = { organizationId: req.user.organizationId };
    if (req.query.userId && mongoose.isValidObjectId(req.query.userId)) {
      filter.userId = req.query.userId;
    }

    // Any session overlapping either window: it started before this window ended
    // and it either has not ended or ended after the previous window began.
    const sessions = await ScreenMonitorSession.find({
      ...filter,
      startedAt: { $lt: to },
      $or: [{ endedAt: null }, { endedAt: { $gt: prevFrom } }],
    })
      .select("userId email role status startedAt endedAt endedReason")
      .sort({ startedAt: 1 })
      .limit(20000)
      .lean();

    const current = buildDayTotals(sessions, from, to, now);
    const previous = buildDayTotals(sessions, prevFrom, prevTo, now);

    // --- the buckets the charts plot along ---
    const bucketKeys = [
      ...new Set(dayKeysBetween(from, to).map((d) => bucketKeyOf(d, granularity))),
    ];
    const prevBucketKeys = [
      ...new Set(dayKeysBetween(prevFrom, prevTo).map((d) => bucketKeyOf(d, granularity))),
    ];

    const bucketsFor = (member, keys) => {
      const totals = new Map(keys.map((k) => [k, 0]));
      member.days.forEach((d, dayKey) => {
        const key = bucketKeyOf(dayKey, granularity);
        if (totals.has(key)) totals.set(key, totals.get(key) + d.minutes);
      });
      return keys.map((k) => ({
        key: k,
        label: bucketLabel(k, granularity),
        hours: toHours(totals.get(k)),
      }));
    };

    const emptyBuckets = () =>
      bucketKeys.map((k) => ({ key: k, label: bucketLabel(k, granularity), hours: 0 }));

    // --- per member ---
    const members = [...current.values()].map((member) => {
      const prev = previous.get(member.userId);
      const minutes = totalMinutes(member);
      const prevMinutes = prev ? totalMinutes(prev) : 0;
      const daysWorked = member.days.size;

      return {
        userId: member.userId,
        email: member.email,
        role: member.role,
        hours: toHours(minutes),
        daysWorked,
        sessions: [...member.days.values()].reduce((n, d) => n + d.sessions, 0),
        avgHoursPerDay: daysWorked ? toHours(minutes / daysWorked) : 0,
        previousHours: toHours(prevMinutes),
        deltaHours: toHours(minutes - prevMinutes),
        deltaPercent:
          prevMinutes > 0 ? Math.round(((minutes - prevMinutes) / prevMinutes) * 100) : null,
        buckets: bucketsFor(member, bucketKeys),
      };
    });

    // Someone who worked the previous period but not this one still belongs in
    // the comparison — otherwise a person who stopped work simply disappears.
    previous.forEach((prev, id) => {
      if (current.has(id)) return;
      const prevHours = toHours(totalMinutes(prev));
      members.push({
        userId: id,
        email: prev.email,
        role: prev.role,
        hours: 0,
        daysWorked: 0,
        sessions: 0,
        avgHoursPerDay: 0,
        previousHours: prevHours,
        deltaHours: -prevHours,
        deltaPercent: -100,
        buckets: emptyBuckets(),
      });
    });

    members.sort((a, b) => b.hours - a.hours || b.previousHours - a.previousHours);

    // --- team roll-up ---
    const teamBuckets = bucketKeys.map((key, i) => ({
      key,
      label: bucketLabel(key, granularity),
      hours: round1(members.reduce((sum, m) => sum + (m.buckets[i]?.hours || 0), 0)),
      headcount: members.filter((m) => (m.buckets[i]?.hours || 0) > 0).length,
    }));

    const prevTeamBuckets = prevBucketKeys.map((key) => {
      let minutes = 0;
      previous.forEach((member) => {
        member.days.forEach((d, dayKey) => {
          if (bucketKeyOf(dayKey, granularity) === key) minutes += d.minutes;
        });
      });
      return { key, label: bucketLabel(key, granularity), hours: toHours(minutes) };
    });

    // Extremes are read off the people who actually worked — a member with no
    // hours at all is not "the lowest", they simply were not on.
    const worked = members.filter((m) => m.hours > 0);
    const totalHours = round1(worked.reduce((s, m) => s + m.hours, 0));
    const prevTotalHours = round1(members.reduce((s, m) => s + m.previousHours, 0));

    const team = {
      memberCount: worked.length,
      totalHours,
      averageHours: worked.length ? round1(totalHours / worked.length) : 0,
      highest: worked[0] || null,
      lowest: worked.length ? worked[worked.length - 1] : null,
      activeDays: new Set([...current.values()].flatMap((m) => [...m.days.keys()])).size,
      previousTotalHours: prevTotalHours,
      deltaHours: round1(totalHours - prevTotalHours),
      deltaPercent:
        prevTotalHours > 0
          ? Math.round(((totalHours - prevTotalHours) / prevTotalHours) * 100)
          : null,
      buckets: teamBuckets,
      previousBuckets: prevTeamBuckets,
    };

    // --- the attendance sheet: one row per member per day worked ---
    const attendance = [];
    current.forEach((member) => {
      member.days.forEach((d, dayKey) => {
        attendance.push({
          userId: member.userId,
          email: member.email,
          role: member.role,
          date: dayKey,
          firstIn: d.firstIn,
          lastOut: d.lastOut,
          hours: toHours(d.minutes),
          sessions: d.sessions,
        });
      });
    });
    attendance.sort(
      (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.email.localeCompare(b.email))
    );

    return res.status(200).json({
      success: true,
      data: {
        range: { from, to, granularity },
        previousRange: { from: prevFrom, to: prevTo },
        team,
        members,
        attendance,
      },
    });
  } catch (error) {
    console.error("Work Hours Report Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to build the working-hours report." });
  }
};
