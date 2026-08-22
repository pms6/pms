// controllers/expense.controller.js
import Expense, { EXPENSE_CATEGORIES } from "../models/Expense.js";
import Property from "../models/Property.js";

/**
 * Whitelist of fields a client may set on create/update.
 */
const EDITABLE_KEYS = [
  "date",
  "amount",
  "category",
  "description",
  "propertyId",
  "supplierId",
  "supplier",
  "paymentMethod",
  "reference",
  "notes",
  "fileUrl",
  "fileName",
];

const pickPayload = (body) => {
  const payload = {};
  for (const key of EDITABLE_KEYS) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  return payload;
};

// How far back the year filter reaches. The frontend offers the same span.
const YEAR_SPAN = 6;

const currentYear = () => new Date().getFullYear();

// Start of `year` to start of `year + 1`, so the range covers the whole year
// without depending on month lengths.
const yearRange = (year) => ({
  $gte: new Date(Date.UTC(year, 0, 1)),
  $lt: new Date(Date.UTC(year + 1, 0, 1)),
});

// Resolve and denormalise the property name so the sheet needn't populate.
const attachProperty = async (payload, organizationId) => {
  if (payload.propertyId) {
    const property = await Property.findOne({ _id: payload.propertyId, organizationId })
      .select("name")
      .lean();
    if (!property) {
      return { error: "Property not found." };
    }
    payload.property = property.name;
  } else if (payload.propertyId === null || payload.propertyId === "") {
    payload.propertyId = null;
    payload.property = "";
  }
  return {};
};

// @desc    List expenses, optionally filtered by year / month / property / category
// @route   GET /api/v1/expenses
export const getExpenses = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const { year, month, propertyId, category, search } = req.query;

    const filter = { organizationId, isDeleted: false };

    if (year) {
      const y = Number(year);
      if (!Number.isInteger(y)) {
        return res.status(400).json({ success: false, message: "year must be a number." });
      }

      if (month) {
        // month is 1-12 as it appears in the UI.
        const m = Number(month);
        if (!Number.isInteger(m) || m < 1 || m > 12) {
          return res.status(400).json({ success: false, message: "month must be 1-12." });
        }
        filter.date = {
          $gte: new Date(Date.UTC(y, m - 1, 1)),
          $lt: new Date(Date.UTC(y, m, 1)),
        };
      } else {
        filter.date = yearRange(y);
      }
    }

    if (propertyId) filter.propertyId = propertyId;
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: "i" } },
        { supplier: { $regex: search, $options: "i" } },
        { reference: { $regex: search, $options: "i" } },
      ];
    }

    // createdBy is populated so the detail view can name who recorded the
    // expense — it is the one field on the record that is otherwise an opaque
    // ObjectId. Property and supplier stay denormalised strings, as the model
    // intends. This is one extra $in query for the whole list, not one per row.
    const expenses = await Expense.find(filter)
      .populate("createdBy", "email")
      .sort({ date: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      total: expenses.length,
      totalAmount: expenses.reduce((sum, e) => sum + (e.amount || 0), 0),
      data: expenses,
    });
  } catch (error) {
    console.error("Get Expenses Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch expenses." });
  }
};

// @desc    Monthly expense sheet for one year — 12 rows plus category totals.
// @route   GET /api/v1/expenses/monthly?year=2026
//
// Returns every month whether or not it has spend, so the sheet renders a full
// year without the client having to fill gaps.
export const getMonthlyExpenses = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const year = Number(req.query.year) || currentYear();
    if (!Number.isInteger(year)) {
      return res.status(400).json({ success: false, message: "year must be a number." });
    }

    const filter = { organizationId, isDeleted: false, date: yearRange(year) };
    if (req.query.propertyId) filter.propertyId = req.query.propertyId;
    if (req.query.category) filter.category = req.query.category;

    const expenses = await Expense.find(filter).select("date amount category").lean();

    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      total: 0,
      count: 0,
      byCategory: {},
    }));

    const byCategory = {};

    for (const e of expenses) {
      // getUTCMonth to match how the range above was built.
      const idx = new Date(e.date).getUTCMonth();
      const amount = e.amount || 0;
      const cat = e.category || "Other";

      months[idx].total += amount;
      months[idx].count += 1;
      months[idx].byCategory[cat] = (months[idx].byCategory[cat] || 0) + amount;

      byCategory[cat] = (byCategory[cat] || 0) + amount;
    }

    const total = months.reduce((sum, m) => sum + m.total, 0);

    return res.status(200).json({
      success: true,
      year,
      // The years the filter should offer, newest first.
      availableYears: Array.from({ length: YEAR_SPAN }, (_, i) => currentYear() - i),
      total,
      count: expenses.length,
      months,
      byCategory,
    });
  } catch (error) {
    console.error("Get Monthly Expenses Error:", error);
    return res.status(500).json({ success: false, message: "Failed to build the expense sheet." });
  }
};

// @desc    Create an expense
// @route   POST /api/v1/expenses
export const createExpense = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const payload = pickPayload(req.body);

    if (!payload.date) {
      return res.status(400).json({ success: false, message: "A date is required." });
    }
    if (payload.amount === undefined || payload.amount === null || payload.amount === "") {
      return res.status(400).json({ success: false, message: "An amount is required." });
    }

    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return res
        .status(400)
        .json({ success: false, message: "Amount must be a positive number." });
    }
    payload.amount = amount;

    if (payload.category && !EXPENSE_CATEGORIES.includes(payload.category)) {
      return res.status(400).json({ success: false, message: "Unknown expense category." });
    }

    const { error } = await attachProperty(payload, organizationId);
    if (error) return res.status(404).json({ success: false, message: error });

    const expense = await Expense.create({
      ...payload,
      organizationId,
      createdBy: req.user._id,
    });

    return res.status(201).json({ success: true, data: expense });
  } catch (error) {
    console.error("Create Expense Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to create the expense." });
  }
};

// @desc    Update an expense
// @route   PUT /api/v1/expenses/:id
export const updateExpense = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const payload = pickPayload(req.body);

    if (payload.amount !== undefined) {
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        return res
          .status(400)
          .json({ success: false, message: "Amount must be a positive number." });
      }
      payload.amount = amount;
    }

    if (payload.category && !EXPENSE_CATEGORIES.includes(payload.category)) {
      return res.status(400).json({ success: false, message: "Unknown expense category." });
    }

    const { error } = await attachProperty(payload, organizationId);
    if (error) return res.status(404).json({ success: false, message: error });

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, organizationId, isDeleted: false },
      { $set: payload },
      { new: true, runValidators: true }
    );

    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found." });
    }

    return res.status(200).json({ success: true, data: expense });
  } catch (error) {
    console.error("Update Expense Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update the expense." });
  }
};

// @desc    Delete an expense (soft delete)
// @route   DELETE /api/v1/expenses/:id
export const deleteExpense = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, organizationId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    );

    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found." });
    }

    return res.status(200).json({ success: true, message: "Expense deleted." });
  } catch (error) {
    console.error("Delete Expense Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete the expense." });
  }
};
