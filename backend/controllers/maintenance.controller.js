// controllers/maintenance.controller.js
import Maintenance, { MAINTENANCE_STATUSES } from "../models/Maintenance.js";

/**
 * Whitelist of fields a client may set on create/update.
 */
const EDITABLE_KEYS = [
  "title",
  "description",
  "category",
  "propertyId",
  "property",
  "roomId",
  "room",
  "reportedBy",
  "supplierId",
  "supplier",
  "priority",
  "status",
  "cost",
  "date",
  "image",
];

const pickPayload = (body) => {
  const payload = {};
  for (const key of EDITABLE_KEYS) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  return payload;
};

// Generate the next "MR-####" reference for an org. Scans existing numeric
// suffixes (including soft-deleted rows) so references are never reused.
const nextRef = async (organizationId) => {
  const docs = await Maintenance.find({ organizationId, ref: /^MR-\d+$/ })
    .select("ref")
    .lean();

  let max = 1000;
  for (const d of docs) {
    const n = Number(String(d.ref).replace("MR-", ""));
    if (Number.isFinite(n) && n > max) max = n;
  }

  return `MR-${max + 1}`;
};

// @desc    List maintenance requests (with optional filters)
// @route   GET /api/v1/maintenance
export const getMaintenance = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const { status, priority, property } = req.query;

    const filter = { organizationId, isDeleted: false };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (property) filter.property = property;

    const requests = await Maintenance.find(filter).sort({ date: -1, createdAt: -1 });

    return res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error("Get Maintenance Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch maintenance requests." });
  }
};

// @desc    Maintenance summary stats (cards)
// @route   GET /api/v1/maintenance/stats
export const getMaintenanceStats = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const match = { organizationId, isDeleted: false };
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [open, urgent, suppliers, spendAgg] = await Promise.all([
      Maintenance.countDocuments({ ...match, status: { $ne: "closed" } }),
      Maintenance.countDocuments({ ...match, priority: "urgent", status: { $ne: "closed" } }),
      Maintenance.distinct("supplier", { ...match, supplier: { $nin: [null, ""] } }),
      Maintenance.aggregate([
        { $match: { ...match, date: { $gte: thirtyDaysAgo }, cost: { $ne: null } } },
        { $group: { _id: null, total: { $sum: "$cost" } } },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        open,
        urgent,
        suppliersEngaged: suppliers.length,
        spend: spendAgg[0]?.total || 0,
      },
    });
  } catch (error) {
    console.error("Maintenance Stats Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load maintenance stats." });
  }
};

// @desc    Create a maintenance request
// @route   POST /api/v1/maintenance
export const createMaintenance = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const createdBy = req.user._id;

    const payload = pickPayload(req.body);

    if (!payload.title || !String(payload.title).trim()) {
      return res.status(400).json({ success: false, message: "Title is required." });
    }

    const ref = await nextRef(organizationId);

    const request = await Maintenance.create({ ...payload, ref, organizationId, createdBy });

    return res.status(201).json({
      success: true,
      message: "Maintenance request created.",
      data: request,
    });
  } catch (error) {
    console.error("Create Maintenance Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to create maintenance request." });
  }
};

// @desc    Update a maintenance request
// @route   PUT /api/v1/maintenance/:id
export const updateMaintenance = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const request = await Maintenance.findOne({
      _id: req.params.id,
      organizationId,
      isDeleted: false,
    });

    if (!request) {
      return res.status(404).json({ success: false, message: "Maintenance request not found." });
    }

    Object.assign(request, pickPayload(req.body));
    const updated = await request.save();

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Update Maintenance Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to update maintenance request." });
  }
};

// @desc    Update just the status of a request
// @route   PATCH /api/v1/maintenance/:id/status
export const updateMaintenanceStatus = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { status } = req.body;

    if (!MAINTENANCE_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status." });
    }

    const request = await Maintenance.findOneAndUpdate(
      { _id: req.params.id, organizationId, isDeleted: false },
      { status },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({ success: false, message: "Maintenance request not found." });
    }

    return res.status(200).json({ success: true, data: request });
  } catch (error) {
    console.error("Update Maintenance Status Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update status." });
  }
};

// @desc    Soft delete a maintenance request
// @route   DELETE /api/v1/maintenance/:id
export const deleteMaintenance = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const request = await Maintenance.findOne({ _id: req.params.id, organizationId });
    if (!request) {
      return res.status(404).json({ success: false, message: "Maintenance request not found." });
    }

    request.isDeleted = true;
    request.deletedAt = new Date();
    await request.save();

    return res.status(200).json({ success: true, message: "Maintenance request deleted." });
  } catch (error) {
    console.error("Delete Maintenance Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete maintenance request." });
  }
};
