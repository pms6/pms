import VoidPeriod from "../models/voidPeriod.js";
import Room from "../models/Room.js";
import { calculateVoidMetrics, toMoney } from "../utils/voidMath.js";

// Re-exported so anything already importing it from here keeps working; the
// implementation now lives in utils/voidMath.js alongside the model's copy.
export { calculateVoidMetrics };

/**
 * Read the day filter off the query string.
 *
 * `days=3`            -> exactly 3 days
 * `minDays`/`maxDays` -> a range, either end optional
 *
 * Anything unparseable is ignored rather than rejected: a filter is a view
 * preference, and failing the whole list because of a stray value is worse
 * than showing everything.
 */
const dayFilter = ({ days, minDays, maxDays }) => {
  const exact = Number(days);
  if (Number.isFinite(exact) && exact > 0) return { voidDays: Math.trunc(exact) };

  const min = Number(minDays);
  const max = Number(maxDays);
  const range = {};
  if (Number.isFinite(min) && min > 0) range.$gte = Math.trunc(min);
  if (Number.isFinite(max) && max > 0) range.$lte = Math.trunc(max);

  return Object.keys(range).length ? { voidDays: range } : {};
};

/**
 * An existing void period for the same room whose dates overlap the range being
 * saved, or null when the range is clear.
 *
 * Two voids on one room over the same days would count the same empty night
 * twice, and the total loss is the number this whole section exists to produce.
 * Ranges overlap when each starts on or before the other ends.
 *
 * @param {object}   args
 * @param {*}        args.roomId
 * @param {*}        args.organizationId
 * @param {Date|string} args.startDate
 * @param {Date|string} args.endDate
 * @param {*}        [args.excludeId] the period being edited, so it cannot
 *                   clash with itself
 */
const overlappingPeriod = async ({ roomId, organizationId, startDate, endDate, excludeId }) => {
  if (!roomId || !startDate || !endDate) return null;

  const filter = {
    organizationId,
    roomId,
    isDeleted: { $ne: true },
    startDate: { $lte: new Date(endDate) },
    endDate: { $gte: new Date(startDate) },
  };

  if (excludeId) filter._id = { $ne: excludeId };

  return VoidPeriod.findOne(filter).select("startDate endDate roomCode").lean();
};

const overlapMessage = (clash) => {
  const from = new Date(clash.startDate).toLocaleDateString("en-GB", { timeZone: "UTC" });
  const to = new Date(clash.endDate).toLocaleDateString("en-GB", { timeZone: "UTC" });
  return `This room already has a void period covering ${from} – ${to}. Overlapping periods would count the same empty days twice.`;
};

export const listVoidPeriods = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    // Deleted periods are kept as history and only returned when asked for, so
    // the working list and the totals stay clean by default.
    const includeDeleted = req.query.includeDeleted === "true";

    const filter = {
      organizationId,
      ...(includeDeleted ? {} : { isDeleted: { $ne: true } }),
      ...dayFilter(req.query),
    };

    const periods = await VoidPeriod.find(filter)
      .populate("propertyId", "name propertyCode")
      .populate("roomId", "roomNumber roomName monthlyRent status")
      .sort({ startDate: -1 })
      .lean();

    // The distinct day-lengths that exist for this organization, so the client
    // can offer "1 day / 2 days / ..." without loading every record to work
    // them out. Always computed over the LIVE set, ignoring any day filter —
    // otherwise picking "3 days" would leave 3 as the only option left.
    const dayOptions = await VoidPeriod.distinct("voidDays", {
      organizationId,
      ...(includeDeleted ? {} : { isDeleted: { $ne: true } }),
    });

    return res.status(200).json({
      success: true,
      data: periods,
      dayOptions: dayOptions.filter((d) => Number(d) > 0).sort((a, b) => a - b),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch void periods.",
    });
  }
};

export const getVoidSummary = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    // Summary covers live periods only. A deleted void is one the operator has
    // said should not count, so folding it into the headline loss would be
    // wrong even though the record is kept.
    const periods = await VoidPeriod.find({
      organizationId,
      isDeleted: { $ne: true },
    }).lean();

    const totalVoid = periods.reduce((sum, period) => sum + Number(period.totalVoid || 0), 0);
    const totalDays = periods.reduce((sum, period) => sum + Number(period.voidDays || 0), 0);
    const roomCount = new Set(periods.map((period) => String(period.roomId))).size;

    const deletedCount = await VoidPeriod.countDocuments({
      organizationId,
      isDeleted: true,
    });

    return res.status(200).json({
      success: true,
      data: {
        totalVoid: toMoney(totalVoid),
        count: periods.length,
        roomCount,
        totalDays,
        deletedCount,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch void summary.",
    });
  }
};

export const createVoidPeriod = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { propertyId, roomId, tenantName, startDate, endDate, notes } = req.body;

    if (!propertyId || !roomId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Property, room, start date and end date are required.",
      });
    }

    const room = await Room.findOne({
      _id: roomId,
      propertyId,
      organizationId,
    }).lean();

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found for this property.",
      });
    }

    const clash = await overlappingPeriod({ roomId, organizationId, startDate, endDate });
    if (clash) {
      return res.status(409).json({ success: false, message: overlapMessage(clash) });
    }

    // Rent is snapshotted from the room at the moment the void is recorded, so
    // a later rent review does not silently rewrite what a past void cost.
    const rentAmount = Number(room.monthlyRent || 0);
    const metrics = calculateVoidMetrics(rentAmount, startDate, endDate);

    const period = await VoidPeriod.create({
      organizationId,
      propertyId,
      roomId,
      createdBy: req.user._id,
      tenantName: tenantName || "",
      roomCode: room.roomNumber || room.roomName || "",
      rentAmount,
      dailyRent: metrics.dailyRent,
      voidDays: metrics.voidDays,
      totalVoid: metrics.totalVoid,
      startDate,
      endDate,
      notes: notes || "",
    });

    const populated = await VoidPeriod.findById(period._id)
      .populate("propertyId", "name propertyCode")
      .populate("roomId", "roomNumber roomName monthlyRent status")
      .lean();

    return res.status(201).json({
      success: true,
      message: "Void period saved successfully.",
      data: populated || period,
    });
  } catch (error) {
    console.error(error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create void period.",
    });
  }
};

/**
 * Edit a void period.
 *
 * Without this the only way to correct a mistyped date or tenant name is to
 * delete the record and re-enter it, which loses who logged it and when.
 *
 * The money is never taken from the request: dailyRent, voidDays and totalVoid
 * are recomputed by the model's pre-validate hook from the rent and the dates,
 * so a client cannot post a total that does not follow from them.
 *
 * @route PUT /api/v1/void-periods/:id
 */
export const updateVoidPeriod = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { id } = req.params;

    const period = await VoidPeriod.findOne({
      _id: id,
      organizationId,
      isDeleted: { $ne: true },
    });

    if (!period) {
      return res.status(404).json({ success: false, message: "Void period not found." });
    }

    const { propertyId, roomId, tenantName, startDate, endDate, notes } = req.body;

    const nextPropertyId = propertyId ?? period.propertyId;
    const nextRoomId = roomId ?? period.roomId;

    // Moving the void to a different room re-snapshots the rent from that room,
    // since the loss is that room's rent, not the old one's.
    if (String(nextRoomId) !== String(period.roomId) || String(nextPropertyId) !== String(period.propertyId)) {
      const room = await Room.findOne({
        _id: nextRoomId,
        propertyId: nextPropertyId,
        organizationId,
      }).lean();

      if (!room) {
        return res.status(404).json({ success: false, message: "Room not found for this property." });
      }

      period.propertyId = nextPropertyId;
      period.roomId = nextRoomId;
      period.roomCode = room.roomNumber || room.roomName || "";
      period.rentAmount = Number(room.monthlyRent || 0);
    }

    if (startDate !== undefined) period.startDate = startDate;
    if (endDate !== undefined) period.endDate = endDate;
    if (tenantName !== undefined) period.tenantName = tenantName;
    if (notes !== undefined) period.notes = notes;

    const clash = await overlappingPeriod({
      roomId: period.roomId,
      organizationId,
      startDate: period.startDate,
      endDate: period.endDate,
      excludeId: period._id,
    });
    if (clash) {
      return res.status(409).json({ success: false, message: overlapMessage(clash) });
    }

    // The pre-validate hook recalculates dailyRent / voidDays / totalVoid here.
    await period.save();

    const populated = await VoidPeriod.findById(period._id)
      .populate("propertyId", "name propertyCode")
      .populate("roomId", "roomNumber roomName monthlyRent status")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Void period updated.",
      data: populated || period,
    });
  } catch (error) {
    console.error(error);

    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(500).json({ success: false, message: "Failed to update void period." });
  }
};

/**
 * Remove a void period from the working list.
 *
 * Soft, not destructive: the loss it records already happened, and an operator
 * tidying the board should not be able to erase the evidence of it. The record
 * stays readable under `?includeDeleted=true`.
 */
export const deleteVoidPeriod = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await VoidPeriod.findOneAndUpdate(
      { _id: id, organizationId: req.user.organizationId, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Void period not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Void period removed. It stays in the history.",
      data: deleted,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete void period.",
    });
  }
};

/**
 * Put a removed void period back on the working list.
 *
 * The counterpart to the soft delete above — without it, "removed" is still a
 * one-way door and keeping the history buys the operator nothing.
 */
export const restoreVoidPeriod = async (req, res) => {
  try {
    const { id } = req.params;

    const restored = await VoidPeriod.findOneAndUpdate(
      { _id: id, organizationId: req.user.organizationId, isDeleted: true },
      { $set: { isDeleted: false }, $unset: { deletedAt: "" } },
      { new: true }
    )
      .populate("propertyId", "name propertyCode")
      .populate("roomId", "roomNumber roomName monthlyRent status");

    if (!restored) {
      return res.status(404).json({
        success: false,
        message: "Removed void period not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Void period restored.",
      data: restored,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to restore void period.",
    });
  }
};
