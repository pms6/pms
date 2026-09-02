import mongoose from "mongoose";

// Compliance document types — MUST stay in sync with CATEGORIES in
// frontend/src/app/admin/compliance/page.js and manager/compliance/page.js.
export const COMPLIANCE_TYPES = [
  "Carbon Monoxide Check",
  "EICR",
  "EPC",
  "Fire Safety",
  "Floor Plan",
  "Gas Safety",
  "HMO Licence",
  "PAT",
  "Smoke Detector Test",
];

// Types that never expire. A floor plan is a record of the building, not a
// test with a result that goes stale — it changes when the building does, and
// giving it a made-up expiry date would put a red "expired" badge on a drawing
// that is still perfectly accurate. So carriedOut and expiryDate are optional
// for these, the status is always valid, and the reminder job skips them
// (its query selects on expiryDate, which they do not have).
export const NON_EXPIRING_TYPES = ["Floor Plan"];

const expires = (type) => !NON_EXPIRING_TYPES.includes(type);

// An attached file. Any type is accepted: the evidence for a compliance item is
// whatever the engineer, surveyor or architect actually issued — a PDF
// certificate, a scanned image, a CAD export, a zip of drawings — and a format
// whitelist here would only keep the real document out of the register.
const fileSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    url: { type: String, trim: true, required: true },
    // Kept so the file can be removed from Cloudinary later.
    publicId: { type: String, trim: true, default: "" },
    // Stored so the UI can label and size an attachment without fetching it.
    format: { type: String, trim: true, default: "" },
    bytes: { type: Number, default: 0, min: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const complianceSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },

    type: {
      type: String,
      required: true,
      enum: COMPLIANCE_TYPES,
    },

    subType: {
      type: String,
      trim: true,
    },

    carriedOut: {
      type: Date,
      // Required for anything with an expiry, since the expiry is derived from
      // it. A floor plan has no "carried out" date worth insisting on.
      required: function () {
        return expires(this.type);
      },
    },

    validityMonths: {
      type: Number,
      default: 3,
      min: 1,
    },

    expiryDate: {
      type: Date,
      required: function () {
        return expires(this.type);
      },
      index: true,
    },

    reminderDaysBefore: {
      type: Number,
      default: 14,
      min: 1,
      max: 365,
    },

    autoReminder: {
      type: Boolean,
      default: true,
    },

    // Set when a reminder goes out, so the daily job emails once per reminder
    // window rather than every morning until the certificate expires. Mirrors
    // Property.contract.lastReminderSentAt.
    lastReminderSentAt: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
    },

    // Every file attached to this record, of any type. A floor plan is rarely
    // one drawing and a certificate often arrives with its schedule of works,
    // so this is a list rather than the single attachment it started as.
    files: [fileSchema],

    // The first attachment, mirrored out of `files` by the pre-save hook below.
    //
    // These two predate `files` and are still what the reminder email, the
    // tenant's own compliance page and the certificate viewer read. Keeping
    // them in step means multiple attachments did not have to be threaded
    // through all of that at once, and records written before `files` existed
    // keep working — the hook seeds `files` from them on the next save.
    fileUrl: {
      type: String,
    },

    fileName: {
      type: String,
    },

    status: {
      type: String,
      enum: ["valid", "warning", "expired"],
      default: "valid",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Keep the legacy single-attachment fields in step with `files`, and compute
// the status.
complianceSchema.pre("save", function (next) {
  // A record created before `files` existed has fileUrl but no list. Seed the
  // list from it so the two never disagree about what is attached.
  if ((!this.files || this.files.length === 0) && this.fileUrl) {
    this.files = [{ url: this.fileUrl, name: this.fileName || "" }];
  }

  // Mirror the first attachment outwards for the reminder email, the tenant
  // page and the viewer, all of which still read fileUrl/fileName.
  if (this.files && this.files.length) {
    this.fileUrl = this.files[0].url;
    this.fileName = this.files[0].name || "";
  } else {
    this.fileUrl = undefined;
    this.fileName = undefined;
  }

  // A type with no expiry is always valid — there is no date to be past.
  if (!this.expiryDate) {
    this.status = "valid";
    return next();
  }

  const now = new Date();
  const expiry = new Date(this.expiryDate);
  const warningDate = new Date(expiry);
  warningDate.setDate(warningDate.getDate() - (this.reminderDaysBefore || 14));

  if (now > expiry) this.status = "expired";
  else if (now >= warningDate) this.status = "warning";
  else this.status = "valid";

  next();
});

complianceSchema.index({ organizationId: 1, propertyId: 1 });
complianceSchema.index({ expiryDate: 1, status: 1 });

export default mongoose.model("Compliance", complianceSchema);