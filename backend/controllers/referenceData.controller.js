// controllers/referenceData.controller.js
//
// The reference register — the app's replacement for
// "Reference Data template .xlsx": the previous landlord, the employer and the
// next of kin collected for each tenant.

import ReferenceData, { REFERENCE_STATUS } from "../models/ReferenceData.js";
import CheckIn from "../models/CheckIn.js";
import Property from "../models/Property.js";
import Room from "../models/Room.js";

const EDITABLE_KEYS = [
  "propertyId",
  "roomId",
  "tenantId",
  "checkInId",
  "property",
  "room",
  "tenant",
  "tenantEmail",
  "tenantPhone",
  "exLandlord",
  "employer",
  "nextOfKin",
  "documents",
  "documentsNote",
  "recordedOn",
  "notes",
];

const REF_KEYS = ["propertyId", "roomId", "tenantId", "checkInId"];

// The three reference blocks, so validation and the "how complete is this row"
// score are written once rather than three times.
export const REFERENCE_BLOCKS = ["exLandlord", "employer", "nextOfKin"];

const pickPayload = (body) => {
  const payload = {};
  for (const key of EDITABLE_KEYS) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  return payload;
};

const blankToNull = (value) => (value === "" || value === undefined ? null : value);

const normalisePayload = (payload) => {
  for (const block of REFERENCE_BLOCKS) {
    if (payload[block] === undefined) continue;
    if (payload[block] === null) {
      payload[block] = {};
      continue;
    }
    if (typeof payload[block] !== "object") {
      return block + " must be an object.";
    }
    const status = payload[block].status;
    if (status && !REFERENCE_STATUS.includes(status)) {
      return "Unknown status on " + block + ".";
    }
  }

  if (payload.recordedOn !== undefined) payload.recordedOn = blankToNull(payload.recordedOn);
  for (const key of REF_KEYS) {
    if (payload[key] !== undefined) payload[key] = blankToNull(payload[key]);
  }

  // Attachments are whitelisted field by field, like everything else on the
  // body: the client sends back whatever Cloudinary handed it, and only the
  // parts the model declares should survive.
  //
  // A row with no url is dropped — an attachment with no file behind it is a
  // dead link in the register, and the form can produce one if a save races an
  // upload. No format restriction: reference paperwork is whatever the referee
  // actually sent.
  if (payload.documents !== undefined) {
    if (!Array.isArray(payload.documents)) {
      return "documents must be a list.";
    }
    if (payload.documents.length > 20) {
      return "A reference record can hold at most 20 documents.";
    }

    const cleaned = [];
    for (const d of payload.documents) {
      if (!d || typeof d !== "object") continue;
      const url = typeof d.url === "string" ? d.url.trim() : "";
      if (!url) continue;

      const bytes = Number(d.bytes);
      cleaned.push({
        name: typeof d.name === "string" ? d.name.trim() : "",
        url,
        publicId: typeof d.publicId === "string" ? d.publicId.trim() : "",
        format: typeof d.format === "string" ? d.format.trim() : "",
        bytes: Number.isFinite(bytes) && bytes >= 0 ? bytes : 0,
        // Preserved on an edit so re-saving a record does not restamp every
        // attachment with today's date.
        uploadedAt: d.uploadedAt || new Date(),
      });
    }
    payload.documents = cleaned;
  }

  return null;
};

/**
 * Resolve the optional links. A checkInId carries the property, room, tenant
 * and their contact details, so referencing a check-in means retyping nothing.
 */
const attachLinks = async (payload, organizationId) => {
  if (payload.checkInId) {
    const checkIn = await CheckIn.findOne({
      _id: payload.checkInId,
      organizationId,
      isDeleted: false,
    })
      .select("property room tenant email phone propertyId roomId tenantId")
      .lean();

    if (!checkIn) return { error: "Check-in not found." };

    if (!payload.property) payload.property = checkIn.property;
    if (!payload.room) payload.room = checkIn.room;
    if (!payload.tenant) payload.tenant = checkIn.tenant;
    if (!payload.tenantEmail) payload.tenantEmail = checkIn.email;
    if (!payload.tenantPhone) payload.tenantPhone = checkIn.phone;
    if (!payload.propertyId) payload.propertyId = checkIn.propertyId;
    if (!payload.roomId) payload.roomId = checkIn.roomId;
    if (!payload.tenantId) payload.tenantId = checkIn.tenantId;
  }

  if (payload.propertyId) {
    const property = await Property.findOne({ _id: payload.propertyId, organizationId })
      .select("name")
      .lean();
    if (!property) return { error: "Property not found." };
    if (!payload.property) payload.property = property.name;
  }

  if (payload.roomId) {
    const room = await Room.findOne({ _id: payload.roomId, organizationId })
      .select("roomName title propertyId")
      .lean();
    if (!room) return { error: "Room not found." };
    if (!payload.room) payload.room = room.roomName || room.title || "";
    if (!payload.propertyId) payload.propertyId = room.propertyId;
  }

  return {};
};

/** A reference block counts as collected once it has any way to reach anyone. */
const isCollected = (block) =>
  Boolean(block && (block.contact || block.email || block.name || block.note));

/** How many of the three references are on file, and how many are verified. */
const scoreRow = (row) => ({
  collected: REFERENCE_BLOCKS.filter((b) => isCollected(row[b])).length,
  verified: REFERENCE_BLOCKS.filter((b) => row[b]?.status === "VERIFIED").length,
  total: REFERENCE_BLOCKS.length,
});

// @desc    List reference records
// @route   GET /api/v1/reference-data
export const getReferenceData = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const { year, month, propertyId, status, incomplete, search } = req.query;

    const filter = { organizationId, isDeleted: false };

    if (year) {
      const y = Number(year);
      if (!Number.isInteger(y)) {
        return res.status(400).json({ success: false, message: "year must be a number." });
      }
      if (month) {
        const m = Number(month);
        if (!Number.isInteger(m) || m < 1 || m > 12) {
          return res.status(400).json({ success: false, message: "month must be 1-12." });
        }
        filter.recordedOn = {
          $gte: new Date(Date.UTC(y, m - 1, 1)),
          $lt: new Date(Date.UTC(y, m, 1)),
        };
      } else {
        filter.recordedOn = {
          $gte: new Date(Date.UTC(y, 0, 1)),
          $lt: new Date(Date.UTC(y + 1, 0, 1)),
        };
      }
    }

    if (propertyId) filter.propertyId = propertyId;

    // A status filter matches if ANY of the three references is in that state —
    // "show me the rows with a failed reference" is the question being asked,
    // not "show me rows where all three failed".
    if (status) {
      if (!REFERENCE_STATUS.includes(status)) {
        return res.status(400).json({ success: false, message: "Unknown reference status." });
      }
      filter.$or = REFERENCE_BLOCKS.map((b) => ({ [b + ".status"]: status }));
    }

    if (search) {
      const rx = { $regex: search, $options: "i" };
      const searchOr = [
        { tenant: rx },
        { property: rx },
        { room: rx },
        { tenantEmail: rx },
        { tenantPhone: rx },
        { "exLandlord.name": rx },
        { "employer.name": rx },
        { "nextOfKin.name": rx },
      ];
      // A status filter already owns $or, so combine rather than overwrite —
      // otherwise searching would silently drop the status filter.
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }

    let rows = await ReferenceData.find(filter)
      .sort({ recordedOn: -1, createdAt: -1 })
      .lean();

    rows = rows.map((r) => ({ ...r, score: scoreRow(r) }));

    // Applied after scoring, since "incomplete" is a property of the whole row
    // rather than of any one field.
    if (incomplete === "true") {
      rows = rows.filter((r) => r.score.collected < r.score.total);
    }

    const summary = {
      total: rows.length,
      complete: rows.filter((r) => r.score.collected === r.score.total).length,
      fullyVerified: rows.filter((r) => r.score.verified === r.score.total).length,
      // Rows carrying at least one reference that came back bad — the ones
      // somebody has to act on.
      failed: rows.filter((r) => REFERENCE_BLOCKS.some((b) => r[b]?.status === "FAILED")).length,
    };

    return res.status(200).json({ success: true, total: rows.length, summary, data: rows });
  } catch (error) {
    console.error("Get Reference Data Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch reference data." });
  }
};

// @desc    One reference record in full
// @route   GET /api/v1/reference-data/:id
export const getReferenceDataById = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;

    const row = await ReferenceData.findOne({
      _id: req.params.id,
      organizationId,
      isDeleted: false,
    })
      .populate("createdBy", "email")
      .lean();

    if (!row) {
      return res.status(404).json({ success: false, message: "Reference record not found." });
    }

    return res.status(200).json({ success: true, data: { ...row, score: scoreRow(row) } });
  } catch (error) {
    console.error("Get Reference Record Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch the reference record." });
  }
};

// @desc    Tenants with no reference record yet — the picker for a new one
// @route   GET /api/v1/reference-data/without-references
export const getTenantsWithoutReferences = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const [checkIns, taken] = await Promise.all([
      CheckIn.find({ organizationId, isDeleted: false, status: "ACTIVE" })
        .select("property room tenant email phone propertyId roomId")
        .sort({ property: 1, room: 1 })
        .lean(),
      ReferenceData.distinct("checkInId", { organizationId, isDeleted: false }),
    ]);

    const done = new Set(taken.filter(Boolean).map(String));
    const rows = checkIns.filter((c) => !done.has(String(c._id)));

    return res.status(200).json({ success: true, total: rows.length, data: rows });
  } catch (error) {
    console.error("Get Tenants Without References Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch tenants." });
  }
};

// @desc    Create a reference record
// @route   POST /api/v1/reference-data
export const createReferenceData = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const payload = pickPayload(req.body);

    const invalid = normalisePayload(payload);
    if (invalid) return res.status(400).json({ success: false, message: invalid });

    // Links first: a checkInId supplies the property and tenant, so requiring
    // them beforehand would reject a valid request that named only the check-in.
    const { error } = await attachLinks(payload, organizationId);
    if (error) return res.status(404).json({ success: false, message: error });

    if (!payload.property || !String(payload.property).trim()) {
      return res.status(400).json({ success: false, message: "A property is required." });
    }
    if (!payload.tenant || !String(payload.tenant).trim()) {
      return res.status(400).json({ success: false, message: "A tenant name is required." });
    }

    const row = await ReferenceData.create({
      ...payload,
      organizationId,
      createdBy: req.user._id,
    });

    return res.status(201).json({ success: true, data: { ...row.toObject(), score: scoreRow(row) } });
  } catch (error) {
    console.error("Create Reference Record Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map((e) => e.message)
          .join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to create the reference record." });
  }
};

// @desc    Update a reference record
// @route   PUT /api/v1/reference-data/:id
export const updateReferenceData = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const payload = pickPayload(req.body);

    const invalid = normalisePayload(payload);
    if (invalid) return res.status(400).json({ success: false, message: invalid });

    const { error } = await attachLinks(payload, organizationId);
    if (error) return res.status(404).json({ success: false, message: error });

    const row = await ReferenceData.findOneAndUpdate(
      { _id: req.params.id, organizationId, isDeleted: false },
      { $set: payload },
      { new: true, runValidators: true }
    );

    if (!row) {
      return res.status(404).json({ success: false, message: "Reference record not found." });
    }

    return res.status(200).json({ success: true, data: { ...row.toObject(), score: scoreRow(row) } });
  } catch (error) {
    console.error("Update Reference Record Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)
          .map((e) => e.message)
          .join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to update the reference record." });
  }
};

// @desc    Delete a reference record (soft delete)
// @route   DELETE /api/v1/reference-data/:id
export const deleteReferenceData = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;

    const row = await ReferenceData.findOneAndUpdate(
      { _id: req.params.id, organizationId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    );

    if (!row) {
      return res.status(404).json({ success: false, message: "Reference record not found." });
    }

    return res.status(200).json({ success: true, message: "Reference record deleted." });
  } catch (error) {
    console.error("Delete Reference Record Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete the reference record." });
  }
};
