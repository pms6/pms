// controllers/internetDetail.controller.js
import mongoose from "mongoose";
import InternetDetail, {
  INTERNET_PROVIDERS,
} from "../models/InternetDetail.js";
import Property from "../models/Property.js";

/**
 * Whitelist of fields a client may set on create/update. `propertyName` is
 * derived from propertyId when one is given, so it is accepted here only for
 * accounts recorded against a property that isn't in the system yet.
 */
const EDITABLE_KEYS = [
  "propertyId",
  "propertyName",
  "accountNumber",
  "areaRef",
  "accountHolder",
  "providerName",
  "providerPhone",
  "contractStart",
  "contractEnd",
  "amount",
  "paymentMethod",
  "companyName",
  "bankName",
  "bankDetails",
  "securityQuestion",
  "userName",
  "password",
  "routerLocation",
  "routerImage",
  "accountEmail",
  "notes",
];

const pickPayload = (body) => {
  const payload = {};
  for (const key of EDITABLE_KEYS) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  return payload;
};

// "" and undefined both mean "no date" — Mongoose would cast "" to an Invalid
// Date and store it, which then breaks every date comparison downstream.
const normaliseDates = (payload) => {
  for (const key of ["contractStart", "contractEnd"]) {
    if (payload[key] === "" || payload[key] === null) payload[key] = null;
  }
};

// Resolve and denormalise the property name so the sheet needn't populate.
// A free-typed propertyName is kept as-is when no property is linked.
const attachProperty = async (payload, organizationId) => {
  if (payload.propertyId) {
    const property = await Property.findOne({
      _id: payload.propertyId,
      organizationId,
      isDeleted: false,
    })
      .select("name")
      .lean();

    if (!property) return { error: "Property not found." };
    payload.propertyName = property.name;
    return {};
  }

  if (payload.propertyId === null || payload.propertyId === "") {
    payload.propertyId = null;
  }
  return {};
};

// The sheet numbers rows 1..n WITHIN each provider section rather than across
// the whole document, so the number is assigned here, on the sorted list, and
// never stored. Rows arrive already sorted by provider then property.
const numberRows = (rows) => {
  const counters = new Map();
  return rows.map((row) => {
    const key = row.providerName || "";
    const next = (counters.get(key) || 0) + 1;
    counters.set(key, next);
    return { ...row, srNo: next };
  });
};

// @desc    List broadband accounts, grouped-ready and numbered per provider
// @route   GET /api/v1/internet-details
export const getInternetDetails = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res
        .status(401)
        .json({ success: false, message: "Organization ID required" });
    }

    const { provider, propertyId, search, expiringInDays } = req.query;

    const filter = { organizationId, isDeleted: false };

    if (provider) filter.providerName = provider;
    if (propertyId) filter.propertyId = propertyId;

    if (expiringInDays) {
      const days = Number(expiringInDays);
      if (!Number.isInteger(days) || days < 0) {
        return res.status(400).json({
          success: false,
          message: "expiringInDays must be a positive number.",
        });
      }
      const until = new Date();
      until.setDate(until.getDate() + days);
      filter.contractEnd = { $ne: null, $lte: until };
    }

    if (search) {
      // Credentials are deliberately NOT searchable — matching on a password
      // would let someone confirm one they already guessed.
      filter.$or = [
        { propertyName: { $regex: search, $options: "i" } },
        { accountNumber: { $regex: search, $options: "i" } },
        { accountHolder: { $regex: search, $options: "i" } },
        { providerName: { $regex: search, $options: "i" } },
        { routerLocation: { $regex: search, $options: "i" } },
        { accountEmail: { $regex: search, $options: "i" } },
      ];
    }

    const rows = await InternetDetail.find(filter)
      .populate("createdBy", "email")
      .sort({ providerName: 1, propertyName: 1, createdAt: 1 })
      .lean();

    const data = numberRows(rows);

    return res.status(200).json({
      success: true,
      total: data.length,
      // Monthly spend across every account on the sheet.
      totalMonthly: data.reduce((sum, r) => sum + (r.amount || 0), 0),
      providers: [...new Set(data.map((r) => r.providerName).filter(Boolean))],
      data,
    });
  } catch (error) {
    console.error("getInternetDetails error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    One broadband account
// @route   GET /api/v1/internet-details/:id
export const getInternetDetailById = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res
        .status(401)
        .json({ success: false, message: "Organization ID required" });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const record = await InternetDetail.findOne({
      _id: req.params.id,
      organizationId,
      isDeleted: false,
    })
      .populate("createdBy", "email")
      .lean();

    if (!record) {
      return res.status(404).json({ success: false, message: "Not found." });
    }

    return res.status(200).json({ success: true, data: record });
  } catch (error) {
    console.error("getInternetDetailById error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Record a broadband account
// @route   POST /api/v1/internet-details
export const createInternetDetail = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res
        .status(401)
        .json({ success: false, message: "Organization ID required" });
    }

    const payload = pickPayload(req.body);
    normaliseDates(payload);

    const { error } = await attachProperty(payload, organizationId);
    if (error) return res.status(400).json({ success: false, message: error });

    if (!payload.propertyName) {
      return res.status(400).json({
        success: false,
        message: "Property is required.",
      });
    }
    if (!payload.providerName) {
      return res.status(400).json({
        success: false,
        message: "Provider is required.",
      });
    }

    const record = await InternetDetail.create({
      ...payload,
      organizationId,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Internet details saved.",
      data: record,
    });
  } catch (error) {
    console.error("createInternetDetail error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a broadband account
// @route   PUT /api/v1/internet-details/:id
export const updateInternetDetail = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res
        .status(401)
        .json({ success: false, message: "Organization ID required" });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const payload = pickPayload(req.body);
    normaliseDates(payload);

    const { error } = await attachProperty(payload, organizationId);
    if (error) return res.status(400).json({ success: false, message: error });

    const record = await InternetDetail.findOneAndUpdate(
      { _id: req.params.id, organizationId, isDeleted: false },
      { $set: payload },
      { new: true, runValidators: true }
    );

    if (!record) {
      return res.status(404).json({ success: false, message: "Not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Internet details updated.",
      data: record,
    });
  } catch (error) {
    console.error("updateInternetDetail error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Soft-delete a broadband account
// @route   DELETE /api/v1/internet-details/:id
export const deleteInternetDetail = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res
        .status(401)
        .json({ success: false, message: "Organization ID required" });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }

    const record = await InternetDetail.findOneAndUpdate(
      { _id: req.params.id, organizationId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    );

    if (!record) {
      return res.status(404).json({ success: false, message: "Not found." });
    }

    return res
      .status(200)
      .json({ success: true, message: "Internet details removed." });
  } catch (error) {
    console.error("deleteInternetDetail error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Headline numbers for the page's summary tiles
// @route   GET /api/v1/internet-details/stats
export const getInternetStats = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res
        .status(401)
        .json({ success: false, message: "Organization ID required" });
    }

    const rows = await InternetDetail.find({ organizationId, isDeleted: false })
      .select("providerName amount contractEnd")
      .lean();

    const now = new Date();
    const in60Days = new Date();
    in60Days.setDate(in60Days.getDate() + 60);

    const byProvider = {};
    for (const row of rows) {
      const key = row.providerName || "Unknown";
      byProvider[key] = (byProvider[key] || 0) + 1;
    }

    return res.status(200).json({
      success: true,
      data: {
        totalAccounts: rows.length,
        monthlySpend: rows.reduce((sum, r) => sum + (r.amount || 0), 0),
        providers: Object.keys(byProvider).length,
        byProvider,
        // Contracts already past their end date, and those about to reach it —
        // the two things this sheet is actually consulted for.
        expired: rows.filter((r) => r.contractEnd && new Date(r.contractEnd) < now)
          .length,
        expiringSoon: rows.filter(
          (r) =>
            r.contractEnd &&
            new Date(r.contractEnd) >= now &&
            new Date(r.contractEnd) <= in60Days
        ).length,
      },
      knownProviders: INTERNET_PROVIDERS,
    });
  } catch (error) {
    console.error("getInternetStats error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
