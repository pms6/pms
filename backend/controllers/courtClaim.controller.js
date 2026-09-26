// controllers/courtClaim.controller.js
import CourtClaim from "../models/CourtClaim.js";
import { cleanAttachments } from "../utils/attachments.js";

const text = (v) => String(v ?? "").trim();

// A money figure from the form: blank or nonsense reads as zero rather than
// failing the whole save.
const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const pickPayload = (body) => {
  const payload = {};

  if (body.propertyId !== undefined) payload.propertyId = body.propertyId || null;
  if (body.property !== undefined) payload.property = text(body.property);
  if (body.claimDate !== undefined) payload.claimDate = body.claimDate;
  if (body.claimBy !== undefined) payload.claimBy = text(body.claimBy);
  if (body.claimTo !== undefined) payload.claimTo = text(body.claimTo);
  if (body.amount !== undefined) payload.amount = money(body.amount);
  if (body.rent !== undefined) payload.rent = money(body.rent);
  if (body.deposit !== undefined) payload.deposit = money(body.deposit);
  // Blank means "not settled yet", so it stays null rather than becoming £0.
  if (body.settlementAmount !== undefined) {
    const n = Number(body.settlementAmount);
    payload.settlementAmount =
      body.settlementAmount === "" || body.settlementAmount === null || !Number.isFinite(n) || n < 0
        ? null
        : n;
  }
  if (body.status !== undefined) payload.status = text(body.status);
  if (body.paidAt !== undefined) payload.paidAt = body.paidAt || null;
  // An emptied date picker sends "" — that means "no deadline", not an invalid date.
  if (body.deadlineToRespond !== undefined) {
    payload.deadlineToRespond = body.deadlineToRespond || null;
  }
  if (body.claimReason !== undefined) payload.claimReason = text(body.claimReason);
  if (body.details !== undefined) payload.details = text(body.details);
  if (body.files !== undefined) payload.files = cleanAttachments(body.files);

  return payload;
};

const validationMessage = (error) =>
  Object.values(error.errors).map((e) => e.message).join(", ");

// @desc    List court claims, newest claim first
// @route   GET /api/v1/court-claims
export const getCourtClaims = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const filter = { organizationId, isDeleted: false };
    if (req.query.propertyId) filter.propertyId = req.query.propertyId;

    const rows = await CourtClaim.find(filter).sort({ claimDate: -1, property: 1 });

    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error("Get Court Claims Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch court claims." });
  }
};

// @desc    Add a court claim
// @route   POST /api/v1/court-claims
export const createCourtClaim = async (req, res) => {
  try {
    const payload = pickPayload(req.body);

    if (!payload.property) {
      return res.status(400).json({ success: false, message: "Property is required." });
    }
    if (!payload.claimDate) {
      return res.status(400).json({ success: false, message: "Claim date is required." });
    }

    const row = await CourtClaim.create({
      ...payload,
      organizationId: req.user.organizationId,
      createdBy: req.user._id,
    });

    return res.status(201).json({ success: true, message: "Court claim added.", data: row });
  } catch (error) {
    console.error("Create Court Claim Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: validationMessage(error) });
    }
    return res.status(500).json({ success: false, message: "Failed to add court claim." });
  }
};

// @desc    Edit a court claim
// @route   PUT /api/v1/court-claims/:id
export const updateCourtClaim = async (req, res) => {
  try {
    const row = await CourtClaim.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: false,
    });

    if (!row) {
      return res.status(404).json({ success: false, message: "Court claim not found." });
    }

    const payload = pickPayload(req.body);
    if (payload.property !== undefined && !payload.property) {
      return res.status(400).json({ success: false, message: "Property is required." });
    }
    if (payload.claimDate !== undefined && !payload.claimDate) {
      return res.status(400).json({ success: false, message: "Claim date is required." });
    }

    Object.assign(row, payload);
    const updated = await row.save();

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Update Court Claim Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: validationMessage(error) });
    }
    return res.status(500).json({ success: false, message: "Failed to update court claim." });
  }
};

// @desc    Soft delete a court claim
// @route   DELETE /api/v1/court-claims/:id
export const deleteCourtClaim = async (req, res) => {
  try {
    const row = await CourtClaim.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: false,
    });

    if (!row) {
      return res.status(404).json({ success: false, message: "Court claim not found." });
    }

    row.isDeleted = true;
    row.deletedAt = new Date();
    await row.save();

    return res.status(200).json({ success: true, message: "Court claim deleted." });
  } catch (error) {
    console.error("Delete Court Claim Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete court claim." });
  }
};
