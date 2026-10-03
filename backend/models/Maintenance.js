import mongoose from "mongoose";

// Maintenance request priority / status vocabularies — MUST stay in sync with
// PRIORITY_TONE / STATUS_TONE / STATUSES in
// frontend/src/app/admin/maintenance/page.js.
export const MAINTENANCE_PRIORITIES = ["urgent", "high", "med", "low"];

// The picker offers "pending", "assigned", "in_progress", "awaiting_response",
// "on_hold" and "sorted" (see STATUSES in
// frontend/src/app/Shared/MaintenanceBooklet.js).
// "open" and "closed" were retired from the vocabulary but stay in the enum so
// rows saved under the old scheme keep validating on edit.
// Moving an entry to "awaiting_response" alerts every admin (see
// notifyAwaitingResponse in maintenance.controller.js).
export const MAINTENANCE_STATUSES = [
  "pending",
  "open",
  "assigned",
  "in_progress",
  "awaiting_response",
  "on_hold",
  "sorted",
  "closed",
];

// Anything not in this list still counts as outstanding work. "closed" stays
// here so a legacy row still reads as resolved.
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
    // Which half of the job the attachment shows. "" is an attachment saved
    // before the booklet asked the question, so it belongs to neither.
    stage: { type: String, enum: ["before", "after", ""], default: "" },
    format: { type: String, trim: true, default: "" },
    bytes: { type: Number, default: 0 },
  },
  { _id: false }
);

// One message in the entry's discussion. Append-only, like a task's history —
// the point is a complete record of what was asked and answered on the job.
// Staff-only: it is stripped from anything a tenant reads.
const commentSchema = new mongoose.Schema(
  {
    text: { type: String, trim: true, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    authorEmail: { type: String, trim: true, default: "" },
    authorRole: { type: String, trim: true, default: "" },
    createdAt: { type: Date, default: Date.now },
    // Set when the author corrected their own comment.
    editedAt: { type: Date, default: null },
  },
  { _id: true }
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

    // The tenant the job concerns, when there is one — set automatically when
    // a tenant reports it from their portal, or picked by staff. It is what
    // puts the job on that tenant's timeline and lets a Tenant Case link it.
    tenancyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenancy",
      default: null,
      index: true,
    },

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

    // The office's discussion on this entry — updates, questions and answers.
    comments: { type: [commentSchema], default: [] },

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
