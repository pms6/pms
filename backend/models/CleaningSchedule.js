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

// What kind of visit this row records. The sheet started as one undifferentiated
// list of cleans, but the office runs three distinct jobs on its properties and
// needs to see each as its own register — the same way the compliance page is
// read one certificate type at a time.
//
// MUST stay in sync with CLEANING_CATEGORIES in
// frontend/src/app/Shared/CleaningScheduleBoard.js.
export const CLEANING_CATEGORIES = [
  "Fridge Cleaning",
  "Washing Machine Descaling",
  "Self Inspection",
];

// Rows written before categories existed have none. They keep reading as fridge
// cleaning, which is what the sheet was overwhelmingly used for — see the note
// on the field below.
export const DEFAULT_CLEANING_CATEGORY = "Fridge Cleaning";

// One piece of evidence for a visit: a photo of the cleaned fridge, a clip of
// the machine running its descale cycle, a signed inspection sheet.
//
// Any type is accepted, for the same reason the compliance register accepts
// any type — the proof is whatever the person on site actually captured, and a
// format whitelist would only keep it out of the record. `type` is Cloudinary's
// own classification, kept so the viewer knows to render a <video> rather than
// an <img> without re-deriving it from the URL every time.
const cleaningFileSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    url: { type: String, trim: true, required: true },
    // Kept so the file can be removed from Cloudinary later.
    publicId: { type: String, trim: true, default: "" },
    type: {
      type: String,
      enum: ["image", "video", "pdf", "file"],
      default: "file",
    },
    // Stored so the UI can label and size an attachment without fetching it.
    format: { type: String, trim: true, default: "" },
    bytes: { type: Number, default: 0, min: 0 },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false }
);

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

    // Which of the three jobs this row is. Defaulted rather than required so
    // the thousands of rows already on the sheet stay valid and simply read as
    // the category they were nearly all written for; the form always sends one.
    category: {
      type: String,
      enum: CLEANING_CATEGORIES,
      default: DEFAULT_CLEANING_CATEGORY,
      index: true,
    },

    // The day the cleaning message goes out / the clean happens.
    date: { type: Date, required: true, index: true },

    status: {
      type: String,
      enum: CLEANING_STATUSES,
      default: "PENDING",
      index: true,
    },

    // How the cleaning message was sent for this visit. The office chases each
    // clean by email, by phone, or both — these record which was done, and the
    // address / number it went to.
    emailSent: { type: Boolean, default: false },
    callMade: { type: Boolean, default: false },
    contactEmail: { type: String, trim: true, default: "" },
    contactPhone: { type: String, trim: true, default: "" },

    // What goes out to the cleaner, and anything the office needs to remember.
    // `message` is the cleaning message for this visit — the sheet is named
    // after it — kept apart from `notes`, which is internal.
    // `cleaner` is a legacy free-text field kept so older rows still read.
    cleaner: { type: String, trim: true, default: "" },
    message: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },

    // Photos, video, PDFs — whatever was captured on the visit. A list, because
    // one fridge clean is several photos rather than one.
    files: { type: [cleaningFileSchema], default: [] },

    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

cleaningScheduleSchema.index({ organizationId: 1, isDeleted: 1, date: 1 });
// The board is read one category at a time, filtered to a month.
cleaningScheduleSchema.index({ organizationId: 1, category: 1, isDeleted: 1, date: 1 });

export default mongoose.model("CleaningSchedule", cleaningScheduleSchema);
