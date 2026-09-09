// controllers/checkIn.controller.js
//
// The check-in register — the app's replacement for
// "Check-in Entries Template.xlsx" and the occupant half of
// "Database Template .xlsx".

import CheckIn from "../models/CheckIn.js";
import Property from "../models/Property.js";
import Room from "../models/Room.js";

/**
 * Whitelist of fields a client may set. Anything else on the body — including
 * organizationId, status and the soft-delete flags — is ignored, so a caller
 * cannot file a row into another organization or resurrect a deleted one.
 */
const EDITABLE_KEYS = [
  "propertyId",
  "roomId",
  "tenantId",
  "tenancyId",
  "property",
  "room",
  "tenant",
  "email",
  "phone",
  "gender",
  "nationality",
  "roomType",
  "rent",
  "deposit",
  "paymentDueDay",
  "bank",
  "agent",
  "roomRentedDate",
  "checkInDate",
  "contractStart",
  "contractEnd",
  "notes",
];

const NUMERIC_KEYS = ["rent", "deposit"];
const DATE_KEYS = ["roomRentedDate", "checkInDate", "contractStart", "contractEnd"];

// ---------------------------------------------------------------------------
// The register's primary date
//
// A room is counted as rented out on the date it was RENTED, not the date the
// tenant moved in — the two can be weeks apart, and it is the first that takes
// the room off the market. So roomRentedDate is what the year/month filter, the
// ordering and the monthly totals all read.
//
// The one wrinkle is history: rows imported from the spreadsheets before that
// column was captured carry only a check-in date. Filtering them out of every
// period would read as data loss, so they fall back to checkInDate — which, for
// those rows, is the only date there is.
// ---------------------------------------------------------------------------

/** The date this row is counted on, as a timestamp. 0 when it carries neither. */
const rentedOn = (row) => {
  const d = row.roomRentedDate || row.checkInDate;
  const t = d ? new Date(d).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Mongo condition for "rented within [start, end)", honouring the same
 * fallback: a row with no roomRentedDate is matched on its check-in date.
 */
const rentedBetween = (start, end) => ({
  $or: [
    { roomRentedDate: { $gte: start, $lt: end } },
    { roomRentedDate: null, checkInDate: { $gte: start, $lt: end } },
  ],
});

const REF_KEYS = ["propertyId", "roomId", "tenantId", "tenancyId"];

const pickPayload = (body) => {
  const payload = {};
  for (const key of EDITABLE_KEYS) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  return payload;
};

// Empty strings arrive from unset select/date inputs. Mongoose casts "" to
// null for an ObjectId path but throws for a Date, so normalise both here.
const blankToNull = (value) => (value === "" || value === undefined ? null : value);

/**
 * Validate and coerce the money and day fields in place. Returns an error
 * message, or null when the payload is good.
 */
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

  if (payload.paymentDueDay !== undefined) {
    if (payload.paymentDueDay === "" || payload.paymentDueDay === null) {
      payload.paymentDueDay = null;
    } else {
      const d = Number(payload.paymentDueDay);
      if (!Number.isInteger(d) || d < 1 || d > 31) {
        return "paymentDueDay must be a day of the month (1-31).";
      }
      payload.paymentDueDay = d;
    }
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
 * Resolve the optional property/room links and denormalise their names, so the
 * register renders without populating. Mirrors attachProperty in
 * expense.controller.js. Returns { error } when a link points somewhere the
 * caller's organization cannot see.
 */
const attachLinks = async (payload, organizationId) => {
  if (payload.propertyId) {
    const property = await Property.findOne({ _id: payload.propertyId, organizationId })
      .select("name")
      .lean();
    if (!property) return { error: "Property not found." };
    // Only fill the display name when the client did not send one. A row typed
    // off the spreadsheet may name the property differently from the record it
    // is being linked to, and the sheet's wording is the audit trail.
    if (!payload.property) payload.property = property.name;
  }

  if (payload.roomId) {
    const room = await Room.findOne({ _id: payload.roomId, organizationId })
      .select("roomName title propertyId")
      .lean();
    if (!room) return { error: "Room not found." };
    if (!payload.room) payload.room = room.roomName || room.title || "";
    // Keep the pair consistent: a room always belongs to its own property.
    if (!payload.propertyId) payload.propertyId = room.propertyId;
  }

  return {};
};

// @desc    List check-ins, filtered by year / month / property / agent / search
// @route   GET /api/v1/check-ins
export const getCheckIns = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const { year, month, propertyId, agent, bank, status, search } = req.query;

    const filter = { organizationId, isDeleted: false };

    // The period filter and the free-text search each need their own $or, so
    // they are collected here and combined under one $and — assigning both to
    // filter.$or would silently drop the first.
    const clauses = [];

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
        clauses.push(
          rentedBetween(new Date(Date.UTC(y, m - 1, 1)), new Date(Date.UTC(y, m, 1)))
        );
      } else {
        clauses.push(
          rentedBetween(new Date(Date.UTC(y, 0, 1)), new Date(Date.UTC(y + 1, 0, 1)))
        );
      }
    }

    if (propertyId) filter.propertyId = propertyId;
    if (agent) filter.agent = agent;
    if (bank) filter.bank = bank;
    if (status) filter.status = status;

    if (search) {
      clauses.push({
        $or: [
          { tenant: { $regex: search, $options: "i" } },
          { property: { $regex: search, $options: "i" } },
          { room: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ],
      });
    }

    if (clauses.length) filter.$and = clauses;

    const rows = await CheckIn.find(filter).lean();

    // Newest first by the date the room was rented. Sorted here rather than in
    // Mongo because the order depends on the checkInDate fallback, which no
    // single index can express — and the endpoint already loads every matching
    // row to total them, so there is nothing to stream.
    rows.sort((a, b) => rentedOn(b) - rentedOn(a) || new Date(b.createdAt) - new Date(a.createdAt));

    // The filter dropdowns need every agent and bank in use, not just the ones
    // surviving the current filter — otherwise picking an agent empties the
    // dropdown you picked them from. One cheap distinct each.
    const [agents, banks] = await Promise.all([
      CheckIn.distinct("agent", { organizationId, isDeleted: false }),
      CheckIn.distinct("bank", { organizationId, isDeleted: false }),
    ]);

    return res.status(200).json({
      success: true,
      total: rows.length,
      totals: {
        rent: rows.reduce((sum, r) => sum + (r.rent || 0), 0),
        deposit: rows.reduce((sum, r) => sum + (r.deposit || 0), 0),
      },
      agents: agents.filter(Boolean).sort(),
      banks: banks.filter(Boolean).sort(),
      data: rows,
    });
  } catch (error) {
    console.error("Get Check-ins Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch check-ins." });
  }
};

// @desc    Check-in counts and money by month for one year
// @route   GET /api/v1/check-ins/monthly?year=2026
//
// Returns all 12 months whether or not anybody moved in, so the sheet renders
// a full year without the client having to fill gaps.
export const getMonthlyCheckIns = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const thisYear = new Date().getFullYear();
    const year = Number(req.query.year) || thisYear;
    if (!Number.isInteger(year)) {
      return res.status(400).json({ success: false, message: "year must be a number." });
    }

    const rows = await CheckIn.find({
      organizationId,
      isDeleted: false,
      ...rentedBetween(
        new Date(Date.UTC(year, 0, 1)),
        new Date(Date.UTC(year + 1, 0, 1))
      ),
    })
      .select("roomRentedDate checkInDate rent deposit")
      .lean();

    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      count: 0,
      rent: 0,
      deposit: 0,
    }));

    for (const r of rows) {
      // Bucketed on the date the room was rented, so the sheet reports what the
      // office counts. getUTCMonth to match how the range above was built.
      const idx = new Date(rentedOn(r)).getUTCMonth();
      months[idx].count += 1;
      months[idx].rent += r.rent || 0;
      months[idx].deposit += r.deposit || 0;
    }

    return res.status(200).json({
      success: true,
      year,
      availableYears: Array.from({ length: 6 }, (_, i) => thisYear - i),
      count: rows.length,
      rent: months.reduce((s, m) => s + m.rent, 0),
      deposit: months.reduce((s, m) => s + m.deposit, 0),
      months,
    });
  } catch (error) {
    console.error("Get Monthly Check-ins Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to build the check-in sheet." });
  }
};

// @desc    One check-in in full
// @route   GET /api/v1/check-ins/:id
export const getCheckInById = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;

    const row = await CheckIn.findOne({
      _id: req.params.id,
      organizationId,
      isDeleted: false,
    })
      .populate("createdBy", "email")
      .lean();

    if (!row) {
      return res.status(404).json({ success: false, message: "Check-in not found." });
    }

    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error("Get Check-in Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch the check-in." });
  }
};

// @desc    Record a check-in
// @route   POST /api/v1/check-ins
export const createCheckIn = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const payload = pickPayload(req.body);

    if (!payload.property || !String(payload.property).trim()) {
      return res.status(400).json({ success: false, message: "A property is required." });
    }
    if (!payload.tenant || !String(payload.tenant).trim()) {
      return res.status(400).json({ success: false, message: "A tenant name is required." });
    }
    if (!payload.roomRentedDate) {
      return res
        .status(400)
        .json({ success: false, message: "A room rented date is required." });
    }

    const invalid = normalisePayload(payload);
    if (invalid) return res.status(400).json({ success: false, message: invalid });

    const { error } = await attachLinks(payload, organizationId);
    if (error) return res.status(404).json({ success: false, message: error });

    const row = await CheckIn.create({
      ...payload,
      organizationId,
      createdBy: req.user._id,
    });

    return res.status(201).json({ success: true, data: row });
  } catch (error) {
    console.error("Create Check-in Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map((e) => e.message)
          .join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to record the check-in." });
  }
};

// @desc    Update a check-in
// @route   PUT /api/v1/check-ins/:id
export const updateCheckIn = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const payload = pickPayload(req.body);

    // Clearing the rented date would take the row out of every period the
    // register counts, so say so plainly rather than letting the schema's
    // required validator report it as a cast error.
    if ("roomRentedDate" in payload && !payload.roomRentedDate) {
      return res
        .status(400)
        .json({ success: false, message: "A room rented date is required." });
    }

    const invalid = normalisePayload(payload);
    if (invalid) return res.status(400).json({ success: false, message: invalid });

    const { error } = await attachLinks(payload, organizationId);
    if (error) return res.status(404).json({ success: false, message: error });

    const row = await CheckIn.findOneAndUpdate(
      { _id: req.params.id, organizationId, isDeleted: false },
      { $set: payload },
      { new: true, runValidators: true }
    );

    if (!row) {
      return res.status(404).json({ success: false, message: "Check-in not found." });
    }

    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error("Update Check-in Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map((e) => e.message)
          .join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to update the check-in." });
  }
};

// @desc    Delete a check-in (soft delete)
// @route   DELETE /api/v1/check-ins/:id
export const deleteCheckIn = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;

    const row = await CheckIn.findOneAndUpdate(
      { _id: req.params.id, organizationId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    );

    if (!row) {
      return res.status(404).json({ success: false, message: "Check-in not found." });
    }

    return res.status(200).json({ success: true, message: "Check-in deleted." });
  } catch (error) {
    console.error("Delete Check-in Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete the check-in." });
  }
};
