// controllers/viewingBlock.controller.js
//
// Blocked viewing dates. An operator closes a date for a property (optionally
// for one room), and any attempt to book or move a viewing into that date is
// refused — see blockedReason() below, which every date-setting path in
// viewing.controller.js calls.
import ViewingBlock from "../models/ViewingBlock.js";
import Property from "../models/Property.js";
import Room from "../models/Room.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD

const idOf = (value) => (value && typeof value === "object" ? value._id : value) || null;

// Parsed and rendered in UTC, so the date named in a refusal is the date the
// operator blocked — not one shifted by whatever timezone the server runs in.
// Must stay in step with prettyDay() in Shared/ViewingsBoard.js.
const prettyDate = (date) => {
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
};

/**
 * Why this slot cannot be booked, or null when it can.
 *
 * A block matches when it is on the same date, for the same property, AND
 * either closes the whole property (roomId null) or names this exact room. A
 * room-level block therefore leaves the rest of the property bookable, and a
 * property-level block closes everything in it.
 *
 * Shared by createViewing, updateViewing, rescheduleViewing, the tenant's
 * reschedule request and the operator's approval of one — every route that can
 * put a viewing on a date.
 *
 * @param {object} args
 * @param {string} args.date          YYYY-MM-DD
 * @param {*}      args.propertyId
 * @param {*}      [args.roomId]
 * @param {*}      args.organizationId
 * @returns {Promise<string|null>} the message to refuse with, or null
 */
export const blockedReason = async ({ date, propertyId, roomId, organizationId }) => {
  // Nothing to check against. The callers' own validation reports a missing or
  // malformed date; this is not the place to duplicate it.
  if (!DATE_RE.test(String(date || "")) || !propertyId || !organizationId) return null;

  const room = idOf(roomId);

  const block = await ViewingBlock.findOne({
    organizationId,
    propertyId: idOf(propertyId),
    date,
    isDeleted: { $ne: true },
    // A property-wide block, or one naming this room.
    $or: [{ roomId: null }, ...(room ? [{ roomId: room }] : [])],
  })
    .populate("roomId", "roomName roomNumber title")
    .lean();

  if (!block) return null;

  const scope = block.roomId
    ? block.roomId.roomName || block.roomId.title || `Room ${block.roomId.roomNumber || ""}`.trim()
    : "this property";

  return (
    `Viewings are blocked for ${scope} on ${prettyDate(date)}.` +
    (block.note ? ` Reason: ${block.note}` : "") +
    " Pick another date, or remove the block on the Viewings board."
  );
};

/**
 * List blocked dates. Past ones are dropped by default — a date that has been
 * and gone cannot stop anything, and leaving them piles up clutter.
 *
 * @route GET /api/v1/viewings/blocks?includePast=true
 */
export const listViewingBlocks = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const includePast = req.query.includePast === "true";

    const filter = { organizationId, isDeleted: { $ne: true } };
    if (!includePast) {
      filter.date = { $gte: new Date().toISOString().slice(0, 10) };
    }

    const blocks = await ViewingBlock.find(filter)
      .populate("propertyId", "name")
      .populate("roomId", "roomName roomNumber title")
      .sort({ date: 1 })
      .lean();

    return res.status(200).json({ success: true, total: blocks.length, data: blocks });
  } catch (error) {
    console.error("listViewingBlocks error:", error);
    return res.status(500).json({ success: false, message: "Failed to load blocked dates." });
  }
};

/**
 * Block a date.
 *
 * @route POST /api/v1/viewings/blocks   body: { propertyId, roomId?, date, note? }
 */
export const createViewingBlock = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { propertyId, roomId, date, note } = req.body;

    if (!propertyId) {
      return res.status(400).json({ success: false, message: "A property is required." });
    }
    if (!DATE_RE.test(String(date || ""))) {
      return res.status(400).json({ success: false, message: "A valid date (YYYY-MM-DD) is required." });
    }

    // Confirm the property is this organization's, so a block cannot be planted
    // on someone else's diary.
    const property = await Property.findOne({ _id: propertyId, organizationId, isDeleted: false })
      .select("name")
      .lean();
    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found." });
    }

    // An empty select posts "" — treat that as "all rooms" rather than letting
    // Mongoose fail casting it to an ObjectId.
    const room = roomId ? roomId : null;
    if (room) {
      const found = await Room.findOne({ _id: room, propertyId, organizationId }).select("_id").lean();
      if (!found) {
        return res.status(404).json({ success: false, message: "Room not found for this property." });
      }
    }

    // Same property, same room, same date — already closed.
    const existing = await ViewingBlock.findOne({
      organizationId,
      propertyId,
      roomId: room,
      date,
      isDeleted: { $ne: true },
    }).lean();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "That date is already blocked for this property and room.",
      });
    }

    const block = await ViewingBlock.create({
      organizationId,
      propertyId,
      roomId: room,
      date,
      note: note || "",
      createdBy: req.user._id,
      createdByEmail: req.user.email || "",
      createdByRole: req.user.organizationRole || "",
    });

    const populated = await ViewingBlock.findById(block._id)
      .populate("propertyId", "name")
      .populate("roomId", "roomName roomNumber title")
      .lean();

    // Warn about viewings ALREADY booked on the date. The block is not applied
    // retroactively — cancelling somebody's confirmed appointment behind their
    // back would be worse than the clash — but the operator has to be told.
    const { default: Viewing } = await import("../models/Viewing.js");
    const clashes = await Viewing.countDocuments({
      organizationId,
      property: propertyId,
      date,
      status: "scheduled",
      isDeleted: false,
      ...(room ? { room } : {}),
    });

    return res.status(201).json({
      success: true,
      message: clashes
        ? `Date blocked. Note: ${clashes} viewing${clashes === 1 ? " is" : "s are"} already booked on this date — they have been left alone.`
        : "Date blocked.",
      existingViewings: clashes,
      data: populated || block,
    });
  } catch (error) {
    console.error("createViewingBlock error:", error);
    return res.status(500).json({ success: false, message: "Failed to block the date." });
  }
};

/**
 * Unblock a date.
 *
 * @route DELETE /api/v1/viewings/blocks/:id
 */
export const deleteViewingBlock = async (req, res) => {
  try {
    const removed = await ViewingBlock.findOneAndUpdate(
      {
        _id: req.params.id,
        organizationId: req.user.organizationId,
        isDeleted: { $ne: true },
      },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    );

    if (!removed) {
      return res.status(404).json({ success: false, message: "Blocked date not found." });
    }

    return res.status(200).json({ success: true, message: "Date unblocked." });
  } catch (error) {
    console.error("deleteViewingBlock error:", error);
    return res.status(500).json({ success: false, message: "Failed to unblock the date." });
  }
};
