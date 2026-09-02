import mongoose from "mongoose";

// Check-in register — one row per tenant moving IN to a room.
//
// Shape follows the two spreadsheets this replaces:
//   • "Check-in Entries Template.xlsx" — Sr No, Property, Client Name, Rent,
//     Deposit, Room rented date, Check-in date, Agent, Bank.
//   • "Database Template .xlsx"        — adds the occupant detail the master
//     client list carries: gender & nationality, contact number, email, the
//     contract period, the rent payment due date and the room type.
//
// Both sheets describe the same event, so they are one model rather than two.
// The Database sheet is the wider of the pair, which is why the extra columns
// live here and the Room Status list can be built from this one collection.

// Banks the check-in sheet actually uses. Offered as a datalist in the UI, but
// the field itself is a free string — the sheets spell the same bank several
// ways ("TSB", "Tsb", "TSb") and an enum would reject historic rows on import.
export const CHECKIN_BANKS = ["Monzo", "TSB", "HSBC", "Barclays", "Lloyds", "NatWest", "Starling", "Revolut"];

const checkInSchema = new mongoose.Schema(
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

    // Optional links back to the source records. As on Tenancy, the
    // denormalised strings beside each ref keep the register cheap to render
    // when a link is missing — which it usually is for rows typed straight off
    // the spreadsheet.
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property", default: null, index: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null, index: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", default: null },
    tenancyId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenancy", default: null },

    // ============================
    // Display fields — "Proptery name" / "Client Name" on the sheet
    // ============================
    property: { type: String, trim: true, required: true },
    room: { type: String, trim: true, default: "" },
    tenant: { type: String, trim: true, required: true },

    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },

    // "Gender & Nationality" is one column on the Database sheet; it is split
    // here so the room status list can filter and total on either half.
    gender: {
      type: String,
      enum: ["", "MALE", "FEMALE", "OTHER"],
      default: "",
    },
    nationality: { type: String, trim: true, default: "" },

    // "Room Status" on the Database sheet is really the room TYPE
    // ("Double Room", "Single Room", "GA Double Room"). Free text, because the
    // sheet invents labels the Room model's enum does not carry.
    roomType: { type: String, trim: true, default: "" },

    // ============================
    // Money
    // ============================
    rent: { type: Number, default: 0, min: 0 },

    // "Deposit" on the check-in sheet, "Deposit of Room £ {Advance liscene
    // Fee}" on the Database sheet — the same figure, roughly half a month's
    // rent. The check-out register settles it.
    deposit: { type: Number, default: 0, min: 0 },

    // Day of the month the rent falls due. Stored as a day number rather than
    // a date because it repeats every month; the sheet's "Payment Due Date"
    // column holds the first due date, whose day is what actually matters.
    paymentDueDay: { type: Number, default: null, min: 1, max: 31 },

    bank: { type: String, trim: true, default: "" },
    agent: { type: String, trim: true, default: "" },

    // ============================
    // Dates
    // ============================
    // When the room was taken off the market for this tenant. Usually earlier
    // than the check-in itself, and the gap is what the void report reads.
    roomRentedDate: { type: Date, default: null },

    // The move-in itself. Required and indexed — the register is grouped and
    // sorted by it.
    checkInDate: { type: Date, required: true, index: true },

    contractStart: { type: Date, default: null },
    contractEnd: { type: Date, default: null },

    // ============================
    // Status
    // ============================
    // ACTIVE = still in the room. CHECKED_OUT is set by the check-out
    // controller when a check-out row is filed against this check-in, so the
    // room status list can tell a current occupant from a past one without
    // joining the two collections on every read.
    status: {
      type: String,
      enum: ["ACTIVE", "CHECKED_OUT"],
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

// The register's default view: this organization's live rows, newest first.
checkInSchema.index({ organizationId: 1, isDeleted: 1, checkInDate: -1 });
// Room status list — "who is in this room now".
checkInSchema.index({ organizationId: 1, roomId: 1, status: 1 });

export default mongoose.model("CheckIn", checkInSchema);
