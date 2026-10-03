// utils/orgTeam.js
//
// "Who in the office should hear about this?" for in-app notifications raised
// by tenants (a chat message, an acknowledged access notice). Returns User ids,
// because in-app notifications are written per person.

import Organization from "../models/Organization.js";
import OrganizationMember from "../models/OrganizationMember.js";

// The owner (the User the Organization record points at) plus every ACTIVE
// member in one of `roles`. INVITED and SUSPENDED members are left out.
export const orgTeamUserIds = async (
  organizationId,
  roles = ["OWNER", "ADMIN", "MANAGER"]
) => {
  if (!organizationId) return [];

  const [org, members] = await Promise.all([
    Organization.findById(organizationId).select("userId").lean(),
    OrganizationMember.find({ organizationId, role: { $in: roles }, status: "ACTIVE" })
      .select("userId")
      .lean(),
  ]);

  const ids = [org?.userId, ...members.map((m) => m.userId)].filter(Boolean).map(String);
  return [...new Set(ids)];
};

// "saima.khan@agency.co.uk" → "Saima Khan". Staff have no name on record —
// the app knows them by email — so this is the readable name for anything a
// tenant sees. Never returns the address itself.
export const nameFromEmail = (email) =>
  String(email || "")
    .split("@")[0]
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

// The display name a staff member signs their messages with: their name on
// the team if one was recorded, otherwise a name read off their email — never
// the email address itself.
export const staffDisplayName = async (user) => {
  if (!user?._id) return "";
  const member = await OrganizationMember.findOne({ userId: user._id }).select("name").lean();
  return member?.name || nameFromEmail(user.email) || "Property Management";
};
