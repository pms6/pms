// controllers/owner.controller.js
import mongoose from "mongoose";
import Owner from "../models/Owner.js";

// The caller's own organization (set by the `protect` middleware).
const callerOrgId = (req) =>
  req.user?.organizationId ? String(req.user.organizationId) : null;

// Whitelist of fields a client may set on create/update.
const pickOwnerFields = (body = {}) => {
  const out = {};
  const fields = [
    "name",
    "company",
    "email",
    "phone",
    "status",
    "payoutStatus",
    "properties",
    "maintenance",
    "monthlyIncome",
    "notes",
    "files",
  ];
  for (const f of fields) {
    if (body[f] !== undefined) out[f] = body[f];
  }
  // bank is nested { account }
  if (body.bank !== undefined || body.account !== undefined) {
    out.bank = { account: body.bank?.account ?? body.account ?? "" };
  }
  return out;
};

/**
 * Create owner
 */
export const createOwner = async (req, res) => {
  try {
    const organizationId = callerOrgId(req);
    if (!organizationId) {
      return res.status(403).json({ success: false, message: "You are not a member of any organization." });
    }

    const data = pickOwnerFields(req.body);
    if (!data.name || !String(data.name).trim()) {
      return res.status(400).json({ success: false, message: "Owner name is required." });
    }

    const owner = await Owner.create({
      ...data,
      organizationId,
      createdBy: req.user._id,
    });

    return res.status(201).json({ success: true, message: "Owner created successfully.", data: owner });
  } catch (error) {
    console.error("createOwner error:", error);
    return res.status(500).json({ success: false, message: "Failed to create owner." });
  }
};

/**
 * Get owners (org-scoped) with optional search + status filter
 */
export const getOwners = async (req, res) => {
  try {
    const organizationId = callerOrgId(req);
    if (!organizationId) {
      return res.status(403).json({ success: false, message: "You are not a member of any organization." });
    }

    const { search = "", status } = req.query;

    const filter = { organizationId, isDeleted: false };
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const owners = await Owner.find(filter).sort({ createdAt: -1 }).lean();

    return res.status(200).json({ success: true, total: owners.length, data: owners });
  } catch (error) {
    console.error("getOwners error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch owners." });
  }
};

/**
 * Get single owner by id (org-scoped)
 */
export const getOwnerById = async (req, res) => {
  try {
    const organizationId = callerOrgId(req);
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid owner id." });
    }

    const owner = await Owner.findOne({ _id: id, organizationId, isDeleted: false }).lean();
    if (!owner) {
      return res.status(404).json({ success: false, message: "Owner not found." });
    }

    return res.status(200).json({ success: true, data: owner });
  } catch (error) {
    console.error("getOwnerById error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch owner." });
  }
};

/**
 * Update owner (org-scoped)
 */
export const updateOwner = async (req, res) => {
  try {
    const organizationId = callerOrgId(req);
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid owner id." });
    }

    const owner = await Owner.findOne({ _id: id, organizationId, isDeleted: false });
    if (!owner) {
      return res.status(404).json({ success: false, message: "Owner not found." });
    }

    const data = pickOwnerFields(req.body);
    if (data.name !== undefined && !String(data.name).trim()) {
      return res.status(400).json({ success: false, message: "Owner name cannot be empty." });
    }

    Object.assign(owner, data);
    await owner.save();

    return res.status(200).json({ success: true, message: "Owner updated successfully.", data: owner });
  } catch (error) {
    console.error("updateOwner error:", error);
    return res.status(500).json({ success: false, message: "Failed to update owner." });
  }
};

/**
 * Soft-delete owner (org-scoped)
 */
export const deleteOwner = async (req, res) => {
  try {
    const organizationId = callerOrgId(req);
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid owner id." });
    }

    const owner = await Owner.findOne({ _id: id, organizationId, isDeleted: false });
    if (!owner) {
      return res.status(404).json({ success: false, message: "Owner not found." });
    }

    owner.isDeleted = true;
    owner.deletedAt = new Date();
    await owner.save();

    return res.status(200).json({ success: true, message: "Owner deleted successfully." });
  } catch (error) {
    console.error("deleteOwner error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete owner." });
  }
};
