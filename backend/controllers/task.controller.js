// controllers/task.controller.js
import mongoose from "mongoose";
import Task, { TASK_PRIORITIES, TASK_STATUSES } from "../models/Task.js";
import OrganizationMember from "../models/OrganizationMember.js";
import User from "../models/User.js";
import Property from "../models/Property.js";
import { sendEmail } from "../utils/sendEmail.js";
import env from "../config/env.js";

// ---------------------------------------------------------------------------
// Permissions
//
// Admin  = the organization OWNER, or a member promoted to ADMIN. Only they
//          may create, assign, reassign, reschedule, edit or delete a task.
//          Assignment in particular is admin-only: no other role can put work
//          on somebody.
// Member = MANAGER / AGENT / FINANCE / OPERATION. They can READ every task in
//          their own organization and COMMENT on any of them, so the team has
//          one shared view of the work. What they cannot do is change a task:
//          only the owner or an actual assignee may post a status update, and
//          only the owner may assign.
//
// The three tiers, in one place:
//
//   action              ADMIN   assignee   other staff   tenant
//   ------------------  -----   --------   -----------   ------
//   see task detail      yes      yes         yes          no
//   comment              yes      yes         yes          no
//   status update        yes      yes         no           no
//   create / assign      yes      no          no           no
//   edit / delete        yes      no          no           no
//
// protect() also resolves an organizationId for TENANT accounts from their own
// Tenant record, so every handler must check the role and not merely the
// presence of an organizationId.
// ---------------------------------------------------------------------------
const STAFF_ROLES = ["OWNER", "ADMIN", "MANAGER", "AGENT", "FINANCE", "OPERATION"];

const isStaff = (req) =>
  req.user?.role === "Organization" && STAFF_ROLES.includes(req.user?.organizationRole);

const ADMIN_ROLES = ["OWNER", "ADMIN"];

const isAdmin = (req) =>
  req.user?.role === "Organization" && ADMIN_ROLES.includes(req.user?.organizationRole);

const denyNonStaff = (req, res) => {
  if (!isStaff(req)) {
    res.status(403).json({ success: false, message: "Not authorized." });
    return true;
  }
  if (!req.user?.organizationId) {
    res.status(401).json({ success: false, message: "Organization ID required" });
    return true;
  }
  return false;
};

const denyNonAdmin = (req, res) => {
  if (denyNonStaff(req, res)) return true;
  if (!isAdmin(req)) {
    res.status(403).json({
      success: false,
      message: "Only an owner or admin can create, assign or edit tasks.",
    });
    return true;
  }
  return false;
};

// ---------------------------------------------------------------------------
// Derived status
// ---------------------------------------------------------------------------
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Map legacy "Completed" → "Done" */
const normalizeStatus = (status) => (status === "Completed" ? "Done" : status);

/**
 * The status to show and count by.
 *
 * "Overdue" is derived from dueDate rather than trusted from the stored field,
 * so a task that runs past its deadline while nobody touches it still reports
 * correctly. Done and Cancelled are terminal and never overdue.
 */
export const effectiveStatus = (task) => {
  const s = normalizeStatus(task.status);
  if (s === "Done" || s === "Cancelled") return s;
  if (task.dueDate && new Date(task.dueDate) < startOfToday()) return "Overdue";
  // A stored "Overdue" with no due date in the past has nothing backing it.
  return s === "Overdue" ? "In Progress" : s;
};

const DAY_MS = 86400000;

const daysUntilDue = (dueDate) => {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  due.setHours(0, 0, 0, 0);
  return Math.round((due - startOfToday()) / DAY_MS);
};

// A decorated task that falls due today and is still open. Used for the
// "Due today" count and filter shown in every role's task view.
// MUST stay in sync with isDueToday in frontend/src/app/Shared/tasks.js.
const isDueToday = (task) =>
  task.effectiveStatus !== "Done" &&
  task.effectiveStatus !== "Cancelled" &&
  task.daysUntilDue === 0;

// Shape one task for the client: derived status plus a couple of conveniences
// the dashboard and lists would otherwise recompute per row.
//
// `req` carries the viewer, so each row also states what THIS person may do
// with it. The UI renders from those flags instead of re-deriving the rules
// from a role string, which is what keeps the buttons and the API agreeing on
// who can update and who can only comment.
const decorate = (task, req) => {
  const progress = task.progress || [];
  const comments = progress.filter((p) => p.kind === "comment");
  const updates = progress.filter((p) => p.kind !== "comment");
  const mine = req ? isAssignedTo(task, req.user._id) : false;

  return {
    ...task,
    status: normalizeStatus(task.status),
    effectiveStatus: effectiveStatus(task),
    daysUntilDue: daysUntilDue(task.dueDate),
    progressCount: updates.length,
    commentCount: comments.length,
    lastUpdate: updates.length ? updates[updates.length - 1] : null,
    lastComment: comments.length ? comments[comments.length - 1] : null,

    // Viewer-relative. Absent `req` (nothing does that today) they default to
    // read-only, which is the safe direction for a permission flag.
    isMine: mine,
    canComment: req ? canView(task, req) : false,
    canUpdateStatus: req ? canUpdateStatus(task, req) : false,
    canManage: req ? isAdmin(req) : false,
  };
};

// ---------------------------------------------------------------------------
// Input sanitisers
// ---------------------------------------------------------------------------
const toDateOrNull = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

// The business runs in the UK, so a date written into task history reads on a
// UK clock in 12-hour form — not in whatever timezone the server happens to be
// deployed in, which is what a bare toLocaleString() gives.
// MUST stay in sync with fmtDateTime in frontend/src/app/Shared/tasks.js.
const fmtUk = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "cleared";
  const date = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  });
  const time = d
    .toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Europe/London",
    })
    .toLowerCase();
  return `${date}, ${time}`;
};

const sanitizeAttachments = (list, user) =>
  (Array.isArray(list) ? list : [])
    .filter((a) => a?.url)
    .map((a) => ({
      name: a.name || "",
      url: a.url,
      publicId: a.publicId || "",
      uploadedAt: a.uploadedAt || new Date(),
      uploadedBy: user?._id || null,
      uploadedByEmail: user?.email || "",
    }));

/**
 * Accept a client status, map legacy "Completed", and reject unknown values.
 */
const normalizeIncomingStatus = (status) => {
  if (status === undefined || status === null || status === "") return null;
  const s = normalizeStatus(status);
  return TASK_STATUSES.includes(s) ? s : null;
};

/**
 * Turn a list of user ids from the client into assignee entries, keeping only
 * ACTIVE members of the caller's own organization.
 *
 * This is the tenant-isolation boundary for assignment: an id belonging to
 * another organization simply does not come back, so a task can never be
 * assigned outside the caller's team.
 */
const resolveAssignees = async (userIds, organizationId) => {
  const ids = (Array.isArray(userIds) ? userIds : [])
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(String(id)));

  if (!ids.length) return [];

  const members = await OrganizationMember.find({
    organizationId,
    userId: { $in: ids },
    status: "ACTIVE",
  })
    .select("userId role")
    .lean();

  if (!members.length) return [];

  const users = await User.find({ _id: { $in: members.map((m) => m.userId) } })
    .select("email")
    .lean();
  const emailById = new Map(users.map((u) => [String(u._id), u.email || ""]));

  return members.map((m) => ({
    userId: m.userId,
    memberId: m._id,
    email: emailById.get(String(m.userId)) || "",
    role: m.role || "",
  }));
};

/**
 * Turn a property id from the client into { propertyId, property }, keeping
 * only a property that belongs to the caller's own organization. An empty /
 * missing id clears the link. Same tenant-isolation idea as resolveAssignees:
 * an id from another organization simply does not resolve.
 */
const resolveProperty = async (propertyId, organizationId) => {
  if (!propertyId || !mongoose.isValidObjectId(propertyId)) {
    return { propertyId: null, property: "" };
  }
  const property = await Property.findOne({ _id: propertyId, organizationId })
    .select("name address")
    .lean();
  if (!property) return { propertyId: null, property: "" };
  return { propertyId: property._id, property: property.name || property.address || "" };
};

const isAssignedTo = (task, userId) =>
  (task.assignees || []).some((a) => String(a.userId) === String(userId));

/**
 * May this caller see this task at all?
 *
 * Yes, for anybody on the staff of the organization the task belongs to. The
 * team shares one view of the work: a member can open a colleague's task, read
 * its history and comment on it, whoever it is assigned to.
 *
 * `task` is still taken so every call site reads as a question about a specific
 * task, and so a narrower rule can be restored here alone if the organization
 * ever wants one. The tenant boundary is NOT this function's job — every
 * handler queries by organizationId and runs denyNonStaff first, so a tenant
 * account never reaches here.
 *
 * This used to open a task organization-wide only when it had an OPERATION
 * assignee, which meant work assigned to, say, an agent was invisible to
 * everyone but that agent and the admins — while the UI offered an "All team
 * tasks" tab that promised the opposite.
 */
const canView = (task, req) => isStaff(req);

/**
 * May this caller post a STATUS update on this task?
 *
 * The owner can move any task; an assignee can move their own. Everybody else
 * is limited to comments — which is what lets the whole team read and discuss
 * the work without being able to change the state of somebody else's task.
 */
const canUpdateStatus = (task, req) => isAdmin(req) || isAssignedTo(task, req.user._id);

const applyStatusSideEffects = (task, status, userId) => {
  task.status = status;
  if (status === "Done") {
    if (!task.completedAt) {
      task.completedAt = new Date();
      task.completedBy = userId;
    }
  } else {
    task.completedAt = null;
    task.completedBy = null;
  }
};

// ---------------------------------------------------------------------------
// Task notifications
//
// Two moments reach a member by email, because both are things they cannot
// discover by sitting still:
//
//   assignment — work has been put on them. Sent on create, and on an edit to
//                whoever is NEW on the task.
//   comment    — somebody wrote on a task they are on. Otherwise a question
//                posted on a task sits unread until they happen to reopen it.
//
// In both cases the person who caused the event is dropped from the recipient
// list: an admin assigning a task to themselves, or a member reading their own
// comment back, is noise.
// ---------------------------------------------------------------------------

// Where a member finds their tasks in the app. There is no per-task page —
// TaskDetail opens as a panel over the list — so the deepest an email can point
// is the recipient's own tasks screen, which differs per role.
const TASK_PATH_BY_ROLE = {
  OWNER: "/admin/tasks",
  ADMIN: "/admin/tasks",
  MANAGER: "/manager/tasks",
  AGENT: "/agent/tasks",
  FINANCE: "/finance/tasks",
  OPERATION: "/operation/tasks",
};

const taskUrlFor = (role) =>
  `${env.clientUrl}${TASK_PATH_BY_ROLE[role] || "/admin/tasks"}`;

// The comment body is whatever a member typed, and it is being dropped into an
// HTML email — so escape it rather than trusting it as markup.
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const assignmentEmailHtml = ({ task, assignedByEmail, taskUrl, isNew }) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <h2 style="color: #F47C3C;">📋 ${isNew ? "A task has been assigned to you" : "You have been added to a task"}</h2>
      <p><strong>Task:</strong> ${escapeHtml(task.title)}</p>
      <p><strong>Priority:</strong> ${escapeHtml(task.priority)}</p>
      ${task.startDate ? `<p><strong>Starts:</strong> ${fmtUk(task.startDate)}</p>` : ""}
      ${task.dueDate ? `<p><strong>Due:</strong> ${fmtUk(task.dueDate)}</p>` : ""}
      <p><strong>Assigned by:</strong> ${escapeHtml(assignedByEmail || "Your administrator")}</p>
      <div style="margin: 16px 0; padding: 12px 16px; border-left: 3px solid #F47C3C; background: #faf7f5;">
        ${escapeHtml(task.description).replace(/\n/g, "<br>")}
      </div>
      ${
        task.adminRemarks
          ? `<p><strong>Notes from the admin:</strong><br>${escapeHtml(task.adminRemarks).replace(
              /\n/g,
              "<br>"
            )}</p>`
          : ""
      }
      ${
        task.attachments?.length
          ? `<p><strong>Attachments:</strong><br>${task.attachments
              .map(
                (a) =>
                  `<a href="${escapeHtml(a.url)}" style="color:#F47C3C;">${escapeHtml(
                    a.name || "View file"
                  )}</a>`
              )
              .join("<br>")}</p>`
          : ""
      }
      <p style="margin-top: 20px;">
        <a href="${taskUrl}" style="background:#F47C3C;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Open the task</a>
      </p>
      <hr style="margin: 20px 0;">
      <p><em>This is an automated notification from your Property Management System.</em></p>
    </div>
  `;

/**
 * Tell people the work is now theirs.
 *
 * `targets` is the set of assignee entries to mail — every assignee on create,
 * only the newly added ones on an edit, so an admin fixing a typo does not
 * re-announce the task to the people already working on it.
 *
 * Never throws, for the same reason as the comment mail: the task is already
 * saved by the time this runs, and an SMTP failure must not report the
 * assignment back to the admin as a failure.
 */
const notifyAssignees = async (task, targets, { assignedByEmail, isNew }) => {
  const actor = String(assignedByEmail || "").trim().toLowerCase();

  const recipients = new Map();
  for (const a of targets || []) {
    const email = String(a.email || "").trim().toLowerCase();
    if (email && email !== actor) recipients.set(email, a.role || "");
  }

  if (!recipients.size) return;

  const subject = `${isNew ? "New task assigned" : "Added to a task"}: ${task.title}`;

  await Promise.allSettled(
    [...recipients].map(([email, role]) =>
      sendEmail({
        email,
        subject,
        html: assignmentEmailHtml({
          task,
          assignedByEmail,
          taskUrl: taskUrlFor(role),
          isNew,
        }),
      }).catch((err) =>
        console.error("Task assignment email failed:", email, err.message)
      )
    )
  );
};

const commentEmailHtml = ({ task, entry, taskUrl }) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <h2 style="color: #F47C3C;">💬 New comment on a task</h2>
      <p><strong>Task:</strong> ${escapeHtml(task.title)}</p>
      <p><strong>Priority:</strong> ${escapeHtml(task.priority)}${
        task.dueDate ? ` &nbsp;•&nbsp; <strong>Due:</strong> ${fmtUk(task.dueDate)}` : ""
      }</p>
      <p><strong>From:</strong> ${escapeHtml(entry.authorEmail || "A team member")}${
        entry.authorRole ? ` (${escapeHtml(entry.authorRole)})` : ""
      }</p>
      <div style="margin: 16px 0; padding: 12px 16px; border-left: 3px solid #F47C3C; background: #faf7f5;">
        ${entry.remark ? escapeHtml(entry.remark).replace(/\n/g, "<br>") : "<em>No message — see the attachments.</em>"}
      </div>
      ${
        entry.attachments?.length
          ? `<p><strong>Attachments:</strong><br>${entry.attachments
              .map(
                (a) =>
                  `<a href="${escapeHtml(a.url)}" style="color:#F47C3C;">${escapeHtml(
                    a.name || "View file"
                  )}</a>`
              )
              .join("<br>")}</p>`
          : ""
      }
      <p style="margin-top: 20px;">
        <a href="${taskUrl}" style="background:#F47C3C;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Open the task</a>
      </p>
      <hr style="margin: 20px 0;">
      <p><em>This is an automated notification from your Property Management System.</em></p>
    </div>
  `;

/**
 * Email everyone who should hear about a comment.
 *
 * One message per recipient rather than one with everybody in `to`, because
 * the link depends on the recipient's role — a MANAGER and an AGENT reach
 * their task list at different paths.
 *
 * Never throws: a comment is already saved by the time this runs, so an SMTP
 * failure must not turn a successful post into an error for the member.
 */
const notifyCommentRecipients = async (task, entry) => {
  const author = String(entry.authorEmail || "").trim().toLowerCase();

  const recipients = new Map();

  // The people the work is on.
  for (const a of task.assignees || []) {
    const email = String(a.email || "").trim().toLowerCase();
    if (email && email !== author) recipients.set(email, a.role || "");
  }

  // The admin who set the task, copied in so they see the thread too.
  const creator = String(task.createdByEmail || "").trim().toLowerCase();
  if (creator && creator !== author && !recipients.has(creator)) {
    recipients.set(creator, "ADMIN");
  }

  if (!recipients.size) return;

  const subject = `New comment on task: ${task.title}`;

  await Promise.allSettled(
    [...recipients].map(([email, role]) =>
      sendEmail({
        email,
        subject,
        html: commentEmailHtml({ task, entry, taskUrl: taskUrlFor(role) }),
      }).catch((err) =>
        console.error("Task comment email failed:", email, err.message)
      )
    )
  );
};

// ===========================================================================
// ADMIN — assignable members
// @route GET /api/v1/tasks/assignable-members
// ===========================================================================
export const getAssignableMembers = async (req, res) => {
  try {
    if (denyNonAdmin(req, res)) return;

    const members = await OrganizationMember.find({
      organizationId: req.user.organizationId,
      status: "ACTIVE",
    })
      .populate("userId", "email")
      .select("userId role status")
      .lean();

    // The owner is a member of their own organization; they can be assigned
    // work too, so no role is filtered out here.
    const data = members
      .filter((m) => m.userId)
      .map((m) => ({
        userId: m.userId._id,
        memberId: m._id,
        email: m.userId.email || "",
        role: m.role || "",
      }));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Get Assignable Members Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load team members." });
  }
};

// ===========================================================================
// Every task in the caller's organization, with filters.
//
// The whole team sees the whole board. What differs by role is what a member
// may DO with a task, not whether it is listed: only an admin or an assignee
// can move one, and only an admin can assign or edit. See `canView` and
// `canUpdateStatus`.
//
// @route GET /api/v1/tasks
// ===========================================================================
export const getTasks = async (req, res) => {
  try {
    if (denyNonStaff(req, res)) return;

    const { status, priority, assignee, search, dueToday } = req.query;
    const filter = { organizationId: req.user.organizationId, isDeleted: false };

    if (priority && TASK_PRIORITIES.includes(priority)) filter.priority = priority;
    if (assignee && mongoose.isValidObjectId(assignee)) filter["assignees.userId"] = assignee;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const tasks = await Task.find(filter).sort({ dueDate: 1, createdAt: -1 }).lean();
    // Visibility BEFORE decorating: a task that fails canView must not leak
    // through decorate's flags, counts or last-touched preview.
    const visible = tasks.filter((t) => canView(t, req));
    // Not `.map(decorate)` — map would pass the array index as the viewer.
    let data = visible.map((t) => decorate(t, req));

    // Status is filtered AFTER decorating, because "Overdue" is derived and so
    // cannot be expressed as a query on the stored field.
    if (status && TASK_STATUSES.includes(normalizeStatus(status))) {
      data = data.filter((t) => t.effectiveStatus === normalizeStatus(status));
    }

    // "Due today" is derived (like Overdue) so it is applied after decorating.
    if (dueToday === "true" || dueToday === "1") {
      data = data.filter(isDueToday);
    }

    // Counts for the tab strip, so a member view does not need the admin-only
    // stats endpoint just to label its filters.
    const stats = data.reduce(
      (acc, t) => {
        acc.total++;
        acc[t.effectiveStatus] = (acc[t.effectiveStatus] || 0) + 1;
        if (isDueToday(t)) acc.dueToday++;
        if (t.isMine) acc.mine++;
        return acc;
      },
      { total: 0, mine: 0, dueToday: 0 }
    );

    return res.status(200).json({ success: true, total: data.length, data, stats });
  } catch (error) {
    console.error("Get Tasks Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load tasks." });
  }
};

// ===========================================================================
// MEMBER — only the tasks assigned to me
// @route GET /api/v1/tasks/my
// ===========================================================================
export const getMyTasks = async (req, res) => {
  try {
    if (denyNonStaff(req, res)) return;

    const tasks = await Task.find({
      organizationId: req.user.organizationId,
      "assignees.userId": req.user._id,
      isDeleted: false,
    })
      .sort({ dueDate: 1, createdAt: -1 })
      .lean();

    const data = tasks.map((t) => decorate(t, req));

    // A compact summary so the member view can show their own counts without
    // calling the admin-only stats endpoint.
    const stats = data.reduce(
      (acc, t) => {
        acc.total++;
        acc[t.effectiveStatus] = (acc[t.effectiveStatus] || 0) + 1;
        if (isDueToday(t)) acc.dueToday++;
        return acc;
      },
      { total: 0, dueToday: 0 }
    );

    return res.status(200).json({ success: true, data, stats });
  } catch (error) {
    console.error("Get My Tasks Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load your tasks." });
  }
};

// ===========================================================================
// ADMIN dashboard aggregates
// @route GET /api/v1/tasks/stats
// ===========================================================================
export const getTaskStats = async (req, res) => {
  try {
    if (denyNonAdmin(req, res)) return;

    const tasks = await Task.find({
      organizationId: req.user.organizationId,
      isDeleted: false,
    }).lean();

    const decorated = tasks.map((t) => decorate(t, req));

    const byStatus = {
      "Not Started": 0,
      "In Progress": 0,
      Done: 0,
      Cancelled: 0,
      Overdue: 0,
    };
    const byPriority = { Low: 0, Medium: 0, High: 0, Urgent: 0 };
    const byMember = new Map();

    for (const t of decorated) {
      byStatus[t.effectiveStatus] = (byStatus[t.effectiveStatus] || 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;

      for (const a of t.assignees || []) {
        const key = String(a.userId);
        if (!byMember.has(key)) {
          byMember.set(key, {
            userId: key,
            email: a.email,
            role: a.role,
            total: 0,
            "Not Started": 0,
            "In Progress": 0,
            Done: 0,
            Cancelled: 0,
            Overdue: 0,
          });
        }
        const row = byMember.get(key);
        row.total++;
        row[t.effectiveStatus] = (row[t.effectiveStatus] || 0) + 1;
      }
    }

    const total = decorated.length;
    const completed = byStatus.Done;
    const dueToday = decorated.filter(isDueToday).length;

    // Due in the next 14 days and not finished — the "what lands next" list.
    const upcoming = decorated
      .filter(
        (t) =>
          t.effectiveStatus !== "Done" &&
          t.effectiveStatus !== "Cancelled" &&
          t.daysUntilDue !== null &&
          t.daysUntilDue >= 0 &&
          t.daysUntilDue <= 14
      )
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
      .slice(0, 8);

    // Most recently touched, by the last progress entry or the task itself.
    const lastTouched = (t) =>
      new Date(t.lastUpdate?.createdAt || t.updatedAt || t.createdAt).getTime();
    const recent = [...decorated].sort((a, b) => lastTouched(b) - lastTouched(a)).slice(0, 8);

    return res.status(200).json({
      success: true,
      stats: {
        total,
        dueToday,
        byStatus,
        byPriority,
        byMember: [...byMember.values()].sort((a, b) => b.total - a.total),
        completionRate: total ? Math.round((completed / total) * 100) : 0,
      },
      upcoming,
      recent,
    });
  } catch (error) {
    console.error("Get Task Stats Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load task statistics." });
  }
};

// ===========================================================================
// One task, in full, including its whole progress and comment history.
//
// Any staff member of the organization may open it; see `canView`. A task from
// another organization gets a 404 rather than a 403 — it does not exist for
// them, not merely "no access".
//
// @route GET /api/v1/tasks/:id
// ===========================================================================
export const getTaskById = async (req, res) => {
  try {
    if (denyNonStaff(req, res)) return;
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid task id." });
    }

    const task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: false,
    }).lean();

    if (!task || !canView(task, req)) {
      return res.status(404).json({ success: false, message: "Task not found." });
    }

    return res.status(200).json({ success: true, data: decorate(task, req) });
  } catch (error) {
    console.error("Get Task Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load the task." });
  }
};

// ===========================================================================
// ADMIN — create and assign
// @route POST /api/v1/tasks
// ===========================================================================
export const createTask = async (req, res) => {
  try {
    if (denyNonAdmin(req, res)) return;

    const {
      title,
      description,
      assignees,
      priority,
      status,
      startDate,
      dueDate,
      attachments,
      adminRemarks,
      propertyId,
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: "Task title is required." });
    }
    if (!description?.trim()) {
      return res.status(400).json({ success: false, message: "Task description is required." });
    }

    const property = await resolveProperty(propertyId, req.user.organizationId);
    const resolved = await resolveAssignees(assignees, req.user.organizationId);
    if (!resolved.length) {
      return res.status(400).json({
        success: false,
        message: "Assign the task to at least one active team member.",
      });
    }

    const start = toDateOrNull(startDate) ?? null;
    const due = toDateOrNull(dueDate) ?? null;
    if (start && due && due < start) {
      return res.status(400).json({
        success: false,
        message: "The due date/time cannot be before the start date/time.",
      });
    }

    const normalized = normalizeIncomingStatus(status) || "Not Started";

    const task = await Task.create({
      organizationId: req.user.organizationId,
      createdBy: req.user._id,
      createdByEmail: req.user.email || "",
      title: title.trim(),
      description: description.trim(),
      propertyId: property.propertyId,
      property: property.property,
      assignees: resolved,
      priority: TASK_PRIORITIES.includes(priority) ? priority : "Medium",
      status: normalized,
      startDate: start,
      dueDate: due,
      attachments: sanitizeAttachments(attachments, req.user),
      adminRemarks: adminRemarks?.trim() || "",
      ...(normalized === "Done"
        ? { completedAt: new Date(), completedBy: req.user._id }
        : {}),
    });

    // Everyone it landed on hears about it. Awaited so a send is attempted
    // before the response, but it swallows its own failures — the task exists
    // either way.
    await notifyAssignees(task, resolved, {
      assignedByEmail: req.user.email || "",
      isNew: true,
    });

    return res.status(201).json({
      success: true,
      message: "Task created and assigned.",
      data: decorate(task.toObject(), req),
    });
  } catch (error) {
    console.error("Create Task Error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// ===========================================================================
// ADMIN — edit, reassign, re-prioritise
// @route PUT /api/v1/tasks/:id
// ===========================================================================
export const updateTask = async (req, res) => {
  try {
    if (denyNonAdmin(req, res)) return;
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid task id." });
    }

    const task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: false,
    });
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });

    const {
      title,
      description,
      assignees,
      priority,
      status,
      startDate,
      dueDate,
      attachments,
      adminRemarks,
      propertyId,
    } = req.body;

    if (propertyId !== undefined) {
      const property = await resolveProperty(propertyId, req.user.organizationId);
      task.propertyId = property.propertyId;
      task.property = property.property;
    }

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({ success: false, message: "Task title is required." });
      }
      task.title = title.trim();
    }
    if (description !== undefined) {
      if (!description.trim()) {
        return res.status(400).json({ success: false, message: "Task description is required." });
      }
      task.description = description.trim();
    }

    // Reassignment. Only replace the list when the client actually sent one, so
    // a partial edit cannot silently unassign everybody.
    //
    // Whoever is new on the task is mailed after the save. The ones already on
    // it are not: they were told when they were assigned, and an admin fixing a
    // due date should not re-announce the work to them.
    let newlyAssigned = [];
    if (assignees !== undefined) {
      const resolved = await resolveAssignees(assignees, req.user.organizationId);
      if (!resolved.length) {
        return res.status(400).json({
          success: false,
          message: "Assign the task to at least one active team member.",
        });
      }
      const before = new Set((task.assignees || []).map((a) => String(a.userId)));
      newlyAssigned = resolved.filter((a) => !before.has(String(a.userId)));
      task.assignees = resolved;
    }

    if (priority !== undefined && TASK_PRIORITIES.includes(priority)) task.priority = priority;
    if (adminRemarks !== undefined) task.adminRemarks = adminRemarks.trim();
    if (startDate !== undefined) task.startDate = toDateOrNull(startDate);
    if (dueDate !== undefined) task.dueDate = toDateOrNull(dueDate);

    if (task.startDate && task.dueDate && task.dueDate < task.startDate) {
      return res.status(400).json({
        success: false,
        message: "The due date/time cannot be before the start date/time.",
      });
    }

    const normalized = normalizeIncomingStatus(status);
    if (normalized) {
      applyStatusSideEffects(task, normalized, req.user._id);
    }

    if (attachments !== undefined) {
      task.attachments = sanitizeAttachments(attachments, req.user);
    }

    await task.save();

    await notifyAssignees(task, newlyAssigned, {
      assignedByEmail: req.user.email || "",
      isNew: false,
    });

    return res.status(200).json({
      success: true,
      message: "Task updated.",
      data: decorate(task.toObject(), req),
    });
  } catch (error) {
    console.error("Update Task Error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// ===========================================================================
// ADMIN — reschedule start / due (writes a progress note)
// @route PATCH /api/v1/tasks/:id/reschedule
// ===========================================================================
export const rescheduleTask = async (req, res) => {
  try {
    if (denyNonAdmin(req, res)) return;
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid task id." });
    }

    const task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: false,
    });
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });

    const { startDate, dueDate, remark } = req.body;

    if (startDate !== undefined) task.startDate = toDateOrNull(startDate);
    if (dueDate !== undefined) task.dueDate = toDateOrNull(dueDate);

    if (task.startDate && task.dueDate && task.dueDate < task.startDate) {
      return res.status(400).json({
        success: false,
        message: "The due date/time cannot be before the start date/time.",
      });
    }

    const stored = normalizeStatus(task.status);
    const note =
      remark?.trim() ||
      `Rescheduled — due ${task.dueDate ? fmtUk(task.dueDate) : "cleared"}`;

    task.progress.push({
      kind: "update",
      status: stored === "Overdue" ? "In Progress" : stored,
      remark: note,
      attachments: [],
      isReport: false,
      authorId: req.user._id,
      authorEmail: req.user.email || "",
      authorRole: req.user.organizationRole || "",
      createdAt: new Date(),
    });

    // If it was overdue and the new due is in the future, bump stored status
    // out of a stale "Overdue" so history stays sensible.
    if (stored === "Overdue") {
      task.status = "In Progress";
    }

    await task.save();

    return res.status(200).json({
      success: true,
      message: "Task rescheduled.",
      data: decorate(task.toObject(), req),
    });
  } catch (error) {
    console.error("Reschedule Task Error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// ===========================================================================
// ADMIN — soft delete
// @route DELETE /api/v1/tasks/:id
// ===========================================================================
export const deleteTask = async (req, res) => {
  try {
    if (denyNonAdmin(req, res)) return;
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid task id." });
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.user.organizationId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    );

    if (!task) return res.status(404).json({ success: false, message: "Task not found." });

    return res.status(200).json({ success: true, message: "Task deleted." });
  } catch (error) {
    console.error("Delete Task Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete the task." });
  }
};

// ===========================================================================
// Append to a task's timeline. Two kinds of entry come through here:
//
//   kind "comment" — anyone who can SEE the task, which is any staff member of
//                    the organization. Carries no status, so it cannot move
//                    the work.
//   kind "update"  — the owner on any task, an assignee on their own. Moves the
//                    task to a status and can be flagged as a formal report.
//
// This is the ONLY write a non-owner can make, and it reaches neither
// assignees, priority nor dates — so assignment stays owner-only no matter what
// a member posts here.
//
// @route POST /api/v1/tasks/:id/progress
// ===========================================================================
export const addTaskProgress = async (req, res) => {
  try {
    if (denyNonStaff(req, res)) return;
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid task id." });
    }

    const task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: false,
    });
    if (!task || !canView(task, req)) {
      return res.status(404).json({ success: false, message: "Task not found." });
    }

    const { status, remark, attachments, isReport } = req.body;

    // Trust the caller's rights, not the flag they sent: anyone who cannot post
    // a status update is writing a comment, whatever `kind` says.
    const mayUpdate = canUpdateStatus(task, req);
    const wantsComment = req.body.kind === "comment";
    const isComment = wantsComment || !mayUpdate;

    if (!remark?.trim() && !(Array.isArray(attachments) && attachments.length)) {
      return res.status(400).json({
        success: false,
        message: isComment
          ? "Write a comment or attach a file."
          : "Add a remark or an attachment to record an update.",
      });
    }

    // A status is required to move the task, and meaningless on a comment.
    const normalized = isComment ? null : normalizeIncomingStatus(status);
    if (!isComment && !normalized) {
      return res.status(400).json({ success: false, message: "A valid status is required." });
    }

    const entry = {
      kind: isComment ? "comment" : "update",
      status: normalized,
      remark: remark?.trim() || "",
      attachments: sanitizeAttachments(attachments, req.user),
      // A comment is never a formal report — that is a statement about the work
      // itself, which only the owner or an assignee is in a position to make.
      isReport: isComment ? false : Boolean(isReport),
      authorId: req.user._id,
      authorEmail: req.user.email || "",
      authorRole: req.user.organizationRole || "",
      createdAt: new Date(),
    };

    task.progress.push(entry);
    if (!isComment) applyStatusSideEffects(task, normalized, req.user._id);

    await task.save();

    // Only after the save — a comment nobody could read is not worth emailing
    // about. Awaited so a send is at least attempted before the response, but
    // it swallows its own failures: the comment is stored either way.
    if (isComment) await notifyCommentRecipients(task, entry);

    return res.status(201).json({
      success: true,
      message: isComment ? "Comment added." : "Progress recorded.",
      data: decorate(task.toObject(), req),
    });
  } catch (error) {
    console.error("Add Task Progress Error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const taskPriorities = TASK_PRIORITIES;
export const taskStatuses = TASK_STATUSES;