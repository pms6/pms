// controllers/screenMonitor.controller.js
//
// Staff screen monitoring.
//
// Two audiences, deliberately unequal:
//   staff  — may start and stop THEIR OWN monitored shift, upload their own
//            screenshots, and see their own session. Nothing else.
//   admin  — OWNER / ADMIN only. May read every session in the organisation,
//            open the screenshots, and edit the policy.
//
// A MANAGER is not an admin here. Managers can run the team screen elsewhere,
// but watching colleagues' screens is a different power and is kept to the
// seats that own the organisation.
//
// And only the OPERATION seat is monitored at all — the same seat that shares
// a live location (see agentLocation.controller.js). Monitoring follows the
// people out doing the day-to-day work; the desk seats are not watched.
//
// The server, not the browser, decides when the next screenshot is due and
// whether a capture is inside working hours — a client that picked its own
// moments would make "random" meaningless.

import mongoose from "mongoose";
import ScreenMonitorPolicy from "../models/ScreenMonitorPolicy.js";
import ScreenMonitorSession from "../models/ScreenMonitorSession.js";

const ADMIN_ROLES = ["OWNER", "ADMIN"];

const isAdmin = (req) =>
  req.user?.role === "Organization" && ADMIN_ROLES.includes(req.user?.organizationRole);

// The seats that are monitored. A list rather than a bare string so widening it
// later is a one-line change, and so it reads the same way as SHARING_ROLES in
// agentLocation.controller.js.
const MONITORED_ROLES = ["OPERATION"];

const isMonitored = (req) => MONITORED_ROLES.includes(req.user?.organizationRole);

// Guards the staff-side endpoints. An admin reading the team board goes through
// denyNonAdmin instead — being able to watch is not being watched.
const denyNonMonitored = (req, res) => {
  if (!isMonitored(req)) {
    res.status(403).json({
      success: false,
      message: "Only an operation team member is screen monitored.",
    });
    return true;
  }
  return false;
};

const denyNonAdmin = (req, res) => {
  if (!isAdmin(req)) {
    res.status(403).json({
      success: false,
      message: "Only an owner or admin can view staff monitoring.",
    });
    return true;
  }
  return false;
};

// ---------------------------------------------------------------------------
// Working hours, on a UK clock
//
// Evaluated in Europe/London rather than the server's timezone: a window that
// moved with the host would capture outside the hours staff were told about.
// ---------------------------------------------------------------------------
const UK_TZ = "Europe/London";

const ukNowParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TZ,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  const p = {};
  for (const { type, value } of parts) if (type !== "literal") p[type] = value;

  const days = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    isoDay: days[p.weekday] || 0,
    minutes: (Number(p.hour) % 24) * 60 + Number(p.minute),
  };
};

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

/** Does this policy's window run past midnight, e.g. 09:00–01:30? */
export const isOvernightWindow = (policy) => {
  const start = toMinutes(policy.workStart);
  const end = toMinutes(policy.workEnd);
  return start !== null && end !== null && end < start;
};

/**
 * Is `date` inside the policy's working-hours window?
 *
 * Handles a window that runs past midnight (09:00–01:30). The subtlety is which
 * day the working-days list is checked against: the early-hours part of an
 * overnight window belongs to the shift that STARTED the previous evening. So
 * for Mon–Fri 09:00–01:30, Saturday 00:30 is inside the window — it is the tail
 * of Friday's shift — while Saturday 10:00 is not.
 *
 * Getting that wrong in either direction matters: check today's list and the
 * Friday-night tail is refused; ignore the list and Sunday morning is monitored.
 */
export const withinWorkingHours = (policy, date = new Date()) => {
  const { isoDay, minutes } = ukNowParts(date);

  const start = toMinutes(policy.workStart);
  const end = toMinutes(policy.workEnd);
  if (start === null || end === null) return false;

  const days = policy.workDays || [];

  // Equal start and end is ambiguous — a zero-length window or a 24-hour one —
  // so it is rejected on save rather than guessed at here.
  if (start === end) return false;

  // Ordinary same-day window.
  if (end > start) return days.includes(isoDay) && minutes >= start && minutes < end;

  // Overnight. The evening portion is today's shift…
  if (minutes >= start) return days.includes(isoDay);

  // …and the early-hours portion belongs to yesterday's.
  if (minutes < end) {
    const previousDay = isoDay === 1 ? 7 : isoDay - 1;
    return days.includes(previousDay);
  }

  return false;
};

// A random point inside the policy's interval range. Uniform, so a screenshot
// is genuinely unpredictable rather than landing on a guessable cadence.
const scheduleNextCapture = (policy, from = new Date()) => {
  const min = Math.max(1, Number(policy.minIntervalMinutes) || 10);
  const max = Math.max(min, Number(policy.maxIntervalMinutes) || 30);
  const minutes = min + Math.random() * (max - min);
  return new Date(from.getTime() + minutes * 60 * 1000);
};

/**
 * Has an ACTIVE session gone quiet?
 *
 * A browser reload destroys the shared stream, and the browser will not hand it
 * back without a fresh click — so the page stops capturing while the session row
 * stays ACTIVE. Reporting that as "Running" is worse than useless: it tells an
 * admin someone is being monitored when nothing is arriving.
 *
 * Derived on read rather than stored, for the same reason task "Overdue" is: a
 * stored flag goes stale the moment the record sits untouched.
 *
 * The grace is generous — a due capture can legitimately be a few minutes late
 * on a slow upload — so this only fires once a capture is properly overdue.
 */
const STALE_GRACE_MS = 5 * 60 * 1000;

export const isStale = (session, now = Date.now()) => {
  if (session.status !== "ACTIVE") return false;
  const due = session.nextCaptureAt ? new Date(session.nextCaptureAt).getTime() : null;
  if (!due) return false;
  return now > due + STALE_GRACE_MS;
};

// Abandoned for this long and the session is closed outright — a tab shut on
// Friday should not still read as "running" on Monday.
const ABANDON_MS = 60 * 60 * 1000;

const getOrCreatePolicy = async (organizationId) => {
  let policy = await ScreenMonitorPolicy.findOne({ organizationId });
  if (!policy) policy = await ScreenMonitorPolicy.create({ organizationId });
  return policy;
};

// ===========================================================================
// POLICY
// ===========================================================================

// @desc    Read the organisation's monitoring policy
// @route   GET /api/v1/screen-monitor/policy
// Staff may read it — they are entitled to know the rules they are monitored
// under. Only an admin may change it.
export const getPolicy = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const policy = await getOrCreatePolicy(organizationId);

    return res.status(200).json({
      success: true,
      data: {
        ...policy.toObject(),
        withinWorkingHours: withinWorkingHours(policy),
        overnight: isOvernightWindow(policy),
      },
    });
  } catch (error) {
    console.error("Get Monitor Policy Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load monitoring policy." });
  }
};

// @desc    Update the policy
// @route   PUT /api/v1/screen-monitor/policy
export const updatePolicy = async (req, res) => {
  try {
    if (denyNonAdmin(req, res)) return;

    const policy = await getOrCreatePolicy(req.user.organizationId);
    const b = req.body || {};

    if (b.enabled !== undefined) policy.enabled = Boolean(b.enabled);
    if (b.workStart !== undefined) policy.workStart = String(b.workStart);
    if (b.workEnd !== undefined) policy.workEnd = String(b.workEnd);
    if (Array.isArray(b.workDays)) {
      policy.workDays = b.workDays.map(Number).filter((d) => d >= 1 && d <= 7);
    }
    if (b.minIntervalMinutes !== undefined) policy.minIntervalMinutes = Number(b.minIntervalMinutes);
    if (b.maxIntervalMinutes !== undefined) policy.maxIntervalMinutes = Number(b.maxIntervalMinutes);
    if (b.retentionDays !== undefined) policy.retentionDays = Number(b.retentionDays);
    if (b.noticeText !== undefined) policy.noticeText = String(b.noticeText);

    if (policy.maxIntervalMinutes < policy.minIntervalMinutes) {
      return res.status(400).json({
        success: false,
        message: "The maximum interval cannot be shorter than the minimum.",
      });
    }

    // Equal times could mean a zero-length window or a 24-hour one. Rather than
    // pick one and have monitoring run for a day nobody intended, say so.
    if (policy.workStart === policy.workEnd) {
      return res.status(400).json({
        success: false,
        message:
          "Start and end times cannot be the same. For round-the-clock monitoring use 00:00 to 23:59.",
      });
    }

    policy.updatedBy = req.user._id;
    await policy.save();

    return res.status(200).json({ success: true, data: policy });
  } catch (error) {
    console.error("Update Monitor Policy Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to save monitoring policy." });
  }
};

// ===========================================================================
// STAFF — their own session
// ===========================================================================

// @desc    The caller's own current session and what is due next
// @route   GET /api/v1/screen-monitor/me
export const getMySession = async (req, res) => {
  try {
    if (denyNonMonitored(req, res)) return;

    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const policy = await getOrCreatePolicy(organizationId);
    const session = await ScreenMonitorSession.findOne({
      organizationId,
      userId: req.user._id,
      status: "ACTIVE",
    }).lean();

    return res.status(200).json({
      success: true,
      data: {
        policy: {
          enabled: policy.enabled,
          workStart: policy.workStart,
          workEnd: policy.workEnd,
          workDays: policy.workDays,
          minIntervalMinutes: policy.minIntervalMinutes,
          maxIntervalMinutes: policy.maxIntervalMinutes,
          retentionDays: policy.retentionDays,
          noticeText: policy.noticeText,
          overnight: isOvernightWindow(policy),
        },
        withinWorkingHours: withinWorkingHours(policy),
        session: session
          ? {
              _id: session._id,
              startedAt: session.startedAt,
              nextCaptureAt: session.nextCaptureAt,
              lastCaptureAt: session.lastCaptureAt,
              captureCount: session.captures?.length || 0,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Get My Monitor Session Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load your monitoring state." });
  }
};

// @desc    Start a monitored shift — only ever the caller's own
// @route   POST /api/v1/screen-monitor/start
export const startSession = async (req, res) => {
  try {
    if (denyNonMonitored(req, res)) return;

    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const policy = await getOrCreatePolicy(organizationId);

    if (!policy.enabled) {
      return res.status(400).json({
        success: false,
        message: "Screen monitoring is switched off for this organisation.",
      });
    }

    if (!withinWorkingHours(policy)) {
      return res.status(400).json({
        success: false,
        message: `Monitoring only runs during working hours (${policy.workStart}–${policy.workEnd} UK time).`,
      });
    }

    // The member must confirm they have read the notice. This is the record
    // that they were told, so it is required rather than assumed.
    if (!req.body?.acknowledged) {
      return res.status(400).json({
        success: false,
        message: "You need to acknowledge the monitoring notice before starting.",
      });
    }

    // Reuse an already-running session rather than stacking duplicates.
    const existing = await ScreenMonitorSession.findOne({
      organizationId,
      userId: req.user._id,
      status: "ACTIVE",
    });
    if (existing) {
      return res.status(200).json({ success: true, data: existing });
    }

    const session = await ScreenMonitorSession.create({
      organizationId,
      userId: req.user._id,
      email: req.user.email || "",
      role: req.user.organizationRole || "",
      status: "ACTIVE",
      startedAt: new Date(),
      acknowledgedAt: new Date(),
      noticeTextSeen: policy.noticeText,
      nextCaptureAt: scheduleNextCapture(policy),
    });

    return res.status(201).json({ success: true, data: session });
  } catch (error) {
    console.error("Start Monitor Session Error:", error);
    return res.status(500).json({ success: false, message: "Failed to start the monitored shift." });
  }
};

// @desc    End the caller's own monitored shift
// @route   POST /api/v1/screen-monitor/stop
export const stopSession = async (req, res) => {
  try {
    const reasons = ["STOPPED", "SHARE_REVOKED", "OUT_OF_HOURS"];
    const reason = reasons.includes(req.body?.reason) ? req.body.reason : "STOPPED";

    const session = await ScreenMonitorSession.findOneAndUpdate(
      {
        organizationId: req.user.organizationId,
        userId: req.user._id,
        status: "ACTIVE",
      },
      { status: "ENDED", endedAt: new Date(), endedReason: reason, nextCaptureAt: null },
      { new: true }
    );

    if (!session) {
      return res.status(200).json({ success: true, message: "No monitored shift was running." });
    }

    return res.status(200).json({ success: true, data: session });
  } catch (error) {
    console.error("Stop Monitor Session Error:", error);
    return res.status(500).json({ success: false, message: "Failed to stop the monitored shift." });
  }
};

// @desc    Upload one screenshot into the caller's own active session
// @route   POST /api/v1/screen-monitor/capture
export const addCapture = async (req, res) => {
  try {
    if (denyNonMonitored(req, res)) return;

    const organizationId = req.user?.organizationId;
    const { url, publicId, width, height, bytes } = req.body || {};

    if (!url) {
      return res.status(400).json({ success: false, message: "A screenshot URL is required." });
    }

    const policy = await getOrCreatePolicy(organizationId);

    const session = await ScreenMonitorSession.findOne({
      organizationId,
      userId: req.user._id,
      status: "ACTIVE",
    });

    if (!session) {
      return res.status(404).json({ success: false, message: "No monitored shift is running." });
    }

    // Outside the agreed window the session closes rather than quietly keeping
    // the screenshot — capturing outside working hours is the specific thing
    // the policy exists to prevent.
    if (!withinWorkingHours(policy)) {
      session.status = "ENDED";
      session.endedAt = new Date();
      session.endedReason = "OUT_OF_HOURS";
      session.nextCaptureAt = null;
      await session.save();

      return res.status(409).json({
        success: false,
        message: "Working hours have ended — the monitored shift was closed and the screenshot discarded.",
      });
    }

    const now = new Date();
    session.captures.push({
      url: String(url).trim(),
      publicId: String(publicId || "").trim(),
      capturedAt: now,
      width: Number(width) || 0,
      height: Number(height) || 0,
      bytes: Number(bytes) || 0,
    });
    session.lastCaptureAt = now;
    session.nextCaptureAt = scheduleNextCapture(policy, now);
    await session.save();

    return res.status(201).json({
      success: true,
      data: {
        captureCount: session.captures.length,
        lastCaptureAt: session.lastCaptureAt,
        nextCaptureAt: session.nextCaptureAt,
      },
    });
  } catch (error) {
    console.error("Add Capture Error:", error);
    return res.status(500).json({ success: false, message: "Failed to save the screenshot." });
  }
};

// ===========================================================================
// ADMIN — the whole team
// ===========================================================================

// @desc    Every monitoring session in the organisation
// @route   GET /api/v1/screen-monitor/sessions
export const getSessions = async (req, res) => {
  try {
    if (denyNonAdmin(req, res)) return;

    const { userId, status, from, to } = req.query;
    const filter = { organizationId: req.user.organizationId };

    if (userId && mongoose.isValidObjectId(userId)) filter.userId = userId;
    if (status === "ACTIVE" || status === "ENDED") filter.status = status;
    if (from || to) {
      filter.startedAt = {};
      if (from) filter.startedAt.$gte = new Date(from);
      if (to) filter.startedAt.$lte = new Date(to);
    }

    const sessions = await ScreenMonitorSession.find(filter)
      .sort({ startedAt: -1 })
      .limit(200)
      .lean();

    // The list carries counts, not the screenshots — a board that shipped every
    // frame would put hundreds of images on screen nobody asked to see.
    const data = sessions.map((s) => ({
      _id: s._id,
      userId: s.userId,
      email: s.email,
      role: s.role,
      status: s.status,
      // Open on the server but nothing arriving — usually a page reload, which
      // drops screen sharing. Surfaced so the board never claims someone is
      // being watched when they are not.
      stale: isStale(s),
      nextCaptureAt: s.nextCaptureAt,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      endedReason: s.endedReason,
      acknowledgedAt: s.acknowledgedAt,
      captureCount: s.captures?.length || 0,
      lastCaptureAt: s.lastCaptureAt,
      viewCount: s.viewedBy?.length || 0,
    }));

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    console.error("Get Monitor Sessions Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load monitoring sessions." });
  }
};

// @desc    One session with its screenshots
// @route   GET /api/v1/screen-monitor/sessions/:id
export const getSessionById = async (req, res) => {
  try {
    if (denyNonAdmin(req, res)) return;

    const session = await ScreenMonitorSession.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found." });
    }

    // Opening someone's screenshots is itself recorded. Kept to one entry per
    // viewer per hour so a page refresh does not spam the trail.
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = session.viewedBy.some(
      (v) => String(v.userId) === String(req.user._id) && v.viewedAt > hourAgo
    );
    if (!recent) {
      session.viewedBy.push({
        userId: req.user._id,
        email: req.user.email || "",
        viewedAt: new Date(),
      });
      await session.save();
    }

    return res.status(200).json({ success: true, data: session });
  } catch (error) {
    console.error("Get Monitor Session Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load the session." });
  }
};

// @desc    Delete one session and its screenshots
// @route   DELETE /api/v1/screen-monitor/sessions/:id
export const deleteSession = async (req, res) => {
  try {
    if (denyNonAdmin(req, res)) return;

    const result = await ScreenMonitorSession.deleteOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!result.deletedCount) {
      return res.status(404).json({ success: false, message: "Session not found." });
    }

    return res.status(200).json({ success: true, message: "Session deleted." });
  } catch (error) {
    console.error("Delete Monitor Session Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete the session." });
  }
};

// ===========================================================================
// RETENTION
// ===========================================================================

/**
 * Drop screenshots older than the organisation's retention period, and remove
 * sessions left with nothing. Called by the daily job; also exposed so an admin
 * can run it on demand.
 *
 * A hard delete, not a soft one: "we deleted it" has to mean the image is gone.
 */
/**
 * Close sessions nobody is feeding any more.
 *
 * The browser has no reliable way to say "I am gone" — a reload, a crash or a
 * closed lid all just stop the captures. So an ACTIVE session whose next
 * capture is long overdue is closed here rather than left open forever.
 */
export const closeAbandonedSessions = async () => {
  const cutoff = new Date(Date.now() - ABANDON_MS);

  const result = await ScreenMonitorSession.updateMany(
    { status: "ACTIVE", nextCaptureAt: { $ne: null, $lt: cutoff } },
    { status: "ENDED", endedAt: new Date(), endedReason: "EXPIRED", nextCaptureAt: null }
  );

  return { sessionsClosed: result.modifiedCount || 0 };
};

export const purgeExpiredCaptures = async () => {
  const policies = await ScreenMonitorPolicy.find().lean();
  let capturesRemoved = 0;
  let sessionsRemoved = 0;

  for (const policy of policies) {
    const cutoff = new Date(Date.now() - (policy.retentionDays || 30) * 24 * 60 * 60 * 1000);

    const sessions = await ScreenMonitorSession.find({
      organizationId: policy.organizationId,
      "captures.capturedAt": { $lt: cutoff },
    });

    for (const session of sessions) {
      const before = session.captures.length;
      session.captures = session.captures.filter((c) => c.capturedAt >= cutoff);
      capturesRemoved += before - session.captures.length;

      if (session.captures.length === 0 && session.status === "ENDED") {
        await ScreenMonitorSession.deleteOne({ _id: session._id });
        sessionsRemoved++;
      } else {
        await session.save();
      }
    }
  }

  return { capturesRemoved, sessionsRemoved };
};

// @desc    Run the retention purge now
// @route   POST /api/v1/screen-monitor/purge
export const runPurge = async (req, res) => {
  try {
    if (denyNonAdmin(req, res)) return;
    const result = await purgeExpiredCaptures();
    return res.status(200).json({
      success: true,
      message: `Removed ${result.capturesRemoved} screenshot(s) past their retention period.`,
      data: result,
    });
  } catch (error) {
    console.error("Purge Captures Error:", error);
    return res.status(500).json({ success: false, message: "Failed to run the purge." });
  }
};
