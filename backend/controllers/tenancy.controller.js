// controllers/tenancy.controller.js
import Tenancy, { TENANCY_STATUS } from "../models/Tenancy.js";
import User from "../models/User.js";
import Tenant from "../models/Tenant.js";
import Organization from "../models/Organization.js";
import Onboarding from "../models/Onboarding.js";

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

// @desc    Housemates of the signed-in tenant — everyone else living in the
//          same property, enriched with their tenant profile.
// @route   GET /api/v1/tenancies/housemates
// @access  Private (Tenant)
export const getMyHousemates = async (req, res) => {
  try {
    const email = (req.user?.email || "").toLowerCase();
    if (!email) return res.status(200).json({ success: true, data: [] });

    // The tenant's own (most recent) active tenancy anchors the property.
    const mine = await Tenancy.findOne({ tenantEmail: email, isDeleted: false })
      .sort({ startDate: -1, createdAt: -1 })
      .lean();

    if (!mine) return res.status(200).json({ success: true, data: [] });

    // Match everyone else in the same property — prefer the propertyId ref,
    // fall back to the denormalised property name within the same org.
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

    // Enrich each housemate with their tenant profile (gender/occupation/…),
    // resolved via tenantEmail → User → Tenant, in two batched round-trips.
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
        name:
          fullName ||
          t.tenant ||
          (t.tenantEmail || "").split("@")[0] ||
          "Housemate",
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
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch housemates." });
  }
};

// @desc    The signed-in tenant's own room/tenancy — terms, managing
//          organization and their documents (for the "My Room" page).
// @route   GET /api/v1/tenancies/my-room
// @access  Private (Tenant)
export const getMyRoom = async (req, res) => {
  try {
    const email = (req.user?.email || "").toLowerCase();
    if (!email) return res.status(200).json({ success: true, data: null });

    // The tenant's most recent active tenancy.
    const tenancy = await Tenancy.findOne({ tenantEmail: email, isDeleted: false })
      .sort({ startDate: -1, createdAt: -1 })
      .lean();

    if (!tenancy) return res.status(200).json({ success: true, data: null });

    // Managing organization (name/logo/phone for the footer card).
    const org = tenancy.organizationId
      ? await Organization.findById(tenancy.organizationId)
          .select("name logo phone")
          .lean()
      : null;

    // Documents come from the tenant's onboarding record for this org (where
    // tenancy-related files like the agreement/deposit info are stored).
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
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch your room." });
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
