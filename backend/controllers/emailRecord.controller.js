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
import { cleanAttachments } from "../utils/attachments.js";
import { sweepEmailFollowUps } from "../cranjob/emailFollowUp.js";

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
    if (q.account) filter.$or = [{ emailTo: q.account }, { emailFrom: q.account }];
    if (q.from || q.to) {
      filter.date = {};
      if (q.from) filter.date.$gte = new Date(q.from);
      if (q.to) filter.date.$lte = new Date(q.to);
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

    if (payload.assignedTo) {
      try {
        payload.assignedToEmail = await resolveAssignee(req.user.organizationId, payload.assignedTo);
      } catch (e) {
        return res.status(400).json({ success: false, message: e.message });
      }
    }

    const row = new EmailRecord({
      ...payload,
      organizationId: req.user.organizationId,
      createdBy: req.user._id,
    });
    applyDerived(row);
    await row.save();

    await notifyAssignee(row, req.user);

    return res.status(201).json({ success: true, message: "Email record added.", data: row });
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

    const previous = { status: row.status, assignedTo: row.assignedTo ? String(row.assignedTo) : "" };

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
    applyDerived(row, previous);
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

    row.history.push({
      channel: pick(b.channel, CHANNELS, "Email"),
      direction: pick(b.direction, ["Incoming", "Outgoing", "Internal"], "Outgoing"),
      date,
      from: text(b.from),
      to: text(b.to),
      summary,
      isReply,
      isFollowUp,
      createdBy: req.user._id,
      createdByEmail: req.user.email || "",
    });

    const previous = { status: row.status };

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
    const updated = await row.save();

    return res.status(201).json({ success: true, data: updated });
  } catch (error) {
    console.error("Add Email History Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: validationMessage(error) });
    }
    return res.status(500).json({ success: false, message: "Failed to add to the history." });
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
