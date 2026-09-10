import mongoose from "mongoose";

// The office's two credential sheets, kept as one register with two shapes:
//
//   ACCOUNT  — "Company Accounts [TMH LTD]": a login the company holds, with
//              the domain it belongs to and that domain's renewal date.
//   KEYSAFE  — "Keysafe Codes": the key-safe and digital-lock codes for a
//              property, and where the lock is.
//
// One collection, one section in the app, but each `type` has its own form and
// its own columns.
// MUST stay in sync with PASSWORD_TYPES in
// frontend/src/app/Shared/CompanyPasswordsBoard.js.
export const PASSWORD_TYPES = ["ACCOUNT", "KEYSAFE"];

// A photo or clip of the key-safe itself — where the box is on the wall, which
// way the dial turns, what the door looks like. Uploaded straight to Cloudinary
// by the browser, so only the delivery URL reaches us.
// Same shape as the maintenance booklet's media, so the shared uploader and
// viewer on the frontend work here without reshaping.
const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, required: true },
    publicId: { type: String, trim: true, default: "" },
    name: { type: String, trim: true, default: "" },
    type: { type: String, enum: ["image", "video", "pdf"], default: "image" },
    format: { type: String, trim: true, default: "" },
    bytes: { type: Number, default: 0 },
  },
  { _id: false }
);

const companyPasswordSchema = new mongoose.Schema(
  {
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

    type: {
      type: String,
      enum: PASSWORD_TYPES,
      required: true,
      index: true,
    },

    // ---- ACCOUNT ---------------------------------------------------------
    accountName: { type: String, trim: true, default: "" }, // "Accounts"
    userId: { type: String, trim: true, default: "" }, // "User ID/Email"
    domain: { type: String, trim: true, default: "" },
    domainDueDate: { type: Date, default: null }, // "Due date of domains"
    site: { type: String, trim: true, default: "" },

    // ---- KEYSAFE --------------------------------------------------------
    // Optional link to the property record; the sheet is written as a plain
    // address and rows exist for addresses not yet in the portfolio.
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
      index: true,
    },
    property: { type: String, trim: true, default: "" },
    keysCode: { type: String, default: "" }, // key-safe combination
    digitalLockCode: { type: String, default: "" },
    lockLocation: { type: String, trim: true, default: "" },
    // Photos / videos of the key-safe and its location.
    media: { type: [mediaSchema], default: [] },

    // ---- shared -------------------------------------------------------
    password: { type: String, default: "" }, // the ACCOUNT password
    notes: { type: String, trim: true, default: "" },

    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

companyPasswordSchema.index({ organizationId: 1, type: 1, isDeleted: 1 });

export default mongoose.model("CompanyPassword", companyPasswordSchema);
