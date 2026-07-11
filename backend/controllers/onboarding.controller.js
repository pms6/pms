// controllers/onboarding.controller.js
import Onboarding, { ONBOARDING_STAGES } from "../models/Onboarding.js";

/**
 * Whitelist of fields a client may set on create/update. Nested objects are
 * merged field-by-field so a partial patch (e.g. just guarantor.status) does
 * not wipe the rest of the sub-document.
 */
const NESTED_KEYS = [
  "employment",
  "rightToRent",
  "references",
  "guarantor",
  "tenancy",
  "depositScheme",
];
const SCALAR_KEYS = [
  "name",
  "email",
  "phone",
  "dob",
  "nationality",
  "currentAddress",
  "holdingDeposit",
];

/**
 * Create Onboarding applicant
 */
export const createOnboarding = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const createdBy = req.user._id;

    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Applicant name is required.",
      });
    }

    const payload = { organizationId, createdBy };

    for (const key of SCALAR_KEYS) {
      if (req.body[key] !== undefined) payload[key] = req.body[key];
    }
    for (const key of NESTED_KEYS) {
      if (req.body[key] !== undefined) payload[key] = req.body[key];
    }
    if (req.body.leadId) payload.leadId = req.body.leadId;
    if (req.body.stageIndex !== undefined) {
      payload.stageIndex = clampStage(req.body.stageIndex);
    }
    if (Array.isArray(req.body.documents)) {
      payload.documents = req.body.documents;
    }

    const applicant = await Onboarding.create(payload);

    return res.status(201).json({
      success: true,
      message: "Applicant added to onboarding.",
      data: applicant,
    });
  } catch (error) {
    console.error(error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to add applicant.",
    });
  }
};

/**
 * Get Onboarding applicants for the org (optional search).
 */
export const getOnboardings = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { search = "" } = req.query;

    const filter = { organizationId, isDeleted: false };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const applicants = await Onboarding.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      total: applicants.length,
      data: applicants,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch applicants.",
    });
  }
};

/**
 * Get Single Onboarding applicant
 */
export const getOnboardingById = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const applicant = await Onboarding.findOne({
      _id: id,
      organizationId,
      isDeleted: false,
    }).lean();

    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: "Applicant not found.",
      });
    }

    return res.status(200).json({ success: true, data: applicant });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch applicant.",
    });
  }
};

/**
 * Update Onboarding applicant (scalars + nested merge).
 */
export const updateOnboarding = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const applicant = await Onboarding.findOne({
      _id: id,
      organizationId,
      isDeleted: false,
    });

    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: "Applicant not found.",
      });
    }

    for (const key of SCALAR_KEYS) {
      if (req.body[key] !== undefined) applicant[key] = req.body[key];
    }

    // Merge nested sub-documents field-by-field.
    for (const key of NESTED_KEYS) {
      if (req.body[key] && typeof req.body[key] === "object") {
        applicant[key] = { ...applicant[key]?.toObject?.() ?? applicant[key], ...req.body[key] };
      }
    }

    if (req.body.stageIndex !== undefined) {
      applicant.stageIndex = clampStage(req.body.stageIndex);
    }
    if (Array.isArray(req.body.documents)) {
      applicant.documents = req.body.documents;
    }

    await applicant.save();

    return res.status(200).json({
      success: true,
      message: "Applicant updated successfully.",
      data: applicant,
    });
  } catch (error) {
    console.error(error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update applicant.",
    });
  }
};

/**
 * Advance / set the onboarding stage (stepper).
 */
export const updateOnboardingStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { stageIndex } = req.body;
    const organizationId = req.user.organizationId;

    if (
      stageIndex === undefined ||
      Number.isNaN(Number(stageIndex)) ||
      Number(stageIndex) < 0 ||
      Number(stageIndex) > ONBOARDING_STAGES.length - 1
    ) {
      return res.status(400).json({
        success: false,
        message: `Invalid stageIndex. Must be between 0 and ${ONBOARDING_STAGES.length - 1}.`,
      });
    }

    const applicant = await Onboarding.findOneAndUpdate(
      { _id: id, organizationId, isDeleted: false },
      { stageIndex: Number(stageIndex) },
      { new: true }
    );

    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: "Applicant not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Onboarding stage updated.",
      data: applicant,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to update onboarding stage.",
    });
  }
};

/**
 * Delete (soft) an Onboarding applicant.
 */
export const deleteOnboarding = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const applicant = await Onboarding.findOne({
      _id: id,
      organizationId,
      isDeleted: false,
    });

    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: "Applicant not found.",
      });
    }

    applicant.isDeleted = true;
    applicant.deletedAt = new Date();
    await applicant.save();

    return res.status(200).json({
      success: true,
      message: "Applicant removed from onboarding.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove applicant.",
    });
  }
};

/**
 * Add a document to an applicant. Expects the file to already be uploaded to
 * storage (Cloudinary) client-side; we persist the resulting url/publicId.
 */
export const addOnboardingDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    const { name, type, url, publicId } = req.body;

    if (!name || !url) {
      return res.status(400).json({
        success: false,
        message: "Document name and url are required.",
      });
    }

    const applicant = await Onboarding.findOne({
      _id: id,
      organizationId,
      isDeleted: false,
    });

    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: "Applicant not found.",
      });
    }

    applicant.documents.push({
      name,
      type: type || "",
      url,
      publicId: publicId || "",
      status: "pending",
      uploadedAt: new Date(),
    });

    await applicant.save();

    return res.status(201).json({
      success: true,
      message: "Document uploaded.",
      data: applicant,
    });
  } catch (error) {
    console.error(error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to upload document.",
    });
  }
};

/**
 * Verify / reject a document (the verification workflow).
 * Body: { status: "verified" | "failed" | "pending" }
 */
export const verifyOnboardingDocument = async (req, res) => {
  try {
    const { id, docId } = req.params;
    const { status } = req.body;
    const organizationId = req.user.organizationId;

    const VALID = ["pending", "verified", "failed"];
    if (!status || !VALID.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID.join(", ")}.`,
      });
    }

    const applicant = await Onboarding.findOne({
      _id: id,
      organizationId,
      isDeleted: false,
    });

    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: "Applicant not found.",
      });
    }

    const doc = applicant.documents.id(docId);
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    doc.status = status;
    if (status === "pending") {
      doc.verifiedBy = null;
      doc.verifiedAt = null;
    } else {
      doc.verifiedBy = req.user._id;
      doc.verifiedAt = new Date();
    }

    await applicant.save();

    return res.status(200).json({
      success: true,
      message: `Document marked ${status}.`,
      data: applicant,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to update document.",
    });
  }
};

/**
 * Remove a document from an applicant.
 */
export const deleteOnboardingDocument = async (req, res) => {
  try {
    const { id, docId } = req.params;
    const organizationId = req.user.organizationId;

    const applicant = await Onboarding.findOne({
      _id: id,
      organizationId,
      isDeleted: false,
    });

    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: "Applicant not found.",
      });
    }

    const doc = applicant.documents.id(docId);
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    doc.deleteOne();
    await applicant.save();

    return res.status(200).json({
      success: true,
      message: "Document removed.",
      data: applicant,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove document.",
    });
  }
};

/**
 * Onboarding pipeline statistics (counts used by the summary cards).
 */
export const getOnboardingStats = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const base = { organizationId, isDeleted: false };

    const [total, referencing, readyToMoveIn] = await Promise.all([
      Onboarding.countDocuments(base),
      Onboarding.countDocuments({ ...base, stageIndex: 1 }),
      Onboarding.countDocuments({ ...base, stageIndex: { $gte: 5 } }),
    ]);

    const inProgress = await Onboarding.countDocuments({
      ...base,
      stageIndex: { $lt: ONBOARDING_STAGES.length - 1 },
    });

    return res.status(200).json({
      success: true,
      data: { total, inProgress, referencing, readyToMoveIn, stages: ONBOARDING_STAGES },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch onboarding statistics.",
    });
  }
};

function clampStage(value) {
  const n = Number(value) || 0;
  if (n < 0) return 0;
  if (n > ONBOARDING_STAGES.length - 1) return ONBOARDING_STAGES.length - 1;
  return n;
}
