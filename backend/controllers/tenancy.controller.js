// controllers/tenancy.controller.js
import Tenancy, { TENANCY_STATUS } from "../models/Tenancy.js";

/**
 * Whitelist of fields a client may set on create/update.
 */
const EDITABLE_KEYS = [
  "propertyId",
  "roomId",
  "tenantId",
  "property",
  "unit",
  "tenant",
  "tenantEmail",
  "rent",
  "startDate",
  "fixedTermEnd",
  "periodicStart",
  "availability",
  "status",
  "onboarded",
];

const pickPayload = (body) => {
  const payload = {};
  for (const key of EDITABLE_KEYS) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  return payload;
};

// @desc    List tenancies (with optional property/status filters)
// @route   GET /api/v1/tenancies
export const getTenancies = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization ID required",
      });
    }

    const { property, status } = req.query;

    const filter = { organizationId, isDeleted: false };
    if (property) filter.property = property;
    if (status) filter.status = status;

    const tenancies = await Tenancy.find(filter).sort({ startDate: -1, createdAt: -1 });

    return res.status(200).json({ success: true, data: tenancies });
  } catch (error) {
    console.error("Get Tenancies Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch tenancies." });
  }
};

// @desc    Occupancy overview stats (summary cards)
// @route   GET /api/v1/tenancies/stats
export const getTenancyStats = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({
        success: false,
        message: "Organization ID required",
      });
    }

    const match = { organizationId, isDeleted: false };

    const [units, occupants, onboardings, tenancyChanges, renewals] = await Promise.all([
      Tenancy.countDocuments(match),
      Tenancy.countDocuments({ ...match, availability: "Occupied" }),
      Tenancy.countDocuments({ ...match, onboarded: false }),
      // A tenancy is "changing" when it is going periodic or ending.
      Tenancy.countDocuments({ ...match, status: { $in: ["Becoming Periodic", "Ending"] } }),
      // Fixed-term tenancies are candidates for renewal.
      Tenancy.countDocuments({ ...match, status: "Fixed Term" }),
    ]);

    return res.status(200).json({
      success: true,
      data: { units, occupants, onboardings, tenancyChanges, renewals },
    });
  } catch (error) {
    console.error("Tenancy Stats Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load occupancy stats." });
  }
};

// @desc    Create a tenancy
// @route   POST /api/v1/tenancies
export const createTenancy = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const createdBy = req.user._id;

    const payload = pickPayload(req.body);

    if (!payload.property || !String(payload.property).trim()) {
      return res.status(400).json({ success: false, message: "Property is required." });
    }
    if (!payload.tenant || !String(payload.tenant).trim()) {
      return res.status(400).json({ success: false, message: "Tenant is required." });
    }

    const tenancy = await Tenancy.create({ ...payload, organizationId, createdBy });

    return res.status(201).json({
      success: true,
      message: "Tenancy created.",
      data: tenancy,
    });
  } catch (error) {
    console.error("Create Tenancy Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to create tenancy." });
  }
};

// @desc    Update a tenancy
// @route   PUT /api/v1/tenancies/:id
export const updateTenancy = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const tenancy = await Tenancy.findOne({
      _id: req.params.id,
      organizationId,
      isDeleted: false,
    });

    if (!tenancy) {
      return res.status(404).json({ success: false, message: "Tenancy not found." });
    }

    Object.assign(tenancy, pickPayload(req.body));
    const updated = await tenancy.save();

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Update Tenancy Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to update tenancy." });
  }
};

// @desc    Soft delete a tenancy
// @route   DELETE /api/v1/tenancies/:id
export const deleteTenancy = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const tenancy = await Tenancy.findOne({ _id: req.params.id, organizationId });
    if (!tenancy) {
      return res.status(404).json({ success: false, message: "Tenancy not found." });
    }

    tenancy.isDeleted = true;
    tenancy.deletedAt = new Date();
    await tenancy.save();

    return res.status(200).json({ success: true, message: "Tenancy deleted." });
  } catch (error) {
    console.error("Delete Tenancy Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete tenancy." });
  }
};

// @desc    Send an onboarding invite to a single tenancy's tenant
// @route   PATCH /api/v1/tenancies/:id/invite
export const inviteTenant = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const tenancy = await Tenancy.findOne({
      _id: req.params.id,
      organizationId,
      isDeleted: false,
    });

    if (!tenancy) {
      return res.status(404).json({ success: false, message: "Tenancy not found." });
    }

    // NOTE: email dispatch is handled by the mailer once configured; here we
    // just record that an invite was sent so the UI can reflect it.
    tenancy.invitedAt = new Date();
    await tenancy.save();

    return res.status(200).json({
      success: true,
      message: `Onboarding invite sent to ${tenancy.tenant}.`,
      data: tenancy,
    });
  } catch (error) {
    console.error("Invite Tenant Error:", error);
    return res.status(500).json({ success: false, message: "Failed to send invite." });
  }
};

// @desc    Send onboarding invites to every not-yet-onboarded tenant
// @route   POST /api/v1/tenancies/invite-all
export const inviteAllTenants = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const result = await Tenancy.updateMany(
      { organizationId, isDeleted: false, onboarded: false },
      { $set: { invitedAt: new Date() } }
    );

    const invited = result.modifiedCount ?? result.nModified ?? 0;

    return res.status(200).json({
      success: true,
      message: `Onboarding invite sent to ${invited} tenant(s).`,
      data: { invited },
    });
  } catch (error) {
    console.error("Invite All Tenants Error:", error);
    return res.status(500).json({ success: false, message: "Failed to send invites." });
  }
};

// Expose the allowed statuses (handy for the client / future validation).
export const tenancyStatuses = TENANCY_STATUS;
