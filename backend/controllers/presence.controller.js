// controllers/presence.controller.js
//
// Who on the team is at their desk right now.
//
// A heartbeat, not a login event: the browser checks in every minute while a
// staff portal is open, and "online" is derived from how recent that was. That
// is why closing a laptop shows someone offline shortly afterwards without
// anything having to be sent on the way out — a logout ping would never arrive
// from a crashed tab or a shut lid.
//
// Reading the list is OWNER / ADMIN only, matching screen monitoring: seeing
// what colleagues are doing is an admin power here, not a team convenience.
// Every staff member can still POST their own heartbeat, which is the only
// thing that writes their own row.

import StaffPresence from "../models/StaffPresence.js";
import OrganizationMember from "../models/OrganizationMember.js";

const ADMIN_ROLES = ["OWNER", "ADMIN"];

const isAdmin = (req) =>
  req.user?.role === "Organization" && ADMIN_ROLES.includes(req.user?.organizationRole);

// The browser beats every 60s, so two minutes leaves room for one missed beat
// (a sleeping tab, a flaky connection) before someone is called offline.
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

// A gap longer than this starts a new "at the desk" stretch rather than
// extending the old one, so the duration shown means something.
const SESSION_GAP_MS = 10 * 60 * 1000;

const PORTALS = ["admin", "manager", "agent", "finance"];

// @desc    Record that the caller is at their desk
// @route   POST /api/v1/presence/ping
export const ping = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const now = new Date();
    const portal = PORTALS.includes(req.body?.portal) ? req.body.portal : "";

    const existing = await StaffPresence.findOne({ userId: req.user._id });
    const continuing =
      existing?.lastSeenAt && now - existing.lastSeenAt < SESSION_GAP_MS;

    await StaffPresence.findOneAndUpdate(
      { userId: req.user._id },
      {
        organizationId,
        email: req.user.email || "",
        role: req.user.organizationRole || "",
        portal,
        lastSeenAt: now,
        sessionStartedAt: continuing ? existing.sessionStartedAt || now : now,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Presence Ping Error:", error);
    return res.status(500).json({ success: false, message: "Failed to record presence." });
  }
};

// @desc    Mark the caller offline immediately (sign-out, tab close)
// @route   POST /api/v1/presence/offline
export const goOffline = async (req, res) => {
  try {
    await StaffPresence.updateOne(
      { userId: req.user._id },
      { lastSeenAt: null, sessionStartedAt: null }
    );
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Presence Offline Error:", error);
    return res.status(500).json({ success: false, message: "Failed to clear presence." });
  }
};

// @desc    The whole team, online first
// @route   GET /api/v1/presence
export const getPresence = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: "Only an owner or admin can see who is online.",
      });
    }

    const organizationId = req.user.organizationId;

    // Start from the team, not from the presence rows, so somebody who has
    // never opened the app still appears — as offline, which is the answer.
    const members = await OrganizationMember.find({ organizationId })
      .populate("userId", "email")
      .lean();

    const presence = await StaffPresence.find({ organizationId }).lean();
    const byUser = new Map(presence.map((p) => [String(p.userId), p]));

    const cutoff = Date.now() - ONLINE_WINDOW_MS;

    const data = members
      .filter((m) => m.userId)
      .map((m) => {
        const p = byUser.get(String(m.userId._id));
        const lastSeenAt = p?.lastSeenAt || null;
        return {
          userId: String(m.userId._id),
          email: m.userId.email || p?.email || "",
          role: m.role,
          memberStatus: m.status,
          online: Boolean(lastSeenAt && new Date(lastSeenAt).getTime() > cutoff),
          lastSeenAt,
          portal: p?.portal || "",
          sessionStartedAt: p?.sessionStartedAt || null,
        };
      })
      .sort(
        (a, b) =>
          Number(b.online) - Number(a.online) ||
          new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0) ||
          a.email.localeCompare(b.email)
      );

    return res.status(200).json({
      success: true,
      count: data.length,
      onlineCount: data.filter((d) => d.online).length,
      data,
    });
  } catch (error) {
    console.error("Get Presence Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load who is online." });
  }
};
