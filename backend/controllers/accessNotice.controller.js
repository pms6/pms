// controllers/accessNotice.controller.js
//
// Access Notices — formal notice to a tenant that the property will be entered:
// the date, the time window, the reason and any instructions. Each notice is
// kept as a record of having been given (see models/AccessNotice.js).
//
// Staff issue, cancel and resend notices (/access-notices…); a tenant reads and
// acknowledges only their own (/access-notices/my…).

import mongoose from "mongoose";
import AccessNotice, { ACCESS_REASONS } from "../models/AccessNotice.js";
import Tenancy from "../models/Tenancy.js";
import Organization from "../models/Organization.js";
import Notification from "../models/Notification.js";
import { sendEmail } from "../utils/sendEmail.js";
import { resolveTenantProperty } from "../utils/tenantProperty.js";
import { staffDisplayName } from "../utils/orgTeam.js";
import { postSystemMessage } from "./tenantMessage.controller.js";
import env from "../config/env.js";

// One notice can go to every occupier of a house at once; this is a ceiling on
// that, not a quota.
const MAX_RECIPIENTS = 50;

// The office works on UK time, so the window the form takes is London time.
const TIME_ZONE = "Europe/London";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const unitOf = (t) => (t?.unit && t.unit !== "—" ? t.unit : "");

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The instant a London wall-clock time happens. Built by taking the time as if
// it were UTC, then correcting by however far London is from UTC at that
// moment (0 in winter, +1h in summer).
const londonInstant = (dateStr, timeStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(asUtc))
      .map((p) => [p.type, p.value])
  );
  const londonAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute)
  );
  return new Date(asUtc - (londonAsUtc - asUtc));
};

// Today's date in London, as "YYYY-MM-DD".
const londonToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());

// accessDate is stored at UTC midnight, so it is read back in UTC.
const fmtLongDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/* ------------------------------------------------------------------ *
 * Emails
 * ------------------------------------------------------------------ */

const noticeEmail = ({ notice, orgName, senderName, kind }) => {
  const when = fmtLongDate(notice.accessDate);
  const window = `${notice.windowStart} – ${notice.windowEnd}`;
  const link = `${env.clientUrl}/tenant/access-notices`;
  const reason = notice.reasonDetail ? `${notice.reason} — ${notice.reasonDetail}` : notice.reason;
  const where = [notice.property, notice.room].filter(Boolean).join(", ");

  if (kind === "cancellation") {
    return {
      subject: `Access notice cancelled — ${when}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; color: #0F253B;">
          <h2 style="color: #F47C3C;">Access Notice Cancelled</h2>
          <p>Dear ${esc(notice.tenantName || "Tenant")},</p>
          <p>The access to ${esc(where || "your property")} we gave you notice of for
            <strong>${esc(when)}</strong> between <strong>${esc(window)}</strong>
            (${esc(reason)}) has been <strong>cancelled</strong>. Nobody will attend at that time.</p>
          ${notice.cancelReason ? `<p><strong>Reason:</strong> ${esc(notice.cancelReason)}</p>` : ""}
          <p>Kind regards,<br>${esc(senderName)}${orgName ? `<br>${esc(orgName)}` : ""}</p>
        </div>`,
    };
  }

  return {
    subject: `${kind === "resend" ? "Reminder: " : ""}Notice of access to your property — ${when}, ${window}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; color: #0F253B;">
        <h2 style="color: #F47C3C; margin-bottom: 2px;">Notice of Access to Property</h2>
        <p style="color:#64748b; margin-top:0;">Issued ${esc(
          new Date(notice.sentAt).toLocaleString("en-GB", { timeZone: TIME_ZONE, dateStyle: "long", timeStyle: "short" })
        )}</p>
        <p>Dear ${esc(notice.tenantName || "Tenant")},</p>
        <p>We are writing to give you notice that access to ${esc(where || "your property")} is required as set out below.</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr><td style="padding:8px 10px;border:1px solid #e5e7eb;background:#f8fafc;width:160px;"><strong>Date</strong></td><td style="padding:8px 10px;border:1px solid #e5e7eb;">${esc(when)}</td></tr>
          <tr><td style="padding:8px 10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Time window</strong></td><td style="padding:8px 10px;border:1px solid #e5e7eb;">${esc(window)}</td></tr>
          <tr><td style="padding:8px 10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Reason for access</strong></td><td style="padding:8px 10px;border:1px solid #e5e7eb;">${esc(reason)}</td></tr>
          ${notice.attendee ? `<tr><td style="padding:8px 10px;border:1px solid #e5e7eb;background:#f8fafc;"><strong>Attending</strong></td><td style="padding:8px 10px;border:1px solid #e5e7eb;">${esc(notice.attendee)}</td></tr>` : ""}
          ${notice.instructions ? `<tr><td style="padding:8px 10px;border:1px solid #e5e7eb;background:#f8fafc;vertical-align:top;"><strong>Instructions</strong></td><td style="padding:8px 10px;border:1px solid #e5e7eb;white-space:pre-line;">${esc(notice.instructions)}</td></tr>` : ""}
        </table>
        <p>You do not need to be present. If the date or time is not convenient, please let us know as soon as possible through the tenant portal.</p>
        <p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#F47C3C;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">View and acknowledge this notice</a></p>
        <p>Kind regards,<br>${esc(senderName)}${orgName ? `<br>${esc(orgName)}` : ""}</p>
      </div>`,
  };
};

// Sends one of the notice emails and records the attempt on the notice. Never
// throws: a failed email is recorded, not fatal — the notice still stands in
// the portal, and the office can resend.
const deliver = async (notice, { orgName, senderName, kind }) => {
  const to = notice.tenantEmail;
  const entry = { at: new Date(), to, ok: false, error: "", kind };

  if (!to) {
    entry.error = "No email address on the tenancy";
  } else {
    try {
      const { subject, html } = noticeEmail({ notice, orgName, senderName, kind });
      await sendEmail({ email: to, subject, html });
      entry.ok = true;
    } catch (err) {
      entry.error = err.message || "Email failed";
    }
  }

  notice.emailLog.push(entry);
  if (kind !== "cancellation") {
    notice.emailStatus = entry.ok ? "sent" : to ? "failed" : "skipped";
    notice.emailError = entry.error;
    notice.emailedTo = to || "";
  }
  return entry.ok;
};

const chatLine = (notice) => {
  const reason = notice.reasonDetail ? `${notice.reason} — ${notice.reasonDetail}` : notice.reason;
  return [
    `📋 Access notice: ${fmtLongDate(notice.accessDate)}, ${notice.windowStart}–${notice.windowEnd}`,
    `Reason: ${reason}`,
    notice.attendee ? `Attending: ${notice.attendee}` : "",
    notice.instructions ? `Instructions: ${notice.instructions}` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

/* ------------------------------------------------------------------ *
 * Staff
 * ------------------------------------------------------------------ */

// @desc    Access notices for the organization
// @route   GET /api/v1/access-notices?status=&when=upcoming|past&q=&tenancyId=
export const listNotices = async (req, res) => {
  try {
    const filter = { organizationId: req.user.organizationId };
    const { status, when, q, tenancyId } = req.query;

    if (status && ["sent", "cancelled"].includes(status)) filter.status = status;
    if (tenancyId && mongoose.isValidObjectId(tenancyId)) filter.tenancyId = tenancyId;

    const today = new Date(`${londonToday()}T00:00:00.000Z`);
    if (when === "upcoming") filter.accessDate = { $gte: today };
    if (when === "past") filter.accessDate = { $lt: today };

    if (q && String(q).trim()) {
      const needle = { $regex: escapeRegex(String(q).trim()), $options: "i" };
      filter.$or = [{ tenantName: needle }, { tenantEmail: needle }, { property: needle }, { room: needle }, { reason: needle }];
    }

    const notices = await AccessNotice.find(filter)
      .sort({ accessDate: -1, windowStart: -1, createdAt: -1 })
      .limit(500)
      .lean();

    return res.status(200).json({ success: true, data: notices });
  } catch (error) {
    console.error("List Access Notices Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load access notices." });
  }
};

const findOwn = (req) =>
  mongoose.isValidObjectId(req.params.id)
    ? AccessNotice.findOne({ _id: req.params.id, organizationId: req.user.organizationId })
    : null;

// @desc    One notice in full
// @route   GET /api/v1/access-notices/:id
export const getNotice = async (req, res) => {
  try {
    const notice = await findOwn(req);
    if (!notice) return res.status(404).json({ success: false, message: "Access notice not found." });
    return res.status(200).json({ success: true, data: notice });
  } catch (error) {
    console.error("Get Access Notice Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load the access notice." });
  }
};

// @desc    Issue a notice to one or more tenants
// @route   POST /api/v1/access-notices
// @body    { tenancyIds[], accessDate "YYYY-MM-DD", windowStart "HH:MM",
//            windowEnd "HH:MM", reason, reasonDetail?, instructions?, attendee?,
//            sendEmail = true }
export const createNotices = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const b = req.body || {};

    const tenancyIds = [...new Set((Array.isArray(b.tenancyIds) ? b.tenancyIds : []).map(String))];
    if (tenancyIds.length === 0) {
      return res.status(400).json({ success: false, message: "Choose at least one tenant." });
    }
    if (tenancyIds.length > MAX_RECIPIENTS) {
      return res.status(400).json({ success: false, message: `A notice can go to at most ${MAX_RECIPIENTS} tenants at once.` });
    }
    if (!tenancyIds.every((id) => mongoose.isValidObjectId(id))) {
      return res.status(400).json({ success: false, message: "Invalid tenant selection." });
    }

    const accessDate = String(b.accessDate || "");
    const windowStart = String(b.windowStart || "");
    const windowEnd = String(b.windowEnd || "");
    if (!DATE_RE.test(accessDate) || Number.isNaN(Date.parse(accessDate))) {
      return res.status(400).json({ success: false, message: "Choose the date access is needed." });
    }
    if (!TIME_RE.test(windowStart) || !TIME_RE.test(windowEnd)) {
      return res.status(400).json({ success: false, message: "Enter the start and end of the access window." });
    }
    if (windowEnd <= windowStart) {
      return res.status(400).json({ success: false, message: "The window must end after it starts." });
    }
    if (accessDate < londonToday()) {
      return res.status(400).json({ success: false, message: "The access date can't be in the past." });
    }
    if (!ACCESS_REASONS.includes(b.reason)) {
      return res.status(400).json({ success: false, message: "Choose the reason for access." });
    }
    const reasonDetail = String(b.reasonDetail || "").trim();
    if (b.reason === "Other" && !reasonDetail) {
      return res.status(400).json({ success: false, message: "Describe the reason for access." });
    }

    const tenancies = await Tenancy.find({
      _id: { $in: tenancyIds },
      organizationId,
      isDeleted: false,
    }).lean();
    if (tenancies.length !== tenancyIds.length) {
      return res.status(400).json({ success: false, message: "One or more of the chosen tenants could not be found." });
    }

    const startsAt = londonInstant(accessDate, windowStart);
    const noticeHours = Math.round(((startsAt.getTime() - Date.now()) / 3600000) * 10) / 10;

    const [org, senderName] = await Promise.all([
      Organization.findById(organizationId).select("name").lean(),
      staffDisplayName(req.user),
    ]);
    const orgName = org?.name || "";
    const sendMail = b.sendEmail !== false;

    const created = [];
    for (const t of tenancies) {
      const notice = new AccessNotice({
        organizationId,
        tenancyId: t._id,
        tenantEmail: t.tenantEmail || "",
        tenantName: t.tenant || "",
        propertyId: t.propertyId || null,
        property: t.property || "",
        room: unitOf(t),
        accessDate: new Date(`${accessDate}T00:00:00.000Z`),
        windowStart,
        windowEnd,
        reason: b.reason,
        reasonDetail,
        instructions: String(b.instructions || "").trim(),
        attendee: String(b.attendee || "").trim(),
        status: "sent",
        sentAt: new Date(),
        sentBy: req.user._id,
        sentByEmail: req.user.email || "",
        noticeHours,
      });

      if (sendMail) await deliver(notice, { orgName, senderName, kind: "notice" });
      await notice.save();

      // The notice also appears in the tenant's conversation with the office.
      await postSystemMessage({ organizationId, tenancy: t, user: req.user, body: chatLine(notice), relatedId: notice._id });

      created.push(notice);
    }

    const failed = created.filter((n) => sendMail && n.emailStatus !== "sent").length;
    return res.status(201).json({
      success: true,
      message:
        `Access notice sent to ${created.length} tenant${created.length === 1 ? "" : "s"}.` +
        (failed ? ` ${failed} email${failed === 1 ? "" : "s"} could not be delivered — the notice is in their portal; try Resend.` : ""),
      data: created,
      emailFailures: failed,
    });
  } catch (error) {
    console.error("Create Access Notice Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to send the access notice." });
  }
};

// @desc    Send the notice email again (e.g. after a delivery failure)
// @route   POST /api/v1/access-notices/:id/resend
export const resendNotice = async (req, res) => {
  try {
    const notice = await findOwn(req);
    if (!notice) return res.status(404).json({ success: false, message: "Access notice not found." });
    if (notice.status === "cancelled") {
      return res.status(400).json({ success: false, message: "A cancelled notice can't be resent." });
    }

    const [org, senderName] = await Promise.all([
      Organization.findById(notice.organizationId).select("name").lean(),
      staffDisplayName(req.user),
    ]);
    const ok = await deliver(notice, { orgName: org?.name || "", senderName, kind: "resend" });
    await notice.save();

    if (!ok) {
      return res.status(502).json({ success: false, message: `The email could not be sent: ${notice.emailError}`, data: notice });
    }
    return res.status(200).json({ success: true, message: "Notice emailed again.", data: notice });
  } catch (error) {
    console.error("Resend Access Notice Error:", error);
    return res.status(500).json({ success: false, message: "Failed to resend the access notice." });
  }
};

// @desc    Cancel a notice — the tenant is told nobody will attend
// @route   PATCH /api/v1/access-notices/:id/cancel   { reason?, sendEmail = true }
export const cancelNotice = async (req, res) => {
  try {
    const notice = await findOwn(req);
    if (!notice) return res.status(404).json({ success: false, message: "Access notice not found." });
    if (notice.status === "cancelled") {
      return res.status(400).json({ success: false, message: "This notice is already cancelled." });
    }

    notice.status = "cancelled";
    notice.cancelledAt = new Date();
    notice.cancelledBy = req.user._id;
    notice.cancelReason = String(req.body?.reason || "").trim().slice(0, 1000);

    const [org, senderName] = await Promise.all([
      Organization.findById(notice.organizationId).select("name").lean(),
      staffDisplayName(req.user),
    ]);
    if (req.body?.sendEmail !== false) {
      await deliver(notice, { orgName: org?.name || "", senderName, kind: "cancellation" });
    }
    await notice.save();

    const tenancy = notice.tenancyId ? await Tenancy.findById(notice.tenancyId).lean() : null;
    await postSystemMessage({
      organizationId: notice.organizationId,
      tenancy: tenancy || { _id: notice.tenancyId, tenantEmail: notice.tenantEmail, tenant: notice.tenantName, property: notice.property, unit: notice.room },
      user: req.user,
      body: `❌ Access notice cancelled: ${fmtLongDate(notice.accessDate)}, ${notice.windowStart}–${notice.windowEnd} (${notice.reason}). Nobody will attend.${notice.cancelReason ? `\nReason: ${notice.cancelReason}` : ""}`,
      relatedId: notice._id,
    });

    return res.status(200).json({ success: true, message: "Access notice cancelled.", data: notice });
  } catch (error) {
    console.error("Cancel Access Notice Error:", error);
    return res.status(500).json({ success: false, message: "Failed to cancel the access notice." });
  }
};

/* ------------------------------------------------------------------ *
 * Tenant
 * ------------------------------------------------------------------ */

const tenantFilter = async (user) => {
  if (user?.role !== "Tenant") return null;
  const email = String(user.email || "").toLowerCase();
  if (!email) return null;
  const { tenancy } = await resolveTenantProperty(user);
  if (!tenancy?.organizationId) return null;
  return { organizationId: tenancy.organizationId, tenantEmail: email };
};

// @desc    The signed-in tenant's access notices, upcoming first. Opening the
//          list records that the tenant has seen them.
// @route   GET /api/v1/access-notices/my
export const getMyNotices = async (req, res) => {
  try {
    const filter = await tenantFilter(req.user);
    if (!filter) return res.status(200).json({ success: true, data: [] });

    const notices = await AccessNotice.find(filter)
      .select("-emailLog -emailError -sentBy -cancelledBy")
      .sort({ accessDate: -1, windowStart: -1 })
      .limit(200)
      .lean();

    await AccessNotice.updateMany({ ...filter, viewedAt: null }, { $set: { viewedAt: new Date() } });

    return res.status(200).json({ success: true, data: notices });
  } catch (error) {
    console.error("Get My Access Notices Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load access notices." });
  }
};

// @desc    How many live notices the tenant has not acknowledged yet
// @route   GET /api/v1/access-notices/my/pending
export const getMyPendingCount = async (req, res) => {
  try {
    const filter = await tenantFilter(req.user);
    if (!filter) return res.status(200).json({ success: true, count: 0 });

    const count = await AccessNotice.countDocuments({
      ...filter,
      status: "sent",
      acknowledgedAt: null,
      accessDate: { $gte: new Date(`${londonToday()}T00:00:00.000Z`) },
    });
    return res.status(200).json({ success: true, count });
  } catch (error) {
    console.error("My Pending Access Notices Error:", error);
    return res.status(500).json({ success: false, message: "Failed to count access notices." });
  }
};

// @desc    The tenant acknowledges a notice
// @route   PATCH /api/v1/access-notices/my/:id/acknowledge
export const acknowledgeNotice = async (req, res) => {
  try {
    const filter = await tenantFilter(req.user);
    if (!filter || !mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: "Access notice not found." });
    }

    const notice = await AccessNotice.findOne({ _id: req.params.id, ...filter });
    if (!notice) return res.status(404).json({ success: false, message: "Access notice not found." });
    if (notice.status === "cancelled") {
      return res.status(400).json({ success: false, message: "This notice was cancelled." });
    }

    if (!notice.acknowledgedAt) {
      notice.acknowledgedAt = new Date();
      if (!notice.viewedAt) notice.viewedAt = notice.acknowledgedAt;
      await notice.save();

      // Tell whoever sent it.
      if (notice.sentBy) {
        await Notification.create({
          organizationId: notice.organizationId,
          userId: notice.sentBy,
          type: "access_notice_ack",
          title: `${notice.tenantName || notice.tenantEmail} acknowledged an access notice`,
          message: `${fmtLongDate(notice.accessDate)}, ${notice.windowStart}–${notice.windowEnd} · ${notice.reason}`,
          relatedType: "AccessNotice",
          relatedId: notice._id,
          actorEmail: notice.tenantEmail,
        }).catch((err) => console.error("Access notice ack notification failed:", err.message));
      }
    }

    return res.status(200).json({ success: true, message: "Thank you — notice acknowledged.", data: notice });
  } catch (error) {
    console.error("Acknowledge Access Notice Error:", error);
    return res.status(500).json({ success: false, message: "Failed to acknowledge the notice." });
  }
};
