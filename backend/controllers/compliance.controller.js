import mongoose from "mongoose";
import { sendAllPendingReminders } from "../cranjob/complianceReminder.js";
import Compliance, { NON_EXPIRING_TYPES } from "../models/Compliance.js";
import Property from "../models/Property.js";
import { resolveTenantProperty } from "../utils/tenantProperty.js";
import { expiryState } from "../utils/reminders.js";

const MAX_FILES = 20;

/**
 * Whitelist the attachment list field by field, so the client's upload
 * metadata survives but nothing else it sends does. Rows with no url are
 * dropped — an attachment with no file behind it is a dead link in the
 * register, and the form can produce one if a save races an upload.
 *
 * No format restriction: the evidence for a compliance item is whatever was
 * actually issued.
 *
 * Returns { error } or { files }.
 */
const cleanFiles = (input) => {
  if (!Array.isArray(input)) return { error: "files must be a list." };
  if (input.length > MAX_FILES) {
    return { error: `A record can hold at most ${MAX_FILES} files.` };
  }

  const files = [];
  for (const f of input) {
    if (!f || typeof f !== "object") continue;
    const url = typeof f.url === "string" ? f.url.trim() : "";
    if (!url) continue;

    const bytes = Number(f.bytes);
    files.push({
      name: typeof f.name === "string" ? f.name.trim() : "",
      url,
      publicId: typeof f.publicId === "string" ? f.publicId.trim() : "",
      format: typeof f.format === "string" ? f.format.trim() : "",
      bytes: Number.isFinite(bytes) && bytes >= 0 ? bytes : 0,
      // Preserved on an edit so re-saving does not restamp every attachment.
      uploadedAt: f.uploadedAt || new Date(),
    });
  }

  return { files };
};

/**
 * The attachment list for a write, from either shape the client may send:
 * the new `files` array, or the single fileUrl/fileName a caller that has not
 * been updated still posts. Returns undefined when neither was sent, which
 * means "leave the attachments alone".
 */
const resolveFiles = (body) => {
  if (body.files !== undefined) return cleanFiles(body.files);

  if (body.fileUrl !== undefined) {
    const url = typeof body.fileUrl === "string" ? body.fileUrl.trim() : "";
    // An explicitly empty fileUrl detaches the file, which is how the edit form
    // has always removed one.
    return { files: url ? [{ url, name: body.fileName || "" }] : [] };
  }

  return { files: undefined };
};

// The stored `status` is only recomputed in the model's pre-save hook, so a
// record nobody has touched since it was created still reports whatever it was
// then. Recompute it on the way out so the dashboard badge, the filters and the
// reminder emails all agree on what is expiring.
const withLiveStatus = (doc) => {
  const record = doc.toObject ? doc.toObject() : doc;
  const { status, days } = expiryState(record.expiryDate, record.reminderDaysBefore);
  return { ...record, status, daysUntilExpiry: days };
};

// GET the signed-in TENANT's compliance certificates — scoped to THEIR property
// only (gas safety, EICR, EPC, etc.), never the whole organization's records.
export const getMyCompliance = async (req, res) => {
  try {
    const { property } = await resolveTenantProperty(req.user);

    // No resolvable property yet → nothing to show (not an error).
    if (!property?._id) {
      return res.json({ success: true, data: [] });
    }

    const compliances = await Compliance.find({
      organizationId: property.organizationId,
      propertyId: property._id,
    })
      .populate("propertyId", "name propertyCode address")
      .sort({ expiryDate: 1 });

    res.json({ success: true, data: compliances.map(withLiveStatus) });
  } catch (error) {
    console.error("Get My Compliance Error:", error);
    res.status(500).json({ success: false, message: "Failed to load compliance documents." });
  }
};

// GET All Compliance Records
export const getCompliances = async (req, res) => {
  try {
    const { organizationId } = req.user;

    const compliances = await Compliance.find({ organizationId })
      .populate("propertyId", "name propertyCode address")
      .sort({ expiryDate: 1 });

    res.json({
      success: true,
      data: compliances.map(withLiveStatus),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// CREATE Compliance
// controllers/compliance.controller.js
export const createCompliance = async (req, res) => {
  try {
    const { organizationId, _id: userId } = req.user;

    const {
      propertyId,
      type,
      subType,
      carriedOut,
      validityMonths,
      expiryDate,
      reminderDaysBefore,
      autoReminder,
      notes,
    } = req.body;

    const property = await Property.findOne({ _id: propertyId, organizationId });

    if (!property) {
      return res.status(403).json({
        success: false,
        message: "Property not found or access denied",
      });
    }

    const { error, files } = resolveFiles(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    // Number(undefined) is NaN, which Mongoose rejects with a cast error rather
    // than falling back to the schema default. Leave the field off entirely
    // when nothing usable was sent, so the default applies.
    const num = (value) => {
      if (value === undefined || value === null || value === "") return undefined;
      const n = Number(value);
      return Number.isFinite(n) ? n : undefined;
    };

    // A non-expiring type (a floor plan) carries no dates. Blanking them rather
    // than storing whatever the form happened to hold keeps it out of the
    // reminder job's expiryDate query and off the expiring-soon filters.
    const dated = !NON_EXPIRING_TYPES.includes(type);

    const compliance = new Compliance({
      organizationId,
      propertyId,
      type,
      subType,
      carriedOut: dated ? carriedOut : undefined,
      validityMonths: dated ? num(validityMonths) : undefined,
      expiryDate: dated ? expiryDate : undefined,
      reminderDaysBefore: num(reminderDaysBefore) ?? 14,
      autoReminder: dated && (autoReminder === "true" || autoReminder === true),
      notes,
      files: files || [],
      createdBy: userId,
    });

    await compliance.save();

    res.status(201).json({
      success: true,
      data: compliance,
      message: "Compliance certificate added successfully",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Fields a client may change. organizationId, createdBy, status and
// lastReminderSentAt are deliberately absent: the first two are identity, and
// the last two are maintained by the model hook and the reminder job.
//
// Attachments are absent too — `files` is handled separately below, through
// resolveFiles, because it needs sanitising rather than assigning, and because
// fileUrl/fileName are derived from it by the model hook.
const EDITABLE_KEYS = [
  "propertyId",
  "type",
  "subType",
  "carriedOut",
  "validityMonths",
  "expiryDate",
  "reminderDaysBefore",
  "autoReminder",
  "notes",
];

// UPDATE Compliance
export const updateCompliance = async (req, res) => {
  try {
    const { organizationId } = req.user;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    // Loaded and saved rather than findOneAndUpdate: `status` is recomputed in
    // the schema's pre("save") hook, which an atomic update would skip — the
    // record would keep the status it had when it was created.
    const compliance = await Compliance.findOne({
      _id: req.params.id,
      organizationId,
    });

    if (!compliance) {
      return res.status(404).json({
        success: false,
        message: "Compliance record not found",
      });
    }

    // Moving a certificate to another property is allowed, but only to one in
    // the same organization.
    if (req.body.propertyId && String(req.body.propertyId) !== String(compliance.propertyId)) {
      const property = await Property.findOne({
        _id: req.body.propertyId,
        organizationId,
      });

      if (!property) {
        return res.status(403).json({
          success: false,
          message: "Property not found or access denied",
        });
      }
    }

    for (const key of EDITABLE_KEYS) {
      if (req.body[key] === undefined) continue;

      if (key === "validityMonths" || key === "reminderDaysBefore") {
        compliance[key] = Number(req.body[key]);
      } else if (key === "autoReminder") {
        compliance[key] = req.body[key] === "true" || req.body[key] === true;
      } else {
        compliance[key] = req.body[key];
      }
    }

    const { error: filesError, files } = resolveFiles(req.body);
    if (filesError) return res.status(400).json({ success: false, message: filesError });
    // undefined means the client said nothing about attachments, so leave them.
    if (files !== undefined) compliance.files = files;

    // Switching an existing record TO a non-expiring type has to clear the
    // dates it used to carry, or a floor plan converted from a certificate
    // keeps expiring and keeps emailing.
    if (NON_EXPIRING_TYPES.includes(compliance.type)) {
      compliance.carriedOut = undefined;
      compliance.expiryDate = undefined;
      compliance.validityMonths = undefined;
      compliance.autoReminder = false;
    }

    await compliance.save();
    await compliance.populate("propertyId", "name propertyCode address");

    res.json({
      success: true,
      data: withLiveStatus(compliance),
      message: "Compliance certificate updated",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE Compliance
export const deleteCompliance = async (req, res) => {
  try {
    const { organizationId } = req.user;

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    // Scoped by organizationId so an id guessed from another org deletes
    // nothing.
    const compliance = await Compliance.findOneAndDelete({
      _id: req.params.id,
      organizationId,
    });

    if (!compliance) {
      return res.status(404).json({
        success: false,
        message: "Compliance record not found",
      });
    }

    res.json({
      success: true,
      message: "Compliance certificate deleted",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Manual "Send Reminders" trigger from the admin compliance dashboard.
//
// Scoped to the caller's own organization — the unscoped sweep belongs to the
// nightly cron job, and letting one admin fire it would mail every other
// tenant's owner too. De-duplication is handled inside the job, so pressing
// this twice in the same reminder window sends one email, not two.
export const sendComplianceReminders = async (req, res) => {
  try {
    const { organizationId } = req.user;

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message: "No organization found for this account",
      });
    }

    const result = await sendAllPendingReminders({ organizationId });

    res.json({
      success: true,
      message: result.sentCount
        ? `Sent ${result.sentCount} reminder${result.sentCount === 1 ? "" : "s"}`
        : "No certificates are due a reminder right now",
      sent: result.sentCount,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};