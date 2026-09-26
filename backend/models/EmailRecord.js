import mongoose from "mongoose";
import { attachmentSchema } from "../utils/attachments.js";

// The office's "Email Records" sheet — the property-management communication
// log: which of the company mailboxes an email went to or came from, the
// property it is about, what the issue is, whether it has been answered and
// when it next needs chasing.
//
// The sheet's "Sr#" column is the row number and is not stored.

// The three registered company mailboxes. "Email To" / "Email From" offer
// these as a dropdown, but also accept any other address, because one side
// of most emails is a tenant, contractor or council rather than us.
export const EMAIL_ACCOUNTS = [
  { email: "info@roomflog.co.uk", purpose: "General property and management correspondence" },
  { email: "tmhours@gmail.com", purpose: "TM Hours / general correspondence" },
  { email: "maintenancetmh@gmail.com", purpose: "Maintenance and repair correspondence" },
];

export const EMAIL_STATUSES = [
  "Open",
  "Awaiting Reply",
  "Follow-Up Required",
  "Resolved",
  "Closed",
];

// Statuses that end the chase — no reminders or escalation once here.
export const DONE_STATUSES = ["Resolved", "Closed"];

export const EMAIL_CATEGORIES = [
  "Maintenance",
  "Tenant Issue",
  "Inspection",
  "Compliance",
  "Contractor",
  "Payment",
  "Notice",
  "General",
];

export const EMAIL_PRIORITIES = ["Low", "Medium", "High", "Urgent"];

// How the communication happened. The record itself is usually an email, but
// calls and texts about the same issue are logged against it too.
export const CHANNELS = ["Email", "Call", "Text", "WhatsApp", "Note"];

// "" = only logged, never emailed from here.
export const DELIVERY_STATUSES = ["", "Sent", "Failed"];

// Delivery of a message the system emailed itself. Shared by the record (its
// original email) and each thread entry.
const deliveryFields = () => ({
  emailStatus: { type: String, enum: DELIVERY_STATUSES, default: "" },
  emailSentAt: { type: Date, default: null },
  emailError: { type: String, trim: true, default: "" },
  emailMessageId: { type: String, trim: true, default: "" },
});

// One step in the conversation after the original email — a reply, a chase,
// a phone call, a WhatsApp message — kept together as one history.
const historyEntrySchema = new mongoose.Schema(
  {
    channel: { type: String, enum: CHANNELS, default: "Email" },
    direction: { type: String, enum: ["Incoming", "Outgoing", "Internal"], default: "Outgoing" },
    date: { type: Date, default: Date.now },
    from: { type: String, trim: true, default: "" },
    to: { type: String, trim: true, default: "" },
    summary: { type: String, trim: true, required: true },
    // Screenshots, the tenant's photos, PDFs sent in the conversation.
    files: { type: [attachmentSchema], default: [] },
    // Counts this step as the follow-up / the reply on the parent record.
    isFollowUp: { type: Boolean, default: false },
    isReply: { type: Boolean, default: false },
    // Written by the system rather than typed in — a reply or status change
    // made on the record itself, copied into the thread so nothing is lost.
    auto: { type: Boolean, default: false },
    // Set when the message was actually emailed from the system, not just
    // logged: whether it went, when, and why not if it failed.
    ...deliveryFields(),
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByEmail: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

const emailRecordSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // Optional link to the property record, plus the address as written.
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
      index: true,
    },
    property: { type: String, trim: true, required: true },

    // The tenant the conversation is with, when it is with a tenant. Keyed on
    // the tenancy (the tenant directory's key) with the name and email copied
    // in, so the tenant's chat history survives the tenancy ending or being
    // deleted.
    tenancyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenancy",
      default: null,
      index: true,
    },
    tenantName: { type: String, trim: true, default: "" },
    tenantEmail: { type: String, trim: true, lowercase: true, default: "" },

    // "Date" on the sheet — when the email was sent or received.
    date: { type: Date, required: true, index: true },

    channel: { type: String, enum: CHANNELS, default: "Email" },
    emailTo: { type: String, trim: true, default: "" },
    emailFrom: { type: String, trim: true, default: "" },
    subject: { type: String, trim: true, default: "" },

    // "Issue" on the sheet.
    issue: { type: String, trim: true, required: true },
    category: { type: String, enum: EMAIL_CATEGORIES, default: "General", index: true },
    priority: { type: String, enum: EMAIL_PRIORITIES, default: "Medium", index: true },
    status: { type: String, enum: EMAIL_STATUSES, default: "Open", index: true },

    // "Reply" on the sheet.
    replyReceived: { type: Boolean, default: false },
    replyDate: { type: Date, default: null },
    replySummary: { type: String, trim: true, default: "" },

    // "Follow Up" on the sheet — the date it next needs chasing, and a note.
    followUpDate: { type: Date, default: null, index: true },
    followUpNotes: { type: String, trim: true, default: "" },
    lastFollowUpAt: { type: Date, default: null },

    // Staff member responsible for the next step.
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    assignedToEmail: { type: String, trim: true, default: "" },

    files: { type: [attachmentSchema], default: [] },
    history: { type: [historyEntrySchema], default: [] },

    // Set when the original email was sent from the system.
    ...deliveryFields(),

    // Set by the daily sweep. `reminderSentFor` is the follow-up date the last
    // reminder was about, so a changed follow-up date gets its own reminder.
    reminderSentFor: { type: Date, default: null },
    escalated: { type: Boolean, default: false, index: true },
    escalatedAt: { type: Date, default: null },

    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },

    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

emailRecordSchema.index({ organizationId: 1, isDeleted: 1, date: -1 });
emailRecordSchema.index({ isDeleted: 1, status: 1, followUpDate: 1 });
// The inbox reader matches replies to sent mail, and skips mail it has
// already filed, by Message-ID.
emailRecordSchema.index({ emailMessageId: 1 });
emailRecordSchema.index({ "history.emailMessageId": 1 });

export default mongoose.model("EmailRecord", emailRecordSchema);
