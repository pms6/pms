// controllers/agentLocation.controller.js
//
// Live location sharing for agents.
//
// An agent turns sharing on with the toggle in their portal header, and the
// browser then pings a position in every so often. The rest of the team sees
// those positions on the Live Location page, and an hourly job emails them out.
//
// Turning the toggle off is a hard stop: the position is cleared from the
// record, the staff view drops the agent, and the hourly email skips them. That
// is what makes the switch trustworthy to the person being tracked.
import AgentLocation from "../models/AgentLocation.js";

// How old a fix may be before the staff view calls it stale rather than live.
// Twice the frontend's 5-minute ping interval, so one missed ping (a tunnel, a
// locked phone) does not flip an agent to stale straight away.
export const STALE_AFTER_MS = 10 * 60 * 1000;

// Only agents share a location. Everyone else on staff can read the board, but
// the toggle is not theirs to flip — a manager broadcasting their own position
// is a different feature with different consent questions.
const SHARING_ROLE = "AGENT";

const isAgent = (req) => req.user?.organizationRole === SHARING_ROLE;

/** A stored row as the clients want it, with liveness derived on read. */
export const shapeLocation = (doc, now = Date.now()) => {
  const lastPingAt = doc.lastPingAt ? new Date(doc.lastPingAt) : null;
  const ageMs = lastPingAt ? now - lastPingAt.getTime() : null;

  return {
    _id: doc._id,
    userId: doc.userId,
    email: doc.email || "",
    role: doc.role || "",
    active: Boolean(doc.active),
    lat: doc.lat,
    lng: doc.lng,
    accuracy: doc.accuracy,
    lastPingAt,
    startedAt: doc.startedAt,
    ageMs,
    // A fix we have, but not a recent one. The board says "last seen" rather
    // than pretending an hour-old position is where the agent is standing.
    stale: doc.active && (ageMs === null || ageMs > STALE_AFTER_MS),
    // Number.isFinite rather than a null check: a document written before
    // these fields existed has them undefined, and the boards call .toFixed()
    // on whatever this says is a fix.
    hasFix: Number.isFinite(doc.lat) && Number.isFinite(doc.lng),
  };
};

/**
 * The agent's own sharing state, so the toggle renders in the right position on
 * a page load rather than flicking on after the first ping.
 *
 * @route GET /api/v1/agent-location/me
 */
export const getMyLocationState = async (req, res) => {
  try {
    if (!isAgent(req)) {
      return res.status(403).json({
        success: false,
        message: "Only an agent can share a live location.",
      });
    }

    const doc = await AgentLocation.findOne({ userId: req.user._id });

    return res.status(200).json({
      success: true,
      data: doc ? shapeLocation(doc) : { active: false, hasFix: false },
    });
  } catch (error) {
    console.error("getMyLocationState error:", error);
    return res.status(500).json({ success: false, message: "Failed to load sharing state." });
  }
};

/**
 * Turn sharing on or off.
 *
 * @route PATCH /api/v1/agent-location/toggle   body: { active: boolean }
 */
export const toggleMyLocation = async (req, res) => {
  try {
    if (!isAgent(req)) {
      return res.status(403).json({
        success: false,
        message: "Only an agent can share a live location.",
      });
    }

    const active = req.body?.active === true;
    const now = new Date();

    const update = active
      ? { active: true, startedAt: now, stoppedAt: null }
      : // Switching off CLEARS the position rather than merely hiding it. A
        // stored last-known location that outlives consent is the thing an
        // agent would reasonably object to.
        {
          active: false,
          stoppedAt: now,
          lat: null,
          lng: null,
          accuracy: null,
          lastPingAt: null,
        };

    const doc = await AgentLocation.findOneAndUpdate(
      { userId: req.user._id },
      {
        $set: {
          ...update,
          organizationId: req.user.organizationId,
          email: req.user.email || "",
          role: req.user.organizationRole || "",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      message: active ? "Live location is on." : "Live location is off.",
      data: shapeLocation(doc),
    });
  } catch (error) {
    console.error("toggleMyLocation error:", error);
    return res.status(500).json({ success: false, message: "Failed to change sharing state." });
  }
};

/**
 * Record a position. Rejected unless sharing is currently on, so a stale tab
 * cannot keep feeding positions after the agent switched off.
 *
 * @route POST /api/v1/agent-location/ping   body: { lat, lng, accuracy }
 */
export const pingMyLocation = async (req, res) => {
  try {
    if (!isAgent(req)) {
      return res.status(403).json({
        success: false,
        message: "Only an agent can share a live location.",
      });
    }

    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({ success: false, message: "A valid latitude is required." });
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ success: false, message: "A valid longitude is required." });
    }

    const accuracyRaw = Number(req.body?.accuracy);
    const accuracy = Number.isFinite(accuracyRaw) && accuracyRaw >= 0 ? accuracyRaw : null;

    // `active: true` in the filter is the guard: a ping from a tab that still
    // thinks it is sharing matches nothing and writes nothing.
    const doc = await AgentLocation.findOneAndUpdate(
      { userId: req.user._id, active: true },
      { $set: { lat, lng, accuracy, lastPingAt: new Date() } },
      { new: true }
    );

    if (!doc) {
      return res.status(409).json({
        success: false,
        message: "Live location is off. Turn it on before sending a position.",
      });
    }

    return res.status(200).json({ success: true, data: shapeLocation(doc) });
  } catch (error) {
    console.error("pingMyLocation error:", error);
    return res.status(500).json({ success: false, message: "Failed to record the position." });
  }
};

/**
 * Every agent in the organization currently sharing. Readable by any staff
 * seat — the point of the feature is that the team can see where their agents
 * are — but never by a tenant, which the route's staffOnly guard enforces.
 *
 * Agents who have switched off are not returned at all, rather than returned
 * with a flag: an "off" pin on a map is still a pin.
 *
 * @route GET /api/v1/agent-location
 */
export const getActiveLocations = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const docs = await AgentLocation.find({ organizationId, active: true })
      .sort({ lastPingAt: -1 })
      .lean();

    const now = Date.now();
    const data = docs.map((d) => shapeLocation(d, now));

    return res.status(200).json({
      success: true,
      total: data.length,
      data,
      // So the client can label a fix stale on exactly the same rule.
      staleAfterMs: STALE_AFTER_MS,
    });
  } catch (error) {
    console.error("getActiveLocations error:", error);
    return res.status(500).json({ success: false, message: "Failed to load agent locations." });
  }
};
