// controllers/onboarding.controller.js
import Onboarding, { ONBOARDING_STAGES } from "../models/Onboarding.js";
import Lead from "../models/Lead.js";
import User from "../models/User.js";
import Tenant from "../models/Tenant.js";
import Tenancy from "../models/Tenancy.js";
import Room from "../models/Room.js";
import Organization from "../models/Organization.js";
import bcrypt from "bcrypt";
import env from "../config/env.js";
import { sendEmail } from "../utils/sendEmail.js";

// Generate a random temporary password for a newly-created applicant account.
const generatePassword = () => {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const loginUrl = () =>
  `${process.env.FRONTEND_URL || "http://localhost:3000"}/login`;

/**
 * Ensure the applicant has a login account, then email them their onboarding
 * welcome. If no User exists for the email, we create a verified Tenant account
 * (connected to this organization) with a temporary password and include those
 * credentials in the email. If the account already exists, we send the same
 * welcome but tell them to log in with their existing credentials.
 *
 * Best-effort: any failure is logged but never throws, so a mail/account glitch
 * cannot roll back the onboarding record that was already created.
 */
async function provisionApplicantAndNotify({ email, name, organizationId }) {
  const clean = (email || "").toLowerCase().trim();
  if (!clean) return;

  try {
    let user = await User.findOne({ email: clean });
    let tempPassword = null;

    if (!user) {
      tempPassword = generatePassword();
      const salt = await bcrypt.genSalt(env.bcryptSaltRounds);
      const hashedPassword = await bcrypt.hash(tempPassword, salt);

      user = await User.create({
        email: clean,
        password: hashedPassword,
        role: "Tenant",
        isVerified: true,
      });

      // Create the tenant profile connected to this organization.
      await Tenant.findOneAndUpdate(
        { userId: user._id },
        { $set: { organizationId } },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }

    const orgName = await orgDisplayName(organizationId);
    const url = loginUrl();
    const greeting = name ? `Hi ${name},` : "Hi,";

    const credentialsBlock = tempPassword
      ? `
          <div style="background:#f5f5f5; padding:15px; border-radius:6px; margin:20px 0;">
            <p style="margin:5px 0;"><strong>Email:</strong> ${clean}</p>
            <p style="margin:5px 0;"><strong>Temporary Password:</strong>
              <code style="background:#e0e0e0; padding:2px 8px; border-radius:3px;">${tempPassword}</code>
            </p>
          </div>
          <p style="font-size:14px; color:#666;">Please change your password after logging in for the first time.</p>`
      : `<p style="color:#666; margin:20px 0;">You already have an account with us — just log in with your existing credentials.</p>`;

    await sendEmail({
      email: clean,
      subject: `${orgName} has started your onboarding`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; max-width: 520px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #0F253B;">Welcome to ${orgName}</h2>
          <p>${greeting}</p>
          <p>${orgName} has added you to onboarding. Log in to your tenant portal to track your move-in progress and complete the next steps.</p>
          ${credentialsBlock}
          <p style="text-align:center; margin: 24px 0;">
            <a href="${url}" style="background:#F47C3C; color:#fff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:bold;">Log in to my portal</a>
          </p>
          <p style="font-size: 12px; color: #666;">If the button doesn't work, paste this link into your browser: ${url}</p>
        </div>
      `,
    });
  } catch (mailError) {
    console.error("Onboarding welcome/provision failed:", mailError.message);
  }
}

// stageIndex at which an applicant is "in review" — advanced past "Application".
// Reaching this commits the tenant to that organization.
const REVIEW_STAGE_INDEX = 1;

// Connect (or disconnect) a tenant's account to an organization by their email.
// Passing organizationId = null disconnects. No-op if no matching user/tenant.
async function setTenantOrganization(email, organizationId) {
  const clean = (email || "").toLowerCase();
  if (!clean) return false;
  const user = await User.findOne({ email: clean }).select("_id").lean();
  if (!user) return false;
  await Tenant.findOneAndUpdate(
    { userId: user._id },
    { $set: { organizationId } },
    { upsert: true, setDefaultsOnInsert: true }
  );
  return true;
}

const tenantPortalUrl = () =>
  `${process.env.FRONTEND_URL || "http://localhost:3000"}/tenant/onboarding`;

async function orgDisplayName(organizationId) {
  const org = await Organization.findById(organizationId).select("name").lean();
  return org?.name || "the property team";
}

// Best-effort onboarding notification email. Never throws — a mail failure must
// not roll back the onboarding action that triggered it.
async function notifyTenant({ email, subject, heading, message }) {
  if (!email) return;
  const url = tenantPortalUrl();
  try {
    await sendEmail({
      email,
      subject,
      html: `
        <div style="font-family: sans-serif; padding: 20px; max-width: 520px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #0F253B;">${heading}</h2>
          <p>${message}</p>
          <p style="text-align:center; margin: 24px 0;">
            <a href="${url}" style="background:#F47C3C; color:#fff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:bold;">View my onboarding</a>
          </p>
          <p style="font-size: 12px; color: #666;">If the button doesn't work, paste this link into your browser: ${url}</p>
        </div>
      `,
    });
  } catch (mailError) {
    console.error("Onboarding email failed:", mailError.message);
  }
}

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

    // If the applicant isn't in our system yet, create a login account and email
    // them their credentials; otherwise just send the onboarding welcome. This is
    // best-effort and won't roll back the applicant that was just created.
    if (applicant.email) {
      await provisionApplicantAndNotify({
        email: applicant.email,
        name: applicant.name,
        organizationId,
      });
    }

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

    const prevStageIndex = applicant.stageIndex;
    const nextStageIndex = Number(stageIndex);
    const movedForward = nextStageIndex > prevStageIndex;

    // Gate: an applicant at "Referencing" cannot be advanced until at least one
    // document (tenant- or admin-uploaded) is on file.
    const REFERENCING_STAGE = ONBOARDING_STAGES.indexOf("Referencing");
    if (
      movedForward &&
      prevStageIndex === REFERENCING_STAGE &&
      (applicant.documents?.length || 0) === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Upload at least one document before advancing past Referencing.",
      });
    }

    applicant.stageIndex = nextStageIndex;
    await applicant.save();

    // Reaching "review" (past Application) commits the tenant to THIS org — make
    // it their connected organization, even if another org accepted them too.
    if (nextStageIndex >= REVIEW_STAGE_INDEX && applicant.email) {
      await setTenantOrganization(applicant.email, organizationId);
    }

    // Notify the tenant — but only when the onboarding moves FORWARD (advancing
    // to a later stage), not when it's stepped back or set to the same stage.
    if (movedForward && applicant.email) {
      const stageName = ONBOARDING_STAGES[nextStageIndex] || "the next step";
      const property = applicant.tenancy?.property || "your property";
      const org = await orgDisplayName(organizationId);

      // At Referencing, the tenant needs to upload documents for verification.
      const message =
        stageName === "Referencing"
          ? `${org} has moved your onboarding for <strong>${property}</strong> into <strong>Referencing</strong>. Please log in and upload your documents (ID, proof of income, references) from the "My Documents" section so ${org} can verify them.`
          : `${org} has advanced your onboarding for <strong>${property}</strong> to the <strong>${stageName}</strong> stage. Log in to see what's next and complete any outstanding steps.`;

      await notifyTenant({
        email: applicant.email,
        subject: `Onboarding update: ${property} is now at "${stageName}"`,
        heading: `Your onboarding has moved to ${stageName}`,
        message,
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
 * Complete onboarding (Move-in).
 *
 * Finalises the applicant: advances them to the last stage (Move-in), creates a
 * Tenancy record from the agreed terms so the tenant appears in the tenancies
 * list and can access their room, links the Tenancy back to the onboarding, and
 * emails the tenant a welcome. Idempotent-guarded — an onboarding that already
 * has a tenancy cannot be completed twice.
 */
export const completeOnboarding = async (req, res) => {
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

    if (applicant.completedAt || applicant.tenancyId) {
      return res.status(409).json({
        success: false,
        message: "This onboarding has already been completed.",
      });
    }

    const t = applicant.tenancy || {};

    // Derive the fixed-term end from the start date + term (best-effort).
    const start = t.startDate ? new Date(t.startDate) : null;
    const validStart = start && !Number.isNaN(start.getTime()) ? start : null;
    let fixedTermEnd = null;
    if (validStart) {
      fixedTermEnd = new Date(validStart);
      fixedTermEnd.setMonth(fixedTermEnd.getMonth() + (Number(t.termMonths) || 12));
    }

    // Resolve the tenant profile so the tenancy links back to the account.
    let tenantId = null;
    if (applicant.email) {
      const user = await User.findOne({ email: applicant.email.toLowerCase() })
        .select("_id")
        .lean();
      if (user) {
        const tenant = await Tenant.findOne({ userId: user._id })
          .select("_id")
          .lean();
        if (tenant) tenantId = tenant._id;
      }
    }

    // Create the Tenancy (occupancy) record. Carry the structured property/room
    // references through so room-scoped features (e.g. room-specific welcome
    // packs) work for tenants who came through onboarding.
    const tenancy = await Tenancy.create({
      organizationId,
      createdBy: req.user._id,
      tenantId,
      propertyId: t.propertyId || null,
      roomId: t.roomId || null,
      property: t.property || "—",
      unit: t.room || "—",
      tenant: applicant.name,
      tenantEmail: applicant.email || "",
      rent: Number(t.rent) || 0,
      startDate: validStart,
      fixedTermEnd,
      status: "Fixed Term",
      onboarded: true,
    });

    // Finalise the onboarding: last stage + completion links.
    applicant.stageIndex = ONBOARDING_STAGES.length - 1;
    applicant.completedAt = new Date();
    applicant.tenancyId = tenancy._id;
    await applicant.save();

    // Mark the room occupied and attach the tenant (best-effort — a room glitch
    // must not roll back the completion that already succeeded). Scoped to the
    // org so we never touch another organisation's room.
    if (t.roomId) {
      try {
        await Room.updateOne(
          { _id: t.roomId, organizationId },
          { $set: { status: "OCCUPIED", currentTenant: tenantId } }
        );
      } catch (roomError) {
        console.error("Onboarding room occupancy update failed:", roomError.message);
      }
    }

    // Notify the tenant that they've moved in (best-effort).
    if (applicant.email) {
      const property = t.property || "your property";
      const org = await orgDisplayName(organizationId);
      await notifyTenant({
        email: applicant.email,
        subject: `Welcome to your new home at ${property}`,
        heading: "Your move-in is complete",
        message: `${org} has completed your onboarding for <strong>${property}</strong>. Your tenancy is now active — log in to view your tenancy details and manage your rental.`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Onboarding completed. Tenancy created.",
      data: { applicant, tenancy },
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
      message: "Failed to complete onboarding.",
    });
  }
};

/**
 * Cancel an onboarding.
 *
 * Soft-deletes the applicant, reverts the linked website request to "lost" (so
 * the tenant is free to enquire again), and — if this org was the tenant's
 * connected/committed organization — disconnects them. This frees a tenant who
 * was "in review" to request other properties again.
 */
export const cancelOnboarding = async (req, res) => {
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

    // Free up the original website request so it can be re-sent.
    if (applicant.leadId) {
      await Lead.updateOne(
        { _id: applicant.leadId, organizationId },
        { $set: { status: "lost" } }
      );
    }

    // If the tenant was connected to THIS org because of this onboarding, and
    // they have no other active onboarding here, disconnect them.
    if (applicant.email) {
      const user = await User.findOne({ email: applicant.email.toLowerCase() }).select("_id").lean();
      if (user) {
        const tenant = await Tenant.findOne({ userId: user._id }).select("organizationId").lean();
        const stillHere = await Onboarding.exists({
          _id: { $ne: applicant._id },
          organizationId,
          email: applicant.email.toLowerCase(),
          isDeleted: false,
        });
        if (tenant && String(tenant.organizationId) === String(organizationId) && !stillHere) {
          await Tenant.findOneAndUpdate({ userId: user._id }, { $set: { organizationId: null } });
        }
      }
    }

    // Notify the tenant that their onboarding was cancelled.
    if (applicant.email) {
      const property = applicant.tenancy?.property || "your property";
      const org = await orgDisplayName(organizationId);
      await notifyTenant({
        email: applicant.email,
        subject: `Your onboarding for ${property} was cancelled`,
        heading: "Your onboarding was cancelled",
        message: `${org} has cancelled your onboarding for <strong>${property}</strong>. You're welcome to browse other listings and send a new request whenever you're ready.`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Onboarding cancelled.",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel onboarding.",
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

/**
 * Get pending onboarding REQUESTS for the org.
 *
 * A "request" is a website enquiry (Lead, source "Website") that a tenant sent
 * from a listing but that the org hasn't accepted yet. Accepting one turns it
 * into a full Onboarding applicant (see acceptOnboardingRequest).
 */
export const getOnboardingRequests = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const requests = await Lead.find({
      organizationId,
      isDeleted: false,
      source: "Website",
      // Not yet accepted (converted) or dismissed (lost).
      status: { $in: ["new", "qualified", "viewing"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      total: requests.length,
      data: requests,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch onboarding requests.",
    });
  }
};

/**
 * Accept a website request → start onboarding.
 *
 * Steps:
 *  1. Create an Onboarding applicant from the lead (stage 0 / Application).
 *  2. Connect the tenant's account to THIS organization (Tenant.organizationId),
 *     which unlocks their full tenant portal + onboarding view.
 *  3. Email the tenant that their request was accepted.
 *  4. Mark the lead as "converted" so it drops out of the pending requests.
 */
export const acceptOnboardingRequest = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { leadId, rent, deposit, holdingDeposit, startDate, termMonths } = req.body;

    if (!leadId) {
      return res.status(400).json({
        success: false,
        message: "leadId is required.",
      });
    }

    const lead = await Lead.findOne({
      _id: leadId,
      organizationId,
      isDeleted: false,
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Request not found.",
      });
    }

    // Guard against accepting the same request twice.
    if (lead.status === "converted") {
      return res.status(409).json({
        success: false,
        message: "This request has already been accepted.",
      });
    }

    const num = (x) => Number(x) || 0;

    // 1. Create the onboarding applicant.
    const applicant = await Onboarding.create({
      organizationId,
      createdBy: req.user._id,
      leadId: lead._id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      stageIndex: 0,
      holdingDeposit: num(holdingDeposit),
      tenancy: {
        propertyId: lead.propertyId || null,
        roomId: lead.roomId || null,
        property: lead.interestedIn || "—",
        room: "—",
        rent: num(rent),
        frequency: "monthly",
        deposit: num(deposit),
        startDate: startDate || "",
        termMonths: num(termMonths) || 12,
      },
    });

    // 2. Connect the tenant's account to this organization.
    let tenantLinked = false;
    if (lead.email) {
      const user = await User.findOne({ email: lead.email });
      if (user) {
        await Tenant.findOneAndUpdate(
          { userId: user._id },
          { $set: { organizationId } },
          { upsert: true, setDefaultsOnInsert: true }
        );
        tenantLinked = true;
      }
    }

    // 3. Email the tenant (best-effort — a mail failure must not roll back the
    //    accept, which has already succeeded above).
    if (lead.email) {
      const org = await Organization.findById(organizationId).select("name").lean();
      const orgName = org?.name || "the property team";
      const portalUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/tenant/onboarding`;
      try {
        await sendEmail({
          email: lead.email,
          subject: `Your request for ${lead.interestedIn || "a property"} was accepted`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; max-width: 520px; border: 1px solid #e0e0e0; border-radius: 8px;">
              <h2 style="color: #0F253B;">Good news, ${lead.name}!</h2>
              <p>${orgName} has accepted your request for <strong>${lead.interestedIn || "a property"}</strong> and started your onboarding.</p>
              <p>Your account is now connected to ${orgName}. Log in to your tenant portal to track your move-in progress and complete the next steps.</p>
              <p style="text-align:center; margin: 24px 0;">
                <a href="${portalUrl}" style="background:#F47C3C; color:#fff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:bold;">View my onboarding</a>
              </p>
              <p style="font-size: 12px; color: #666;">If the button doesn't work, paste this link into your browser: ${portalUrl}</p>
            </div>
          `,
        });
      } catch (mailError) {
        console.error("Accept email failed:", mailError.message);
      }
    }

    // 4. Mark the lead converted so it leaves the pending requests list.
    lead.status = "converted";
    await lead.save();

    return res.status(201).json({
      success: true,
      message: tenantLinked
        ? "Request accepted. The tenant has been notified and connected to your organization."
        : "Request accepted. Onboarding started (no matching tenant account found to connect).",
      data: { applicant, tenantLinked },
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
      message: "Failed to accept request.",
    });
  }
};

/**
 * Get ALL of the signed-in TENANT's onboarding records (for the tenant portal).
 * A tenant who was accepted for several rooms sees each as an option to review
 * and select. Matched by the tenant's account email (what enquiries / accepted
 * requests are keyed on). Each item carries its operator organization.
 */
export const getMyOnboarding = async (req, res) => {
  try {
    const email = (req.user.email || "").toLowerCase();

    const list = email
      ? await Onboarding.find({ email, isDeleted: false })
          .sort({ createdAt: -1 })
          .lean()
      : [];

    // Attach each onboarding's operator organization in one round-trip.
    const orgIds = [...new Set(list.map((o) => String(o.organizationId)).filter(Boolean))];
    const orgs = orgIds.length
      ? await Organization.find({ _id: { $in: orgIds } })
          .select("name logo phone")
          .lean()
      : [];
    const orgById = Object.fromEntries(orgs.map((o) => [String(o._id), o]));

    const data = list.map((o) => ({
      ...o,
      organization: orgById[String(o.organizationId)] || null,
    }));

    return res.status(200).json({
      success: true,
      total: data.length,
      data,
      stages: ONBOARDING_STAGES,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch your onboarding.",
    });
  }
};

/**
 * Find an onboarding OWNED by the signed-in tenant (by account email). Used to
 * authorize the tenant's own document actions without org membership.
 */
async function findOwnedOnboarding(req, id) {
  const email = (req.user.email || "").toLowerCase();
  if (!email) return null;
  return Onboarding.findOne({ _id: id, email, isDeleted: false });
}

/**
 * Tenant uploads a document to their OWN onboarding. The file is uploaded to
 * storage client-side; we persist url/publicId. It lands as "pending" and then
 * appears in the operator's admin onboarding view for verification.
 */
export const addMyOnboardingDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, url, publicId } = req.body;

    if (!name || !url) {
      return res.status(400).json({
        success: false,
        message: "Document name and url are required.",
      });
    }

    const applicant = await findOwnedOnboarding(req, id);
    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: "Onboarding not found.",
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
 * Tenant removes a document from their OWN onboarding — but only while it is
 * still "pending" (they can't delete something the operator already verified).
 */
export const deleteMyOnboardingDocument = async (req, res) => {
  try {
    const { id, docId } = req.params;

    const applicant = await findOwnedOnboarding(req, id);
    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: "Onboarding not found.",
      });
    }

    const doc = applicant.documents.id(docId);
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: "Document not found.",
      });
    }

    if (doc.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending documents can be removed.",
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

function clampStage(value) {
  const n = Number(value) || 0;
  if (n < 0) return 0;
  if (n > ONBOARDING_STAGES.length - 1) return ONBOARDING_STAGES.length - 1;
  return n;
}