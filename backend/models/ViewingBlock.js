import mongoose from "mongoose";

// A date on which viewings cannot be booked — a block of flats being fumigated,
// a landlord away, a room mid-refurbishment.
//
// Scoped to a property, and optionally to one room within it. A block with no
// roomId closes the whole property for that day; a block with a roomId closes
// only that room, leaving the rest of the property bookable.
const viewingBlockSchema = new mongoose.Schema(
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

    // null = every room in the property. The Viewing model treats room as
    // optional too (a viewing of the whole property), so the two line up.
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
      index: true,
    },

    // YYYY-MM-DD, stored as a string to match Viewing.date exactly. Comparing
    // two plain strings avoids the timezone traps a Date would introduce, where
    // a block on the 5th could reject a viewing on the 4th.
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },

    // Why the date is closed. Shown to whoever is refused the booking, so the
    // message says "Landlord away" rather than just "no".
    note: {
      type: String,
      trim: true,
      default: "",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Denormalised the same way the Lead and Viewing boards do it, so the list
    // can name who blocked the date without a populate.
    createdByEmail: {
      type: String,
      trim: true,
      default: "",
    },
    createdByRole: {
      type: String,
      trim: true,
      default: "",
    },

    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

// The lookup every booking attempt makes.
viewingBlockSchema.index({ organizationId: 1, propertyId: 1, date: 1, isDeleted: 1 });

export default mongoose.model("ViewingBlock", viewingBlockSchema);
