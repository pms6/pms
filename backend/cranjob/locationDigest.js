// cranjob/locationDigest.js
//
// Hourly digest of where the organization's operation team is.
//
// Runs on the hour and mails every ACTIVE member of each organization that has
// at least one operation team member sharing. Anyone who has switched the
// toggle off is not in the query at all, so no email mentions them —
// switching off means no visibility and no mail, which is the whole promise
// of the switch.
//
// Organizations with nobody sharing get no email. A quiet hour should be quiet.
import AgentLocation from "../models/AgentLocation.js";
import { STALE_AFTER_MS } from "../controllers/agentLocation.controller.js";
import { resolveAllOrgRecipients } from "../utils/reminders.js";
import { sendEmail } from "../utils/sendEmail.js";

// Don't mail the same organization twice within the hour, so a restart or a
// manual trigger cannot double-send.
const RESEND_GUARD_MS = 55 * 60 * 1000;

const nameFromEmail = (email) => (email ? String(email).split("@")[0] : "a team member");

const mapsLink = (lat, lng) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

const ago = (ms) => {
  if (ms === null || ms === undefined) return "no fix yet";
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`;
};

const row = (loc, now) => {
  const hasFix = loc.lat !== null && loc.lng !== null;
  const ageMs = loc.lastPingAt ? now - new Date(loc.lastPingAt).getTime() : null;
  const stale = !hasFix || ageMs === null || ageMs > STALE_AFTER_MS;

  const position = hasFix
    ? `<a href="${mapsLink(loc.lat, loc.lng)}" style="color:#F47C3C;font-weight:bold;">${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}</a>`
    : `<span style="color:#999;">Sharing is on, but no position received yet</span>`;

  const accuracy =
    hasFix && loc.accuracy ? ` <span style="color:#999;">±${Math.round(loc.accuracy)}m</span>` : "";

  return `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;">
        <strong>${nameFromEmail(loc.email)}</strong><br>
        <span style="font-size:12px;color:#999;">${loc.email || ""}</span>
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;">${position}${accuracy}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;font-size:12px;color:${stale ? "#c47f17" : "#2f855a"};">
        ${ago(ageMs)}${stale && hasFix ? " (stale)" : ""}
      </td>
    </tr>`;
};

const digestHtml = (locations, now) => `
  <div style="font-family:sans-serif;max-width:640px;padding:20px;border:1px solid #e0e0e0;border-radius:8px;">
    <h2 style="color:#0F253B;margin:0 0 4px;">Operation live locations</h2>
    <p style="color:#666;font-size:13px;margin:0 0 16px;">
      ${locations.length} operation team member${locations.length === 1 ? "" : "s"} sharing as of
      ${new Date(now).toLocaleString("en-GB")}.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr style="text-align:left;color:#999;font-size:11px;text-transform:uppercase;letter-spacing:1px;">
        <th style="padding:0 8px 6px;">Operation</th>
        <th style="padding:0 8px 6px;">Position</th>
        <th style="padding:0 8px 6px;">Last fix</th>
      </tr>
      ${locations.map((l) => row(l, now)).join("")}
    </table>
    <p style="font-size:11px;color:#999;margin-top:16px;">
      Operation team members appear here only while their live location toggle is on.
      This email stops as soon as they switch it off.
    </p>
  </div>`;

/**
 * Send one digest per organization that has operation team members sharing.
 *
 * @returns {Promise<{sentCount:number, skipped:number, organizations:number, errors:Array}>}
 */
export const sendAllLocationDigests = async () => {
  const result = { sentCount: 0, skipped: 0, organizations: 0, errors: [] };

  try {
    const active = await AgentLocation.find({ active: true }).lean();

    // Group by organization so a team gets ONE email listing every sharer, not
    // one email per person.
    const byOrg = new Map();
    for (const loc of active) {
      const key = String(loc.organizationId);
      if (!byOrg.has(key)) byOrg.set(key, []);
      byOrg.get(key).push(loc);
    }

    result.organizations = byOrg.size;
    const now = Date.now();

    for (const [organizationId, locations] of byOrg) {
      try {
        // Already mailed this hour.
        const recentlyMailed = locations.every(
          (l) => l.lastEmailSentAt && now - new Date(l.lastEmailSentAt).getTime() < RESEND_GUARD_MS
        );
        if (recentlyMailed) {
          result.skipped++;
          continue;
        }

        const { to, cc } = await resolveAllOrgRecipients(organizationId);
        if (!to) {
          result.errors.push({ organizationId, error: "No recipient email" });
          continue;
        }

        await sendEmail({
          email: to,
          cc,
          subject: `Operation live locations — ${locations.length} sharing`,
          html: digestHtml(locations, now),
        });

        await AgentLocation.updateMany(
          { _id: { $in: locations.map((l) => l._id) } },
          { $set: { lastEmailSentAt: new Date() } }
        );

        result.sentCount++;
      } catch (err) {
        result.errors.push({ organizationId, error: err.message });
      }
    }
  } catch (error) {
    console.error("Location Digest Error:", error);
    result.errors.push({ error: error.message });
  }

  return result;
};
