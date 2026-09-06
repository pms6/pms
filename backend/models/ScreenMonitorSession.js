import mongoose from "mongoose";

// One monitored shift, with the screenshots taken during it.
//
// A session only ever exists because the staff member started it themselves and
// picked what to share in their browser — there is no way for the server to
// open one. `acknowledgedAt` and `noticeTextSeen` record the notice they
// accepted, so months later it is still answerable what someone was told when
// the monitoring happened.

const captureSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true, default: "" },
    capturedAt: { type: Date, default: Date.now, index: true },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    bytes: { type: Number, default: 0 },
  },
  { _id: true }
);

// Who opened the screenshots, and when. Monitoring the workers without any
// record of who watched is the asymmetry that makes staff distrust it.
const viewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    email: { type: String, trim: true, default: "" },
    viewedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const screenMonitorSessionSchema = new mongoose.Schema(
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
      index: true,
    },

    // Denormalised so the admin board renders without a populate per row, and
    // still names the person after they leave the team.
    email: { type: String, trim: true, lowercase: true, default: "" },
    role: { type: String, trim: true, default: "" },

    status: {
      type: String,
      enum: ["ACTIVE", "ENDED"],
      default: "ACTIVE",
      index: true,
    },

    startedAt: { type: Date, default: Date.now, index: true },
    endedAt: { type: Date, default: null },

    // How the session finished: the member stopped it, they revoked the browser
    // share, or the server closed it when the working-hours window ended.
    endedReason: {
      type: String,
      enum: ["", "STOPPED", "SHARE_REVOKED", "OUT_OF_HOURS", "EXPIRED"],
      default: "",
    },

    // The notice the member accepted to start this session, copied in so a
    // later policy edit cannot rewrite what they agreed to.
    acknowledgedAt: { type: Date, default: null },
    noticeTextSeen: { type: String, trim: true, default: "" },

    captures: { type: [captureSchema], default: [] },

    // When the next screenshot is due. Set to a random point inside the
    // policy's interval range, server-side, so the client cannot choose a
    // convenient moment.
    nextCaptureAt: { type: Date, default: null },
    lastCaptureAt: { type: Date, default: null },

    viewedBy: { type: [viewSchema], default: [] },
  },
  { timestamps: true }
);

screenMonitorSessionSchema.index({ organizationId: 1, startedAt: -1 });
screenMonitorSessionSchema.index({ organizationId: 1, userId: 1, status: 1 });

export default mongoose.model("ScreenMonitorSession", screenMonitorSessionSchema);
