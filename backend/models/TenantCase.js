import mongoose from "mongoose";
import { attachmentSchema } from "../utils/attachments.js";

// A tenant case — one issue with one tenant (a complaint, a dispute over the
// deposit, repeated late rent, noise), tracked from report to close with its
// own notes, evidence and assignee.
//
// A case does not copy the records around it. Maintenance jobs, Email Records
// conversations and invoices stay where they are and the case links to them by
// id, so each of those still has exactly one home and the tenant's timeline
// shows each thing once.
//
// Statuses and categories MUST stay in sync with CASE_STATUSES /
// CASE_CATEGORIES in frontend/src/app/utils/tenantCases.js.
export const CASE_STATUSES = ["Open", "In Progress", "Pending", "Resolved", "Closed"];
export const CASE_DONE_STATUSES = ["Resolved", "Closed"];

export const CASE_CATEGORIES = [
  "Complaint",
  "Maintenance",
  "Rent / Payment",
  "Deposit",
  "Notice",
  "Anti-social Behaviour",
  "Tenancy",
  "Other",
];

export const CASE_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

// One entry in the case's history. Append-only: the point of the log is that
// nothing said or decided on the case can be quietly rewritten later.
//   note        — a staff note, optionally with evidence attached
//   status      — the case moved to `status`
//   assignment  — the case was handed to someone
//   link        — a maintenance job / email record / invoice was linked
//   created     — the case was opened
const activitySchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["note", "status", "assignment", "link", "created", "edit"],
      default: "note",
    },
    text: { type: String, trim: true, default: "" },
    status: { type: String, enum: [...CASE_STATUSES, null], default: null },
    files: { type: [attachmentSchema], default: [] },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    authorEmail: { type: String, trim: true, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const tenantCaseSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByEmail: { type: String, trim: true, default: "" },

    // "CASE-000012" — per organisation, from the Counter model.
    ref: { type: String, trim: true, required: true },

    title: { type: String, trim: true, required: true },
    description: { type: String, trim: true, default: "" },
    category: { type: String, enum: CASE_CATEGORIES, default: "Other", index: true },
    priority: { type: String, enum: CASE_PRIORITIES, default: "Medium" },
    status: { type: String, enum: CASE_STATUSES, default: "Open", index: true },

    // The tenant, keyed on the tenancy like the tenant directory and Email
    // Records, with the name copied in so the case survives the tenancy ending.
    tenancyId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenancy", required: true, index: true },
    tenantName: { type: String, trim: true, default: "" },
    tenantEmail: { type: String, trim: true, lowercase: true, default: "" },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property", default: null, index: true },
    property: { type: String, trim: true, default: "" },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null },
    room: { type: String, trim: true, default: "" },

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    assignedToEmail: { type: String, trim: true, default: "" },

    // Evidence attached to the case itself; notes carry their own.
    files: { type: [attachmentSchema], default: [] },

    // Links to the records this case is about.
    maintenanceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Maintenance" }],
    emailRecordIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "EmailRecord" }],

    activity: { type: [activitySchema], default: [] },

    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },

    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

tenantCaseSchema.index({ organizationId: 1, isDeleted: 1, updatedAt: -1 });
tenantCaseSchema.index({ organizationId: 1, ref: 1 }, { unique: true });

export default mongoose.model("TenantCase", tenantCaseSchema);
