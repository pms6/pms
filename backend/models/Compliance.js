import mongoose from "mongoose";

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
      enum: [
        "Carbon Monoxide Check",
        "EICR",
        "EPC",
        "Fire Safety",
        "Gas Safety",
        "HMO Licence",
        "PAT",
        "Smoke Detector Test",
      ],
    },

    subType: {
      type: String,
      trim: true,
    },

    carriedOut: {
      type: Date,
      required: true,
    },

    validityMonths: {
      type: Number,
      default: 3,
      min: 1,
    },

    expiryDate: {
      type: Date,
      required: true,
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

    // Only storing URL (sent from frontend)
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

// Auto calculate status before save
complianceSchema.pre("save", function (next) {
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