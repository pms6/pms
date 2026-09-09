import mongoose from "mongoose";

// The client database — "Database Template .xlsx" as a register the office
// keeps by hand.
//
// This used to be a read-only VIEW over CheckIn: every check-in appeared here
// automatically, and editing a client edited their check-in. That link is gone
// on purpose. The two registers record different things and are maintained by
// different people, so a client is now typed into this collection directly and
// a check-in never creates, updates or deletes one.
//
// What that means in practice:
//   • Adding a check-in does NOT add a client here.
//   • Deleting a client here does NOT touch any check-in.
//   • The same person can exist in both, with different details, and neither
//     register corrects the other.
//
// The two dates the sheet is kept on are the contract's. Room rented date and
// check-in date deliberately have no place here — they belong to the check-in
// register, which is where they are managed.

export const CLIENT_STATUSES = ["ACTIVE", "PAST"];

const clientSchema = new mongoose.Schema(
  {
    // ============================
    // SaaS relationships
    // ============================
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

    // Optional links to the property and room records. Optional because the
    // sheet carries addresses and rooms that were never set up as records, and
    // the free-text name beside each link is what the register actually reads.
    //
    // Note what is NOT here: no checkInId. A client row is not a check-in and
    // must not be able to become one.
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
      index: true,
    },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null },

    // ============================
    // The sheet's columns
    // ============================
    property: { type: String, trim: true, required: true },
    room: { type: String, trim: true, default: "" },

    // "Room Status" on the sheet is really the room TYPE ("Double Room",
    // "GA Double Room"). Free text, because the sheet invents labels the Room
    // model's enum does not carry.
    roomType: { type: String, trim: true, default: "" },

    tenant: { type: String, trim: true, required: true },

    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },

    // "Gender & Nationality" is one column on the sheet; split here so the
    // register can filter and total on either half.
    gender: {
      type: String,
      enum: ["", "MALE", "FEMALE", "OTHER"],
      default: "",
    },
    nationality: { type: String, trim: true, default: "" },

    // ============================
    // Period of contract — the only dates this register keeps
    // ============================
    contractStart: { type: Date, default: null, index: true },
    contractEnd: { type: Date, default: null, index: true },

    // ============================
    // Money
    // ============================
    rent: { type: Number, default: 0, min: 0 },
    deposit: { type: Number, default: 0, min: 0 },

    // Day of the month the rent falls due. A day number rather than a date
    // because it repeats every month.
    paymentDueDay: { type: Number, default: null, min: 1, max: 31 },

    bank: { type: String, trim: true, default: "" },
    agent: { type: String, trim: true, default: "" },

    // ============================
    // Status
    // ============================
    // Set by hand. Nothing else moves it — a check-out cannot retire a client
    // row, because the two registers no longer know about each other.
    status: {
      type: String,
      enum: CLIENT_STATUSES,
      default: "ACTIVE",
      index: true,
    },

    notes: { type: String, trim: true, default: "" },

    // ============================
    // Soft delete
    // ============================
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

// The register's default view: this organization's live rows, in sheet order.
clientSchema.index({ organizationId: 1, isDeleted: 1, property: 1, room: 1 });
// "Whose contract is running out" — the thing the sheet is scanned for.
clientSchema.index({ organizationId: 1, isDeleted: 1, contractEnd: 1 });

export default mongoose.model("Client", clientSchema);
