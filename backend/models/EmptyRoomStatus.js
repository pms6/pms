import mongoose from "mongoose";

// The office's "Available Rooms Status" sheet: one row per empty room being
// turned around, tracking the make-ready checklist (paint, bedsheet, keys), any
// outstanding issues, and the dates the room emptied and became ready.
//
// The sheet groups rows under two headings — rooms still available, and rooms
// that have been let agreed — which is what `status` records.
// MUST stay in sync with EMPTY_ROOM_STATUSES /  TURNAROUND_STATUSES in
// frontend/src/app/Shared/EmptyRoomStatusBoard.js.
export const EMPTY_ROOM_STATUSES = ["AVAILABLE", "LET_AGREED"];

// Each make-ready task is a simple tick — done or still outstanding.
export const TURNAROUND_STATUSES = ["PENDING", "DONE"];

const emptyRoomStatusSchema = new mongoose.Schema(
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
    // text is what the list actually reads from.
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
      index: true,
    },
    property: { type: String, trim: true, required: true },

    // Who was in the room before it emptied.
    exTenant: { type: String, trim: true, default: "" },

    // The make-ready checklist. Each is Pending until the office ticks it Done.
    paint: { type: String, enum: TURNAROUND_STATUSES, default: "PENDING" },
    bedsheet: { type: String, enum: TURNAROUND_STATUSES, default: "PENDING" },
    keys: { type: String, enum: TURNAROUND_STATUSES, default: "PENDING" },

    // Anything blocking the room — "Remove Rubbish, Lock Broken", "Bed Base
    // Broken", etc.
    issues: { type: String, trim: true, default: "" },

    // When the room emptied and when it was ready to re-let.
    emptyRoomDate: { type: Date, required: true, index: true },
    roomReadyDate: { type: Date, default: null },

    // Whether the room was (or is expected to be) made ready inside seven
    // working days of emptying.
    withinSevenDays: { type: Boolean, default: false },

    // "AVAILABLE" while the room is still being marketed, "LET_AGREED" once a
    // new tenant is lined up — the two headings the sheet groups rows under.
    status: {
      type: String,
      enum: EMPTY_ROOM_STATUSES,
      default: "AVAILABLE",
      index: true,
    },

    notes: { type: String, trim: true, default: "" },

    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

emptyRoomStatusSchema.index({ organizationId: 1, isDeleted: 1, emptyRoomDate: -1 });
emptyRoomStatusSchema.index({ organizationId: 1, status: 1, isDeleted: 1 });

export default mongoose.model("EmptyRoomStatus", emptyRoomStatusSchema);
