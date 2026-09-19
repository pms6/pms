import mongoose from "mongoose";
import { attachmentSchema } from "../utils/attachments.js";

// The office's "Garden Cutting Machines" sheet: one row per property, saying
// what garden equipment is kept there and where it was picked up from.
//
// Every column can carry pictures and video, so each one is the same small
// shape — a free-text `value` (Yes / No / a count / a condition, whatever the
// office writes in the cell) plus its own list of files.
//
// MUST stay in sync with GARDEN_MACHINE_ITEMS in
// frontend/src/app/Shared/GardenBoard.js.
export const GARDEN_MACHINE_ITEMS = [
  "gardenCuttingMachine",
  "hedgeCutter",
  "extension",
  "binBags",
  "pickedFrom",
];

const itemSchema = new mongoose.Schema(
  {
    value: { type: String, trim: true, default: "" },
    files: { type: [attachmentSchema], default: [] },
  },
  { _id: false }
);

const gardenMachineSchema = new mongoose.Schema(
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

    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
      index: true,
    },
    property: { type: String, trim: true, required: true },

    gardenCuttingMachine: { type: itemSchema, default: () => ({}) },
    hedgeCutter: { type: itemSchema, default: () => ({}) },
    extension: { type: itemSchema, default: () => ({}) },
    binBags: { type: itemSchema, default: () => ({}) },
    // Where the equipment was collected from.
    pickedFrom: { type: itemSchema, default: () => ({}) },

    notes: { type: String, trim: true, default: "" },

    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

gardenMachineSchema.index({ organizationId: 1, isDeleted: 1, property: 1 });

export default mongoose.model("GardenMachine", gardenMachineSchema);
