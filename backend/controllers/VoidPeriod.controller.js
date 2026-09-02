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
    const { period = "all" } = req.query; // "month" | "6months" | "year" | "all"

    const now = new Date();
    let start = null;

    if (period === "month") {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    } else if (period === "6months") {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    } else if (period === "year") {
      start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    }

    const filter = {
      organizationId,
      // Include deleted voids in the financial summary
      // (the loss still happened)
    };

    if (start) {
      filter.startDate = { $gte: start };
    }

    const periods = await VoidPeriod.find(filter).lean();

    const totalVoid = periods.reduce((sum, p) => sum + Number(p.totalVoid || 0), 0);
    const totalDays = periods.reduce((sum, p) => sum + Number(p.voidDays || 0), 0);
    const activeCount = periods.filter((p) => !p.isDeleted).length;
    const deletedCount = periods.filter((p) => p.isDeleted).length;

    return res.status(200).json({
      success: true,
      data: {
        period,
        totalVoid: toMoney(totalVoid),
        totalDays,
        count: periods.length,
        activeCount,
        deletedCount,
        startDate: start ? start.toISOString() : null,
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

/**
 * Latest non-deleted void for a specific room (used by the form to suggest
 * the next start date).
 */
export const getLastVoidForRoom = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { roomId } = req.params;

    if (!roomId) {
      return res.status(400).json({ success: false, message: "roomId is required." });
    }

    const period = await VoidPeriod.findOne({
      organizationId,
      roomId,
      isDeleted: { $ne: true },
    })
      .sort({ endDate: -1 })
      .populate("propertyId", "name propertyCode")
      .populate("roomId", "roomNumber roomName monthlyRent status")
      .lean();

    return res.status(200).json({
      success: true,
      data: period || null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch last void for room.",
    });
  }
};

/**
 * Call this from the place where you mark a room as OCCUPIED.
 * It cleanly ends any still-open void periods for that room.
 */
export const endOpenVoidsForRoom = async (roomId, organizationId, endDate = new Date()) => {
  const open = await VoidPeriod.find({
    roomId,
    organizationId,
    isDeleted: { $ne: true },
    endDate: { $gte: endDate },
  });

  for (const period of open) {
    period.endDate = endDate;
    // pre-validate hook recalculates voidDays + totalVoid
    await period.save();
  }

  return open.length;
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

    // Block occupied rooms
    if (room.status === "OCCUPIED") {
      return res.status(409).json({
        success: false,
        message:
          "This room is currently occupied. Mark the room available (or end the tenancy) before recording a void period.",
      });
    }

    const clash = await overlappingPeriod({ roomId, organizationId, startDate, endDate });
    if (clash) {
      return res.status(409).json({ success: false, message: overlapMessage(clash) });
    }

    // Snapshot rent at the moment the void is recorded
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

    // Moving to a different room → re-snapshot rent + check status
    if (String(nextRoomId) !== String(period.roomId) || String(nextPropertyId) !== String(period.propertyId)) {
      const room = await Room.findOne({
        _id: nextRoomId,
        propertyId: nextPropertyId,
        organizationId,
      }).lean();

      if (!room) {
        return res.status(404).json({ success: false, message: "Room not found for this property." });
      }

      if (room.status === "OCCUPIED") {
        return res.status(409).json({
          success: false,
          message:
            "This room is currently occupied. You cannot move a void period onto an occupied room.",
        });
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

    // pre-validate hook recalculates dailyRent / voidDays / totalVoid
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