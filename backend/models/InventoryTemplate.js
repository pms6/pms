import mongoose from "mongoose";
import { AREA_TYPES } from "../utils/inventoryTemplates.js";

// An organisation's own room / area template for Inventory Reports — the item
// list for "Bedroom (furnished HMO)", say — saved alongside the built-in ones
// in utils/inventoryTemplates.js, which are never stored.
const templateItemSchema = new mongoose.Schema(
  {
    item: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const inventoryTemplateSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, trim: true, required: true },
    areaType: { type: String, enum: AREA_TYPES, default: "OTHER" },
    items: { type: [templateItemSchema], default: [] },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("InventoryTemplate", inventoryTemplateSchema);
