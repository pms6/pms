// utils/reminders.js
//
// Helpers shared by the daily reminder jobs in cranjob/. Both the compliance
// and contract jobs need the same two things: how many days are left until a
// date, and who in the organization should hear about it.
import Organization from "../models/Organization.js";
import OrganizationMember from "../models/OrganizationMember.js";
import User from "../models/User.js";
import env from "../config/env.js";

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Days from today until `date`. Both ends are floored to midnight so a
 * certificate expiring later today reads as 0 rather than a fraction.
 */
export const daysUntil = (date) => {
  const end = new Date(date);
  end.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((end - today) / DAY_MS);
};

/**
 * Who should hear about this organization's expiries.
 *
 * The owner (the User the Organization record points at) plus every ACTIVE
 * OWNER/MANAGER in OrganizationMember — co-owners and managers run renewals
 * day to day, so they need the warning too. AGENT and FINANCE are left out:
 * lettings and bookkeeping have no part in arranging a certificate renewal.
 *
 * INVITED and SUSPENDED members are skipped — an invite that was never
 * accepted, or an account deliberately turned off, should not be mailed.
 *
 * Returns { to, cc }: the owner is the primary recipient because the renewal
 * is ultimately their call, with the rest of the team copied in. Falls back to
 * the configured mailbox so a reminder is never silently dropped.
 */
export const resolveOrgRecipients = async (organizationId) => {
  const fallback = env.mail.user ? { to: env.mail.user, cc: [] } : { to: null, cc: [] };

  if (!organizationId) return fallback;

  const org = await Organization.findById(organizationId).select("userId").lean();

  const memberships = await OrganizationMember.find({
    organizationId,
    role: { $in: ["OWNER", "MANAGER"] },
    status: "ACTIVE",
  })
    .select("userId")
    .lean();

  // Owner first so it lands in `to`; the rest are copied in.
  const userIds = [org?.userId, ...memberships.map((m) => m.userId)].filter(Boolean);
  if (!userIds.length) return fallback;

  const users = await User.find({ _id: { $in: userIds } }).select("email").lean();

  // The $in query gives no ordering guarantee, so map back to preserve
  // owner-first rather than relying on the order Mongo returns.
  const emailById = new Map(users.map((u) => [String(u._id), u.email]));

  const seen = new Set();
  const emails = [];
  for (const id of userIds) {
    const email = emailById.get(String(id))?.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }

  if (!emails.length) return fallback;

  return { to: emails[0], cc: emails.slice(1) };
};

/**
 * Expiry state derived from a date every time it is asked for, rather than
 * read from a stored field that goes stale while nobody touches the record.
 *
 *   expired -> the date has passed
 *   warning -> inside the run-up window the user chose
 *   valid   -> still further out than the window
 */
export const expiryState = (expiryDate, reminderDaysBefore = 14) => {
  if (!expiryDate) return { status: "valid", days: null };

  const days = daysUntil(expiryDate);
  if (days < 0) return { status: "expired", days };
  if (days <= (reminderDaysBefore || 14)) return { status: "warning", days };
  return { status: "valid", days };
};
