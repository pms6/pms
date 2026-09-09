// controllers/companyPassword.controller.js
import CompanyPassword, { PASSWORD_TYPES } from "../models/CompanyPassword.js";

// The fields each type actually owns. Anything outside its set is ignored so an
// ACCOUNT row can't carry keysafe codes and vice-versa.
const FIELDS_BY_TYPE = {
  ACCOUNT: ["accountName", "userId", "password", "domain", "domainDueDate", "site", "notes"],
  KEYSAFE: [
    "propertyId",
    "property",
    "keysCode",
    "digitalLockCode",
    "lockLocation",
    "notes",
  ],
};

const TRIMMED = new Set([
  "accountName",
  "userId",
  "domain",
  "site",
  "property",
  "lockLocation",
  "notes",
]);

const pickPayload = (type, body) => {
  const payload = {};
  for (const key of FIELDS_BY_TYPE[type] || []) {
    if (body[key] === undefined) continue;
    let value = body[key];
    if (TRIMMED.has(key)) value = String(value ?? "").trim();
    payload[key] = value;
  }

  if (payload.domainDueDate === "") payload.domainDueDate = null;
  if (payload.propertyId === "") payload.propertyId = null;

  return payload;
};

// A row is worth keeping if it names the thing it is about.
const missingRequired = (type, payload) => {
  if (type === "ACCOUNT" && !payload.accountName) return "Account name is required.";
  if (type === "KEYSAFE" && !payload.property) return "Property is required.";
  return null;
};

// @desc    List credential rows of one type
// @route   GET /api/v1/company-passwords?type=ACCOUNT|KEYSAFE
export const getCompanyPasswords = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { type } = req.query;

    const filter = { organizationId, isDeleted: false };
    if (type && PASSWORD_TYPES.includes(type)) filter.type = type;

    const rows = await CompanyPassword.find(filter).sort({ createdAt: 1 });

    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error("Get Company Passwords Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch credentials." });
  }
};

// @desc    Read one row
// @route   GET /api/v1/company-passwords/:id
export const getCompanyPasswordById = async (req, res) => {
  try {
    const row = await CompanyPassword.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: false,
    });

    if (!row) {
      return res.status(404).json({ success: false, message: "Entry not found." });
    }

    return res.status(200).json({ success: true, data: row });
  } catch (error) {
    console.error("Get Company Password Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch entry." });
  }
};

// @desc    Add a row
// @route   POST /api/v1/company-passwords
export const createCompanyPassword = async (req, res) => {
  try {
    const type = req.body.type;
    if (!PASSWORD_TYPES.includes(type)) {
      return res.status(400).json({ success: false, message: "A valid type is required." });
    }

    const payload = pickPayload(type, req.body);
    const missing = missingRequired(type, payload);
    if (missing) {
      return res.status(400).json({ success: false, message: missing });
    }

    const row = await CompanyPassword.create({
      ...payload,
      type,
      organizationId: req.user.organizationId,
      createdBy: req.user._id,
    });

    return res.status(201).json({ success: true, message: "Entry added.", data: row });
  } catch (error) {
    console.error("Create Company Password Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to add entry." });
  }
};

// @desc    Edit a row
// @route   PUT /api/v1/company-passwords/:id
export const updateCompanyPassword = async (req, res) => {
  try {
    const row = await CompanyPassword.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: false,
    });

    if (!row) {
      return res.status(404).json({ success: false, message: "Entry not found." });
    }

    // The type is fixed once created — a row can't switch shape.
    const payload = pickPayload(row.type, req.body);
    const missing = missingRequired(row.type, {
      accountName: payload.accountName ?? row.accountName,
      property: payload.property ?? row.property,
    });
    if (missing) {
      return res.status(400).json({ success: false, message: missing });
    }

    Object.assign(row, payload);
    const updated = await row.save();

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Update Company Password Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to update entry." });
  }
};

// @desc    Soft delete a row
// @route   DELETE /api/v1/company-passwords/:id
export const deleteCompanyPassword = async (req, res) => {
  try {
    const row = await CompanyPassword.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!row) {
      return res.status(404).json({ success: false, message: "Entry not found." });
    }

    row.isDeleted = true;
    row.deletedAt = new Date();
    await row.save();

    return res.status(200).json({ success: true, message: "Entry deleted." });
  } catch (error) {
    console.error("Delete Company Password Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete entry." });
  }
};
