import mongoose from "mongoose";

// Expense categories — MUST stay in sync with EXPENSE_CATEGORIES in
// frontend/src/app/admin/expenses/page.js.
export const EXPENSE_CATEGORIES = [
  "Maintenance",
  "Repairs",
  "Cleaning",
  "Utilities",
  "Insurance",
  "Council Tax",
  "Mortgage",
  "Management Fee",
  "Letting Fee",
  "Compliance",
  "Furnishings",
  "Legal & Professional",
  "Marketing",
  "Other",
];

const expenseSchema = new mongoose.Schema(
  {
    // ============================
    // SaaS Relationships
    // ============================
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // ============================
    // Expense detail
    // ============================
    // The date the money went out. Everything on the monthly sheet is grouped
    // by this, so it is required and indexed.
    date: {
      type: Date,
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    category: {
      type: String,
      enum: EXPENSE_CATEGORIES,
      default: "Other",
      index: true,
    },

    description: { type: String, trim: true, default: "" },

    // Optional links. The denormalised names keep the sheet cheap to render
    // without populating on every row.
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
      index: true,
    },
    property: { type: String, trim: true, default: "" },

    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
    },
    supplier: { type: String, trim: true, default: "" },

    paymentMethod: {
      type: String,
      enum: ["", "Bank Transfer", "Card", "Cash", "Direct Debit", "Cheque"],
      default: "",
    },

    reference: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },

    // Receipt / invoice file.
    fileUrl: { type: String, default: "" },
    fileName: { type: String, default: "" },

    // ============================
    // Soft delete
    // ============================
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// The monthly sheet always filters by org + date range, often by property.
expenseSchema.index({ organizationId: 1, date: -1 });
expenseSchema.index({ organizationId: 1, propertyId: 1, date: -1 });

export default mongoose.model("Expense", expenseSchema);
