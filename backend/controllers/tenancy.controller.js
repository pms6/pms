// controllers/tenancy.controller.js
import Tenancy, { TENANCY_STATUS } from "../models/Tenancy.js";
import User from "../models/User.js";
import Tenant from "../models/Tenant.js";
import Organization from "../models/Organization.js";
import Onboarding from "../models/Onboarding.js";
import Property from "../models/Property.js";
import Room from "../models/Room.js";
import mongoose from "mongoose";

// --- ADD THESE IMPORTS ---
import bcrypt from "bcryptjs"; // or "bcrypt" depending on what you use
import { sendEmail } from "../utils/sendEmail.js";

// Friendly gender label from the Tenant enum (MALE/FEMALE/OTHER/PREFER_NOT_SAY).
const GENDER_LABEL = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  PREFER_NOT_SAY: "",
};

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

// @desc    Housemates of the signed-in tenant
// @route   GET /api/v1/tenancies/housemates
export const getMyHousemates = async (req, res) => {
  try {
    const email = (req.user?.email || "").toLowerCase();
    if (!email) return res.status(200).json({ success: true, data: [] });

    const mine = await Tenancy.findOne({ tenantEmail: email, isDeleted: false })
      .sort({ startDate: -1, createdAt: -1 })
      .lean();

    if (!mine) return res.status(200).json({ success: true, data: [] });

    const propertyMatch = mine.propertyId
      ? { propertyId: mine.propertyId }
      : { property: mine.property, organizationId: mine.organizationId };

    const others = await Tenancy.find({
      ...propertyMatch,
      isDeleted: false,
      tenantEmail: { $ne: email },
    })
      .sort({ unit: 1 })
      .lean();

    const emails = [
      ...new Set(
        others.map((t) => (t.tenantEmail || "").toLowerCase()).filter(Boolean)
      ),
    ];

    const users = emails.length
      ? await User.find({ email: { $in: emails } }).select("_id email").lean()
      : [];
    const userByEmail = Object.fromEntries(
      users.map((u) => [u.email.toLowerCase(), u])
    );
    const profiles = users.length
      ? await Tenant.find({ userId: { $in: users.map((u) => u._id) } }).lean()
      : [];
    const profileByUserId = Object.fromEntries(
      profiles.map((p) => [String(p.userId), p])
    );

    const yearsFrom = (birthdate) => {
      if (!birthdate) return null;
      const ms = Date.now() - new Date(birthdate).getTime();
      if (Number.isNaN(ms) || ms < 0) return null;
      return Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
    };

    const data = others.map((t) => {
      const u = userByEmail[(t.tenantEmail || "").toLowerCase()];
      const p = u ? profileByUserId[String(u._id)] : null;
      const fullName = [p?.firstName, p?.lastName].filter(Boolean).join(" ");
      const age = yearsFrom(p?.birthdate);
      return {
        id: String(t._id),
        room: t.unit && t.unit !== "—" ? t.unit : "",
        name: fullName || t.tenant || (t.tenantEmail || "").split("@")[0] || "Housemate",
        gender: GENDER_LABEL[p?.gender] ?? "",
        age: age != null ? `${age} years` : "",
        occupation: p?.jobTitle || "",
        bio: p?.about || "",
        interests: Array.isArray(p?.interests) ? p.interests : [],
        profileImage: p?.profileImage || "",
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Get Housemates Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch housemates." });
  }
};

// @desc    The signed-in tenant's own room/tenancy
// @route   GET /api/v1/tenancies/my-room
export const getMyRoom = async (req, res) => {
  try {
    const email = (req.user?.email || "").toLowerCase();
    if (!email) return res.status(200).json({ success: true, data: null });

    const tenancy = await Tenancy.findOne({ tenantEmail: email, isDeleted: false })
      .sort({ startDate: -1, createdAt: -1 })
      .lean();

    if (!tenancy) return res.status(200).json({ success: true, data: null });

    const org = tenancy.organizationId
      ? await Organization.findById(tenancy.organizationId)
          .select("name logo phone")
          .lean()
      : null;

    const onboarding = await Onboarding.findOne({
      email,
      organizationId: tenancy.organizationId,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .lean();

    const documents = (onboarding?.documents || [])
      .filter((d) => d.url)
      .map((d) => ({
        name: d.name,
        type: d.type || "",
        status: d.status || "pending",
        url: d.url,
        uploadedAt: d.uploadedAt || null,
      }));

    return res.status(200).json({
      success: true,
      data: {
        room: tenancy.unit && tenancy.unit !== "—" ? tenancy.unit : "",
        property: tenancy.property || "",
        rent: tenancy.rent || 0,
        status: tenancy.status || "",
        availability: tenancy.availability || "",
        startDate: tenancy.startDate || null,
        fixedTermEnd: tenancy.fixedTermEnd || null,
        periodicStart: tenancy.periodicStart || null,
        organization: org
          ? { name: org.name || "", logo: org.logo || "", phone: org.phone || "" }
          : null,
        documents,
      },
    });
  } catch (error) {
    console.error("Get My Room Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch your room." });
  }
};

// @desc    Occupancy overview stats
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
      Tenancy.countDocuments({ ...match, status: { $in: ["Becoming Periodic", "Ending"] } }),
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

const generatePassword = () => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const loginUrl = () => `${process.env.FRONTEND_URL || "http://localhost:3000"}/login`;

const emailShell = (inner) => `
  <div style="font-family: -apple-system, Segoe UI, sans-serif; padding: 20px; max-width: 520px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
    ${inner}
  </div>
`;

const loginButton = () => `
  <p style="text-align:center; margin: 24px 0;">
    <a href="${loginUrl()}" style="background:#F47C3C; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">
      Log in to Tenant Portal
    </a>
  </p>
`;

// New user → email their login credentials.
const buildCredentialsEmail = ({ name, orgName, where, cleanEmail, tempPassword }) =>
  emailShell(`
    <h2 style="color:#0F253B; margin-top:0;">Welcome to ${orgName}</h2>
    <p>Hi ${name || "there"},</p>
    <p>An account has been created for you and your tenancy at <strong>${where}</strong> is set up.</p>
    <div style="background:#f5f5f5; padding:15px; border-radius:6px; margin:20px 0;">
      <p style="margin:0 0 8px;"><strong>Email:</strong> ${cleanEmail}</p>
      <p style="margin:0;"><strong>Temporary Password:</strong> <code>${tempPassword}</code></p>
    </div>
    <p>Please log in and change your password after your first sign-in.</p>
    ${loginButton()}
  `);

// Existing user → confirmation email (no credentials).
const buildConfirmationEmail = ({ name, orgName, where }) =>
  emailShell(`
    <h2 style="color:#0F253B; margin-top:0;">Tenancy confirmed</h2>
    <p>Hi ${name || "there"},</p>
    <p>This confirms your tenancy at <strong>${where}</strong> with ${orgName} has been set up.</p>
    <p>You can view the details in your tenant portal using your existing account.</p>
    ${loginButton()}
  `);

// Onboarding invite → asks the tenant to log in and complete their details.
const buildInviteEmail = ({ name, orgName, where }) =>
  emailShell(`
    <h2 style="color:#0F253B; margin-top:0;">Complete your onboarding</h2>
    <p>Hi ${name || "there"},</p>
    <p>${orgName} has invited you to finish setting up your tenancy at <strong>${where}</strong>.</p>
    <p>Log in to your tenant portal to complete your onboarding details.</p>
    ${loginButton()}
    <p style="color:#666; font-size:13px;">If you don't have an account yet, use the "Forgot password" link on the login page with this email address.</p>
  `);

/**
 * Send one onboarding invite. Never throws — the caller decides what to do
 * with the outcome so a bad address can't take down a bulk send.
 *
 * @returns {{ sent: boolean, reason: string|null }}
 */
async function sendOnboardingInvite({ tenancy, orgName }) {
  const cleanEmail = String(tenancy.tenantEmail || "").toLowerCase().trim();
  if (!cleanEmail) return { sent: false, reason: "no email address on file" };

  const where = [tenancy.property, tenancy.unit].filter((v) => v && v !== "—").join(" · ") || "your home";

  try {
    console.log(`[EMAIL] Sending onboarding invite to: ${cleanEmail}`);
    await sendEmail({
      email: cleanEmail,
      subject: `${orgName} - Complete your onboarding for ${where}`,
      html: buildInviteEmail({ name: tenancy.tenant, orgName, where }),
    });
    console.log(`[EMAIL] ✅ Sent onboarding invite to ${cleanEmail}`);
    return { sent: true, reason: null };
  } catch (err) {
    console.error(`[EMAIL] ❌ Failed to send onboarding invite to ${cleanEmail}:`, err.message);
    return { sent: false, reason: err.message || "email delivery failed" };
  }
}

// Org name is used as the sender label in invite emails.
const getOrgName = async (organizationId) => {
  const org = await Organization.findById(organizationId).select("name").lean();
  return org?.name || "the property team";
};

/**
 * Provision tenant account + send the right email:
 *   - New user  → create account + email temporary credentials
 *   - Existing  → send a tenancy confirmation email (no credentials)
 *
 * @returns {{ tenantId: string|null, isNewUser: boolean, emailSent: boolean }}
 */
async function provisionTenantAndNotify({ email, name, organizationId, propertyName, unit, createAccount }) {
  const result = { tenantId: null, isNewUser: false, emailSent: false };
  if (!createAccount || !email) return result;

  const cleanEmail = String(email).toLowerCase().trim();
  if (!cleanEmail) return result;

  let tempPassword = null;

  try {
    let user = await User.findOne({ email: cleanEmail });

    if (!user) {
      result.isNewUser = true;
      tempPassword = generatePassword();
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(tempPassword, salt);

      user = await User.create({
        email: cleanEmail,
        password: hashedPassword,
        role: "Tenant",
        isVerified: true,
      });
    }

    // Create or update Tenant profile
    const [firstName, ...rest] = String(name || "").trim().split(/\s+/);
    const lastName = rest.join(" ");

    const tenant = await Tenant.findOneAndUpdate(
      { userId: user._id },
      {
        $set: { organizationId, email: cleanEmail },
        $setOnInsert: { firstName: firstName || undefined, lastName: lastName || undefined },
      },
      { upsert: true, setDefaultsOnInsert: true, new: true }
    );
    result.tenantId = tenant?._id || null;
  } catch (err) {
    console.error(`[OCCUPANCY] ❌ Failed to provision account for ${cleanEmail}:`, err.message);
    return result;
  }

  // Email is best-effort — never fail the tenancy because the mail server hiccuped.
  try {
    const org = await Organization.findById(organizationId).select("name").lean();
    const orgName = org?.name || "the property team";
    const where = [propertyName, unit].filter(Boolean).join(" · ") || "your new home";

    const { subject, html } = result.isNewUser
      ? {
          subject: `${orgName} - Your login details for ${where}`,
          html: buildCredentialsEmail({ name, orgName, where, cleanEmail, tempPassword }),
        }
      : {
          subject: `${orgName} - Your tenancy at ${where} is confirmed`,
          html: buildConfirmationEmail({ name, orgName, where }),
        };

    console.log(
      `[EMAIL] Sending ${result.isNewUser ? "credentials" : "confirmation"} email to: ${cleanEmail}`
    );

    await sendEmail({ email: cleanEmail, subject, html });
    result.emailSent = true;
    console.log(`[EMAIL] ✅ Sent ${result.isNewUser ? "credentials" : "confirmation"} email to ${cleanEmail}`);
  } catch (err) {
    console.error(`[EMAIL] ❌ Failed to send email to ${cleanEmail}:`, err.message);
  }

  return result;
}

// @desc    Create a tenancy (links to EXISTING Property + Room)
// @route   POST /api/v1/tenancies
export const createTenancy = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const createdBy = req.user._id;

    const payload = pickPayload(req.body);
    const createAccount = req.body.createAccount === true;

    if (!payload.propertyId || !mongoose.isValidObjectId(payload.propertyId)) {
      return res.status(400).json({ success: false, message: "Valid propertyId is required." });
    }
    if (!payload.roomId || !mongoose.isValidObjectId(payload.roomId)) {
      return res.status(400).json({ success: false, message: "Valid roomId is required." });
    }
    if (!payload.tenant || !String(payload.tenant).trim()) {
      return res.status(400).json({ success: false, message: "Tenant name is required." });
    }

    // Verify Property & Room
    const [property, room] = await Promise.all([
      Property.findOne({ _id: payload.propertyId, organizationId, isDeleted: false }),
      Room.findOne({ _id: payload.roomId, organizationId, propertyId: payload.propertyId, isDeleted: false })
    ]);

    if (!property) return res.status(404).json({ success: false, message: "Property not found." });
    if (!room) return res.status(404).json({ success: false, message: "Room not found." });

    // Update tenant org if needed
    if (payload.tenantId) {
      const tenant = await Tenant.findById(payload.tenantId);
      if (tenant) {
        let needsSave = false;
        if (!tenant.organizationId || String(tenant.organizationId) !== String(organizationId)) {
          tenant.organizationId = organizationId;
          needsSave = true;
        }
        if (payload.tenantEmail && payload.tenantEmail !== tenant.email) {
          tenant.email = payload.tenantEmail.toLowerCase().trim();
          needsSave = true;
        }
        if (needsSave) await tenant.save();
      }
    }

    // Create Tenancy
    const tenancy = await Tenancy.create({
      ...payload,
      organizationId,
      createdBy,
      property: property.name,
      unit: room.roomNumber || room.roomName || room.title || "—",
    });

    // Provision account + send email (if requested)
    let notifyResult = { tenantId: null, isNewUser: false, emailSent: false };
    if (createAccount && payload.tenantEmail) {
      notifyResult = await provisionTenantAndNotify({
        email: payload.tenantEmail,
        name: payload.tenant,
        organizationId,
        propertyName: property.name,
        unit: tenancy.unit,
        createAccount,
      });

      if (notifyResult.tenantId) {
        tenancy.tenantId = notifyResult.tenantId;
        await tenancy.save();

        // Optional: Update room with current tenant
        await Room.updateOne({ _id: payload.roomId }, { $set: { currentTenant: notifyResult.tenantId, status: "OCCUPIED" } });
      }
    }

    let message = "Tenancy created successfully.";
    if (notifyResult.emailSent) {
      message = notifyResult.isNewUser
        ? "Tenancy created — login credentials emailed to the tenant."
        : "Tenancy created — confirmation email sent to the tenant.";
    } else if (createAccount && payload.tenantEmail) {
      message = "Tenancy created, but the notification email could not be sent.";
    }

    return res.status(201).json({
      success: true,
      message,
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

// @desc    Send an onboarding invite to a single tenant
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

    if (!String(tenancy.tenantEmail || "").trim()) {
      return res.status(400).json({
        success: false,
        message: `No email address on file for ${tenancy.tenant}. Add one before sending an invite.`,
      });
    }

    const orgName = await getOrgName(organizationId);
    const { sent, reason } = await sendOnboardingInvite({ tenancy, orgName });

    // Only stamp invitedAt when an invite actually went out, so the record
    // never claims an invite the tenant never received.
    if (!sent) {
      return res.status(502).json({
        success: false,
        message: `Could not send the onboarding invite to ${tenancy.tenant}: ${reason}.`,
      });
    }

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

// @desc    Send onboarding invites to all not-onboarded tenants
// @route   POST /api/v1/tenancies/invite-all
export const inviteAllTenants = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const pending = await Tenancy.find({
      organizationId,
      isDeleted: false,
      onboarded: false,
    }).select("tenant tenantEmail property unit");

    if (!pending.length) {
      return res.status(200).json({
        success: true,
        message: "No tenants are waiting on an onboarding invite.",
        data: { invited: 0, skipped: 0, failed: 0, failures: [] },
      });
    }

    const orgName = await getOrgName(organizationId);

    const sentIds = [];
    const failures = [];
    let skipped = 0;

    // Send in small batches so a large org doesn't open hundreds of
    // simultaneous SMTP connections.
    const BATCH_SIZE = 5;
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((tenancy) => sendOnboardingInvite({ tenancy, orgName }))
      );

      results.forEach(({ sent, reason }, index) => {
        const tenancy = batch[index];
        if (sent) {
          sentIds.push(tenancy._id);
        } else if (reason === "no email address on file") {
          skipped += 1;
          failures.push({ tenant: tenancy.tenant, reason });
        } else {
          failures.push({ tenant: tenancy.tenant, reason });
        }
      });
    }

    // Stamp only the tenancies whose invite actually went out.
    if (sentIds.length) {
      await Tenancy.updateMany(
        { _id: { $in: sentIds } },
        { $set: { invitedAt: new Date() } }
      );
    }

    const invited = sentIds.length;
    const failed = failures.length - skipped;

    let message = `Onboarding invite sent to ${invited} of ${pending.length} tenant(s).`;
    const notes = [];
    if (skipped) notes.push(`${skipped} had no email address`);
    if (failed) notes.push(`${failed} failed to send`);
    if (notes.length) message += ` ${notes.join(", ")}.`;

    return res.status(200).json({
      success: invited > 0,
      message,
      data: { invited, skipped, failed, failures },
    });
  } catch (error) {
    console.error("Invite All Tenants Error:", error);
    return res.status(500).json({ success: false, message: "Failed to send invites." });
  }
};

// Expose allowed statuses
export const tenancyStatuses = TENANCY_STATUS;