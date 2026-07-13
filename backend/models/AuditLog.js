// models/AuditLog.js
import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrganizationMember",
    },

    category: {
      type: String,
      required: true,
      enum: [
        "Organisation Note",
        "User Management",
        "Property Update",
        "Tenant Action",
        "Financial",
        "System",
        "Task",           // ← New
      ],
    },

    action: {
      type: String,
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    description: String,

    // === TASK SPECIFIC FIELDS ===
    isTask: {
      type: Boolean,
      default: false,
    },
    dueDate: Date,
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrganizationMember",
    },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "CANCELLED"],
      default: "PENDING",
    },
    completedAt: Date,
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    ipAddress: String,
    userAgent: String,
  },
  { 
    timestamps: true 
  }
);

// Indexes
auditLogSchema.index({ organizationId: 1, createdAt: -1 });
auditLogSchema.index({ organizationId: 1, isTask: 1, status: 1 });
auditLogSchema.index({ assignedTo: 1, dueDate: 1 });

export default mongoose.model("AuditLog", auditLogSchema);