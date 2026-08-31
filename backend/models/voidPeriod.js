import mongoose from "mongoose";
import { calculateVoidMetrics } from "../utils/voidMath.js";

const voidPeriodSchema = new mongoose.Schema(
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
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tenantName: {
      type: String,
      trim: true,
      default: "",
    },
    roomCode: {
      type: String,
      trim: true,
      default: "",
    },
    rentAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    dailyRent: {
      type: Number,
      min: 0,
      default: 0,
    },
    voidDays: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalVoid: {
      type: Number,
      min: 0,
      default: 0,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },

    // ============================
    // Soft delete
    // ============================
    // Removing a void period used to erase it outright, which threw away the
    // record of a loss the business had already booked. It is hidden from the
    // working list instead, and stays available under the history view — the
    // same convention Property, Lead, Tenancy and the rest use.
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

voidPeriodSchema.index({ organizationId: 1, isDeleted: 1 });

voidPeriodSchema.pre("validate", function preValidate(next) {
  if (this.endDate < this.startDate) {
    next(new Error("Void end date must be after the start date."));
    return;
  }

  if (!this.rentAmount && this.rentAmount !== 0) {
    this.rentAmount = 0;
  }

  // Recomputed on every save from utils/voidMath.js, so the stored figures can
  // never drift from the rule — whatever a client happens to post.
  const { dailyRent, voidDays, totalVoid } = calculateVoidMetrics(
    this.rentAmount,
    this.startDate,
    this.endDate
  );

  this.dailyRent = dailyRent;
  this.voidDays = voidDays;
  this.totalVoid = totalVoid;

  next();
});

const VoidPeriod = mongoose.model("VoidPeriod", voidPeriodSchema);

export default VoidPeriod;
