// controllers/cleaningSchedule.controller.js
import CleaningSchedule, {
  CLEANING_STATUSES,
  CLEANING_CATEGORIES,
  COMMUNICATION_CHANNELS,
} from "../models/CleaningSchedule.js";
import Property from "../models/Property.js";
import { sendEmail } from "../utils/sendEmail.js";
import {
  generateSchedule,
  computeNextDue,
  cycleWorkingDays,
} from "../utils/cleaningPlan.js";

const EDITABLE_KEYS = [
  "propertyId",
  "property",
  "roomId",
  "room",
  "category",
  "date",
  "status",
  "messageSent",
  "callMade",
  "emailSent",
  "picturesTaken",
  "cleaner",
  "inspectorName",
  "message",
  "notes",
  "files",
];

// Cloudinary's classification of an upload, narrowed to what the viewer knows
// how to render. Anything else is a file you download rather than preview.
const FILE_TYPES = ["image", "video", "pdf", "file"];

// The evidence attached to a visit, straight from the board's uploader. A URL
// is the only thing that makes an attachment worth keeping, so entries without
// one are dropped rather than stored as empty rows.
const cleanFiles = (files) => {
  if (!Array.isArray(files)) return [];
  return files
    .filter((f) => f?.url)
    .map((f) => ({
      name: String(f.name ?? "").trim(),
      url: String(f.url).trim(),
      publicId: String(f.publicId ?? "").trim(),
      type: FILE_TYPES.includes(f.type) ? f.type : "file",
      format: String(f.format ?? "").trim(),
      bytes: Number(f.bytes) > 0 ? Number(f.bytes) : 0,
      uploadedAt: f.uploadedAt ? new Date(f.uploadedAt) : new Date(),
    }));
};

const pickPayload = (body) => {
  const payload = {};
  for (const key of EDITABLE_KEYS) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  if (payload.property !== undefined) payload.property = String(payload.property).trim();
  if (payload.cleaner !== undefined) payload.cleaner = String(payload.cleaner).trim();
  if (payload.inspectorName !== undefined) {
    payload.inspectorName = String(payload.inspectorName ?? "").trim();
  }
  if (payload.message !== undefined) payload.message = String(payload.message).trim();
  if (payload.notes !== undefined) payload.notes = String(payload.notes).trim();
  if (payload.messageSent !== undefined) payload.messageSent = Boolean(payload.messageSent);
  if (payload.callMade !== undefined) payload.callMade = Boolean(payload.callMade);
  if (payload.emailSent !== undefined) payload.emailSent = Boolean(payload.emailSent);
  if (payload.picturesTaken !== undefined) payload.picturesTaken = Boolean(payload.picturesTaken);
  if (payload.room !== undefined) payload.room = String(payload.room ?? "").trim();
  if (payload.roomId === "") payload.roomId = null;
  if (payload.files !== undefined) payload.files = cleanFiles(payload.files);
  if (payload.propertyId === "") payload.propertyId = null;
  if (payload.status !== undefined && !CLEANING_STATUSES.includes(payload.status)) {
    delete payload.status;
  }
  // An unrecognised category is dropped rather than rejected, so the schema
  // default decides — the same way an unrecognised status is handled above.
  if (payload.category !== undefined && !CLEANING_CATEGORIES.includes(payload.category)) {
    delete payload.category;
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

// How many working days one turn of the rotation takes — needed to work out when
// a rotation clean is next due.
const rotationCycle = async (organizationId) =>
  cycleWorkingDays(
    await Property.countDocuments({ organizationId, isDeleted: false, status: "ACTIVE" })
  );

// Keeps the derived fields honest whenever a row is written by hand: when it is
// next due, and when it was finished.
const stampDerived = (row, cycle) => {
  row.nextDueDate = computeNextDue(row.category || "Cleaning Schedule", row.date, cycle);
};

const stampCompletion = (row) => {
  row.completedAt = row.status === "DONE" ? row.completedAt || new Date() : null;
};

// Finishing a repeat task is what puts the next one on the board, so a
// completion runs the schedule straight away rather than waiting for the
// nightly sweep. Best effort — the row is already saved.
const topUpSchedule = async (req) => {
  try {
    const { created } = await generateSchedule({
      organizationId: req.user.organizationId,
      createdBy: req.user._id,
    });
    return created;
  } catch (error) {
    console.error("Cleaning schedule top-up failed:", error);
    return 0;
  }
};

// @desc    List cleaning schedule rows
// @route   GET /api/v1/cleaning-schedule
export const getCleaningSchedule = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const { status, category, month, propertyId, from, to } = req.query;

    const filter = { organizationId, isDeleted: false };
    if (status && CLEANING_STATUSES.includes(status)) filter.status = status;
    if (category && CLEANING_CATEGORIES.includes(category)) filter.category = category;
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

    const row = new CleaningSchedule({
      ...payload,
      organizationId,
      createdBy: req.user._id,
    });
    stampDerived(row, await rotationCycle(organizationId));
    stampCompletion(row);
    await row.save();
    const generated = row.status === "DONE" ? await topUpSchedule(req) : 0;

    return res.status(201).json({
      success: true,
      message: "Cleaning entry added.",
      data: row,
      generated,
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

    const cycle = await rotationCycle(organizationId);
    const docs = rows
      .map(pickPayload)
      .filter((r) => r.property && r.date)
      .map((r) => ({
        ...r,
        organizationId,
        createdBy: req.user._id,
        nextDueDate: computeNextDue(r.category || "Cleaning Schedule", r.date, cycle),
        completedAt: r.status === "DONE" ? new Date() : null,
      }));

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
    if (row.isModified("date") || row.isModified("category")) {
      stampDerived(row, await rotationCycle(req.user.organizationId));
    }
    const finishing = row.isModified("status") && row.status === "DONE";
    if (row.isModified("status")) stampCompletion(row);
    const updated = await row.save();
    const generated = finishing ? await topUpSchedule(req) : 0;

    return res.status(200).json({ success: true, data: updated, generated });
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
      { status, completedAt: status === "DONE" ? new Date() : null },
      { new: true }
    );

    if (!row) {
      return res.status(404).json({ success: false, message: "Cleaning entry not found." });
    }

    const generated = status === "DONE" ? await topUpSchedule(req) : 0;

    return res.status(200).json({ success: true, data: row, generated });
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

// @desc    Bring the automatic schedule up to date for this organization
// @route   POST /api/v1/cleaning-schedule/generate
export const generateCleaningSchedule = async (req, res) => {
  try {
    const { created } = await generateSchedule({
      organizationId: req.user.organizationId,
      createdBy: req.user._id,
    });
    return res.status(200).json({ success: true, created });
  } catch (error) {
    console.error("Generate Cleaning Schedule Error:", error);
    return res.status(500).json({ success: false, message: "Failed to generate the schedule." });
  }
};

const escapeHtml = (v) =>
  String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// @desc    Record a message, email or call against a visit. An email is also
//          actually sent (unless send is false); messages and calls happen on
//          the person's own device, so those are only recorded.
// @route   POST /api/v1/cleaning-schedule/:id/communications
export const addCleaningCommunication = async (req, res) => {
  try {
    const { channel, to = "", subject = "", message = "", note = "", send = true } = req.body;

    if (!COMMUNICATION_CHANNELS.includes(channel)) {
      return res.status(400).json({ success: false, message: "Invalid channel." });
    }

    const row = await CleaningSchedule.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: false,
    });
    if (!row) {
      return res.status(404).json({ success: false, message: "Cleaning entry not found." });
    }

    const recipient = String(to).trim();
    const body = String(message).trim();
    const heading = String(subject).trim() || `${row.category || "Cleaning"} — ${row.property}`;

    if (channel === "email" && send !== false) {
      if (!EMAIL_RE.test(recipient)) {
        return res.status(400).json({ success: false, message: "Enter a valid email address." });
      }
      if (!body) {
        return res.status(400).json({ success: false, message: "Write the email first." });
      }
      try {
        await sendEmail({
          email: recipient,
          subject: heading,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px;">${escapeHtml(body).replace(/\n/g, "<br>")}</div>`,
        });
      } catch {
        // Not recorded — nothing was sent.
        return res.status(502).json({
          success: false,
          message: "The email could not be sent. Check the address and try again.",
        });
      }
    }

    row.communications.push({
      channel,
      to: recipient,
      subject: channel === "email" ? heading : "",
      message: body,
      note: String(note).trim(),
      by: req.user._id,
      byName: req.user.name || "",
    });
    if (channel === "message") row.messageSent = true;
    if (channel === "email") row.emailSent = true;
    if (channel === "call") row.callMade = true;

    await row.save();
    return res.status(201).json({ success: true, data: row });
  } catch (error) {
    console.error("Add Cleaning Communication Error:", error);
    return res.status(500).json({ success: false, message: "Failed to record the communication." });
  }
};
