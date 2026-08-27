// utils/codes.js
//
// Reference-code generators shared by the property/room controllers and the
// property-submission approval flow, so an approved submission gets the same
// PROP-/RM- sequence as anything created inside the app.
//
// Each next number comes from the HIGHEST existing code, not the document
// count — otherwise deleting a record makes count+1 collide with a code that
// still exists (both fields are unique), throwing a duplicate-key error.

import Property from "../models/Property.js";
import Room from "../models/Room.js";

/** Next property code, e.g. PROP-000001. */
export const generatePropertyCode = async () => {
  const last = await Property.findOne({ propertyCode: /^PROP-\d+$/ })
    .sort({ propertyCode: -1 })
    .select("propertyCode")
    .lean();

  const lastNum = last ? parseInt(last.propertyCode.slice(5), 10) || 0 : 0;
  return `PROP-${String(lastNum + 1).padStart(6, "0")}`;
};

/** Next room listing code, e.g. RM-000001. */
export const generateRoomCode = async () => {
  const last = await Room.findOne({ listingCode: /^RM-\d+$/ })
    .sort({ listingCode: -1 })
    .select("listingCode")
    .lean();

  const lastNum = last ? parseInt(last.listingCode.slice(3), 10) || 0 : 0;
  return `RM-${String(lastNum + 1).padStart(6, "0")}`;
};

/**
 * A room slug that is not already taken. `slug` is unique across the whole Room
 * collection (not per organization), so a clash is suffixed with a timestamp —
 * same rule the room controller uses.
 */
export const uniqueRoomSlug = async (source = "") => {
  const base =
    String(source)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "room";

  const existing = await Room.findOne({ slug: base }).select("_id").lean();
  return existing ? `${base}-${Date.now()}` : base;
};
