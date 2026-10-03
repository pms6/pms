// cranjob/councilTaxReminder.js
//
// "Next due payment" reminders for the Council Tax sheet. Every unpaid
// instalment whose due date falls within the next DUE_SOON_DAYS days (or has
// already passed) is reminded about once — one email per organization listing
// them all, plus a bell notification for the team.
//
// Each instalment is reminded once per due date (see remindedDueDates on the
// model), so the daily run doesn't repeat itself every morning.

import mongoose from "mongoose";
import CouncilTax from "../models/CouncilTax.js";
import Notification from "../models/Notification.js";
import { sendEmail } from "../utils/sendEmail.js";
import { daysUntil, resolveOrgRecipients } from "../utils/reminders.js";
import { orgTeamUserIds } from "../utils/orgTeam.js";

// MUST match DUE_SOON_DAYS in frontend/src/app/Shared/CouncilTaxBillsBoard.js.
export const DUE_SOON_DAYS = 7;

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const money = (n) =>
  n === null || n === undefined
    ? "amount not set"
    : `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Due dates are stored at UTC midnight, so they are read back in UTC.
const fmt = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const sameDay = (a, b) => new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);

const dueLabel = (days) =>
  days < 0 ? `Overdue by ${-days} day${days === -1 ? "" : "s"}` : days === 0 ? "Due today" : `Due in ${days} day${days === 1 ? "" : "s"}`;

/**
 * Sends every pending council tax reminder.
 *
 * `organizationId` limits the run to one organization — the "Send reminders
 * now" button passes its own so pressing it can never email another
 * organization. The daily job passes nothing and sweeps them all.
 */
export const sendCouncilTaxReminders = async ({ organizationId } = {}) => {
  const result = { sentCount: 0, instalments: 0, errors: [] };

  try {
    const filter = { isDeleted: false, "installments.0": { $exists: true } };
    if (organizationId) filter.organizationId = new mongoose.Types.ObjectId(String(organizationId));

    const rows = await CouncilTax.find(filter)
      .select("organizationId property councilName accountNumber installments remindedDueDates")
      .lean();

    // organizationId → [{ row, inst, days, n }]
    const byOrg = new Map();
    for (const row of rows) {
      row.installments.forEach((inst, n) => {
        if (inst.paidAt || !inst.dueDate) return;
        const days = daysUntil(inst.dueDate);
        if (days > DUE_SOON_DAYS) return;
        if ((row.remindedDueDates || []).some((d) => sameDay(d, inst.dueDate))) return;
        const key = String(row.organizationId);
        if (!byOrg.has(key)) byOrg.set(key, []);
        byOrg.get(key).push({ row, inst, days, n });
      });
    }

    for (const [orgId, items] of byOrg) {
      try {
        items.sort((a, b) => a.days - b.days);

        const { to, cc } = await resolveOrgRecipients(orgId);
        if (!to) {
          result.errors.push({ organizationId: orgId, error: "No recipient email" });
          continue;
        }

        const lines = items
          .map(
            ({ row, inst, days, n }) => `
              <tr>
                <td style="padding:6px 8px;border:1px solid #e5e7eb;">${esc(row.property)}${row.councilName ? `<br><span style="color:#64748b;font-size:12px;">${esc(row.councilName)}${row.accountNumber ? ` · ${esc(row.accountNumber)}` : ""}</span>` : ""}</td>
                <td style="padding:6px 8px;border:1px solid #e5e7eb;">Instalment ${n + 1}</td>
                <td style="padding:6px 8px;border:1px solid #e5e7eb;"><strong>${esc(money(inst.amount))}</strong></td>
                <td style="padding:6px 8px;border:1px solid #e5e7eb;">${esc(fmt(inst.dueDate))}</td>
                <td style="padding:6px 8px;border:1px solid #e5e7eb;color:${days <= 0 ? "#e11d48" : "#b45309"};"><strong>${esc(dueLabel(days))}</strong></td>
              </tr>`
          )
          .join("");

        const overdue = items.filter((i) => i.days < 0).length;

        await sendEmail({
          email: to,
          cc,
          subject: `Council tax payment${items.length === 1 ? "" : "s"} due — ${items.length} instalment${items.length === 1 ? "" : "s"}${overdue ? ` (${overdue} overdue)` : ""}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 720px; color:#0F253B;">
              <h2 style="color: #F47C3C;">🏛️ Council Tax Payments Due</h2>
              <p>The following council tax instalments are due within the next ${DUE_SOON_DAYS} days or are overdue:</p>
              <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
                <thead><tr style="background:#f8fafc;text-align:left;">
                  <th style="padding:6px 8px;border:1px solid #e5e7eb;">Property</th>
                  <th style="padding:6px 8px;border:1px solid #e5e7eb;">Instalment</th>
                  <th style="padding:6px 8px;border:1px solid #e5e7eb;">Amount</th>
                  <th style="padding:6px 8px;border:1px solid #e5e7eb;">Due date</th>
                  <th style="padding:6px 8px;border:1px solid #e5e7eb;">Status</th>
                </tr></thead>
                <tbody>${lines}</tbody>
              </table>
              <p style="margin-top:16px;">Once paid, tick the instalment off in Council Tax and Bills so it stops counting as outstanding.</p>
              <p><em>This is an automated reminder from your Property Management System.</em></p>
            </div>`,
        });

        // The bell, for the owner and admins inside the PMS — Council Tax and
        // Bills lives in the owner portal only.
        const userIds = await orgTeamUserIds(orgId, ["OWNER", "ADMIN"]);
        if (userIds.length) {
          const notifications = [];
          for (const { row, inst, days, n } of items) {
            for (const userId of userIds) {
              notifications.push({
                organizationId: orgId,
                userId,
                type: "council_tax_due",
                title: `Council tax ${days < 0 ? "overdue" : "due"} — ${row.property}`,
                message: `Instalment ${n + 1}: ${money(inst.amount)} · ${dueLabel(days)} (${fmt(inst.dueDate)})`,
                relatedType: "CouncilTax",
                relatedId: row._id,
              });
            }
          }
          await Notification.insertMany(notifications);
        }

        // Stamp each reminded due date so tomorrow's run skips it.
        for (const { row, inst } of items) {
          await CouncilTax.updateOne({ _id: row._id }, { $addToSet: { remindedDueDates: inst.dueDate } });
        }

        result.sentCount++;
        result.instalments += items.length;
      } catch (err) {
        result.errors.push({ organizationId: orgId, error: err.message });
      }
    }
  } catch (error) {
    console.error("Council Tax Reminder Error:", error);
    result.errors.push({ error: error.message });
  }

  return result;
};
