import mongoose from "mongoose";
import { attachmentSchema } from "../utils/attachments.js";
import { AREA_TYPES } from "../utils/inventoryTemplates.js";

// An Inventory Report — the professional check-in / check-out document, built
// room by room in the shape of the office's reference report: a cover page,
// schedule of condition, meter readings, one table per area (Ref / Item /
// Description / Condition + Comments / Check In / Check Out comments) followed
// by that area's photos, then the key exchange, signatures and disclaimer.
//
// This is deliberately separate from Property.inventory / Room.inventory, which
// stay what they are: the running asset list (quantity, replacement value) the
// property form and the Inventory sheet edit. A report can be seeded from that
// list, but it is a dated document of what was seen on one visit, and it must
// not change when the asset list does.
//
// Ref numbers are NOT stored. The reference numbers its rows continuously
// across the whole document, so they are derived from row order when the
// report is shown or printed — reordering or inserting a row renumbers
// everything after it, exactly as a re-typed report would.

export const JOB_TYPES = ["Inventory", "Check In", "Check Out", "Mid-Term Inspection"];

export const REPORT_STATUSES = ["Draft", "Final"];

// "" = not assessed. "POOR" is shown as "Poor/Damaged". MUST stay in sync with
// ROW_CONDITIONS in frontend/src/app/utils/inventoryReports.js.
export const ROW_CONDITIONS = ["", "GOOD", "FAIR", "POOR"];

export const SIGNATURE_ROLES = ["Tenant", "Landlord", "Clerk"];

const itemRowSchema = new mongoose.Schema(
  {
    item: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    condition: { type: String, enum: ROW_CONDITIONS, default: "" },
    conditionComments: { type: String, trim: true, default: "" },
    checkInComments: { type: String, trim: true, default: "" },
    checkOutComments: { type: String, trim: true, default: "" },
    // Listed under "Additional Items Not Present at Inventory" at the end of
    // the area's table, as the reference does.
    additional: { type: Boolean, default: false },
    photos: { type: [attachmentSchema], default: [] },
  },
  { _id: true }
);

const sectionSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, required: true },
    areaType: { type: String, enum: AREA_TYPES, default: "OTHER" },
    // The room record this area is, when it is one of the property's rooms.
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null },
    notes: { type: String, trim: true, default: "" },
    rows: { type: [itemRowSchema], default: [] },
    // General photos of the area, printed after its per-item photos.
    photos: { type: [attachmentSchema], default: [] },
  },
  { _id: true }
);

const conditionSummarySchema = new mongoose.Schema(
  {
    group: { type: String, trim: true, default: "" },
    subject: { type: String, trim: true, required: true },
    comment: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const meterSchema = new mongoose.Schema(
  {
    type: { type: String, trim: true, default: "" },
    reading: { type: String, trim: true, default: "" },
    serialNumber: { type: String, trim: true, default: "" },
    location: { type: String, trim: true, default: "" },
    keyType: { type: String, trim: true, default: "" },
    photos: { type: [attachmentSchema], default: [] },
  },
  { _id: false }
);

const signatureSchema = new mongoose.Schema(
  {
    role: { type: String, enum: SIGNATURE_ROLES, required: true },
    name: { type: String, trim: true, default: "" },
    date: { type: Date, default: null },
    // A PNG of the drawn signature, uploaded to Cloudinary like any photo.
    imageUrl: { type: String, trim: true, default: "" },
    imagePublicId: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

// Who did what to the report. Append-only.
const historySchema = new mongoose.Schema(
  {
    action: { type: String, trim: true, required: true },
    note: { type: String, trim: true, default: "" },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    byEmail: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const inventoryReportSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByEmail: { type: String, trim: true, default: "" },

    // "IR-000042" — per organisation, from the Counter model.
    reference: { type: String, trim: true, required: true },

    jobType: { type: String, enum: JOB_TYPES, default: "Check In", index: true },
    status: { type: String, enum: REPORT_STATUSES, default: "Draft", index: true },

    // ============================
    // What and who it is about
    // ============================
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true, index: true },
    property: { type: String, trim: true, default: "" },
    propertyAddress: { type: String, trim: true, default: "" },
    // Set when the report covers one room (an HMO room check-in) rather than
    // the whole house.
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null, index: true },
    room: { type: String, trim: true, default: "" },
    tenancyId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenancy", default: null, index: true },
    tenantName: { type: String, trim: true, default: "" },
    tenantEmail: { type: String, trim: true, lowercase: true, default: "" },
    // The register rows this report belongs to, when there are any.
    checkInId: { type: mongoose.Schema.Types.ObjectId, ref: "CheckIn", default: null },
    checkOutId: { type: mongoose.Schema.Types.ObjectId, ref: "CheckOut", default: null },
    // The earlier report a check-out was compiled from.
    sourceReportId: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryReport", default: null },

    // ============================
    // Cover page
    // ============================
    inspectionDate: { type: Date, required: true },
    preparedBy: { type: String, trim: true, default: "" },
    instructedBy: { type: String, trim: true, default: "" },
    propertyType: { type: String, trim: true, default: "" },
    generalNotes: { type: String, trim: true, default: "" },

    // ============================
    // Body
    // ============================
    scheduleSubject: { type: String, trim: true, default: "" },
    scheduleOfCondition: { type: [conditionSummarySchema], default: [] },
    scheduleNote: { type: String, trim: true, default: "" },
    meterReadings: { type: [meterSchema], default: [] },
    sections: { type: [sectionSchema], default: [] },

    keys: {
      sets: { type: String, trim: true, default: "" },
      count: { type: String, trim: true, default: "" },
      notes: { type: String, trim: true, default: "" },
      photos: { type: [attachmentSchema], default: [] },
    },
    keyExchangeNote: { type: String, trim: true, default: "" },
    signatureNote: { type: String, trim: true, default: "" },
    signatures: { type: [signatureSchema], default: [] },
    disclaimer: { type: String, trim: true, default: "" },

    // Any other paperwork filed with the report.
    files: { type: [attachmentSchema], default: [] },

    // ============================
    // Finalisation
    // ============================
    finalisedAt: { type: Date, default: null },
    finalisedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // The PDF generated when the report was finalised, as filed in Cloudinary
    // and on Property.documents. Empty if the upload did not go through — the
    // PDF can always be regenerated from the record.
    pdf: { type: attachmentSchema, default: null },

    history: { type: [historySchema], default: [] },

    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

inventoryReportSchema.index({ organizationId: 1, isDeleted: 1, inspectionDate: -1 });
inventoryReportSchema.index({ organizationId: 1, reference: 1 }, { unique: true });

export default mongoose.model("InventoryReport", inventoryReportSchema);
