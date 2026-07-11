import Compliance from "../models/Compliance.js";
import { sendEmail } from "../utils/sendEmail.js";

export const sendAllPendingReminders = async () => {
  const result = { sentCount: 0, errors: [] };
  const today = new Date();

  try {
    // Find all compliance records where autoReminder is enabled and not yet expired
    const compliances = await Compliance.find({
      autoReminder: true,
      status: { $in: ["valid", "warning"] },
    })
      .populate("propertyId", "name address")
      .populate("createdBy", "email name") // Optional: if you want to email the creator
      .lean();

    for (const comp of compliances) {
      try {
        const expiryDate = new Date(comp.expiryDate);
        const daysUntilExpiry = Math.ceil(
          (expiryDate - today) / (1000 * 3600 * 24)
        );

        // Only send reminder if we are within the user's chosen reminder window
        if (daysUntilExpiry > 0 && daysUntilExpiry <= comp.reminderDaysBefore) {
          const propertyName = comp.propertyId?.name || "Unknown Property";

          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
              <h2 style="color: #F47C3C;">⚠️ Compliance Reminder</h2>
              <p><strong>Property:</strong> ${propertyName}</p>
              <p><strong>Certificate Type:</strong> ${comp.type}${
                comp.subType ? ` > ${comp.subType}` : ""
              }</p>
              <p><strong>Expiry Date:</strong> ${expiryDate.toLocaleDateString("en-GB")}</p>
              <p><strong>Days Remaining:</strong> <strong style="color: #e11d48;">${daysUntilExpiry} days</strong></p>
              
              <hr style="margin: 20px 0;">
              <p>Please take action to renew this compliance document before it expires.</p>
              <p><em>This is an automated reminder from your Property Management System.</em></p>
            </div>
          `;

          // TODO: Later improve to send to organization owner / admin email
          await sendEmail({
            email: "pmssystem6@gmail.com", // Replace with dynamic email later
            subject: `Compliance Expiring Soon - ${comp.type} (${propertyName})`,
            html: emailHtml,
          });

          result.sentCount++;
        }
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