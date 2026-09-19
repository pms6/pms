// utils/tenantProperty.js
//
// Resolve the property a signed-in TENANT belongs to, from their tenancy. Used
// by the tenant-facing compliance / welcome-pack / maintenance endpoints to
// scope data to the tenant's own property instead of the whole organization.
//
// Onboarding-created tenancies store the property as a NAME string (sometimes
// suffixed with the room, e.g. "House A — Room 2") and may not carry a
// propertyId, so we fall back to matching the Property by name within the org.

import Tenancy from "../models/Tenancy.js";
import Property from "../models/Property.js";
import Room from "../models/room.js";

export async function resolveTenantProperty(user) {
  const email = (user?.email || "").toLowerCase();
  if (!email) return { tenancy: null, property: null, roomId: null };

  // The tenant's most recent active tenancy anchors their property.
  const tenancy = await Tenancy.findOne({ tenantEmail: email, isDeleted: false })
    .sort({ startDate: -1, createdAt: -1 })
    .lean();

  if (!tenancy) return { tenancy: null, property: null, roomId: null };

  let property = null;

  // Prefer the direct reference when present.
  if (tenancy.propertyId) {
    property = await Property.findOne({
      _id: tenancy.propertyId,
      isDeleted: false,
    }).lean();
  }

  // Fall back to matching the Property by name within the tenant's org. Strip a
  // trailing " — <room>" suffix that the enquiry flow appends to the name.
  if (!property && tenancy.property) {
    const name = String(tenancy.property).split(" — ")[0].trim();
    if (name && name !== "—") {
      property = await Property.findOne({
        organizationId: tenancy.organizationId,
        name,
        isDeleted: false,
      }).lean();
    }
  }

  return { tenancy, property, roomId: await resolveTenantRoomId(tenancy, property) };
}

// Resolve the ROOM the tenant occupies. A tenancy created from a property-level
// website enquiry carries no roomId (the applicant never picked a room), so fall
// back to the room that points at this tenant, then to matching the denormalised
// `unit` string against the property's rooms. Returns null when the tenancy
// genuinely isn't tied to a room — callers must treat that as "room unknown"
// rather than "no room", since room-scoped records would otherwise be hidden.
async function resolveTenantRoomId(tenancy, property) {
  if (tenancy?.roomId) return tenancy.roomId;
  if (!property?._id) return null;

  // The room the operator moved this tenant into (set on onboarding completion).
  if (tenancy?.tenantId) {
    const occupied = await Room.findOne({
      propertyId: property._id,
      currentTenant: tenancy.tenantId,
    })
      .select("_id")
      .lean();
    if (occupied) return occupied._id;
  }

  // Last resort: the tenancy's display "unit" against room name / title / number.
  const unit = String(tenancy?.unit || "").trim();
  if (unit && unit !== "—") {
    const byName = await Room.findOne({
      propertyId: property._id,
      $or: [{ roomName: unit }, { title: unit }, { roomNumber: unit }],
    })
      .select("_id")
      .lean();
    if (byName) return byName._id;
  }

  return null;
}
