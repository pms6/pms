// controllers/emptyRoomStatus.controller.js
import EmptyRoomStatus, {
  EMPTY_ROOM_STATUSES,
  TURNAROUND_STATUSES,
} from "../models/EmptyRoomStatus.js";

const EDITABLE_KEYS = [
  "propertyId",
  "property",
  "exTenant",
  "paint",
  "bedsheet",
  "keys",
  "issues",
  "emptyRoomDate",
  "roomReadyDate",
  "withinSevenDays",
  "status",
  "notes",
];

const TEXT_KEYS = ["property", "exTenant", "issues", "notes"];
const CHECKLIST_KEYS = ["paint", "bedsheet", "keys"];

const pickPayload = (body) => {
  const payload = {};
  for (const key of EDITABLE_KEYS) {
    if (body[key] !== undefined) payload[key] = body[key];
  }

  for (const key of TEXT_KEYS) {
    if (payload[key] !== undefined) payload[key] = String(payload[key] ?? "").trim();
  }

  for (const key of CHECKLIST_KEYS) {
    if (payload[key] !== undefined && !TURNAROUND_STATUSES.includes(payload[key])) {
      delete payload[key];
    }
  }

  if (payload.withinSevenDays !== undefined) {
    payload.withinSevenDays = Boolean(payload.withinSevenDays);
  }

  if (payload.status !== undefined && !EMPTY_ROOM_STATUSES.includes(payload.status)) {
    delete payload.status;
  }

  // A blank date clears the field rather than failing to cast.
  if (payload.roomReadyDate === "") payload.roomReadyDate = null;
  if (payload.propertyId === "") payload.propertyId = null;

  return payload;
};

// @desc    List empty-room rows
// @route   GET /api/v1/empty-rooms
export const getEmptyRooms = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const { status, propertyId } = req.query;

    const filter = { organizationId, isDeleted: false };
    if (status && EMPTY_ROOM_STATUSES.includes(status)) filter.status = status;
    if (propertyId) filter.propertyId = propertyId;

    // Newest empties first — the office works the top of the list.
    const rows = await EmptyRoomStatus.find(filter).sort({ emptyRoomDate: -1, property: 1 });

    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error("Get Empty Rooms Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch empty rooms." });
  }
};

// @desc    Read one row
// @route   GET /api/v1/empty-rooms/:id
export const getEmptyRoomById = async (req, res) => {
  try {
    const row = await EmptyRoomStatus.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: false,
    });

    if (!row) {
      return res.status(404).json({ success: false, message: "Empty-room entry not found." });
    }

    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error("Get Empty Room Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch empty-room entry." });
  }
};

// @desc    Add a row
// @route   POST /api/v1/empty-rooms
export const createEmptyRoom = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const payload = pickPayload(req.body);

    if (!payload.property) {
      return res.status(400).json({ success: false, message: "Property is required." });
    }
    if (!payload.emptyRoomDate) {
      return res.status(400).json({ success: false, message: "Empty room date is required." });
    }

    const row = await EmptyRoomStatus.create({
      ...payload,
      organizationId,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Empty-room entry added.",
      data: row,
    });
  } catch (error) {
    console.error("Create Empty Room Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to add empty-room entry." });
  }
};

// @desc    Edit a row
// @route   PUT /api/v1/empty-rooms/:id
export const updateEmptyRoom = async (req, res) => {
  try {
    const row = await EmptyRoomStatus.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: false,
    });

    if (!row) {
      return res.status(404).json({ success: false, message: "Empty-room entry not found." });
    }

    const payload = pickPayload(req.body);
    if (payload.property !== undefined && !payload.property) {
      return res.status(400).json({ success: false, message: "Property is required." });
    }

    Object.assign(row, payload);
    const updated = await row.save();

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Update Empty Room Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to update empty-room entry." });
  }
};

// @desc    Flip one checklist tick or the status in place — the columns the
//          office ticks all day
// @route   PATCH /api/v1/empty-rooms/:id
export const patchEmptyRoom = async (req, res) => {
  try {
    const payload = pickPayload(req.body);
    if (!Object.keys(payload).length) {
      return res.status(400).json({ success: false, message: "Nothing to update." });
    }

    const row = await EmptyRoomStatus.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId, isDeleted: false },
      payload,
      { new: true, runValidators: true }
    );

    if (!row) {
      return res.status(404).json({ success: false, message: "Empty-room entry not found." });
    }

    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error("Patch Empty Room Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update empty-room entry." });
  }
};

// @desc    Soft delete a row
// @route   DELETE /api/v1/empty-rooms/:id
export const deleteEmptyRoom = async (req, res) => {
  try {
    const row = await EmptyRoomStatus.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!row) {
      return res.status(404).json({ success: false, message: "Empty-room entry not found." });
    }

    row.isDeleted = true;
    row.deletedAt = new Date();
    await row.save();

    return res.status(200).json({ success: true, message: "Empty-room entry deleted." });
  } catch (error) {
    console.error("Delete Empty Room Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete empty-room entry." });
  }
};
