import EmailRecord, { DONE_STATUSES } from "../models/EmailRecord.js";
import Notification from "../models/Notification.js";
import Organization from "../models/Organization.js";
import OrganizationMember from "../models/OrganizationMember.js";
import User from "../models/User.js";
import { sendEmail } from "../utils/sendEmail.js";
import { resolveOrgRecipients } from "../utils/reminders.js";
import env from "../config/env.js";

// Record text is whatever staff typed, dropped into an HTML email.
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");
const sameDay = (a, b) => a && b && new Date(a).toDateString() === new Date(b).toDateString();
const recordUrl = (row) => `${env.clientUrl}/admin/email-records?open=${row._id}`;

const recordHtml = (row, heading, lead) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px;">
    <h2 style="color: #F47C3C;">${heading}</h2>
    <p>${lead}</p>
    <p><strong>Property:</strong> ${escapeHtml(row.property)}</p>
    <p><strong>Date:</strong> ${fmt(row.date)} &nbsp; <strong>Priority:</strong> ${escapeHtml(row.priority)} &nbsp; <strong>Status:</strong> ${escapeHtml(row.status)}</p>
    ${row.subject ? `<p><strong>Subject:</strong> ${escapeHtml(row.subject)}</p>` : ""}
    <p><strong>Issue:</strong> ${escapeHtml(row.issue)}</p>
    <p><strong>Follow-up date:</strong> ${fmt(row.followUpDate)}</p>
    <p><strong>Reply received:</strong> ${row.replyReceived ? `Yes (${fmt(row.replyDate)})` : "No"}</p>
    ${row.followUpNotes ? `<p><strong>Follow-up notes:</strong> ${escapeHtml(row.followUpNotes)}</p>` : ""}
    <p><a href="${recordUrl(row)}" style="color:#F47C3C;">Open the email record</a></p>
    <hr style="margin: 20px 0;">
    <p><em>This is an automated reminder from your Property Management System.</em></p>
  </div>
`;

// Owner, admins and managers — the people an escalation goes up to.
const escalationUserIds = async (organizationId) => {
  const [org, members] = await Promise.all([
    Organization.findById(organizationId).select("userId").lean(),
    OrganizationMember.find({
      organizationId,
      role: { $in: ["OWNER", "ADMIN", "MANAGER"] },
      status: "ACTIVE",
    })
      .select("userId")
      .lean(),
  ]);
  const ids = [org?.userId, ...members.map((m) => m.userId)].filter(Boolean).map(String);
  return [...new Set(ids)];
};

const notify = async (organizationId, userIds, { type, title, message, relatedId }) => {
  const docs = userIds.map((userId) => ({
    organizationId,
    userId,
    type,
    title,
    message,
    relatedType: "EmailRecord",
    relatedId,
    actorEmail: "",
  }));
  if (!docs.length) return;
  try {
    await Notification.insertMany(docs, { ordered: false });
  } catch (err) {
    console.error("Email record notification write failed:", err.message);
  }
};

/**
 * Daily sweep over open email records:
 *
 *  - Follow-up reminder: the follow-up date has arrived (today or earlier) and
 *    the record is not Resolved / Closed. The assignee — or, if nobody is
 *    assigned, whoever logged it — gets an in-app notification and an email.
 *    Sent once per follow-up date (`reminderSentFor`), so moving the date on
 *    earns a fresh reminder and leaving it alone does not repeat daily.
 *
 *  - Escalation: an Urgent record still unresolved after its follow-up date
 *    has passed is flagged `escalated`, and the owner, admins and managers are
 *    told in-app and by email. Cleared again when the record is resolved or
 *    given a later follow-up date (see applyDerived in the controller).
 *
 * @param {object} [opts]
 * @param {string} [opts.organizationId] Restrict to one organization — the
 *   admin "Run reminders" button passes its own so it never mails another
 *   tenant's staff.
 */
export const sweepEmailFollowUps = async ({ organizationId } = {}) => {
  const result = { reminders: 0, escalations: 0, errors: [] };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  let rows = [];
  try {
    rows = await EmailRecord.find({
      isDeleted: false,
      status: { $nin: DONE_STATUSES },
      followUpDate: { $ne: null, $lt: endOfToday },
      ...(organizationId ? { organizationId } : {}),
    }).lean();
  } catch (error) {
    console.error("Email Follow-up Sweep Error:", error);
    result.errors.push({ error: error.message });
    return result;
  }

  for (const row of rows) {
    try {
      // ---- follow-up reminder ------------------------------------------
      if (!sameDay(row.reminderSentFor, row.followUpDate)) {
        const recipientId = row.assignedTo || row.createdBy;
        if (recipientId) {
          const overdue = new Date(row.followUpDate) < startOfToday;
          const title = `${overdue ? "Overdue follow-up" : "Follow-up due today"} — ${row.property}`;
          const lead = row.replyReceived
            ? "This email record is due a follow-up."
            : "No reply has been recorded for this email and its follow-up date has arrived.";

          await notify(row.organizationId, [String(recipientId)], {
            type: "email_followup",
            title,
            message: row.issue.slice(0, 200),
            relatedId: row._id,
          });

          const user = await User.findById(recipientId).select("email").lean();
          if (user?.email) {
            await sendEmail({
              email: user.email,
              subject: title,
              html: recordHtml(row, title, lead),
            }).catch((err) => result.errors.push({ recordId: row._id, error: err.message }));
          }
        }

        await EmailRecord.updateOne(
          { _id: row._id },
          { $set: { reminderSentFor: row.followUpDate, status: row.status === "Open" ? "Follow-Up Required" : row.status } }
        );
        result.reminders++;
      }

      // ---- escalation ---------------------------------------------------
      if (row.priority === "Urgent" && !row.escalated && new Date(row.followUpDate) < startOfToday) {
        const title = `Escalated: urgent issue unresolved — ${row.property}`;
        const ids = await escalationUserIds(row.organizationId);
        if (row.assignedTo) ids.push(String(row.assignedTo));

        await notify(row.organizationId, [...new Set(ids)], {
          type: "email_escalated",
          title,
          message: row.issue.slice(0, 200),
          relatedId: row._id,
        });

        const { to, cc } = await resolveOrgRecipients(row.organizationId);
        if (to) {
          await sendEmail({
            email: to,
            cc,
            subject: title,
            html: recordHtml(
              row,
              "🚨 Urgent issue escalated",
              `This urgent issue is still unresolved after its follow-up date of ${fmt(row.followUpDate)}.`
            ),
          }).catch((err) => result.errors.push({ recordId: row._id, error: err.message }));
        }

        await EmailRecord.updateOne(
          { _id: row._id },
          { $set: { escalated: true, escalatedAt: new Date() } }
        );
        result.escalations++;
      }
    } catch (err) {
      result.errors.push({ recordId: row._id, error: err.message });
    }
  }

  return result;
};
