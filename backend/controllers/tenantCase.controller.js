// controllers/tenantCase.controller.js
//
// Tenant Cases — one issue with one tenant, from report to close. See
// models/TenantCase.js. Every change of state is written to the case's
// append-only activity log, so the history of a case can always be read back.

import mongoose from "mongoose";
import TenantCase, {
  CASE_STATUSES,
  CASE_DONE_STATUSES,
  CASE_CATEGORIES,
  CASE_PRIORITIES,
} from "../models/TenantCase.js";
import Tenancy from "../models/Tenancy.js";
import Maintenance from "../models/Maintenance.js";
import EmailRecord from "../models/EmailRecord.js";
import Invoice from "../models/Invoice.js";
import Notification from "../models/Notification.js";
import { nextSeq, formatRef } from "../models/Counter.js";
import { cleanAttachments } from "../utils/attachments.js";
import { resolveAssignee } from "../utils/staff.js";

const ADMIN_ROLES = ["OWNER", "ADMIN"];
const isAdmin = (req) => ADMIN_ROLES.includes(req.user?.organizationRole);

const text = (v, max = 5000) => String(v ?? "").trim().slice(0, max);
const pick = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);
const oid = (v) => (v && mongoose.isValidObjectId(v) ? String(v) : null);
const idList = (v) => [...new Set((Array.isArray(v) ? v : []).map(oid).filter(Boolean))];

const orgFilter = (req, extra = {}) => ({
  organizationId: req.user.organizationId,
  isDeleted: false,
  ...extra,
});

const entry = (req, kind, fields = {}) => ({
  kind,
  authorId: req.user._id,
  authorEmail: req.user.email || "",
  createdAt: new Date(),
  ...fields,
});

// Copies tenant, property and room off the tenancy. Throws a 400-worthy
// message for a tenancy outside the caller's organization.
const resolveTenancy = async (organizationId, tenancyId) => {
  if (!oid(tenancyId)) throw new Error("Pick the tenant this case is about.");
  const t = await Tenancy.findOne({ _id: tenancyId, organizationId })
    .select("tenant tenantEmail propertyId property roomId unit")
    .lean();
  if (!t) throw new Error("Tenant not found in this organization.");
  return {
    tenancyId: t._id,
    tenantName: t.tenant || "",
    tenantEmail: t.tenantEmail || "",
    propertyId: t.propertyId || null,
    property: t.property || "",
    roomId: t.roomId || null,
    room: t.unit && t.unit !== "—" ? t.unit : "",
  };
};

// Only ids that are really this organisation's records survive.
const ownIds = async (Model, organizationId, ids) => {
  if (!ids.length) return [];
  const rows = await Model.find({ _id: { $in: ids }, organizationId }).select("_id").lean();
  return rows.map((r) => String(r._id));
};

const notify = async (row, actor, type, title, message) => {
  if (!row.assignedTo || String(row.assignedTo) === String(actor._id)) return;
  try {
    await Notification.create({
      organizationId: row.organizationId,
      userId: row.assignedTo,
      type,
      title,
      message: String(message || "").slice(0, 200),
      relatedType: "TenantCase",
      relatedId: row._id,
      actorEmail: actor.email || "",
    });
  } catch (err) {
    console.error("Case notification failed:", err.message);
  }
};

// Resolved / closed timestamps follow the status.
const stampStatus = (row) => {
  if (row.status === "Resolved" && !row.resolvedAt) row.resolvedAt = new Date();
  if (row.status === "Closed" && !row.closedAt) row.closedAt = new Date();
  if (!CASE_DONE_STATUSES.includes(row.status)) {
    row.resolvedAt = null;
    row.closedAt = null;
  }
};

// @route   GET /api/v1/tenant-cases/options
export const getCaseOptions = (_req, res) =>
  res.status(200).json({
    success: true,
    data: { statuses: CASE_STATUSES, doneStatuses: CASE_DONE_STATUSES, categories: CASE_CATEGORIES, priorities: CASE_PRIORITIES },
  });

// @desc    List cases, most recently active first
// @route   GET /api/v1/tenant-cases
export const getCases = async (req, res) => {
  try {
    const q = req.query;
    const filter = orgFilter(req);
    if (q.status === "open") filter.status = { $nin: CASE_DONE_STATUSES };
    else if (CASE_STATUSES.includes(q.status)) filter.status = q.status;
    if (CASE_CATEGORIES.includes(q.category)) filter.category = q.category;
    if (CASE_PRIORITIES.includes(q.priority)) filter.priority = q.priority;
    if (q.tenancyIds) filter.tenancyId = { $in: String(q.tenancyIds).split(",").filter(oid) };
    else if (oid(q.tenancyId)) filter.tenancyId = q.tenancyId;
    if (oid(q.propertyId)) filter.propertyId = q.propertyId;
    if (q.mine === "1") filter.assignedTo = req.user._id;
    else if (oid(q.assignedTo)) filter.assignedTo = q.assignedTo;
    if (q.q) {
      const rx = new RegExp(String(q.q).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ ref: rx }, { title: rx }, { description: rx }, { tenantName: rx }, { property: rx }, { room: rx }, { "activity.text": rx }];
    }

    const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200);
    const page = Math.max(Number(q.page) || 1, 1);

    const [rows, total, counts] = await Promise.all([
      TenantCase.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      TenantCase.countDocuments(filter),
      TenantCase.aggregate([
        { $match: { organizationId: new mongoose.Types.ObjectId(String(req.user.organizationId)), isDeleted: false } },
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ]),
    ]);

    const data = rows.map(({ activity = [], ...r }) => ({
      ...r,
      activityCount: activity.length,
      lastActivity: activity[activity.length - 1] || null,
    }));

    return res.status(200).json({
      success: true,
      count: data.length,
      total,
      page,
      limit,
      statusCounts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
      data,
    });
  } catch (error) {
    console.error("Get Tenant Cases Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch cases." });
  }
};

// @desc    One case, with the records it links to resolved for display
// @route   GET /api/v1/tenant-cases/:id
export const getCase = async (req, res) => {
  try {
    const row = await TenantCase.findOne(orgFilter(req, { _id: req.params.id })).lean();
    if (!row) return res.status(404).json({ success: false, message: "Case not found." });

    const organizationId = req.user.organizationId;
    const [maintenance, emailRecords, invoices] = await Promise.all([
      row.maintenanceIds?.length
        ? Maintenance.find({ _id: { $in: row.maintenanceIds }, organizationId })
            .select("ref title status priority date property room isDeleted")
            .lean()
        : [],
      row.emailRecordIds?.length
        ? EmailRecord.find({ _id: { $in: row.emailRecordIds }, organizationId })
            .select("subject issue status channel date property isDeleted")
            .lean()
        : [],
      Invoice.find({ caseId: row._id, organizationId, isDeleted: false }).select("number status total balance invoiceDate dueDate").lean(),
    ]);

    return res.status(200).json({ success: true, data: { ...row, linked: { maintenance, emailRecords, invoices } } });
  } catch (error) {
    console.error("Get Tenant Case Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch the case." });
  }
};

// @route   POST /api/v1/tenant-cases
export const createCase = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const b = req.body || {};
    const title = text(b.title, 300);
    if (!title) return res.status(400).json({ success: false, message: "A title is required." });

    let tenant;
    let assignedToEmail = "";
    try {
      tenant = await resolveTenancy(organizationId, b.tenancyId);
      if (oid(b.assignedTo)) assignedToEmail = await resolveAssignee(organizationId, b.assignedTo);
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }

    const [maintenanceIds, emailRecordIds] = await Promise.all([
      ownIds(Maintenance, organizationId, idList(b.maintenanceIds)),
      ownIds(EmailRecord, organizationId, idList(b.emailRecordIds)),
    ]);

    const seq = await nextSeq(organizationId, "tenantCase");
    const row = new TenantCase({
      organizationId,
      createdBy: req.user._id,
      createdByEmail: req.user.email || "",
      ref: formatRef("CASE-", seq),
      title,
      description: text(b.description),
      category: pick(b.category, CASE_CATEGORIES, "Other"),
      priority: pick(b.priority, CASE_PRIORITIES, "Medium"),
      status: pick(b.status, CASE_STATUSES, "Open"),
      ...tenant,
      assignedTo: oid(b.assignedTo),
      assignedToEmail,
      files: cleanAttachments(b.files),
      maintenanceIds,
      emailRecordIds,
      activity: [entry(req, "created", { text: `Case opened${assignedToEmail ? ` and assigned to ${assignedToEmail}` : ""}` })],
    });
    stampStatus(row);
    await row.save();

    await notify(row, req.user, "case_assigned", `Case assigned to you — ${row.ref}`, `${row.tenantName}: ${row.title}`);

    return res.status(201).json({ success: true, message: "Case opened.", data: row });
  } catch (error) {
    console.error("Create Tenant Case Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: Object.values(error.errors).map((e) => e.message).join(", ") });
    }
    return res.status(500).json({ success: false, message: "Failed to open the case." });
  }
};

// @desc    Edit a case. Status, assignment and link changes are written to the
//          activity log automatically.
// @route   PUT /api/v1/tenant-cases/:id
export const updateCase = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const row = await TenantCase.findOne(orgFilter(req, { _id: req.params.id }));
    if (!row) return res.status(404).json({ success: false, message: "Case not found." });
    const b = req.body || {};

    const edited = [];
    if (b.title !== undefined && text(b.title, 300) && text(b.title, 300) !== row.title) {
      row.title = text(b.title, 300);
      edited.push("title");
    }
    if (b.description !== undefined && text(b.description) !== row.description) {
      row.description = text(b.description);
      edited.push("description");
    }
    if (b.category !== undefined && pick(b.category, CASE_CATEGORIES, row.category) !== row.category) {
      row.category = pick(b.category, CASE_CATEGORIES, row.category);
      edited.push("category");
    }
    if (b.priority !== undefined && pick(b.priority, CASE_PRIORITIES, row.priority) !== row.priority) {
      row.priority = pick(b.priority, CASE_PRIORITIES, row.priority);
      edited.push("priority");
    }
    if (b.files !== undefined) {
      row.files = cleanAttachments(b.files);
      edited.push("evidence");
    }
    if (b.tenancyId !== undefined && oid(b.tenancyId) && String(b.tenancyId) !== String(row.tenancyId)) {
      try {
        row.set(await resolveTenancy(organizationId, b.tenancyId));
      } catch (e) {
        return res.status(400).json({ success: false, message: e.message });
      }
      edited.push("tenant");
    }
    if (edited.length) row.activity.push(entry(req, "edit", { text: `Updated ${edited.join(", ")}` }));

    // Status
    const statusBefore = row.status;
    if (b.status !== undefined) row.status = pick(b.status, CASE_STATUSES, row.status);
    if (row.status !== statusBefore) {
      row.activity.push(entry(req, "status", { status: row.status, text: `${statusBefore} → ${row.status}` }));
      stampStatus(row);
    }

    // Assignment
    let reassigned = false;
    if (b.assignedTo !== undefined && String(oid(b.assignedTo) || "") !== String(row.assignedTo || "")) {
      try {
        row.assignedToEmail = oid(b.assignedTo) ? await resolveAssignee(organizationId, b.assignedTo) : "";
      } catch (e) {
        return res.status(400).json({ success: false, message: e.message });
      }
      row.assignedTo = oid(b.assignedTo);
      row.activity.push(entry(req, "assignment", { text: row.assignedTo ? `Assigned to ${row.assignedToEmail}` : "Unassigned" }));
      reassigned = Boolean(row.assignedTo);
    }

    // Links
    const relink = async (field, Model, label) => {
      if (b[field] === undefined) return;
      const next = await ownIds(Model, organizationId, idList(b[field]));
      const before = new Set(row[field].map(String));
      const added = next.filter((id) => !before.has(id)).length;
      const removed = [...before].filter((id) => !next.includes(id)).length;
      if (added || removed) {
        row[field] = next;
        row.activity.push(entry(req, "link", { text: [added && `Linked ${added} ${label}`, removed && `Unlinked ${removed} ${label}`].filter(Boolean).join(", ") }));
      }
    };
    await relink("maintenanceIds", Maintenance, "maintenance job(s)");
    await relink("emailRecordIds", EmailRecord, "communication record(s)");

    await row.save();

    if (reassigned) {
      await notify(row, req.user, "case_assigned", `Case assigned to you — ${row.ref}`, `${row.tenantName}: ${row.title}`);
    } else if (row.status !== statusBefore) {
      await notify(row, req.user, "case_update", `${row.ref} is now ${row.status}`, row.title);
    }

    return res.status(200).json({ success: true, message: "Case updated.", data: row });
  } catch (error) {
    console.error("Update Tenant Case Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update the case." });
  }
};

// @desc    Add a note (with evidence), optionally moving the status
// @route   POST /api/v1/tenant-cases/:id/activity
export const addCaseActivity = async (req, res) => {
  try {
    const row = await TenantCase.findOne(orgFilter(req, { _id: req.params.id }));
    if (!row) return res.status(404).json({ success: false, message: "Case not found." });
    const b = req.body || {};
    const note = text(b.text);
    const files = cleanAttachments(b.files);
    const nextStatus = b.status !== undefined ? pick(b.status, CASE_STATUSES, row.status) : row.status;

    if (!note && !files.length && nextStatus === row.status) {
      return res.status(400).json({ success: false, message: "Write a note, attach evidence or change the status." });
    }

    if (note || files.length) row.activity.push(entry(req, "note", { text: note, files }));
    if (nextStatus !== row.status) {
      row.activity.push(entry(req, "status", { status: nextStatus, text: `${row.status} → ${nextStatus}` }));
      row.status = nextStatus;
      stampStatus(row);
    }
    await row.save();

    await notify(row, req.user, "case_update", `New update on ${row.ref}`, note || `Status: ${row.status}`);

    return res.status(201).json({ success: true, message: "Added to the case.", data: row });
  } catch (error) {
    console.error("Add Case Activity Error:", error);
    return res.status(500).json({ success: false, message: "Failed to add to the case." });
  }
};

// @desc    Remove a case (owner / admin only; soft delete)
// @route   DELETE /api/v1/tenant-cases/:id
export const deleteCase = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, message: "Only an owner or admin can delete a case. Close it instead." });
    }
    const row = await TenantCase.findOne(orgFilter(req, { _id: req.params.id }));
    if (!row) return res.status(404).json({ success: false, message: "Case not found." });
    row.isDeleted = true;
    row.deletedAt = new Date();
    await row.save();
    return res.status(200).json({ success: true, message: "Case deleted." });
  } catch (error) {
    console.error("Delete Tenant Case Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete the case." });
  }
};
