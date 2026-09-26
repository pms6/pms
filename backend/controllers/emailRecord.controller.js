// controllers/emailRecord.controller.js
import mongoose from "mongoose";
import EmailRecord, {
  EMAIL_ACCOUNTS,
  EMAIL_STATUSES,
  DONE_STATUSES,
  EMAIL_CATEGORIES,
  EMAIL_PRIORITIES,
  CHANNELS,
} from "../models/EmailRecord.js";
import OrganizationMember from "../models/OrganizationMember.js";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import Notification from "../models/Notification.js";
import Tenancy from "../models/Tenancy.js";
import { cleanAttachments } from "../utils/attachments.js";
import { sendEmail } from "../utils/sendEmail.js";
import { sweepEmailFollowUps } from "../cranjob/emailFollowUp.js";
import { syncInbox, inboxStatus } from "../cranjob/emailInbox.js";

const text = (v) => String(v ?? "").trim();
const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);

const ADMIN_ROLES = ["OWNER", "ADMIN"];
const isAdmin = (req) =>
  req.user?.role === "Organization" && ADMIN_ROLES.includes(req.user?.organizationRole);

const validationMessage = (error) =>
  Object.values(error.errors).map((e) => e.message).join(", ");

const orgFilter = (req, extra = {}) => ({
  organizationId: req.user.organizationId,
  isDeleted: false,
  ...extra,
});

const pickPayload = (body) => {
  const payload = {};

  if (body.propertyId !== undefined) payload.propertyId = body.propertyId || null;
  if (body.property !== undefined) payload.property = text(body.property);
  if (body.date !== undefined) payload.date = body.date;
  if (body.channel !== undefined) payload.channel = pick(body.channel, CHANNELS, "Email");
  if (body.emailTo !== undefined) payload.emailTo = text(body.emailTo);
  if (body.emailFrom !== undefined) payload.emailFrom = text(body.emailFrom);
  if (body.subject !== undefined) payload.subject = text(body.subject);
  if (body.issue !== undefined) payload.issue = text(body.issue);
  if (body.category !== undefined) payload.category = pick(body.category, EMAIL_CATEGORIES, "General");
  if (body.priority !== undefined) payload.priority = pick(body.priority, EMAIL_PRIORITIES, "Medium");
  if (body.status !== undefined) payload.status = pick(body.status, EMAIL_STATUSES, "Open");
  if (body.replyReceived !== undefined) payload.replyReceived = Boolean(body.replyReceived);
  // An emptied date picker sends "" — that means "no date", not an invalid one.
  if (body.replyDate !== undefined) payload.replyDate = body.replyDate || null;
  if (body.replySummary !== undefined) payload.replySummary = text(body.replySummary);
  if (body.followUpDate !== undefined) payload.followUpDate = body.followUpDate || null;
  if (body.followUpNotes !== undefined) payload.followUpNotes = text(body.followUpNotes);
  if (body.assignedTo !== undefined) payload.assignedTo = body.assignedTo || null;
  if (body.tenancyId !== undefined) payload.tenancyId = body.tenancyId || null;
  if (body.files !== undefined) payload.files = cleanAttachments(body.files);

  return payload;
};

// The assignee must be an active member of the caller's own organization.
// Returns their email, or throws a 400-worthy message.
const resolveAssignee = async (organizationId, userId) => {
  if (!mongoose.isValidObjectId(userId)) throw new Error("Invalid staff member.");
  const [member, user] = await Promise.all([
    OrganizationMember.findOne({ organizationId, userId, status: "ACTIVE" }).select("_id").lean(),
    User.findById(userId).select("email").lean(),
  ]);
  if (!user) throw new Error("Staff member not found.");
  // The owner has no membership row in some organizations, so the owner of
  // the organization itself is accepted too.
  if (!member) {
    const org = await Organization.findOne({ _id: organizationId, userId }).select("_id").lean();
    if (!org) throw new Error("That person is not an active member of this organization.");
  }
  return user.email || "";
};

// ------------------------------------------------------------------ *
// Sending — a record's original email, or an outgoing message in its thread,
// can be emailed from the system instead of only logged.
// ------------------------------------------------------------------ *

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

// "a@x.com, b@y.com" → ["a@x.com", "b@y.com"]; null when any part is not an
// address, so a typo is reported rather than half-sent.
const parseAddresses = (value) => {
  const parts = String(value || "")
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length || !parts.every((p) => EMAIL_RE.test(p))) return null;
  return parts;
};

// Gmail rejects messages over 25MB, so files are attached up to this total and
// the rest go in as links.
const ATTACH_LIMIT_BYTES = 18 * 1024 * 1024;

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fmtWhen = (d) =>
  new Date(d).toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// The earlier messages of the conversation, newest first, quoted under the new
// one the way a mail client quotes a reply — so whoever receives it reads the
// whole chain in one email. The "On … wrote:" line is also where the inbox
// reader (stripQuoted) cuts an answer off, so the quote never comes back into
// the record twice.
const quoteChain = (chain = []) => {
  if (!chain.length) return { html: "", text: "" };
  const ordered = [...chain].reverse();
  const html = ordered
    .map(
      (m) => `<p style="margin:16px 0 4px;color:#6b7280;">On ${escapeHtml(fmtWhen(m.date))}, ${escapeHtml(m.from || "PMS")} wrote:</p>
    <blockquote style="margin:0 0 0 6px;padding-left:10px;border-left:2px solid #d1d5db;color:#4b5563;">${escapeHtml(m.body).replace(/\r?\n/g, "<br>")}</blockquote>`
    )
    .join("");
  const text = ordered
    .map(
      (m) =>
        `On ${fmtWhen(m.date)}, ${m.from || "PMS"} wrote:\n${String(m.body || "")
          .split(/\r?\n/)
          .map((line) => `> ${line}`)
          .join("\n")}`
    )
    .join("\n\n");
  return { html: `<div style="margin-top:24px;">${html}</div>`, text: `\n\n${text}` };
};

const buildMessage = ({ body, files = [], chain = [] }) => {
  const attachments = [];
  const linked = [];
  let total = 0;
  for (const f of files) {
    const bytes = Number(f.bytes) || 0;
    // An unknown size is attached — it came through the same uploader, and
    // a link is the fallback only once the known sizes run out of room.
    if (total + bytes <= ATTACH_LIMIT_BYTES) {
      total += bytes;
      attachments.push({ filename: f.name || f.url.split("/").pop() || "attachment", path: f.url });
    } else {
      linked.push(f);
    }
  }

  const links = linked.length
    ? `<p style="margin-top:16px;"><strong>Files:</strong><br>${linked
        .map((f) => `<a href="${escapeHtml(f.url)}">${escapeHtml(f.name || f.url)}</a>`)
        .join("<br>")}</p>`
    : "";

  const quoted = quoteChain(chain);

  const html = `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #0F253B; white-space: normal;">
    ${escapeHtml(body).replace(/\r?\n/g, "<br>")}
    ${links}
    ${quoted.html}
  </div>`;

  return { html, text: `${body}${quoted.text}`, attachments };
};

// Emails one message and writes the outcome onto `target` (the record or a
// thread entry). Never throws: a failed send is stored as "Failed" with the
// reason, so the message is still in the history and can be resent.
const deliver = async (target, { to, subject, body, files, replyTo, chain = [] }) => {
  const addresses = parseAddresses(to);
  if (!addresses) {
    target.emailStatus = "Failed";
    target.emailError = "No valid recipient address.";
    return false;
  }
  try {
    const { html, text: plain, attachments } = buildMessage({ body, files, chain });
    const replyAddr = parseAddresses(replyTo);
    // Every Message-ID already in the conversation, oldest first — the last
    // one is what this message answers.
    const references = chain.map((m) => m.messageId).filter(Boolean);
    const info = await sendEmail({
      email: addresses,
      subject: subject || "(no subject)",
      html,
      text: plain,
      attachments,
      replyTo: replyAddr ? replyAddr[0] : undefined,
      inReplyTo: references[references.length - 1],
      references,
    });
    target.emailStatus = "Sent";
    target.emailSentAt = new Date();
    target.emailError = "";
    target.emailMessageId = info?.messageId || "";
    return true;
  } catch (err) {
    target.emailStatus = "Failed";
    target.emailError = String(err?.message || "Sending failed.").slice(0, 500);
    return false;
  }
};

const replySubject = (row) => {
  const base = row.subject || row.issue.slice(0, 80);
  return /^re:/i.test(base) ? base : `Re: ${base}`;
};

// What an original record's email says and where it goes.
const recordMail = (row) => ({
  to: row.emailTo,
  subject: row.subject || row.issue.slice(0, 80),
  body: row.issue,
  files: row.files,
  replyTo: row.emailFrom,
});

// The emails that came before `entry` in the record's conversation, oldest
// first: the original email, then every email in the thread dated before it.
// Calls, texts and internal notes are left out — they were never in anyone's
// mailbox.
const emailChainBefore = (row, entry) => {
  const chain = [];
  if ((row.channel || "Email") === "Email") {
    chain.push({
      date: row.date,
      from: row.emailFrom,
      body: row.issue,
      messageId: row.emailMessageId,
    });
  }
  const cutoff = new Date(entry.date).getTime();
  const earlier = row.history
    .filter(
      (h) =>
        String(h._id) !== String(entry._id) &&
        h.channel === "Email" &&
        h.direction !== "Internal" &&
        new Date(h.date).getTime() <= cutoff
    )
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const h of earlier) {
    chain.push({ date: h.date, from: h.from, body: h.summary, messageId: h.emailMessageId });
  }
  return chain;
};

const entryMail = (row, entry, subject) => ({
  to: entry.to,
  subject: subject || replySubject(row),
  body: entry.summary,
  files: entry.files,
  replyTo: entry.from,
  chain: emailChainBefore(row, entry),
});

const sentMessage = (target, what) =>
  target.emailStatus === "Sent"
    ? `${what} saved and emailed.`
    : `${what} saved, but the email was not sent: ${target.emailError}`;

// "2026-09" → [first instant of September, first instant of October), in
// server local time. Null for anything that is not a real month.
export const monthRange = (value) => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(value || ""));
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  if (month < 0 || month > 11) return null;
  return { start: new Date(year, month, 1), end: new Date(year, month + 1, 1) };
};

// Copies the tenant's name and email off their tenancy onto the payload, so
// the conversation stays attributed even after the tenancy is gone. Throws a
// 400-worthy message for a tenancy outside the caller's organization.
const resolveTenant = async (organizationId, payload) => {
  if (payload.tenancyId === undefined) return;
  if (!payload.tenancyId) {
    payload.tenantName = "";
    payload.tenantEmail = "";
    return;
  }
  if (!mongoose.isValidObjectId(payload.tenancyId)) throw new Error("Invalid tenant.");
  const tenancy = await Tenancy.findOne({ _id: payload.tenancyId, organizationId })
    .select("tenant tenantEmail")
    .lean();
  if (!tenancy) throw new Error("Tenant not found in this organization.");
  payload.tenantName = tenancy.tenant || "";
  payload.tenantEmail = tenancy.tenantEmail || "";
};

// Anything that changes the conversation on the record itself — a reply typed
// into the edit form, a status change — is also written into the thread, so
// the thread is the complete, timestamped record of what happened.
const autoLog = (row, previous, actor) => {
  const base = {
    auto: true,
    createdBy: actor._id,
    createdByEmail: actor.email || "",
  };

  const replyChanged =
    row.replyReceived &&
    row.replySummary &&
    (row.replySummary !== (previous.replySummary || "") || !previous.replyReceived);
  if (replyChanged) {
    row.history.push({
      ...base,
      channel: row.channel || "Email",
      direction: "Incoming",
      date: row.replyDate || new Date(),
      from: row.channel === "Email" ? row.emailTo : "",
      to: row.channel === "Email" ? row.emailFrom : "",
      summary: row.replySummary,
      isReply: true,
    });
  }

  if (previous.status && row.status !== previous.status) {
    row.history.push({
      ...base,
      channel: "Note",
      direction: "Internal",
      date: new Date(),
      summary: `Status changed from ${previous.status} to ${row.status}.`,
    });
  }
};

// Replies typed into the record form — any number of them, each with its own
// date and text — go into the thread as separate incoming replies. The
// latest one becomes what the "Reply" column shows. Returns how many were
// added; blank rows are skipped, a bad date is a 400-worthy error.
const addFormReplies = (row, list, actor) => {
  if (!Array.isArray(list)) return 0;
  const replies = [];
  for (const r of list) {
    const summary = text(r?.summary);
    if (!summary) continue;
    const date = r?.date ? new Date(r.date) : new Date();
    if (Number.isNaN(date.getTime())) throw new Error("A reply has an invalid date.");
    replies.push({ summary, date });
  }
  if (!replies.length) return 0;

  replies.sort((a, b) => a.date - b.date);
  const isEmail = (row.channel || "Email") === "Email";
  for (const { summary, date } of replies) {
    row.history.push({
      channel: row.channel || "Email",
      direction: "Incoming",
      date,
      from: isEmail ? row.emailTo : "",
      to: isEmail ? row.emailFrom : "",
      summary,
      isReply: true,
      createdBy: actor._id,
      createdByEmail: actor.email || "",
    });
  }

  const latest = replies[replies.length - 1];
  if (!row.replyDate || latest.date >= new Date(row.replyDate)) {
    row.replyDate = latest.date;
    row.replySummary = latest.summary;
  }
  row.replyReceived = true;
  if (row.status === "Awaiting Reply") row.status = "Open";
  return replies.length;
};

// Keeps the derived stamps honest whenever a record is saved: when it was
// resolved / closed, when the reply landed, and clearing an escalation once
// the record is dealt with or pushed to a later follow-up date.
const applyDerived = (row, previous = {}) => {
  const now = new Date();

  if (row.replyReceived && !row.replyDate) row.replyDate = now;

  if (row.status === "Resolved" && previous.status !== "Resolved") row.resolvedAt = now;
  if (row.status === "Closed" && previous.status !== "Closed") row.closedAt = now;
  if (!DONE_STATUSES.includes(row.status)) {
    row.resolvedAt = null;
    row.closedAt = null;
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const followUpInFuture = row.followUpDate && new Date(row.followUpDate) >= startOfToday;
  if (DONE_STATUSES.includes(row.status) || followUpInFuture) {
    row.escalated = false;
    row.escalatedAt = null;
  }
};

// In-app notification for the person a record has just been handed to. Never
// throws: the record is already saved.
const notifyAssignee = async (row, actor) => {
  if (!row.assignedTo || String(row.assignedTo) === String(actor._id)) return;
  try {
    await Notification.create({
      organizationId: row.organizationId,
      userId: row.assignedTo,
      type: "email_assigned",
      title: `Email record assigned to you — ${row.property}`,
      message: row.issue.slice(0, 200),
      relatedType: "EmailRecord",
      relatedId: row._id,
      actorEmail: actor.email || "",
    });
  } catch (err) {
    console.error("Email record notification failed:", err.message);
  }
};

// @desc    The fixed option lists the form and filters are built from
// @route   GET /api/v1/email-records/options
export const getEmailRecordOptions = (_req, res) =>
  res.status(200).json({
    success: true,
    data: {
      accounts: EMAIL_ACCOUNTS,
      statuses: EMAIL_STATUSES,
      doneStatuses: DONE_STATUSES,
      categories: EMAIL_CATEGORIES,
      priorities: EMAIL_PRIORITIES,
      channels: CHANNELS,
    },
  });

// @desc    List email records, newest first, with optional filters
// @route   GET /api/v1/email-records
export const getEmailRecords = async (req, res) => {
  try {
    if (!req.user?.organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const q = req.query;
    const filter = orgFilter(req);
    if (q.propertyId) filter.propertyId = q.propertyId;
    if (q.status) filter.status = q.status;
    if (q.category) filter.category = q.category;
    if (q.priority) filter.priority = q.priority;
    if (q.assignedTo) filter.assignedTo = q.assignedTo;
    if (q.tenancyId) filter.tenancyId = q.tenancyId;
    if (q.account) filter.$or = [{ emailTo: q.account }, { emailFrom: q.account }];
    if (q.from || q.to) {
      filter.date = {};
      if (q.from) filter.date.$gte = new Date(q.from);
      if (q.to) filter.date.$lte = new Date(q.to);
    }
    // ?month=YYYY-MM — any record with communication in that month: the
    // original message, or a later reply / message in its thread.
    if (q.month) {
      const range = monthRange(q.month);
      if (!range) {
        return res.status(400).json({ success: false, message: "Month must be YYYY-MM." });
      }
      const inMonth = { $gte: range.start, $lt: range.end };
      filter.$and = [{ $or: [{ date: inMonth }, { "history.date": inMonth }] }];
    }

    const rows = await EmailRecord.find(filter).sort({ date: -1, createdAt: -1 }).lean();

    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    console.error("Get Email Records Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch email records." });
  }
};

// @desc    Add an email record
// @route   POST /api/v1/email-records
export const createEmailRecord = async (req, res) => {
  try {
    const payload = pickPayload(req.body);

    if (!payload.property) {
      return res.status(400).json({ success: false, message: "Property is required." });
    }
    if (!payload.date) {
      return res.status(400).json({ success: false, message: "Date is required." });
    }
    if (!payload.issue) {
      return res.status(400).json({ success: false, message: "Issue is required." });
    }

    const sendNow = Boolean(req.body.sendNow);
    if (sendNow) {
      if ((payload.channel || "Email") !== "Email") {
        return res.status(400).json({ success: false, message: "Only an Email record can be sent." });
      }
      if (!parseAddresses(payload.emailTo)) {
        return res.status(400).json({ success: false, message: "Enter a valid 'Email to' address to send." });
      }
    }

    try {
      if (payload.assignedTo) {
        payload.assignedToEmail = await resolveAssignee(req.user.organizationId, payload.assignedTo);
      }
      await resolveTenant(req.user.organizationId, payload);
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }

    const row = new EmailRecord({
      ...payload,
      organizationId: req.user.organizationId,
      createdBy: req.user._id,
    });
    let added;
    try {
      added = addFormReplies(row, req.body.newReplies, req.user);
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }
    applyDerived(row);
    // The replies are already in the thread — autoLog only needs to note the rest.
    autoLog(row, added ? { replyReceived: true, replySummary: row.replySummary } : {}, req.user);
    // Validated before sending, so a bad record never emails anyone.
    await row.validate();
    if (sendNow) await deliver(row, recordMail(row));
    await row.save();

    await notifyAssignee(row, req.user);

    return res.status(201).json({
      success: true,
      message: sendNow ? sentMessage(row, "Email record") : "Email record added.",
      emailStatus: row.emailStatus,
      data: row,
    });
  } catch (error) {
    console.error("Create Email Record Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: validationMessage(error) });
    }
    return res.status(500).json({ success: false, message: "Failed to add email record." });
  }
};

// @desc    Edit an email record
// @route   PUT /api/v1/email-records/:id
export const updateEmailRecord = async (req, res) => {
  try {
    const row = await EmailRecord.findOne(orgFilter(req, { _id: req.params.id }));
    if (!row) {
      return res.status(404).json({ success: false, message: "Email record not found." });
    }

    const payload = pickPayload(req.body);
    if (payload.property !== undefined && !payload.property) {
      return res.status(400).json({ success: false, message: "Property is required." });
    }
    if (payload.date !== undefined && !payload.date) {
      return res.status(400).json({ success: false, message: "Date is required." });
    }
    if (payload.issue !== undefined && !payload.issue) {
      return res.status(400).json({ success: false, message: "Issue is required." });
    }

    const previous = {
      status: row.status,
      assignedTo: row.assignedTo ? String(row.assignedTo) : "",
      replyReceived: row.replyReceived,
      replySummary: row.replySummary,
    };

    try {
      await resolveTenant(req.user.organizationId, payload);
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }

    if (payload.assignedTo !== undefined) {
      if (payload.assignedTo) {
        try {
          payload.assignedToEmail = await resolveAssignee(req.user.organizationId, payload.assignedTo);
        } catch (e) {
          return res.status(400).json({ success: false, message: e.message });
        }
      } else {
        payload.assignedToEmail = "";
      }
    }

    Object.assign(row, payload);
    let added;
    try {
      added = addFormReplies(row, req.body.newReplies, req.user);
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }
    applyDerived(row, previous);
    // The replies are already in the thread — autoLog only needs to note the rest.
    autoLog(
      row,
      added ? { ...previous, replyReceived: true, replySummary: row.replySummary } : previous,
      req.user
    );
    const updated = await row.save();

    if (updated.assignedTo && String(updated.assignedTo) !== previous.assignedTo) {
      await notifyAssignee(updated, req.user);
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Update Email Record Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: validationMessage(error) });
    }
    return res.status(500).json({ success: false, message: "Failed to update email record." });
  }
};

// @desc    Soft delete an email record
// @route   DELETE /api/v1/email-records/:id
export const deleteEmailRecord = async (req, res) => {
  try {
    const row = await EmailRecord.findOne(orgFilter(req, { _id: req.params.id }));
    if (!row) {
      return res.status(404).json({ success: false, message: "Email record not found." });
    }

    row.isDeleted = true;
    row.deletedAt = new Date();
    await row.save();

    return res.status(200).json({ success: true, message: "Email record deleted." });
  } catch (error) {
    console.error("Delete Email Record Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete email record." });
  }
};

// @desc    Add a reply, follow-up, call or message to a record's thread
// @route   POST /api/v1/email-records/:id/history
export const addHistoryEntry = async (req, res) => {
  try {
    const row = await EmailRecord.findOne(orgFilter(req, { _id: req.params.id }));
    if (!row) {
      return res.status(404).json({ success: false, message: "Email record not found." });
    }

    const b = req.body || {};
    const summary = text(b.summary);
    if (!summary) {
      return res.status(400).json({ success: false, message: "A summary is required." });
    }

    const date = b.date ? new Date(b.date) : new Date();
    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date." });
    }

    const isReply = Boolean(b.isReply);
    const isFollowUp = Boolean(b.isFollowUp);
    const channel = pick(b.channel, CHANNELS, "Email");
    const direction = pick(b.direction, ["Incoming", "Outgoing", "Internal"], "Outgoing");

    // A reply is only recorded on the record — it is never emailed out.
    const sendNow = Boolean(b.sendNow) && !isReply;
    if (sendNow) {
      if (channel !== "Email" || direction !== "Outgoing") {
        return res.status(400).json({ success: false, message: "Only an outgoing Email can be sent." });
      }
      if (!parseAddresses(b.to)) {
        return res.status(400).json({ success: false, message: "Enter a valid 'To' address to send." });
      }
    }

    row.history.push({
      channel,
      direction,
      date,
      from: text(b.from),
      to: text(b.to),
      summary,
      files: cleanAttachments(b.files),
      isReply,
      isFollowUp,
      createdBy: req.user._id,
      createdByEmail: req.user.email || "",
    });
    // Taken before autoLog can append a status-change note after it.
    const entry = row.history[row.history.length - 1];

    const previous = { status: row.status };
    const statusBefore = row.status;

    // A reply on the thread answers the record; the latest one is what the
    // "Reply" column shows.
    if (isReply) {
      row.replyReceived = true;
      row.replyDate = date;
      row.replySummary = summary;
      if (row.status === "Awaiting Reply") row.status = "Open";
    }
    if (isFollowUp) row.lastFollowUpAt = date;
    // Chasing something usually sets when it next needs looking at.
    if (b.nextFollowUpDate !== undefined) row.followUpDate = b.nextFollowUpDate || null;
    if (b.status !== undefined) row.status = pick(b.status, EMAIL_STATUSES, row.status);

    applyDerived(row, previous);
    // The status is being changed from the thread itself, so only the status
    // change needs noting — the entry just added already carries the message.
    autoLog(row, { status: statusBefore, replyReceived: true, replySummary: row.replySummary }, req.user);

    await row.validate();
    if (sendNow) await deliver(entry, entryMail(row, entry, text(b.subject)));
    const updated = await row.save();

    return res.status(201).json({
      success: true,
      message: sendNow ? sentMessage(entry, "Message") : "Added to the history.",
      emailStatus: sendNow ? entry.emailStatus : "",
      data: updated,
    });
  } catch (error) {
    console.error("Add Email History Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: validationMessage(error) });
    }
    return res.status(500).json({ success: false, message: "Failed to add to the history." });
  }
};

// @desc    Send again — the record's original email, or one thread entry
//          (body.entryId) — typically after a failed send
// @route   POST /api/v1/email-records/:id/send
export const resendEmail = async (req, res) => {
  try {
    const row = await EmailRecord.findOne(orgFilter(req, { _id: req.params.id }));
    if (!row) {
      return res.status(404).json({ success: false, message: "Email record not found." });
    }

    const entryId = req.body?.entryId;
    let target;
    let mail;
    if (entryId) {
      target = row.history.id(entryId);
      if (!target) {
        return res.status(404).json({ success: false, message: "History entry not found." });
      }
      if (target.channel !== "Email" || target.direction !== "Outgoing") {
        return res.status(400).json({ success: false, message: "Only an outgoing Email can be sent." });
      }
      mail = entryMail(row, target);
    } else {
      if (row.channel !== "Email") {
        return res.status(400).json({ success: false, message: "Only an Email record can be sent." });
      }
      target = row;
      mail = recordMail(row);
    }

    const ok = await deliver(target, mail);
    const updated = await row.save();

    return res.status(ok ? 200 : 502).json({
      success: ok,
      message: ok ? "Email sent." : `The email was not sent: ${target.emailError}`,
      data: updated,
    });
  } catch (error) {
    console.error("Resend Email Record Error:", error);
    return res.status(500).json({ success: false, message: "Failed to send the email." });
  }
};

// @desc    Remove one step from a record's thread
// @route   DELETE /api/v1/email-records/:id/history/:entryId
export const deleteHistoryEntry = async (req, res) => {
  try {
    const row = await EmailRecord.findOne(orgFilter(req, { _id: req.params.id }));
    if (!row) {
      return res.status(404).json({ success: false, message: "Email record not found." });
    }

    const entry = row.history.id(req.params.entryId);
    if (!entry) {
      return res.status(404).json({ success: false, message: "History entry not found." });
    }
    entry.deleteOne();
    const updated = await row.save();

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Delete Email History Error:", error);
    return res.status(500).json({ success: false, message: "Failed to remove the history entry." });
  }
};

// @desc    Read the inbox now for tenant replies, instead of waiting for the
//          five-minute check
// @route   POST /api/v1/email-records/fetch-inbox
export const fetchInbox = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, message: "Only an owner or admin can check the inbox." });
    }
    const result = await syncInbox();
    const status = await inboxStatus();
    return res.status(200).json({ success: true, data: { ...result, status } });
  } catch (error) {
    console.error("Fetch Inbox Error:", error);
    return res.status(500).json({ success: false, message: "Failed to check the inbox." });
  }
};

// @desc    When the inbox was last read, and whether it worked
// @route   GET /api/v1/email-records/inbox-status
export const getInboxStatus = async (_req, res) => {
  try {
    return res.status(200).json({ success: true, data: await inboxStatus() });
  } catch (error) {
    console.error("Inbox Status Error:", error);
    return res.status(500).json({ success: false, message: "Failed to read the inbox status." });
  }
};

// @desc    Run the follow-up reminder / escalation sweep now, for this org only
// @route   POST /api/v1/email-records/run-reminders
export const runEmailReminders = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, message: "Only an owner or admin can run reminders." });
    }
    const result = await sweepEmailFollowUps({ organizationId: req.user.organizationId });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Run Email Reminders Error:", error);
    return res.status(500).json({ success: false, message: "Failed to run reminders." });
  }
};
