import mongoose from "mongoose";

// The office's "Cleaning Messages Schedule" sheet: one row per property visit,
// grouped by month, with the weekday shown alongside the date and a Done flag.
//
// The weekday is NOT stored — it is derived from `date` so the two can never
// disagree, which is the failure mode a hand-kept sheet has. Same for the month
// band: it is the date's month.
// MUST stay in sync with CLEANING_STATUSES in
// frontend/src/app/Shared/CleaningScheduleBoard.js.
export const CLEANING_STATUSES = ["PENDING", "DONE"];

const cleaningScheduleSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Optional link to the property record. The sheet is written as a plain
    // address, and rows exist for addresses not yet in the portfolio, so the
    // text is what the schedule actually reads from.
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
      index: true,
    },
    property: { type: String, trim: true, required: true },

    // The day the cleaning message goes out / the clean happens.
    date: { type: Date, required: true, index: true },

    status: {
      type: String,
      enum: CLEANING_STATUSES,
      default: "PENDING",
      index: true,
    },

    // Who is doing it, what goes out to them, and anything the office needs
    // to remember. `message` is the cleaning message for this visit — the
    // sheet is named after it — kept apart from `notes`, which is internal.
    cleaner: { type: String, trim: true, default: "" },
    message: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },

    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

cleaningScheduleSchema.index({ organizationId: 1, isDeleted: 1, date: 1 });

export default mongoose.model("CleaningSchedule", cleaningScheduleSchema);
