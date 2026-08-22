import mongoose from "mongoose";

// Task priorities and statuses — MUST stay in sync with the constants in
// frontend/src/app/Shared/tasks.js.
export const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

// "Overdue" is stored only if an operator sets it explicitly. It is normally
// DERIVED on read from dueDate (see effectiveStatus in task.controller.js),
// because a stored status goes stale the moment a record sits untouched past
// its due date — the same trap the Compliance model falls into.
// "Done" is the terminal success state (replaces legacy "Completed").
// "Cancelled" is an explicit terminal cancel.
export const TASK_STATUSES = [
  "Not Started",
  "In Progress",
  "Done",
  "Cancelled",
  "Overdue",
];

// A file attached either to the task itself (by the admin) or to one progress
// update (by the assignee). publicId is kept so the upload can be removed from
// Cloudinary later.
const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true, default: "" },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    uploadedByEmail: { type: String, trim: true, default: "" },
  },
  { _id: true }
);

// One entry in the task's progress history. Never edited or removed once
// written — the whole point is that the admin can see how the work moved over
// time, so an update is an append, not a mutation.
const progressSchema = new mongoose.Schema(
  {
    // The status the task was moved to by this update. Stored per entry so the
    // history reads as a timeline of state changes, not just free text.
    status: { type: String, enum: TASK_STATUSES, required: true },
    remark: { type: String, trim: true, default: "" },
    attachments: { type: [attachmentSchema], default: [] },

    // Marks an update the member submitted as a formal completion/update
    // report, as opposed to a routine progress note.
    isReport: { type: Boolean, default: false },

    // Who wrote it. The email and role are denormalised so the history renders
    // without populating a user per entry.
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    authorEmail: { type: String, trim: true, default: "" },
    authorRole: { type: String, trim: true, default: "" },

    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// A team member the task is assigned to. userId drives the permission check;
// email and role are denormalised so the admin list renders without a populate
// per row, matching how Tenancy and Expense already carry display names.
const assigneeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: "OrganizationMember", default: null },
    email: { type: String, trim: true, lowercase: true, default: "" },
    role: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
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

    // The admin who created the task. Only an OWNER can create or assign, so
    // this is always an organization owner.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdByEmail: { type: String, trim: true, default: "" },

    // ============================
    // Task detail
    // ============================
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },

    // One or more team members. An empty array is rejected by the controller —
    // an unassigned task has nobody to do it.
    assignees: { type: [assigneeSchema], default: [] },

    priority: {
      type: String,
      enum: TASK_PRIORITIES,
      default: "Medium",
      index: true,
    },

    status: {
      type: String,
      enum: TASK_STATUSES,
      default: "Not Started",
      index: true,
    },

    // Full datetime (date + time). Time is optional at the UI level but stored
    // on the same Date fields.
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null, index: true },

    // Files the admin attached when setting the work.
    attachments: { type: [attachmentSchema], default: [] },

    // Optional instructions from the admin, separate from the description.
    adminRemarks: { type: String, trim: true, default: "" },

    // Append-only history of status changes and remarks.
    progress: { type: [progressSchema], default: [] },

    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // ============================
    // Soft delete
    // ============================
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// The admin dashboard filters by org and sorts by due date; the member view
// filters by org plus their own userId inside assignees.
taskSchema.index({ organizationId: 1, isDeleted: 1, dueDate: 1 });
taskSchema.index({ organizationId: 1, "assignees.userId": 1, isDeleted: 1 });

export default mongoose.model("Task", taskSchema);