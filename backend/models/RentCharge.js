import mongoose from "mongoose";

// A single rent charge (one billing period) for a tenancy. Charges are generated
// month-by-month from the tenancy's rent + start date, and move to "paid" when
// the tenant records a payment.
export const RENT_CHARGE_STATUS = ["upcoming", "due", "overdue", "paid"];

const rentChargeSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    tenancyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenancy",
      required: true,
      index: true,
    },

    // Denormalised so a tenant's charges resolve by their account email, and the
    // card list renders without extra joins.
    tenantEmail: { type: String, trim: true, lowercase: true, default: "", index: true },
    property: { type: String, trim: true, default: "" },
    room: { type: String, trim: true, default: "" },

    amount: { type: Number, default: 0 },

    // Billing period this charge covers, e.g. "2026-07". Unique per tenancy so
    // generation is idempotent (we never create the same month twice).
    periodKey: { type: String, trim: true, default: "" },
    dueDate: { type: Date, required: true, index: true },

    status: {
      type: String,
      enum: RENT_CHARGE_STATUS,
      default: "due",
    },

    // How the payment was recorded (Card / Direct Debit / …) and when.
    method: { type: String, trim: true, default: "" },
    paidDate: { type: Date, default: null },
  },
  { timestamps: true }
);

rentChargeSchema.index({ tenancyId: 1, periodKey: 1 }, { unique: true });

export default mongoose.model("RentCharge", rentChargeSchema);
