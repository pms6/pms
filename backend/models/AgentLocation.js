import mongoose from "mongoose";

// One row per operation team member, created the first time they turn sharing on
// and reused after that — the toggle flips `active` rather than creating a new
// record, so there is exactly one place to read their current position from.
//
// Nothing here is history: only the LATEST fix is kept. Sharing a live position
// is meant to answer "where is this person now", and keeping a trail would turn
// a convenience into a movement log nobody asked for.
const agentLocationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // Denormalised so the staff map renders without populating User and
    // OrganizationMember for every pin, and so the hourly email can name the
    // sharer even after they leave the team.
    email: { type: String, trim: true, lowercase: true, default: "" },
    role: { type: String, trim: true, default: "" },

    // The switch itself. False = not sharing: the map hides them and the
    // hourly email skips them entirely.
    active: { type: Boolean, default: false, index: true },

    // Latest fix. Null whenever they have turned sharing on but the browser
    // has not returned a position yet.
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    // Metres of uncertainty, straight from the Geolocation API.
    accuracy: { type: Number, default: null },

    // When that fix arrived. Distinct from `updatedAt`, which also moves when
    // they merely toggle sharing off.
    lastPingAt: { type: Date, default: null },

    startedAt: { type: Date, default: null },
    stoppedAt: { type: Date, default: null },

    // Stamped by the hourly job so a restart, or an admin pressing "send now",
    // cannot mail the same hour twice.
    lastEmailSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

agentLocationSchema.index({ organizationId: 1, active: 1 });

export default mongoose.model("AgentLocation", agentLocationSchema);
