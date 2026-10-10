import EmailRecord from "../models/EmailRecord.js";
import { sendEmail } from "../utils/sendEmail.js";

const escapeHtml = (value) => String(value || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

export const sendScheduledEmails = async () => {
  const result = { sent: 0, failed: 0, errors: [] };
  const due = await EmailRecord.find({
    isDeleted: false,
    emailStatus: "Scheduled",
    scheduledSendAt: { $lte: new Date() },
  }).sort({ scheduledSendAt: 1 }).limit(50).select("_id").lean();

  for (const item of due) {
    const row = await EmailRecord.findOneAndUpdate(
      { _id: item._id, emailStatus: "Scheduled", isDeleted: false },
      { $set: { emailStatus: "Sending" } },
      { new: true }
    );
    if (!row) continue;
    try {
      const attachments = (row.files || []).filter((file) => file.url).map((file) => ({
        filename: file.name || "attachment",
        path: file.url,
      }));
      const info = await sendEmail({
        organizationId: row.organizationId,
        email: row.emailTo,
        subject: row.subject || row.issue.slice(0, 80) || "(no subject)",
        text: row.issue,
        html: `<div style="font-family:Arial,sans-serif;white-space:pre-wrap">${escapeHtml(row.issue)}</div>`,
        attachments,
      });
      row.emailStatus = "Sent";
      row.emailSentAt = new Date();
      row.emailMessageId = info?.messageId || "";
      row.emailError = "";
      await row.save();
      result.sent++;
    } catch (error) {
      row.emailStatus = "Failed";
      row.emailError = String(error.message || "Sending failed.").slice(0, 500);
      await row.save();
      result.failed++;
      result.errors.push({ recordId: row._id, error: row.emailError });
    }
  }
  return result;
};
