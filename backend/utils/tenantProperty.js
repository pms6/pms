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

export async function resolveTenantProperty(user) {
  const email = (user?.email || "").toLowerCase();
  if (!email) return { tenancy: null, property: null };

  // The tenant's most recent active tenancy anchors their property.
  const tenancy = await Tenancy.findOne({ tenantEmail: email, isDeleted: false })
    .sort({ startDate: -1, createdAt: -1 })
    .lean();

  if (!tenancy) return { tenancy: null, property: null };

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

  return { tenancy, property };
}
