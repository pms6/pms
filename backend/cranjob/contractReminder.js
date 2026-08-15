import Property from "../models/Property.js";
import Organization from "../models/Organization.js";
import User from "../models/User.js";
import env from "../config/env.js";
import { sendEmail } from "../utils/sendEmail.js";

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Days from today until `date`. Both ends are floored to midnight so a contract
 * ending later today reads as 0 rather than a fraction.
 */
export const daysUntil = (date) => {
  const end = new Date(date);
  end.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((end - today) / DAY_MS);
};

/**
 * Contract expiry state, derived from endDate every time it is asked for.
 *
 * Compliance stores its status in the document and recomputes it only in a
 * pre-save hook, which means a record that expires while nobody touches it
 * keeps reporting "warning" forever. Deriving it here avoids that entirely.
 */
export const contractStatus = (contract) => {
  if (!contract?.endDate) return { status: "none", days: null };

  const days = daysUntil(contract.endDate);
  const window = contract.reminderDaysBefore || 30;

  if (days < 0) return { status: "expired", days };
  if (days <= window) return { status: "warning", days };
  return { status: "valid", days };
};

/**
 * Who should hear about this property's contract. The organization owner's
 * account email, falling back to the configured mailbox so a reminder is never
 * silently dropped. (The compliance job hardcodes a single address for every
 * organization — this resolves it per property instead.)
 */
const resolveRecipient = async (organizationId) => {
  if (!organizationId) return env.mail.user || null;

  const org = await Organization.findById(organizationId).select("userId name").lean();
  if (!org?.userId) return env.mail.user || null;

  const owner = await User.findById(org.userId).select("email").lean();
  return owner?.email || env.mail.user || null;
};

/**
 * True if a reminder has already gone out for the current window, so the daily
 * job doesn't email every morning for the whole run-up to expiry.
 */
const alreadyReminded = (contract) => {
  if (!contract.lastReminderSentAt) return false;

  const windowOpens = new Date(contract.endDate);
  windowOpens.setDate(windowOpens.getDate() - (contract.reminderDaysBefore || 30));

  return new Date(contract.lastReminderSentAt) >= windowOpens;
};

export const sendAllContractReminders = async () => {
  const result = { sentCount: 0, skipped: 0, errors: [] };

  try {
    const properties = await Property.find({
      isDeleted: { $ne: true },
      "contract.endDate": { $ne: null, $exists: true },
      "contract.autoReminder": true,
    })
      .select("name organizationId contract")
      .lean();

    for (const property of properties) {
      try {
        const contract = property.contract || {};
        const { status, days } = contractStatus(contract);

        // Only inside the run-up window. An already-expired contract is not
        // chased — there is nothing left to remind about.
        if (status !== "warning" || days < 0) {
          result.skipped++;
          continue;
        }

        if (alreadyReminded(contract)) {
          result.skipped++;
          continue;
        }

        const recipient = await resolveRecipient(property.organizationId);
        if (!recipient) {
          result.errors.push({ propertyId: property._id, error: "No recipient email" });
          continue;
        }

        const endDate = new Date(contract.endDate).toLocaleDateString("en-GB");

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <h2 style="color: #F47C3C;">📄 Contract Expiring Soon</h2>
            <p><strong>Property:</strong> ${property.name}</p>
            <p><strong>Agreement:</strong> ${contract.agreementType || "—"}</p>
            <p><strong>End Date:</strong> ${endDate}</p>
            <p><strong>Days Remaining:</strong> <strong style="color: #e11d48;">${days} day${days === 1 ? "" : "s"}</strong></p>
            ${contract.tenantName ? `<p><strong>Tenant:</strong> ${contract.tenantName}</p>` : ""}
            ${
              contract.rollsToPeriodic
                ? `<p style="color:#475569;">This contract is set to roll into a periodic tenancy at the end of the fixed term.</p>`
                : `<p style="color:#e11d48;">This contract does <strong>not</strong> roll into a periodic tenancy — it ends on the date above.</p>`
            }
            <hr style="margin: 20px 0;">
            <p>Renew, re-let or serve notice before the end date.</p>
            <p><em>This is an automated reminder from your Property Management System.</em></p>
          </div>
        `;

        await sendEmail({
          email: recipient,
          subject: `Contract Expiring Soon — ${property.name} (${days} day${days === 1 ? "" : "s"})`,
          html: emailHtml,
        });

        // Stamp it so this window isn't emailed again tomorrow.
        await Property.updateOne(
          { _id: property._id },
          { $set: { "contract.lastReminderSentAt": new Date() } }
        );

        result.sentCount++;
      } catch (err) {
        result.errors.push({ propertyId: property._id, error: err.message });
      }
    }
  } catch (error) {
    console.error("Contract Reminder Error:", error);
    result.errors.push({ error: error.message });
  }

  return result;
};
