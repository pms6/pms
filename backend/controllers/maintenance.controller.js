// controllers/maintenance.controller.js
import Maintenance, {
  MAINTENANCE_STATUSES,
  MAINTENANCE_RESOLVED_STATUSES,
  MAINTENANCE_CONTACT_TIMES,
} from "../models/Maintenance.js";
import Notification from "../models/Notification.js";
import Tenancy from "../models/Tenancy.js";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import { sendEmail } from "../utils/sendEmail.js";
import env from "../config/env.js";
import { resolveTenantProperty } from "../utils/tenantProperty.js";
import { orgTeamUserIds } from "../utils/orgTeam.js";

const AWAITING_RESPONSE = "awaiting_response";

// An entry moved to "awaiting response" is stuck on somebody's answer, so every
// admin gets an in-app notification — except the one who made the change.
// Never throws: the entry is already saved by the time this runs.
const notifyAwaitingResponse = async (request, actor) => {
  try {
    const adminIds = await orgTeamUserIds(request.organizationId, ["OWNER", "ADMIN"]);
    const docs = adminIds
      .filter((id) => id !== String(actor?._id))
      .map((userId) => ({
        organizationId: request.organizationId,
        userId,
        type: "maintenance_awaiting_response",
        title: "Maintenance awaiting response",
        message: [request.ref, request.title, request.property].filter(Boolean).join(" — "),
        relatedType: "Maintenance",
        relatedId: request._id,
        actorEmail: actor?.email || "",
      }));
    if (docs.length) await Notification.insertMany(docs, { ordered: false });
  } catch (err) {
    console.error("Maintenance notification failed:", err.message);
  }
};

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// What each status means to the tenant who reported the job.
const TENANT_STATUS_COPY = {
  pending: { label: "Reported", line: "We have your report and will review it shortly." },
  open: { label: "Reported", line: "We have your report and will review it shortly." },
  assigned: { label: "Contractor assigned", line: "A contractor has been assigned and will be in touch to arrange a visit." },
  in_progress: { label: "Work in progress", line: "Work on your repair is under way." },
  awaiting_response: { label: "Awaiting a response", line: "We are waiting on a reply, possibly from you, a contractor or the landlord, before the job can move on." },
  on_hold: { label: "On hold", line: "Your repair is on hold for now. We will let you know when it moves again." },
  sorted: { label: "Sorted", line: "Your repair has been marked as complete. If the problem isn't fixed, please report it again." },
  closed: { label: "Sorted", line: "Your repair has been marked as complete. If the problem isn't fixed, please report it again." },
};

// Email the tenant behind a job that its status has changed. Only jobs tied to
// a tenant (reported from the portal, or linked by staff) have anyone to tell.
// Never throws, and callers don't await it: the status is already saved and a
// slow SMTP server must not hold up the office's screen.
const emailTenantStatusChange = async (request, status) => {
  try {
    const copy = TENANT_STATUS_COPY[status];
    if (!copy) return;

    let email = "";
    let name = "";
    if (request.tenancyId) {
      const tenancy = await Tenancy.findById(request.tenancyId).select("tenantEmail tenant").lean();
      email = tenancy?.tenantEmail || "";
      name = tenancy?.tenant || "";
    }
    if (!email && request.createdBy) {
      const user = await User.findById(request.createdBy).select("email role").lean();
      if (user?.role === "Tenant") email = user.email || "";
    }
    if (!email) return;

    const org = await Organization.findById(request.organizationId).select("name").lean();
    const orgName = org?.name || "";
    const link = `${env.clientUrl}/tenant/maintenance?tab=requests`;

    await sendEmail({
      email,
      subject: `Repair update: ${request.title} is now "${copy.label}"${request.ref ? ` (${request.ref})` : ""}`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; color: #0F253B;">
        <h2 style="color: #F47C3C; margin-bottom: 4px;">Your repair has been updated</h2>
        <p>Hi ${esc(name || "there")},</p>
        <p>The status of your repair request has changed:</p>
        <table style="margin: 16px 0; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 4px 16px 4px 0; color: #64748b;">Reference</td><td><strong>${esc(request.ref || "—")}</strong></td></tr>
          <tr><td style="padding: 4px 16px 4px 0; color: #64748b;">Issue</td><td><strong>${esc(request.title)}</strong></td></tr>
          <tr><td style="padding: 4px 16px 4px 0; color: #64748b;">New status</td><td><strong style="color: #F47C3C;">${esc(copy.label)}</strong></td></tr>
        </table>
        <p>${esc(copy.line)}</p>
        <p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#F47C3C;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Track your repair</a></p>
        <p style="color:#64748b;font-size:12px;">${orgName ? `Sent by ${esc(orgName)}. ` : ""}Please don't reply to this email. Use the tenant portal instead.</p>
      </div>`,
    });
  } catch (err) {
    console.error("Maintenance status email failed:", err.message);
  }
};

// One entry as a plain object, with each comment saying whether THIS viewer
// may edit it — only the person who wrote it can.
const withCommentFlags = (request, req) => {
  const row = typeof request.toObject === "function" ? request.toObject() : request;
  if (!Array.isArray(row.comments)) return row;
  return {
    ...row,
    comments: row.comments.map((c) => ({
      ...c,
      canEdit: String(c.authorId || "") === String(req.user._id),
    })),
  };
};

/**
 * Whitelist of fields a client may set on create/update.
 */
const EDITABLE_KEYS = [
  "title",
  "description",
  "category",
  "issue",
  "issueStarted",
  "access",
  "propertyId",
  "property",
  "roomId",
  "room",
  "tenancyId",
  "reportedBy",
  "supplierId",
  "supplier",
  "priority",
  "status",
  "solutionTitle",
  "solutionSteps",
  "cost",
  "date",
  "media",
  "image",
];

// Attachments arrive as [{ url, publicId, name, type, format, bytes, stage }]
// straight from the browser's Cloudinary upload, where `stage` says whether the
// shot is of the problem ("before") or the finished work ("after"). Keep only
// rows that actually have a URL.
const cleanMedia = (media) => {
  if (!Array.isArray(media)) return [];
  return media
    .map((f) => ({
      url: String(f?.url ?? "").trim(),
      publicId: String(f?.publicId ?? "").trim(),
      name: String(f?.name ?? "").trim(),
      type: ["video", "pdf"].includes(f?.type)
        ? f.type
        : String(f?.format ?? "").toLowerCase() === "pdf" || /\.pdf(\?|$)/i.test(f?.url ?? "")
        ? "pdf"
        : "image",
      format: String(f?.format ?? "").trim(),
      bytes: Number(f?.bytes) || 0,
      stage: ["before", "after"].includes(f?.stage) ? f.stage : "",
    }))
    .filter((f) => f.url);
};

// The booklet's "Solution" column arrives as [{ title, detail }]. Coerce it and
// drop rows the operator left completely blank.
const cleanSteps = (steps) => {
  if (!Array.isArray(steps)) return [];
  return steps
    .map((s) => ({
      title: String(s?.title ?? "").trim(),
      detail: String(s?.detail ?? "").trim(),
    }))
    .filter((s) => s.title || s.detail);
};

// The tenant form's access answers. Unknown keys are dropped and a contact time
// outside the vocabulary is treated as "not said".
const cleanAccess = (access) => {
  const a = access && typeof access === "object" ? access : {};
  const text = (v) => String(v ?? "").trim().slice(0, 500);
  return {
    contactTime: MAINTENANCE_CONTACT_TIMES.includes(a.contactTime) ? a.contactTime : "",
    permissionToEnter: typeof a.permissionToEnter === "boolean" ? a.permissionToEnter : null,
    availability: text(a.availability),
    pets: text(a.pets),
    notes: text(a.notes),
  };
};

const pickPayload = (body) => {
  const payload = {};
  for (const key of EDITABLE_KEYS) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  if (payload.solutionSteps !== undefined) {
    payload.solutionSteps = cleanSteps(payload.solutionSteps);
  }
  // An emptied tenant picker sends "" — that means "no tenant".
  if (payload.tenancyId !== undefined && !payload.tenancyId) payload.tenancyId = null;
  if (payload.access !== undefined) payload.access = cleanAccess(payload.access);
  if (payload.issueStarted !== undefined && !payload.issueStarted) payload.issueStarted = null;
  if (payload.media !== undefined) {
    payload.media = cleanMedia(payload.media);
    // Mirror the first photo into the legacy `image` field so anything still
    // reading it (the tenant dashboard, older records) shows a cover shot.
    if (body.image === undefined) {
      payload.image = payload.media.find((f) => f.type === "image")?.url || "";
    }
  }
  if (payload.cost !== undefined) {
    payload.cost =
      payload.cost === "" || payload.cost === null ? null : Number(payload.cost);
    if (Number.isNaN(payload.cost)) payload.cost = null;
  }
  return payload;
};

// Generate the next "MR-####" reference for an org. Scans existing numeric
// suffixes (including soft-deleted rows) so references are never reused.
const nextRef = async (organizationId) => {
  const docs = await Maintenance.find({ organizationId, ref: /^MR-\d+$/ })
    .select("ref")
    .lean();

  let max = 1000;
  for (const d of docs) {
    const n = Number(String(d.ref).replace("MR-", ""));
    if (Number.isFinite(n) && n > max) max = n;
  }

  return `MR-${max + 1}`;
};

// Next "Sr#" for an org. Soft-deleted rows keep their number so the booklet
// never reuses one.
const nextSrNo = async (organizationId) => {
  const last = await Maintenance.findOne({ organizationId, srNo: { $ne: null } })
    .sort({ srNo: -1 })
    .select("srNo")
    .lean();

  return (last?.srNo || 0) + 1;
};

// @desc    List maintenance requests (with optional filters)
// @route   GET /api/v1/maintenance
export const getMaintenance = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const { status, priority, property, open, limit } = req.query;

    const filter = { organizationId, isDeleted: false };
    if (status) filter.status = status;
    // `?open=1` — everything still outstanding, whichever vocabulary was used.
    else if (open === "1" || open === "true") {
      filter.status = { $nin: MAINTENANCE_RESOLVED_STATUSES };
    }
    if (priority) filter.priority = priority;
    if (property) filter.property = property;

    // A tenant only ever sees the requests they raised — never the whole org's.
    if (req.user.role === "Tenant") {
      filter.createdBy = req.user._id;
    }

    let query = Maintenance.find(filter).sort({ date: -1, createdAt: -1 });
    // The discussion is the office talking among itself — never sent to a tenant.
    if (req.user.role === "Tenant") query = query.select("-comments");
    const max = Number(limit);
    if (Number.isFinite(max) && max > 0) query = query.limit(max);

    const requests = await query;

    return res.status(200).json({
      success: true,
      data: requests.map((r) => withCommentFlags(r, req)),
    });
  } catch (error) {
    console.error("Get Maintenance Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch maintenance requests." });
  }
};

// @desc    Maintenance summary stats (cards)
// @route   GET /api/v1/maintenance/stats
export const getMaintenanceStats = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ success: false, message: "Organization ID required" });
    }

    const match = { organizationId, isDeleted: false };
    const outstanding = { $nin: MAINTENANCE_RESOLVED_STATUSES };
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [open, urgent, resolved, suppliers, spendAgg] = await Promise.all([
      Maintenance.countDocuments({ ...match, status: outstanding }),
      Maintenance.countDocuments({ ...match, priority: "urgent", status: outstanding }),
      Maintenance.countDocuments({ ...match, status: { $in: MAINTENANCE_RESOLVED_STATUSES } }),
      Maintenance.distinct("supplier", { ...match, supplier: { $nin: [null, ""] } }),
      Maintenance.aggregate([
        { $match: { ...match, date: { $gte: thirtyDaysAgo }, cost: { $ne: null } } },
        { $group: { _id: null, total: { $sum: "$cost" } } },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        open,
        urgent,
        resolved,
        suppliersEngaged: suppliers.length,
        spend: spendAgg[0]?.total || 0,
      },
    });
  } catch (error) {
    console.error("Maintenance Stats Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load maintenance stats." });
  }
};

// @desc    Create a maintenance request
// @route   POST /api/v1/maintenance
export const createMaintenance = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const createdBy = req.user._id;

    const payload = pickPayload(req.body);

    if (!payload.title || !String(payload.title).trim()) {
      return res.status(400).json({ success: false, message: "Issue is required." });
    }

    // For a tenant, stamp the request with THEIR property/room and name so the
    // operator sees who reported it and where — the tenant can't set these.
    if (req.user.role === "Tenant") {
      // A tenant's report must come with evidence — at least one photo or
      // video of the problem. The portal enforces this too; this stops a
      // report sent straight to the API from skipping it.
      const evidence = (payload.media || []).filter((m) => m.type === "image" || m.type === "video");
      if (evidence.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please attach at least one photo or video of the problem.",
        });
      }

      const { tenancy, property } = await resolveTenantProperty(req.user);
      if (property?._id) payload.propertyId = property._id;
      payload.property = property?.name || tenancy?.property || payload.property || "";
      payload.room = tenancy?.unit && tenancy.unit !== "—" ? tenancy.unit : payload.room || "";
      if (tenancy?.roomId) payload.roomId = tenancy.roomId;
      // Files the job on the tenant's own timeline and case history.
      if (tenancy?._id) payload.tenancyId = tenancy._id;
      payload.reportedBy = tenancy?.tenant || req.user.email || "Tenant";
      // Tenants can't self-assign a supplier, cost, solution or a non-default status.
      delete payload.supplierId;
      delete payload.supplier;
      delete payload.cost;
      delete payload.status;
      delete payload.solutionTitle;
      delete payload.solutionSteps;
    }

    const [ref, srNo] = await Promise.all([
      nextRef(organizationId),
      nextSrNo(organizationId),
    ]);

    const request = await Maintenance.create({
      ...payload,
      ref,
      srNo,
      organizationId,
      createdBy,
      statusHistory: [{ status: payload.status || "pending", at: new Date() }],
    });

    if (request.status === AWAITING_RESPONSE) await notifyAwaitingResponse(request, req.user);

    return res.status(201).json({
      success: true,
      message: "Maintenance request created.",
      data: request,
    });
  } catch (error) {
    console.error("Create Maintenance Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to create maintenance request." });
  }
};

// @desc    Read a single maintenance request
// @route   GET /api/v1/maintenance/:id
export const getMaintenanceById = async (req, res) => {
  try {
    const filter = {
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: false,
    };
    if (req.user.role === "Tenant") filter.createdBy = req.user._id;

    const request = await Maintenance.findOne(filter).select(
      req.user.role === "Tenant" ? "-comments" : ""
    );
    if (!request) {
      return res.status(404).json({ success: false, message: "Maintenance request not found." });
    }

    return res.status(200).json({ success: true, data: withCommentFlags(request, req) });
  } catch (error) {
    console.error("Get Maintenance By Id Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch maintenance request." });
  }
};

// @desc    Update a maintenance request
// @route   PUT /api/v1/maintenance/:id
export const updateMaintenance = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const request = await Maintenance.findOne({
      _id: req.params.id,
      organizationId,
      isDeleted: false,
    });

    if (!request) {
      return res.status(404).json({ success: false, message: "Maintenance request not found." });
    }

    const payload = pickPayload(req.body);
    if (payload.title !== undefined && !String(payload.title).trim()) {
      return res.status(400).json({ success: false, message: "Issue is required." });
    }

    const awaiting =
      payload.status === AWAITING_RESPONSE && request.status !== AWAITING_RESPONSE;

    const statusChanged = payload.status !== undefined && payload.status !== request.status;

    Object.assign(request, payload);
    if (statusChanged) request.statusHistory.push({ status: payload.status, at: new Date() });
    const updated = await request.save();

    if (awaiting) await notifyAwaitingResponse(updated, req.user);
    if (statusChanged) emailTenantStatusChange(updated, updated.status);

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Update Maintenance Error:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map((e) => e.message).join(", "),
      });
    }
    return res.status(500).json({ success: false, message: "Failed to update maintenance request." });
  }
};

// @desc    Update just the status of a request
// @route   PATCH /api/v1/maintenance/:id/status
export const updateMaintenanceStatus = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { status } = req.body;

    if (!MAINTENANCE_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status." });
    }

    // The document as it was BEFORE the change, so a move onto "awaiting
    // response" can be told apart from a re-save of the same status.
    // Only a real change goes on the tenant's progress tracker; re-saving
    // the same status leaves the history alone.
    const previous = await Maintenance.findOneAndUpdate(
      { _id: req.params.id, organizationId, isDeleted: false },
      [
        {
          $set: {
            statusHistory: {
              $cond: [
                { $eq: ["$status", status] },
                { $ifNull: ["$statusHistory", []] },
                { $concatArrays: [{ $ifNull: ["$statusHistory", []] }, [{ status, at: "$$NOW" }]] },
              ],
            },
            status,
          },
        },
      ],
      { new: false }
    );

    if (!previous) {
      return res.status(404).json({ success: false, message: "Maintenance request not found." });
    }

    const request = previous.toObject();
    const awaiting = status === AWAITING_RESPONSE && request.status !== AWAITING_RESPONSE;
    request.status = status;

    if (awaiting) await notifyAwaitingResponse(request, req.user);
    if (previous.status !== status) emailTenantStatusChange(request, status);

    return res.status(200).json({ success: true, data: request });
  } catch (error) {
    console.error("Update Maintenance Status Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update status." });
  }
};

// @desc    Add a comment to an entry's discussion (staff only — see the route)
// @route   POST /api/v1/maintenance/:id/comments
export const addMaintenanceComment = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const text = String(req.body?.text ?? "").trim().slice(0, 5000);

    if (!text) {
      return res.status(400).json({ success: false, message: "Write a comment first." });
    }

    const request = await Maintenance.findOne({
      _id: req.params.id,
      organizationId,
      isDeleted: false,
    });
    if (!request) {
      return res.status(404).json({ success: false, message: "Maintenance request not found." });
    }

    // Everyone already in the conversation, read before this comment is added.
    const participants = request.comments.map((c) => String(c.authorId || "")).filter(Boolean);

    request.comments.push({
      text,
      authorId: req.user._id,
      authorEmail: req.user.email || "",
      authorRole: req.user.organizationRole || "",
      createdAt: new Date(),
    });
    await request.save();

    // Owner comments go to active Admins; Admin comments go to the Owner.
    // Other staff keep the existing leadership-and-participants notification.
    // Failing to write a notification must not fail the saved comment.
    try {
      const role = req.user.organizationRole;
      let recipients;
      if (role === "OWNER") {
        recipients = await orgTeamUserIds(organizationId, ["ADMIN"]);
      } else if (role === "ADMIN") {
        recipients = await orgTeamUserIds(organizationId, ["OWNER"]);
      } else {
        const team = await orgTeamUserIds(organizationId);
        recipients = [...team, ...participants];
      }
      const docs = [...new Set(recipients)]
        .filter((id) => id !== String(req.user._id))
        .map((userId) => ({
          organizationId,
          userId,
          type: "maintenance_comment",
          title: "New comment on maintenance issue",
          message: `${[request.ref, request.title].filter(Boolean).join(" — ")}: ${text}`.slice(0, 200),
          relatedType: "Maintenance",
          relatedId: request._id,
          actorEmail: req.user.email || "",
        }));
      if (docs.length) await Notification.insertMany(docs, { ordered: false });
    } catch (err) {
      console.error("Maintenance comment notification failed:", err.message);
    }

    return res.status(201).json({
      success: true,
      message: "Comment added.",
      data: withCommentFlags(request, req),
    });
  } catch (error) {
    console.error("Add Maintenance Comment Error:", error);
    return res.status(500).json({ success: false, message: "Failed to add the comment." });
  }
};

// @desc    Edit a comment — only by the person who wrote it
// @route   PATCH /api/v1/maintenance/:id/comments/:commentId
export const editMaintenanceComment = async (req, res) => {
  try {
    const text = String(req.body?.text ?? "").trim().slice(0, 5000);
    if (!text) {
      return res.status(400).json({ success: false, message: "A comment cannot be empty." });
    }

    const request = await Maintenance.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: false,
    });
    const comment = request?.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found." });
    }
    if (String(comment.authorId || "") !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Only the person who wrote a comment can edit it.",
      });
    }

    comment.text = text;
    comment.editedAt = new Date();
    await request.save();

    return res.status(200).json({
      success: true,
      message: "Comment updated.",
      data: withCommentFlags(request, req),
    });
  } catch (error) {
    console.error("Edit Maintenance Comment Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update the comment." });
  }
};

// @desc    Soft delete a maintenance request
// @route   DELETE /api/v1/maintenance/:id
export const deleteMaintenance = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    const request = await Maintenance.findOne({ _id: req.params.id, organizationId });
    if (!request) {
      return res.status(404).json({ success: false, message: "Maintenance request not found." });
    }

    request.isDeleted = true;
    request.deletedAt = new Date();
    await request.save();

    return res.status(200).json({ success: true, message: "Maintenance request deleted." });
  } catch (error) {
    console.error("Delete Maintenance Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete maintenance request." });
  }
};
