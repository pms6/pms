import mongoose from "mongoose";

// Tenant Chat — direct messages between the property management team and one
// tenant, inside the PMS.
//
// One document per message. A conversation is every message for one tenant in
// one organization, keyed by the tenant's email: a renewal creates a new
// Tenancy record, but it is still the same person and the same conversation,
// so the thread must not reset with it. `tenancyId` records which tenancy was
// current when the message was written.
//
// Messages are only ever between the team and that one tenant — a tenant never
// sees another tenant's thread, and the thread list is staff-only.

export const MESSAGE_SENDERS = ["staff", "tenant"];

// "message" is a normal chat message. "access_notice" is the system entry the
// Access Notices feature drops into the thread when a notice is sent or
// cancelled, so the conversation shows it in context; `relatedId` points at the
// AccessNotice.
export const MESSAGE_KINDS = ["message", "access_notice"];

// A ceiling, not a target: long enough for a full explanation, short enough
// that a pasted document can't bloat the collection.
export const MESSAGE_MAX_LENGTH = 4000;

const tenantMessageSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    // The conversation key — see the note above.
    tenantEmail: { type: String, trim: true, lowercase: true, required: true },

    tenancyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenancy",
      default: null,
    },

    // Denormalised so the thread list renders without a join.
    tenantName: { type: String, trim: true, default: "" },
    property: { type: String, trim: true, default: "" },
    room: { type: String, trim: true, default: "" },

    sender: { type: String, enum: MESSAGE_SENDERS, required: true },
    senderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Shown above the bubble: the staff member's name/email, or the tenant's.
    senderName: { type: String, trim: true, default: "" },

    kind: { type: String, enum: MESSAGE_KINDS, default: "message" },
    relatedId: { type: mongoose.Schema.Types.ObjectId, default: null },

    body: {
      type: String,
      trim: true,
      required: true,
      maxlength: MESSAGE_MAX_LENGTH,
    },

    // Read state for each side. A message is "unread" for the side that did
    // not send it until that side opens the thread.
    readByTenantAt: { type: Date, default: null },
    readByStaffAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// A thread in order, and "unread from the tenant" for the staff list.
tenantMessageSchema.index({ organizationId: 1, tenantEmail: 1, createdAt: 1 });
tenantMessageSchema.index({ organizationId: 1, sender: 1, readByStaffAt: 1 });

export default mongoose.model("TenantMessage", tenantMessageSchema);
