import mongoose from "mongoose";

// Check-out register — one row per tenant moving OUT of a room.
//
// Shape follows "Check out template.xlsx": Property, Tenants Name, Deposit
// Status, Contract, Due Date, Notice Date, Moved Out Date, Actual moved Out
// date, Rent, Advance liscene fee, Pictures, Videos, Keys Location, Fridge
// cleaning, Bedsheets, Cupboard Clean, Room Clean, Inspection.
//
// The last seven columns are the move-out checklist the inspector works
// through. They are tri-state rather than Boolean: on the sheet a blank cell
// means "not checked yet", which is a different thing from "No".

// How the deposit was settled. The spreadsheet records this as free text
// ("He used deposit as rent", "470 done on 30 march (118 deducted because she
// left the rubbish near bin)"), so the prose is kept in depositNote and only
// the outcome is enumerated — that is the part worth totalling.
export const DEPOSIT_STATUS = [
  "PENDING",
  "RETURNED",
  "PARTIALLY_RETURNED",
  "USED_AS_RENT",
  "WITHHELD",
];

export const CHECKOUT_CONTRACT_STATUS = ["ONGOING", "COMPLETED", "BREAK", "CANCELLED"];

// Tri-state for the move-out checklist. "" = not inspected yet.
const yesNo = {
  type: String,
  enum: ["", "YES", "NO"],
  default: "",
};

const checkOutSchema = new mongoose.Schema(
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

    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property", default: null, index: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null, index: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", default: null },
    tenancyId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenancy", default: null },

    // The check-in this settles. Set it and the deposit register can show the
    // deposit taken and the deposit returned on one line; leave it null and the
    // row still stands on its own, which is what historic sheet rows need.
    checkInId: { type: mongoose.Schema.Types.ObjectId, ref: "CheckIn", default: null, index: true },

    // ============================
    // Display fields
    // ============================
    property: { type: String, trim: true, required: true },
    room: { type: String, trim: true, default: "" },
    // One cell on the sheet can name two people ("-Keerthana … -Anushka …")
    // when a couple shares a room, so this is deliberately not split.
    tenant: { type: String, trim: true, required: true },

    // ============================
    // Contract
    // ============================
    contractStatus: {
      type: String,
      enum: CHECKOUT_CONTRACT_STATUS,
      default: "COMPLETED",
    },
    // The sheet's "Contract" column is sometimes a status and sometimes the
    // term itself ("23 Sep 2025 to 22 Sep 2026 Break"). The prose goes here.
    contractNote: { type: String, trim: true, default: "" },

    // "Due Date" on the sheet is a day number (1, 23, 25, 28) — the day of the
    // month the rent fell due, not a calendar date.
    rentDueDay: { type: Number, default: null, min: 1, max: 31 },

    // ============================
    // Dates
    // ============================
    noticeDate: { type: Date, default: null },
    // What was agreed …
    movedOutDate: { type: Date, default: null, index: true },
    // … and what happened. They differ when a tenant leaves early, which is
    // the difference the void report is built on.
    actualMovedOutDate: { type: Date, default: null },

    // ============================
    // Money
    // ============================
    rent: { type: Number, default: 0, min: 0 },
    // "Advance liscene fee" — the deposit under the name the sheet gives it.
    advanceLicenceFee: { type: Number, default: 0, min: 0 },

    depositStatus: {
      type: String,
      enum: DEPOSIT_STATUS,
      default: "PENDING",
      index: true,
    },
    depositReturned: { type: Number, default: 0, min: 0 },
    depositDeducted: { type: Number, default: 0, min: 0 },
    // The sheet's own wording, kept verbatim: it is where the reason for a
    // deduction lives.
    depositNote: { type: String, trim: true, default: "" },

    // ============================
    // Move-out checklist
    // ============================
    keysLocation: { type: String, trim: true, default: "" }, // "Keysafe", "On Table"
    pictures: yesNo,
    videos: yesNo,
    fridgeCleaning: yesNo,
    bedsheets: yesNo,
    cupboardClean: yesNo,
    roomClean: yesNo,

    inspection: {
      type: String,
      enum: ["PENDING", "DONE", "NOT_REQUIRED"],
      default: "PENDING",
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

checkOutSchema.index({ organizationId: 1, isDeleted: 1, movedOutDate: -1 });
checkOutSchema.index({ organizationId: 1, depositStatus: 1 });

export default mongoose.model("CheckOut", checkOutSchema);
