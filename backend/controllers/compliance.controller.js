import { sendAllPendingReminders } from "../cranjob/complianceReminder.js";
import Compliance from "../models/Compliance.js";
import Property from "../models/Property.js";
import { resolveTenantProperty } from "../utils/tenantProperty.js";

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

    res.json({ success: true, data: compliances });
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
      data: compliances,
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
      fileUrl,
      fileName,
    } = req.body;

    const property = await Property.findOne({ _id: propertyId, organizationId });

    if (!property) {
      return res.status(403).json({
        success: false,
        message: "Property not found or access denied",
      });
    }

    const compliance = new Compliance({
      organizationId,
      propertyId,
      type,
      subType,
      carriedOut,
      validityMonths: Number(validityMonths),
      expiryDate,
      reminderDaysBefore: Number(reminderDaysBefore || 14),
      autoReminder: autoReminder === "true" || autoReminder === true,
      notes,
      fileUrl,
      fileName,
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

// NEW: Send Reminders (for Cron Job)
export const sendComplianceReminders = async (req, res) => {
  try {
    const result = await sendAllPendingReminders();
    res.json({
      success: true,
      message: "Reminder process completed",
      sent: result.sentCount,
      errors: result.errors,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};