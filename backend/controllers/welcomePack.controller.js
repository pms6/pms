import WelcomePack from "../models/WelcomePack.js";
import { resolveTenantProperty } from "../utils/tenantProperty.js";

// ---------------------------------------------------------------------------
// Visibility window
//
// A card carries an optional visibleFrom/visibleUntil pair. Null at either end
// means "no bound" — live immediately, or never expires.
//
// Both ends are inclusive at DAY granularity, which is what an operator picking
// dates in a calendar expects: a card set to run until the 20th is still there
// for the whole of the 20th, not gone at 00:00. The date inputs post midnight
// UTC, so comparing raw timestamps would otherwise hide it a day early.
// ---------------------------------------------------------------------------
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

// Mongo clauses matching only the cards live right now. Kept as an array so it
// can be combined with the room targeting rules under a single $and.
const liveNowClauses = () => [
  {
    $or: [
      { visibleFrom: null },
      { visibleFrom: { $exists: false } },
      { visibleFrom: { $lte: endOfToday() } },
    ],
  },
  {
    $or: [
      { visibleUntil: null },
      { visibleUntil: { $exists: false } },
      { visibleUntil: { $gte: startOfToday() } },
    ],
  },
];

// "scheduled" (starts later) | "expired" (window has passed) | "live".
// Returned to the admin list so the dashboard can label each card without
// re-deriving the same rule in the browser.
export const visibilityStatus = ({ visibleFrom, visibleUntil }) => {
  if (visibleFrom && new Date(visibleFrom) > endOfToday()) return "scheduled";
  if (visibleUntil && new Date(visibleUntil) < startOfToday()) return "expired";
  return "live";
};

// Date fields arrive as "YYYY-MM-DD" or "" from the admin form. Empty means
// "no bound" (null); undefined means the caller did not touch the field at all,
// which matters on PATCH so a partial update cannot silently clear a window.
const toDateOrNull = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Rejects a window that ends before it starts, which would silently hide the
// card from everyone.
const windowError = (from, until) =>
  from && until && new Date(until) < new Date(from)
    ? "The visible-until date cannot be before the visible-from date."
    : null;


// GET the signed-in TENANT's welcome pack(s) — scoped to THEIR property, and
// further to property-wide packs plus any pack targeted at THEIR specific room.
export const getMyWelcomePack = async (req, res) => {
  try {
    const { property, roomId } = await resolveTenantProperty(req.user);

    if (!property?._id) {
      return res.json({ success: true, data: [] });
    }

    // Only cards whose visibility window covers today. A card scheduled for
    // next month, or one whose run has finished, is simply not returned.
    const clauses = liveNowClauses();

    // Property-wide packs (no room) always apply; room-specific packs apply only
    // when they match the tenant's own room. When the room can't be resolved at
    // all we don't narrow by room — a tenancy with no room link would otherwise
    // see nothing at all in a property whose packs are all room-targeted.
    if (roomId) {
      clauses.push({
        $or: [
          { roomId: null },
          { roomId: { $exists: false } },
          { roomId },
        ],
      });
    }

    const query = {
      organizationId: property.organizationId,
      propertyId: property._id,
      isDeleted: false,
      $and: clauses,
    };

    const items = await WelcomePack.find(query)
      .populate("propertyId", "name")
      .populate("roomId", "roomName title roomNumber")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: items });
  } catch (err) {
    console.error("Get My Welcome Pack Error:", err);
    res.status(500).json({ success: false, message: "Failed to load your welcome pack." });
  }
};

export const getWelcomePack = async (req, res) => {
  try {
    const { organizationId } = req.user;

    // The admin dashboard shows scheduled and expired cards too — it is the
    // screen where the window gets set — so nothing is filtered out here.
    // Each card is labelled instead.
    const items = await WelcomePack.find({
      organizationId,
      isDeleted: false,
    })
      .populate("propertyId", "name")
      .populate("roomId", "roomName title roomNumber")
      .lean();

    res.json({
      success: true,
      data: items.map((item) => ({ ...item, visibility: visibilityStatus(item) })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createWelcomePack = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { propertyId, roomId, title, description, wifiNetwork, wifiPassword, emergencyNumber, videoUrl, documentUrl, documentName, visibleFrom, visibleUntil } = req.body;

    const from = toDateOrNull(visibleFrom) ?? null;
    const until = toDateOrNull(visibleUntil) ?? null;

    const invalid = windowError(from, until);
    if (invalid) return res.status(400).json({ success: false, message: invalid });

    const item = await WelcomePack.create({
      organizationId,
      propertyId,
      roomId: roomId || null, // optional — empty selection means property-wide
      title,
      description,
      wifiNetwork,
      wifiPassword,
      emergencyNumber,
      videoUrl,
      documentUrl,
      documentName,
      visibleFrom: from,
      visibleUntil: until,
    });

    res.status(201).json({
      success: true,
      data: { ...item.toObject(), visibility: visibilityStatus(item) },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const updateWelcomePack = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { id } = req.params;

    // Normalise an empty room selection to null (property-wide) so Mongoose
    // doesn't try to cast "" to an ObjectId.
    const updates = { ...req.body };
    if ("roomId" in updates && !updates.roomId) updates.roomId = null;

    // Only touch a date the caller actually sent, so a partial update cannot
    // silently clear a window that was set elsewhere.
    if ("visibleFrom" in updates) updates.visibleFrom = toDateOrNull(updates.visibleFrom);
    if ("visibleUntil" in updates) updates.visibleUntil = toDateOrNull(updates.visibleUntil);

    // Validate against the saved record for whichever end was not sent.
    const current = await WelcomePack.findOne({ _id: id, organizationId, isDeleted: false }).lean();
    if (!current) return res.status(404).json({ success: false, message: "Welcome pack not found" });

    const invalid = windowError(
      "visibleFrom" in updates ? updates.visibleFrom : current.visibleFrom,
      "visibleUntil" in updates ? updates.visibleUntil : current.visibleUntil
    );
    if (invalid) return res.status(400).json({ success: false, message: invalid });

    const item = await WelcomePack.findOneAndUpdate(
      { _id: id, organizationId, isDeleted: false },
      updates,
      { new: true, runValidators: true }
    );

    if (!item) return res.status(404).json({ success: false, message: "Welcome pack not found" });

    res.json({
      success: true,
      data: { ...item.toObject(), visibility: visibilityStatus(item) },
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const deleteWelcomePack = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { id } = req.params;

    const item = await WelcomePack.findOneAndUpdate(
      { _id: id, organizationId },
      { isDeleted: true },
      { new: true }
    );

    if (!item) return res.status(404).json({ success: false, message: "Item not found" });

    res.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};