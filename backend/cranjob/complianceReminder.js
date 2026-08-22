import Compliance from "../models/Compliance.js";
import { sendEmail } from "../utils/sendEmail.js";
import { daysUntil, expiryState, resolveOrgRecipients } from "../utils/reminders.js";

/**
 * True if a reminder has already gone out for the current window, so the daily
 * job doesn't email every morning for the whole run-up to expiry.
 *
 * The window opens `reminderDaysBefore` days before expiryDate. A stamp from
 * before that point belongs to the previous certificate cycle and is ignored.
 */
const alreadyReminded = (comp) => {
  if (!comp.lastReminderSentAt) return false;

  const windowOpens = new Date(comp.expiryDate);
  windowOpens.setDate(windowOpens.getDate() - (comp.reminderDaysBefore || 14));

  return new Date(comp.lastReminderSentAt) >= windowOpens;
};

const reminderHtml = ({ comp, propertyName, days, expiryDate }) => {
  const urgent = days <= 3;
  const heading = urgent
    ? `🚨 Compliance Expiring in ${days} day${days === 1 ? "" : "s"}`
    : "⚠️ Compliance Reminder";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <h2 style="color: #F47C3C;">${heading}</h2>
      <p><strong>Property:</strong> ${propertyName}</p>
      <p><strong>Certificate Type:</strong> ${comp.type}${comp.subType ? ` &gt; ${comp.subType}` : ""}</p>
      <p><strong>Expiry Date:</strong> ${expiryDate}</p>
      <p><strong>Days Remaining:</strong> <strong style="color: #e11d48;">${days} day${days === 1 ? "" : "s"}</strong></p>
      ${comp.notes ? `<p><strong>Notes:</strong> ${comp.notes}</p>` : ""}
      ${comp.fileUrl ? `<p><a href="${comp.fileUrl}" style="color:#F47C3C;">View the current certificate</a></p>` : ""}
      <hr style="margin: 20px 0;">
      <p>Please arrange the renewal before this certificate expires — letting it
      lapse can put the property out of compliance.</p>
      <p><em>This is an automated reminder from your Property Management System.</em></p>
    </div>
  `;
};

/**
 * Sweep: email the organization owner about every certificate whose expiry has
 * come inside its chosen reminder window.
 *
 * Candidates are selected on expiryDate, NOT on the stored `status` field —
 * that is only recomputed in the model's pre-save hook, so a record nobody has
 * touched keeps reporting whatever it was when last saved.
 *
 * @param {object} [opts]
 * @param {string} [opts.organizationId] Restrict to one organization. The cron
 *   job omits it to sweep every tenant; the admin-panel "Send Reminders" button
 *   passes its own org so pressing it can never fire another tenant's email.
 */
export const sendAllPendingReminders = async ({ organizationId } = {}) => {
  const result = { sentCount: 0, skipped: 0, errors: [] };

  try {
    // Widest possible window (the schema caps reminderDaysBefore at 365), then
    // narrow per record below using each one's own setting.
    const horizon = new Date();
    horizon.setHours(0, 0, 0, 0);
    horizon.setDate(horizon.getDate() + 365);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const compliances = await Compliance.find({
      autoReminder: true,
      expiryDate: { $gte: today, $lte: horizon },
      ...(organizationId ? { organizationId } : {}),
    })
      .populate("propertyId", "name address")
      .lean();

    for (const comp of compliances) {
      try {
        const { status, days } = expiryState(comp.expiryDate, comp.reminderDaysBefore);

        // Only inside the run-up window. Already-expired certificates are not
        // chased here — there is no renewal deadline left to warn about.
        if (status !== "warning") {
          result.skipped++;
          continue;
        }

        if (alreadyReminded(comp)) {
          result.skipped++;
          continue;
        }

        // Owner in `to`, active co-owners and managers copied in.
        const { to, cc } = await resolveOrgRecipients(comp.organizationId);
        if (!to) {
          result.errors.push({ complianceId: comp._id, error: "No recipient email" });
          continue;
        }

        const propertyName = comp.propertyId?.name || "Unknown Property";
        const expiryDate = new Date(comp.expiryDate).toLocaleDateString("en-GB");

        await sendEmail({
          email: to,
          cc,
          subject: `Compliance Expiring Soon — ${comp.type} at ${propertyName} (${days} day${days === 1 ? "" : "s"})`,
          html: reminderHtml({ comp, propertyName, days, expiryDate }),
        });

        // Stamp it so this window isn't emailed again tomorrow.
        await Compliance.updateOne(
          { _id: comp._id },
          { $set: { lastReminderSentAt: new Date(), status: "warning" } }
        );

        result.sentCount++;
      } catch (err) {
        result.errors.push({ complianceId: comp._id, error: err.message });
      }
    }
  } catch (error) {
    console.error("Compliance Reminder Error:", error);
    result.errors.push({ error: error.message });
  }

  return result;
};

export { daysUntil };
