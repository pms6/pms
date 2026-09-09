import mongoose from "mongoose";

// One row per staff member, created the first time their browser checks in and
// reused after that — a heartbeat updates the row rather than appending, so
// there is exactly one place to read "is this person at their desk" from.
//
// Deliberately NOT a history. Presence answers "who is working right now"; a
// stored trail of every check-in would quietly become an attendance log of
// when each person opened and closed their laptop, which is a different and
// much heavier thing than what was asked for. `lastSeenAt` is overwritten, and
// online status is derived from it on read rather than stored.

const staffPresenceSchema = new mongoose.Schema(
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

    // Denormalised so the board renders without a populate per row, and still
    // names someone after they leave the team.
    email: { type: String, trim: true, lowercase: true, default: "" },
    role: { type: String, trim: true, default: "" },

    // Which portal they are in — "admin" / "manager" / "agent" / "finance" /
    // "operation". The accepted list lives in controllers/presence.controller.js.
    portal: { type: String, trim: true, default: "" },

    // The last heartbeat. Online is derived from how recent this is.
    lastSeenAt: { type: Date, default: null, index: true },

    // When this stretch at the desk began: set on the first heartbeat after a
    // gap, so the board can say "online for 40 minutes" rather than only "seen
    // 20 seconds ago".
    sessionStartedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

staffPresenceSchema.index({ organizationId: 1, lastSeenAt: -1 });

export default mongoose.model("StaffPresence", staffPresenceSchema);
