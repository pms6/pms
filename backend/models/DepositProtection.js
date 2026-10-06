import mongoose from "mongoose";

// Keep legacy labels valid so existing records remain readable while the
// frontend presents the updated deposit protection vocabulary.
export const DEPOSIT_PROTECTION_STATUSES = [
  "Protection Pending", "Protected", "Release Requested", "Payment Received",
  "Protect ASAP", "Released",
];

const schema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  tenant: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true, default: "" },
  phone: { type: String, trim: true, default: "" },
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property", default: null },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null },
  property: { type: String, trim: true, default: "" },
  room: { type: String, trim: true, default: "" },
  amount: { type: Number, min: 0, default: null },
  status: { type: String, enum: DEPOSIT_PROTECTION_STATUSES, default: "Protection Pending" },
  paymentReceived: { type: Boolean, default: false },
  note: { type: String, trim: true, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

schema.index({ organizationId: 1, tenant: 1 });
export default mongoose.model("DepositProtection", schema);
