// controllers/tenantMessage.controller.js
//
// Tenant Chat — the property management team and a tenant messaging each other
// inside the PMS. See models/TenantMessage.js for how a conversation is keyed.
//
// Two audiences, kept strictly apart:
//   • a TENANT only ever reads and writes their own conversation (/my…);
//   • STAFF see every conversation in their organization (/threads…).

import mongoose from "mongoose";
import TenantMessage, { MESSAGE_MAX_LENGTH } from "../models/TenantMessage.js";
import Tenancy from "../models/Tenancy.js";
import Organization from "../models/Organization.js";
import Notification from "../models/Notification.js";
import { resolveTenantProperty } from "../utils/tenantProperty.js";
import { orgTeamUserIds, staffDisplayName } from "../utils/orgTeam.js";
import { sendEmail } from "../utils/sendEmail.js";
import env from "../config/env.js";

// The most a thread returns in one read. Far more than a tenancy's worth of
// chat; a ceiling so one request can't pull an unbounded history.
const THREAD_LIMIT = 500;

const unitOf = (t) => (t?.unit && t.unit !== "—" ? t.unit : "");

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Validates a message body: returns { body } or { error }.
const readBody = (raw) => {
  const body = String(raw ?? "").trim();
  if (!body) return { error: "Message cannot be empty." };
  if (body.length > MESSAGE_MAX_LENGTH) {
    return { error: `Messages are limited to ${MESSAGE_MAX_LENGTH} characters.` };
  }
  return { body };
};

/* ------------------------------------------------------------------ *
 * Tenant side
 * ------------------------------------------------------------------ */

// The signed-in tenant's organization, tenancy and display details — or null
// when they have no tenancy yet (and so nobody to talk to).
const tenantContext = async (user) => {
  if (user?.role !== "Tenant") return null;
  const { tenancy, property } = await resolveTenantProperty(user);
  if (!tenancy?.organizationId) return null;
  return {
    tenancy,
    organizationId: tenancy.organizationId,
    tenantEmail: String(user.email || "").toLowerCase(),
    tenantName: tenancy.tenant || user.email,
    property: property?.name || tenancy.property || "",
    room: unitOf(tenancy),
  };
};

// @desc    The signed-in tenant's conversation with the office. Opening it
//          marks the office's messages read.
// @route   GET /api/v1/messages/my
export const getMyThread = async (req, res) => {
  try {
    const ctx = await tenantContext(req.user);
    if (!ctx) return res.status(200).json({ success: true, data: [], organization: null });

    const filter = { organizationId: ctx.organizationId, tenantEmail: ctx.tenantEmail };

    const [messages, org] = await Promise.all([
      TenantMessage.find(filter).sort({ createdAt: -1 }).limit(THREAD_LIMIT).lean(),
      Organization.findById(ctx.organizationId).select("name logo").lean(),
    ]);

    await TenantMessage.updateMany(
      { ...filter, sender: "staff", readByTenantAt: null },
      { $set: { readByTenantAt: new Date() } }
    );

    return res.status(200).json({
      success: true,
      data: messages.reverse(),
      organization: org ? { name: org.name || "", logo: org.logo || "" } : null,
    });
  } catch (error) {
    console.error("Get My Thread Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load messages." });
  }
};

// @desc    How many of the office's messages the tenant has not read yet
// @route   GET /api/v1/messages/my/unread
export const getMyUnreadCount = async (req, res) => {
  try {
    const ctx = await tenantContext(req.user);
    if (!ctx) return res.status(200).json({ success: true, count: 0 });

    const count = await TenantMessage.countDocuments({
      organizationId: ctx.organizationId,
      tenantEmail: ctx.tenantEmail,
      sender: "staff",
      readByTenantAt: null,
    });
    return res.status(200).json({ success: true, count });
  } catch (error) {
    console.error("My Unread Messages Error:", error);
    return res.status(500).json({ success: false, message: "Failed to count messages." });
  }
};

// Tells the office a tenant has written. One unread notification per person
// per conversation: a tenant sending five messages in a row raises the bell
// once, not five times.
const notifyTeamOfTenantMessage = async (ctx, message) => {
  // Every staff role can read and answer tenant chat, so every one hears.
  const userIds = await orgTeamUserIds(ctx.organizationId, [
    "OWNER", "ADMIN", "MANAGER", "AGENT", "FINANCE", "OPERATION",
  ]);
  if (!userIds.length) return;

  const already = await Notification.find({
    userId: { $in: userIds },
    type: "tenant_message",
    relatedId: ctx.tenancy._id,
    read: false,
  })
    .select("userId")
    .lean();
  const skip = new Set(already.map((n) => String(n.userId)));

  const where = [ctx.property, ctx.room].filter(Boolean).join(" · ");
  const rows = userIds
    .filter((id) => !skip.has(id))
    .map((userId) => ({
      organizationId: ctx.organizationId,
      userId,
      type: "tenant_message",
      title: `New message from ${ctx.tenantName}`,
      message: `${where ? `${where} — ` : ""}${message.body.slice(0, 140)}`,
      relatedType: "TenantMessage",
      relatedId: ctx.tenancy._id,
      actorEmail: ctx.tenantEmail,
    }));

  if (rows.length) await Notification.insertMany(rows);
};

// @desc    The tenant sends the office a message
// @route   POST /api/v1/messages/my
export const sendMyMessage = async (req, res) => {
  try {
    const ctx = await tenantContext(req.user);
    if (!ctx) {
      return res.status(400).json({
        success: false,
        message: "You can message your property manager once your tenancy is set up.",
      });
    }

    const { body, error } = readBody(req.body?.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const message = await TenantMessage.create({
      organizationId: ctx.organizationId,
      tenantEmail: ctx.tenantEmail,
      tenancyId: ctx.tenancy._id,
      tenantName: ctx.tenantName,
      property: ctx.property,
      room: ctx.room,
      sender: "tenant",
      senderUserId: req.user._id,
      senderName: ctx.tenantName,
      body,
      // The tenant has obviously read their own message.
      readByTenantAt: new Date(),
    });

    // A failed bell must not fail the send — the message is saved either way.
    notifyTeamOfTenantMessage(ctx, message).catch((err) =>
      console.error("Tenant message notification failed:", err.message)
    );

    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error("Send My Message Error:", error);
    return res.status(500).json({ success: false, message: "Failed to send the message." });
  }
};

/* ------------------------------------------------------------------ *
 * Staff side
 * ------------------------------------------------------------------ */

// The current (most recent, not deleted) tenancy for each email, within one
// organization. Used to label threads and to check a recipient is really one
// of this organization's tenants.
const currentTenancies = async (organizationId, emails) => {
  if (!emails.length) return new Map();
  const tenancies = await Tenancy.find({
    organizationId,
    tenantEmail: { $in: emails },
    isDeleted: false,
  })
    .sort({ startDate: -1, createdAt: -1 })
    .lean();

  const byEmail = new Map();
  for (const t of tenancies) {
    if (!byEmail.has(t.tenantEmail)) byEmail.set(t.tenantEmail, t);
  }
  return byEmail;
};

// @desc    Every conversation in the organization, most recent first, with
//          how many of the tenant's messages are unread
// @route   GET /api/v1/messages/threads
export const listThreads = async (req, res) => {
  try {
    const organizationId = new mongoose.Types.ObjectId(String(req.user.organizationId));

    const threads = await TenantMessage.aggregate([
      { $match: { organizationId } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$tenantEmail",
          last: { $first: "$$ROOT" },
          count: { $sum: 1 },
          unread: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$sender", "tenant"] }, { $eq: ["$readByStaffAt", null] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { "last.createdAt": -1 } },
      { $limit: 500 },
    ]);

    const current = await currentTenancies(organizationId, threads.map((t) => t._id));

    const data = threads.map((t) => {
      const tenancy = current.get(t._id);
      return {
        tenantEmail: t._id,
        tenancyId: tenancy?._id || t.last.tenancyId || null,
        tenantName: tenancy?.tenant || t.last.tenantName || t._id,
        property: tenancy?.property || t.last.property || "",
        room: tenancy ? unitOf(tenancy) : t.last.room || "",
        // A thread whose tenant no longer has a live tenancy stays readable,
        // but is flagged so the office knows replies may not be seen.
        active: Boolean(tenancy),
        lastMessage: {
          body: t.last.body,
          sender: t.last.sender,
          kind: t.last.kind,
          createdAt: t.last.createdAt,
        },
        count: t.count,
        unread: t.unread,
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("List Threads Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load conversations." });
  }
};

// @desc    How many tenant messages are unread across the organization
// @route   GET /api/v1/messages/unread
export const getStaffUnreadCount = async (req, res) => {
  try {
    const count = await TenantMessage.countDocuments({
      organizationId: req.user.organizationId,
      sender: "tenant",
      readByStaffAt: null,
    });
    return res.status(200).json({ success: true, count });
  } catch (error) {
    console.error("Staff Unread Messages Error:", error);
    return res.status(500).json({ success: false, message: "Failed to count messages." });
  }
};

const emailParam = (req) => String(req.params.email || "").trim().toLowerCase();

// @desc    One tenant's conversation. Opening it marks their messages read.
// @route   GET /api/v1/messages/threads/:email
export const getThread = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const tenantEmail = emailParam(req);
    if (!tenantEmail) {
      return res.status(400).json({ success: false, message: "Tenant email is required." });
    }

    const filter = { organizationId, tenantEmail };
    const [messages, current] = await Promise.all([
      TenantMessage.find(filter).sort({ createdAt: -1 }).limit(THREAD_LIMIT).lean(),
      currentTenancies(organizationId, [tenantEmail]),
    ]);
    const tenancy = current.get(tenantEmail);

    // Only this organization's tenants (current or with an existing thread)
    // can be opened.
    if (!tenancy && messages.length === 0) {
      return res.status(404).json({ success: false, message: "Tenant not found." });
    }

    const now = new Date();
    await TenantMessage.updateMany(
      { ...filter, sender: "tenant", readByStaffAt: null },
      { $set: { readByStaffAt: now } }
    );

    // Reading the conversation is reading its bell entries too.
    const tenancyIds = [
      ...new Set([tenancy?._id, ...messages.map((m) => m.tenancyId)].filter(Boolean).map(String)),
    ];
    if (tenancyIds.length) {
      await Notification.updateMany(
        { userId: req.user._id, type: "tenant_message", relatedId: { $in: tenancyIds }, read: false },
        { $set: { read: true, readAt: now } }
      );
    }

    const last = messages[0];
    return res.status(200).json({
      success: true,
      tenant: {
        tenantEmail,
        tenancyId: tenancy?._id || last?.tenancyId || null,
        tenantName: tenancy?.tenant || last?.tenantName || tenantEmail,
        property: tenancy?.property || last?.property || "",
        room: tenancy ? unitOf(tenancy) : last?.room || "",
        active: Boolean(tenancy),
      },
      data: messages.reverse(),
    });
  } catch (error) {
    console.error("Get Thread Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load the conversation." });
  }
};

// The "you have a new message" email. Sent only for the first unread message,
// so a burst of replies is one email, not one each.
const emailTenantAboutMessage = async ({ tenantEmail, tenantName, orgName, senderName, body }) => {
  const link = `${env.clientUrl}/tenant/messages`;
  const preview = body.length > 600 ? `${body.slice(0, 600)}…` : body;
  await sendEmail({
    email: tenantEmail,
    subject: `New message from ${orgName || "your property manager"}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; color: #0F253B;">
        <h2 style="color: #F47C3C; margin-bottom: 4px;">You have a new message</h2>
        <p>Hi ${esc(tenantName || "there")},</p>
        <p><strong>${esc(senderName)}</strong>${orgName ? ` at ${esc(orgName)}` : ""} has sent you a message:</p>
        <blockquote style="margin: 16px 0; padding: 12px 16px; background: #FFF7F2; border-left: 4px solid #F47C3C; white-space: pre-line;">${esc(preview)}</blockquote>
        <p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#F47C3C;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Read and reply in your portal</a></p>
        <p style="color:#64748b;font-size:12px;">Please reply through the tenant portal rather than to this email.</p>
      </div>`,
  });
};

// @desc    Staff send a tenant a message
// @route   POST /api/v1/messages/threads/:email
// @body    { body, notifyByEmail = true }
export const sendThreadMessage = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const tenantEmail = emailParam(req);

    const { body, error } = readBody(req.body?.body);
    if (error) return res.status(400).json({ success: false, message: error });

    // Messages can only start with a current tenant of this organization.
    const tenancy = (await currentTenancies(organizationId, [tenantEmail])).get(tenantEmail);
    if (!tenancy) {
      return res.status(404).json({
        success: false,
        message: "That tenant has no current tenancy with you, so they can't receive messages.",
      });
    }

    const senderName = await staffDisplayName(req.user);

    // Whether the tenant already has an unread message waiting — if so they
    // have already been emailed about it.
    const alreadyWaiting = await TenantMessage.exists({
      organizationId,
      tenantEmail,
      sender: "staff",
      readByTenantAt: null,
    });

    const message = await TenantMessage.create({
      organizationId,
      tenantEmail,
      tenancyId: tenancy._id,
      tenantName: tenancy.tenant || tenantEmail,
      property: tenancy.property || "",
      room: unitOf(tenancy),
      sender: "staff",
      senderUserId: req.user._id,
      senderName,
      body,
      readByStaffAt: new Date(),
    });

    let emailed = false;
    if (req.body?.notifyByEmail !== false && !alreadyWaiting) {
      try {
        const org = await Organization.findById(organizationId).select("name").lean();
        await emailTenantAboutMessage({
          tenantEmail,
          tenantName: tenancy.tenant,
          orgName: org?.name || "",
          senderName,
          body,
        });
        emailed = true;
      } catch (err) {
        // The message is in the portal regardless; the email is a nudge.
        console.error("Tenant message email failed:", err.message);
      }
    }

    return res.status(201).json({ success: true, data: message, emailed });
  } catch (error) {
    console.error("Send Thread Message Error:", error);
    return res.status(500).json({ success: false, message: "Failed to send the message." });
  }
};

// Used by the Access Notices feature to drop a system entry into the tenant's
// conversation. Never throws — the notice itself is the record.
export const postSystemMessage = async ({ organizationId, tenancy, user, body, relatedId }) => {
  try {
    if (!tenancy?.tenantEmail) return;
    await TenantMessage.create({
      organizationId,
      tenantEmail: tenancy.tenantEmail,
      tenancyId: tenancy._id,
      tenantName: tenancy.tenant || tenancy.tenantEmail,
      property: tenancy.property || "",
      room: unitOf(tenancy),
      sender: "staff",
      senderUserId: user?._id || null,
      senderName: await staffDisplayName(user),
      kind: "access_notice",
      relatedId: relatedId || null,
      body: body.slice(0, MESSAGE_MAX_LENGTH),
      readByStaffAt: new Date(),
    });
  } catch (err) {
    console.error("Access notice chat entry failed:", err.message);
  }
};
