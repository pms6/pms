// cranjob/locationDigest.js
//
// Hourly digest of where the organization's operation team is.
//
// Runs on the hour and mails every ACTIVE member of each organization that has
// at least one operation team member sharing AND still online. Anyone who has
// switched the toggle off is not in the query at all, so no email mentions
// them — switching off means no visibility and no mail, which is the whole
// promise of the switch.
//
// Someone whose toggle is still on but whose fixes have stopped arriving is
// left out too. A closed laptop, a phone in a pocket, a tab left open
// overnight: the position is old, and an hourly email presenting an old
// position in a "live locations" table reads as though they are standing
// there now. No line at all is more honest than a stale one.
//
// Organizations with nobody online get no email. A quiet hour should be quiet.
import AgentLocation from "../models/AgentLocation.js";
import { STALE_AFTER_MS } from "../controllers/agentLocation.controller.js";
import { resolveAllOrgRecipients } from "../utils/reminders.js";
import { sendEmail } from "../utils/sendEmail.js";

// Don't mail the same organization twice within the hour, so a restart or a
// manual trigger cannot double-send.
const RESEND_GUARD_MS = 55 * 60 * 1000;

const nameFromEmail = (email) => (email ? String(email).split("@")[0] : "a team member");

/**
 * Is this sharer actually online right now?
 *
 * The same rule and the same window the Live Location board uses
 * (STALE_AFTER_MS, twice the client's ping interval), so the email and the
 * screen never disagree about who is live.
 *
 * Number.isFinite rather than a null check: a row written before lat/lng
 * existed has them undefined, and `undefined !== null` would let it through
 * to .toFixed().
 */
const isOnline = (loc, now) => {
  if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return false;
  if (!loc.lastPingAt) return false;
  return now - new Date(loc.lastPingAt).getTime() <= STALE_AFTER_MS;
};

const mapsLink = (lat, lng) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

const ago = (ms) => {
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.round(mins / 60);
  return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`;
};

// Only ever called with a row that passed isOnline(), so the fix exists and is
// recent. There is no "no position yet" case to render and nothing to mark
// stale — keeping an old position off the email is what the filter is for.
const row = (loc, now) => {
  const ageMs = now - new Date(loc.lastPingAt).getTime();

  const position = `<a href="${mapsLink(loc.lat, loc.lng)}" style="color:#F47C3C;font-weight:bold;">${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}</a>`;

  const accuracy = loc.accuracy
    ? ` <span style="color:#999;">±${Math.round(loc.accuracy)}m</span>`
    : "";

  return `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;">
        <strong>${nameFromEmail(loc.email)}</strong><br>
        <span style="font-size:12px;color:#999;">${loc.email || ""}</span>
      </td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;">${position}${accuracy}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #eee;font-size:12px;color:#2f855a;">
        ${ago(ageMs)}
      </td>
    </tr>`;
};

const digestHtml = (locations, now) => `
  <div style="font-family:sans-serif;max-width:640px;padding:20px;border:1px solid #e0e0e0;border-radius:8px;">
    <h2 style="color:#0F253B;margin:0 0 4px;">Operation live locations</h2>
    <p style="color:#666;font-size:13px;margin:0 0 16px;">
      ${locations.length} operation team member${locations.length === 1 ? "" : "s"} online as of
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
      Operation team members appear here only while their live location toggle is on
      and their position is still arriving. This email stops as soon as they switch
      it off, and anyone whose device has gone quiet is left out rather than listed
      with an old position.
    </p>
  </div>`;

/**
 * Send one digest per organization that has operation team members online.
 *
 * `offline` counts sharers whose toggle is on but whose fixes have stopped —
 * they are in nobody's email.
 *
 * @returns {Promise<{sentCount:number, skipped:number, offline:number, organizations:number, errors:Array}>}
 */
export const sendAllLocationDigests = async () => {
  const result = { sentCount: 0, skipped: 0, offline: 0, organizations: 0, errors: [] };

  try {
    const active = await AgentLocation.find({ active: true }).lean();
    const now = Date.now();

    // Group by organization so a team gets ONE email listing every sharer, not
    // one email per person. Sharers who have gone quiet are dropped here, which
    // is also what empties an organization out of the map entirely — no online
    // sharers, no entry, no email.
    const byOrg = new Map();
    for (const loc of active) {
      if (!isOnline(loc, now)) {
        result.offline++;
        continue;
      }
      const key = String(loc.organizationId);
      if (!byOrg.has(key)) byOrg.set(key, []);
      byOrg.get(key).push(loc);
    }

    result.organizations = byOrg.size;

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
          subject: `Operation live locations — ${locations.length} online`,
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
