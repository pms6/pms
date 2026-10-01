// models/Organization.js
import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    type: {
      type: String,
      enum: ["AGENCY", "LANDLORD"],
    },

    businessType: {
      type: String,
      enum: ["BUSINESS", "INDIVIDUAL"],
    },

    name: String,
    legalName: String,
    phone: String,
    address: String,
    logo: String,

    units: Number,
    planType: {
      type: String,
      enum: ["MONTHLY", "ANNUAL"],
    },

    fastTrack: Boolean,

    // Company and payment details printed on invoices and on the cover of
    // inventory reports. Name, address, phone and logo come from the fields
    // above; these are the extras an invoice needs. Edited in Settings.
    invoiceSettings: {
      prefix: { type: String, trim: true, default: "INV-" },
      email: { type: String, trim: true, default: "" },
      website: { type: String, trim: true, default: "" },
      vatNumber: { type: String, trim: true, default: "" },
      companyNumber: { type: String, trim: true, default: "" },
      defaultVatRate: { type: Number, default: 0, min: 0, max: 100 },
      paymentTermsDays: { type: Number, default: 14, min: 0 },
      bankName: { type: String, trim: true, default: "" },
      accountName: { type: String, trim: true, default: "" },
      sortCode: { type: String, trim: true, default: "" },
      accountNumber: { type: String, trim: true, default: "" },
      iban: { type: String, trim: true, default: "" },
      swift: { type: String, trim: true, default: "" },
      paymentInstructions: { type: String, trim: true, default: "" },
      footer: { type: String, trim: true, default: "" },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Organization", organizationSchema);