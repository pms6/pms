// controllers/cleaningSchedule.controller.js
import CleaningSchedule, { CLEANING_STATUSES } from "../models/CleaningSchedule.js";

const EDITABLE_KEYS = [
  "propertyId",
  "property",
  "date",
  "status",
  "cleaner",
  "notes",
];

const pickPayload = (body) => {
  const payload = {};
  for (const key of EDITABLE_KEYS) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  if (payload.property !== undefined) payload.property = String(payload.property).trim();
  if (payload.cleaner !== undefined) payload.cleaner = String(payload.cleaner).trim();
  if (payload.notes !== undefined) payload.notes = String(payload.notes).trim();
  if (payload.propertyId === "") payload.propertyId = null;
  if (payload.status !== undefined && !CLEANING_STATUSES.includes(payload.status)) {
    delete payload.status;
  }
  return payload;
};

// The sheet's month band, e.g. "2026-05". Returns the [start, end) range so a
// month filter is an index-friendly date range rather than a $expr on the date.
const monthRange = (month) => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  if (!m) return null;
  const start = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  const end = new Date(Date.UTC(Number(m[1]), Number(m[2]), 1));
  return { start, end };
};

// @desc    List cleaning schedule rows
// @route   GET /api/v1/cleaning-schedule
export const getCleaningSchedule = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const { status, month, propertyId, from, to } = req.query;

    const filter = { organizationId, isDeleted: false };
    if (status && CLEANING_STATUSES.includes(status)) filter.status = status;
    if (propertyId) filter.propertyId = propertyId;

    const range = monthRange(month);
    if (range) {
      filter.date = { $gte: range.start, $lt: range.end };
    } else if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    // The sheet reads oldest first within a month, which is how the office
    // works through it.
    const rows = await CleaningSchedule.find(filter).sort({ date: 1, property: 1 });

    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error("Get Cleaning Schedule Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch cleaning schedule." });
  }
};

// @desc    The months that actually have rows, for the month picker
// @route   GET /api/v1/cleaning-schedule/months
export const getCleaningMonths = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const months = await CleaningSchedule.aggregate([
      { $match: { organizationId, isDeleted: false } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          total: { $sum: 1 },
          done: { $sum: { $cond: [{ $eq: ["$status", "DONE"] }, 1, 0] } },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      data: months.map((m) => ({ month: m._id, total: m.total, done: m.done })),
    });
  } catch (error) {
    console.error("Get Cleaning Months Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load months." });
  }
};

// @desc    Read one row
// @route   GET /api/v1/cleaning-schedule/:id
export const getCleaningScheduleById = async (req, res) => {
  try {
    const row = await CleaningSchedule.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: false,
    });

    if (!row) {
      return res.status(404).json({ success: false, message: "Cleaning entry not found." });
    }

    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error("Get Cleaning Entry Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch cleaning entry." });
  }
};

// @desc    Add a row
// @route   POST /api/v1/cleaning-schedule
export const createCleaningSchedule = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const payload = pickPayload(req.body);

    if (!payload.property) {
      return res.status(400).json({ success: false, message: "Property is required." });
    }
    if (!payload.date) {
      return res.status(400).json({ success: false, message: "Date is required." });
    }

    const row = await CleaningSchedule.create({
      ...payload,
      organizationId,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Cleaning entry added.",
      data: row,
    });
  } catch (error) {
    console.error("Create Cleaning Entry Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to add cleaning entry." });
  }
};

// @desc    Add several rows at once — the sheet is written a week at a time
// @route   POST /api/v1/cleaning-schedule/bulk
export const createCleaningScheduleBulk = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

    const docs = rows
      .map(pickPayload)
      .filter((r) => r.property && r.date)
      .map((r) => ({ ...r, organizationId, createdBy: req.user._id }));

    if (!docs.length) {
      return res.status(400).json({
        success: false,
        message: "Nothing to add — each row needs a property and a date.",
      });
    }

    const created = await CleaningSchedule.insertMany(docs);

    return res.status(201).json({
      success: true,
      message: `${created.length} cleaning ${created.length === 1 ? "entry" : "entries"} added.`,
      data: created,
    });
  } catch (error) {
    console.error("Bulk Create Cleaning Error:", error);
    return res.status(500).json({ success: false, message: "Failed to add cleaning entries." });
  }
};

// @desc    Edit a row
// @route   PUT /api/v1/cleaning-schedule/:id
export const updateCleaningSchedule = async (req, res) => {
  try {
    const row = await CleaningSchedule.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: false,
    });

    if (!row) {
      return res.status(404).json({ success: false, message: "Cleaning entry not found." });
    }

    const payload = pickPayload(req.body);
    if (payload.property !== undefined && !payload.property) {
      return res.status(400).json({ success: false, message: "Property is required." });
    }

    Object.assign(row, payload);
    const updated = await row.save();

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Update Cleaning Entry Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to update cleaning entry." });
  }
};

// @desc    Flip just the Done flag — the column the office ticks all day
// @route   PATCH /api/v1/cleaning-schedule/:id/status
export const updateCleaningStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!CLEANING_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status." });
    }

    const row = await CleaningSchedule.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId, isDeleted: false },
      { status },
      { new: true }
    );

    if (!row) {
      return res.status(404).json({ success: false, message: "Cleaning entry not found." });
    }

    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error("Update Cleaning Status Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update status." });
  }
};

// @desc    Soft delete a row
// @route   DELETE /api/v1/cleaning-schedule/:id
export const deleteCleaningSchedule = async (req, res) => {
  try {
    const row = await CleaningSchedule.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!row) {
      return res.status(404).json({ success: false, message: "Cleaning entry not found." });
    }

    row.isDeleted = true;
    row.deletedAt = new Date();
    await row.save();

    return res.status(200).json({ success: true, message: "Cleaning entry deleted." });
  } catch (error) {
    console.error("Delete Cleaning Entry Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete cleaning entry." });
  }
};
