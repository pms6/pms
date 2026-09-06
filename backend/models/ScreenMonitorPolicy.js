import mongoose from "mongoose";

// One row per organisation — the rules screen monitoring runs under.
//
// These are not cosmetic settings. UK worker-monitoring guidance expects
// monitoring to be limited to what is necessary and proportionate, so the
// working-hours window, the capture frequency and the retention period are
// stored as policy the server ENFORCES, rather than left to whatever the
// browser decides to send.
//
// MUST stay in sync with the defaults in
// frontend/src/app/Shared/StaffMonitoringBoard.js.

// Times are held as "HH:mm" on a UK clock and evaluated in Europe/London, the
// same way task dates are — a monitoring window that drifts with the viewer's
// machine timezone would capture outside the agreed hours.
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const screenMonitorPolicySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
      index: true,
    },

    // Master switch. Off means no session can be started at all.
    enabled: { type: Boolean, default: false },

    // The working-hours window. Captures outside it are refused by the server.
    workStart: {
      type: String,
      default: "09:00",
      validate: { validator: (v) => TIME_RE.test(v), message: "workStart must be HH:mm" },
    },
    workEnd: {
      type: String,
      default: "17:30",
      validate: { validator: (v) => TIME_RE.test(v), message: "workEnd must be HH:mm" },
    },
    // ISO weekdays, 1 = Monday … 7 = Sunday.
    workDays: { type: [Number], default: [1, 2, 3, 4, 5] },

    // Screenshots land at a random point inside this range, so they cannot be
    // predicted and worked around — the "random" in random screenshots.
    minIntervalMinutes: { type: Number, default: 10, min: 1, max: 240 },
    maxIntervalMinutes: { type: Number, default: 30, min: 1, max: 480 },

    // Screenshots are deleted this many days after capture. A monitoring
    // record kept indefinitely is the thing that turns a proportionate check
    // into a permanent file on someone.
    retentionDays: { type: Number, default: 30, min: 1, max: 365 },

    // The text every staff member sees before a session can start, and which
    // their acknowledgement is recorded against.
    noticeText: {
      type: String,
      trim: true,
      default:
        "While a monitored shift is running, this app takes occasional screenshots of the screen you chose to share. Screenshots are visible to your organisation's admins only. Your browser shows a screen-sharing indicator the whole time, and you can stop at any moment.",
    },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("ScreenMonitorPolicy", screenMonitorPolicySchema);
