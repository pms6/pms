import mongoose from "mongoose";

// Maintenance request priority / status vocabularies — MUST stay in sync with
// PRIORITY_TONE / STATUS_TONE / STATUSES in
// frontend/src/app/admin/maintenance/page.js.
export const MAINTENANCE_PRIORITIES = ["urgent", "high", "med", "low"];

// "pending" and "sorted" mirror the Maintenance Booklet sheet; the other three
// are the finer-grained lifecycle the app already recorded, kept so existing
// rows keep validating.
export const MAINTENANCE_STATUSES = [
  "pending",
  "open",
  "assigned",
  "in_progress",
  "sorted",
  "closed",
];

// Anything not in this list still counts as outstanding work.
export const MAINTENANCE_RESOLVED_STATUSES = ["sorted", "closed"];

// One numbered step of the "Solution" column, e.g.
// { title: "Property Inspection", detail: "Kamran inspected the property…" }.
const solutionStepSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: "" },
    detail: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

// A photo or video of the issue / the completed work. Uploaded straight to
// Cloudinary by the browser, so only the delivery URL reaches us.
const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, required: true },
    publicId: { type: String, trim: true, default: "" },
    name: { type: String, trim: true, default: "" },
    // "pdf" covers documents attached to an entry — a quote, an invoice, a
    // contractor's report — which Cloudinary stores as an `image` resource.
    type: { type: String, enum: ["image", "video", "pdf"], default: "image" },
    format: { type: String, trim: true, default: "" },
    bytes: { type: Number, default: 0 },
  },
  { _id: false }
);

const maintenanceSchema = new mongoose.Schema(
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

    // Human-friendly reference, e.g. "MR-1042". Generated on create.
    ref: { type: String, trim: true, index: true },

    // The booklet's "Sr#" column — a per-organisation running number.
    srNo: { type: Number, default: null, index: true },

    // ============================
    // Request detail
    // ============================
    // The booklet's "Issue" column.
    title: { type: String, trim: true, required: true },
    description: { type: String, trim: true, default: "" },
    category: { type: String, trim: true, default: "General" },

    // Optional links back to source records; denormalised names keep the card
    // list cheap to render.
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },
    property: { type: String, trim: true, default: "" },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
    },
    room: { type: String, trim: true, default: "" },

    reportedBy: { type: String, trim: true, default: "" },

    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
    },
    supplier: { type: String, trim: true, default: "" },

    priority: {
      type: String,
      enum: MAINTENANCE_PRIORITIES,
      default: "med",
    },
    status: {
      type: String,
      enum: MAINTENANCE_STATUSES,
      default: "pending",
    },

    // ============================
    // Solution ("what we did") — the booklet's widest column: a procedure
    // heading followed by the numbered steps taken to resolve the issue.
    // ============================
    solutionTitle: { type: String, trim: true, default: "" },
    solutionSteps: { type: [solutionStepSchema], default: [] },

    // null until quoted / invoiced.
    cost: { type: Number, default: null },

    date: { type: Date, default: Date.now },

    // Photos and videos of the issue and the work done.
    media: { type: [mediaSchema], default: [] },

    // Legacy single cover photo, kept so records written before `media` (and
    // the tenant report form, which posts one photo) keep rendering. The
    // controller mirrors the first image of `media` into it.
    image: { type: String, trim: true, default: "" },

    // ============================
    // Soft delete
    // ============================
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

maintenanceSchema.index({ organizationId: 1, isDeleted: 1 });

export default mongoose.model("Maintenance", maintenanceSchema);
