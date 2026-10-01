// utils/staff.js
//
// Resolving "assign this to a staff member" — shared by Email Records and
// Tenant Cases so both apply the same rule.

import mongoose from "mongoose";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import OrganizationMember from "../models/OrganizationMember.js";

// The assignee must be an active member of the caller's own organization.
// Returns their email, or throws a 400-worthy message.
export const resolveAssignee = async (organizationId, userId) => {
  if (!mongoose.isValidObjectId(userId)) throw new Error("Invalid staff member.");
  const [member, user] = await Promise.all([
    OrganizationMember.findOne({ organizationId, userId, status: "ACTIVE" }).select("_id").lean(),
    User.findById(userId).select("email").lean(),
  ]);
  if (!user) throw new Error("Staff member not found.");
  // The owner has no membership row in some organizations, so the owner of
  // the organization itself is accepted too.
  if (!member) {
    const org = await Organization.findOne({ _id: organizationId, userId }).select("_id").lean();
    if (!org) throw new Error("That person is not an active member of this organization.");
  }
  return user.email || "";
};
