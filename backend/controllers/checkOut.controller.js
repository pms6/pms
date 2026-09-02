// controllers/checkOut.controller.js
//
// The check-out register — the app's replacement for
// "Check out template.xlsx": who moved out, when, what state the room was left
// in, and how their deposit was settled.

import CheckOut, { DEPOSIT_STATUS } from "../models/CheckOut.js";
import CheckIn from "../models/CheckIn.js";
import Property from "../models/Property.js";
import Room from "../models/Room.js";

const EDITABLE_KEYS = [
  "propertyId",
  "roomId",
  "tenantId",
  "tenancyId",
  "checkInId",
  "property",
  "room",
  "tenant",
  "contractStatus",
  "contractNote",
  "rentDueDay",
  "noticeDate",
  "movedOutDate",
  "actualMovedOutDate",
  "rent",
  "advanceLicenceFee",
  "depositStatus",
  "depositReturned",
  "depositDeducted",
  "depositNote",
  "keysLocation",
  "pictures",
  "videos",
  "fridgeCleaning",
  "bedsheets",
  "cupboardClean",
  "roomClean",
  "inspection",
  "notes",
];

const NUMERIC_KEYS = ["rent", "advanceLicenceFee", "depositReturned", "depositDeducted"];
const DATE_KEYS = ["noticeDate", "movedOutDate", "actualMovedOutDate"];
const REF_KEYS = ["propertyId", "roomId", "tenantId", "tenancyId", "checkInId"];

// The seven move-out checklist columns. Grouped so the summary can report how
// far through the checklist a row is without listing them again.
export const CHECKLIST_KEYS = [
  "pictures",
  "videos",
  "fridgeCleaning",
  "bedsheets",
  "cupboardClean",
  "roomClean",
];

const pickPayload = (body) => {
  const payload = {};
  for (const key of EDITABLE_KEYS) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  return payload;
};

const blankToNull = (value) => (value === "" || value === undefined ? null : value);

const normalisePayload = (payload) => {
  for (const key of NUMERIC_KEYS) {
    if (payload[key] === undefined) continue;
    if (payload[key] === "" || payload[key] === null) {
      payload[key] = 0;
      continue;
    }
    const n = Number(payload[key]);
    if (!Number.isFinite(n) || n < 0) {
      return key + " must be a positive number.";
    }
    payload[key] = n;
  }

  if (payload.rentDueDay !== undefined) {
    if (payload.rentDueDay === "" || payload.rentDueDay === null) {
      payload.rentDueDay = null;
    } else {
      const d = Number(payload.rentDueDay);
      if (!Number.isInteger(d) || d < 1 || d > 31) {
        return "rentDueDay must be a day of the month (1-31).";
      }
      payload.rentDueDay = d;
    }
  }

  if (payload.depositStatus && !DEPOSIT_STATUS.includes(payload.depositStatus)) {
    return "Unknown deposit status.";
  }

  for (const key of DATE_KEYS) {
    if (payload[key] !== undefined) payload[key] = blankToNull(payload[key]);
  }
  for (const key of REF_KEYS) {
    if (payload[key] !== undefined) payload[key] = blankToNull(payload[key]);
  }

  return null;
};

/**
 * Resolve the optional links. A checkInId does the most work: it carries the
 * property, room, tenant and the deposit that was taken, so filing a check-out
 * against one means the operator retypes nothing.
 */
const attachLinks = async (payload, organizationId) => {
  if (payload.checkInId) {
    const checkIn = await CheckIn.findOne({
      _id: payload.checkInId,
      organizationId,
      isDeleted: false,
    })
      .select("property room tenant propertyId roomId tenantId tenancyId rent deposit paymentDueDay")
      .lean();

    if (!checkIn) return { error: "Check-in not found." };

    // Only fill what the caller left blank — an explicit value on the body is
    // the operator correcting the record, and must win.
    if (!payload.property) payload.property = checkIn.property;
    if (!payload.room) payload.room = checkIn.room;
    if (!payload.tenant) payload.tenant = checkIn.tenant;
    if (!payload.propertyId) payload.propertyId = checkIn.propertyId;
    if (!payload.roomId) payload.roomId = checkIn.roomId;
    if (!payload.tenantId) payload.tenantId = checkIn.tenantId;
    if (!payload.tenancyId) payload.tenancyId = checkIn.tenancyId;
    if (payload.rent === undefined) payload.rent = checkIn.rent;
    if (payload.advanceLicenceFee === undefined) payload.advanceLicenceFee = checkIn.deposit;
    if (payload.rentDueDay === undefined) payload.rentDueDay = checkIn.paymentDueDay;
  }

  if (payload.propertyId) {
    const property = await Property.findOne({ _id: payload.propertyId, organizationId })
      .select("name")
      .lean();
    if (!property) return { error: "Property not found." };
    if (!payload.property) payload.property = property.name;
  }

  if (payload.roomId) {
    const room = await Room.findOne({ _id: payload.roomId, organizationId })
      .select("roomName title propertyId")
      .lean();
    if (!room) return { error: "Room not found." };
    if (!payload.room) payload.room = room.roomName || room.title || "";
    if (!payload.propertyId) payload.propertyId = room.propertyId;
  }

  return {};
};

// @desc    List check-outs
// @route   GET /api/v1/check-outs
export const getCheckOuts = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const { year, month, propertyId, depositStatus, inspection, search } = req.query;

    const filter = { organizationId, isDeleted: false };

    if (year) {
      const y = Number(year);
      if (!Number.isInteger(y)) {
        return res.status(400).json({ success: false, message: "year must be a number." });
      }
      if (month) {
        const m = Number(month);
        if (!Number.isInteger(m) || m < 1 || m > 12) {
          return res.status(400).json({ success: false, message: "month must be 1-12." });
        }
        filter.movedOutDate = {
          $gte: new Date(Date.UTC(y, m - 1, 1)),
          $lt: new Date(Date.UTC(y, m, 1)),
        };
      } else {
        filter.movedOutDate = {
          $gte: new Date(Date.UTC(y, 0, 1)),
          $lt: new Date(Date.UTC(y + 1, 0, 1)),
        };
      }
    }

    if (propertyId) filter.propertyId = propertyId;
    if (depositStatus) filter.depositStatus = depositStatus;
    if (inspection) filter.inspection = inspection;

    if (search) {
      filter.$or = [
        { tenant: { $regex: search, $options: "i" } },
        { property: { $regex: search, $options: "i" } },
        { room: { $regex: search, $options: "i" } },
        { depositNote: { $regex: search, $options: "i" } },
      ];
    }

    const rows = await CheckOut.find(filter)
      .sort({ movedOutDate: -1, createdAt: -1 })
      .lean();

    // Counts per deposit status, so the summary tiles stay stable while the
    // list filters. Computed from the filtered rows deliberately: the tiles
    // describe what is on screen.
    const byDepositStatus = DEPOSIT_STATUS.reduce((acc, s) => {
      acc[s] = rows.filter((r) => r.depositStatus === s).length;
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      total: rows.length,
      totals: {
        rent: rows.reduce((sum, r) => sum + (r.rent || 0), 0),
        advanceLicenceFee: rows.reduce((sum, r) => sum + (r.advanceLicenceFee || 0), 0),
        depositReturned: rows.reduce((sum, r) => sum + (r.depositReturned || 0), 0),
        depositDeducted: rows.reduce((sum, r) => sum + (r.depositDeducted || 0), 0),
      },
      byDepositStatus,
      data: rows,
    });
  } catch (error) {
    console.error("Get Check-outs Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch check-outs." });
  }
};

// @desc    One check-out in full
// @route   GET /api/v1/check-outs/:id
export const getCheckOutById = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;

    const row = await CheckOut.findOne({
      _id: req.params.id,
      organizationId,
      isDeleted: false,
    })
      .populate("createdBy", "email")
      .lean();

    if (!row) {
      return res.status(404).json({ success: false, message: "Check-out not found." });
    }

    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error("Get Check-out Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch the check-out." });
  }
};

// @desc    Tenants still in a room — the picker for "who is checking out?"
// @route   GET /api/v1/check-outs/open-check-ins
//
// Anyone whose check-in has not been checked out yet. Kept on this controller
// rather than the check-in one because it exists to serve this form.
export const getOpenCheckIns = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const rows = await CheckIn.find({
      organizationId,
      isDeleted: false,
      status: "ACTIVE",
    })
      .select("property room tenant rent deposit paymentDueDay checkInDate contractEnd propertyId roomId")
      .sort({ property: 1, room: 1 })
      .lean();

    return res.status(200).json({ success: true, total: rows.length, data: rows });
  } catch (error) {
    console.error("Get Open Check-ins Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch current occupants." });
  }
};

// @desc    Record a check-out
// @route   POST /api/v1/check-outs
export const createCheckOut = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const payload = pickPayload(req.body);

    const invalid = normalisePayload(payload);
    if (invalid) return res.status(400).json({ success: false, message: invalid });

    // Links are resolved before the required-field check: a checkInId supplies
    // the property and tenant, so requiring them first would reject a valid
    // "check this person out" request that named only the check-in.
    const { error } = await attachLinks(payload, organizationId);
    if (error) return res.status(404).json({ success: false, message: error });

    if (!payload.property || !String(payload.property).trim()) {
      return res.status(400).json({ success: false, message: "A property is required." });
    }
    if (!payload.tenant || !String(payload.tenant).trim()) {
      return res.status(400).json({ success: false, message: "A tenant name is required." });
    }

    const row = await CheckOut.create({
      ...payload,
      organizationId,
      createdBy: req.user._id,
    });

    // Close the check-in so the room status list stops counting this tenant as
    // the current occupant. Scoped by organizationId as well as _id — the id
    // came off the request body.
    if (row.checkInId) {
      await CheckIn.updateOne(
        { _id: row.checkInId, organizationId },
        { $set: { status: "CHECKED_OUT" } }
      );
    }

    return res.status(201).json({ success: true, data: row });
  } catch (error) {
    console.error("Create Check-out Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map((e) => e.message)
          .join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to record the check-out." });
  }
};

// @desc    Update a check-out
// @route   PUT /api/v1/check-outs/:id
export const updateCheckOut = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const payload = pickPayload(req.body);

    const invalid = normalisePayload(payload);
    if (invalid) return res.status(400).json({ success: false, message: invalid });

    const { error } = await attachLinks(payload, organizationId);
    if (error) return res.status(404).json({ success: false, message: error });

    const row = await CheckOut.findOneAndUpdate(
      { _id: req.params.id, organizationId, isDeleted: false },
      { $set: payload },
      { new: true, runValidators: true }
    );

    if (!row) {
      return res.status(404).json({ success: false, message: "Check-out not found." });
    }

    if (row.checkInId) {
      await CheckIn.updateOne(
        { _id: row.checkInId, organizationId },
        { $set: { status: "CHECKED_OUT" } }
      );
    }

    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error("Update Check-out Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map((e) => e.message)
          .join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to update the check-out." });
  }
};

// @desc    Delete a check-out (soft delete)
// @route   DELETE /api/v1/check-outs/:id
//
// Deleting the check-out puts its check-in back to ACTIVE — the tenant is once
// again the room's current occupant, which is what deleting a check-out means.
export const deleteCheckOut = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;

    const row = await CheckOut.findOneAndUpdate(
      { _id: req.params.id, organizationId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    );

    if (!row) {
      return res.status(404).json({ success: false, message: "Check-out not found." });
    }

    if (row.checkInId) {
      await CheckIn.updateOne(
        { _id: row.checkInId, organizationId },
        { $set: { status: "ACTIVE" } }
      );
    }

    return res.status(200).json({ success: true, message: "Check-out deleted." });
  } catch (error) {
    console.error("Delete Check-out Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete the check-out." });
  }
};
