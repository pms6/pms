import mongoose from "mongoose";

// Access Notices — the formal notice a landlord/agent gives a tenant before
// entering the property: when, during what window, why, and anything the
// tenant needs to know or do. Every notice is kept as a record of having given
// it — who sent it, when, whether the email went out, and whether the tenant
// acknowledged it — which is the evidence needed if access is ever disputed.
//
// One notice per tenant. A whole-house visit is sent as one notice to each
// occupier, so each tenant's acknowledgement is tracked on its own.
//
// MUST stay in sync with ACCESS_REASONS in
// frontend/src/app/Shared/AccessNoticesBoard.js.
export const ACCESS_REASONS = [
  "Repairs / Maintenance",
  "Inspection",
  "Gas Safety Check",
  "Electrical Safety Check",
  "Fire Safety Check",
  "Viewing",
  "Cleaning",
  "Pest Control",
  "Meter Reading",
  "Other",
];

export const ACCESS_NOTICE_STATUSES = ["sent", "cancelled"];

// Whether the notice email reached the mail server. "failed" keeps the record
// (it was still issued in the portal) but tells the office to chase it.
export const ACCESS_EMAIL_STATUSES = ["sent", "failed", "skipped"];

const accessNoticeSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    // Who the notice is for. The tenant's email is what the tenant portal
    // looks it up by, as everywhere else tenant-facing.
    tenancyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenancy",
      default: null,
      index: true,
    },
    tenantEmail: { type: String, trim: true, lowercase: true, default: "", index: true },
    tenantName: { type: String, trim: true, default: "" },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },
    property: { type: String, trim: true, default: "" },
    room: { type: String, trim: true, default: "" },

    // When: the day, and the window ("HH:MM" 24h, Europe/London as entered).
    accessDate: { type: Date, required: true },
    windowStart: { type: String, trim: true, required: true },
    windowEnd: { type: String, trim: true, required: true },

    // Why.
    reason: { type: String, enum: ACCESS_REASONS, required: true },
    reasonDetail: { type: String, trim: true, default: "", maxlength: 1000 },

    // Anything the tenant should know or do — "please clear the area under
    // the sink", "the contractor will call 30 minutes before".
    instructions: { type: String, trim: true, default: "", maxlength: 4000 },

    // Who is attending (a contractor, an inspector) — optional.
    attendee: { type: String, trim: true, default: "" },

    // The record of sending.
    status: { type: String, enum: ACCESS_NOTICE_STATUSES, default: "sent" },
    sentAt: { type: Date, default: Date.now },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    sentByEmail: { type: String, trim: true, default: "" },
    // Hours between sending and the start of the window — kept so the record
    // shows how much notice was actually given, even after edits elsewhere.
    noticeHours: { type: Number, default: null },

    emailStatus: { type: String, enum: ACCESS_EMAIL_STATUSES, default: "skipped" },
    emailError: { type: String, trim: true, default: "" },
    emailedTo: { type: String, trim: true, default: "" },
    // Every time the email was (re)sent.
    emailLog: {
      type: [
        new mongoose.Schema(
          {
            at: { type: Date, default: Date.now },
            to: { type: String, trim: true, default: "" },
            ok: { type: Boolean, default: false },
            error: { type: String, trim: true, default: "" },
            kind: { type: String, trim: true, default: "notice" }, // notice | resend | cancellation
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    // The tenant's side: first opened in the portal, and acknowledged.
    viewedAt: { type: Date, default: null },
    acknowledgedAt: { type: Date, default: null },

    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancelReason: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

accessNoticeSchema.index({ organizationId: 1, accessDate: -1 });

export default mongoose.model("AccessNotice", accessNoticeSchema);
