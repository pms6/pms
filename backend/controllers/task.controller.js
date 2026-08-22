// controllers/task.controller.js
import mongoose from "mongoose";
import Task, { TASK_PRIORITIES, TASK_STATUSES } from "../models/Task.js";
import OrganizationMember from "../models/OrganizationMember.js";
import User from "../models/User.js";

// ---------------------------------------------------------------------------
// Permissions
//
// Admin  = the organization OWNER. Only they may create, assign, reassign,
//          edit or delete a task, and only they see every task.
// Member = MANAGER / AGENT / FINANCE. They see the tasks assigned to them and
//          may append progress, nothing else.
//
// protect() also resolves an organizationId for TENANT accounts from their own
// Tenant record, so every handler must check the role and not merely the
// presence of an organizationId.
// ---------------------------------------------------------------------------
const STAFF_ROLES = ["OWNER", "MANAGER", "AGENT", "FINANCE"];

const isStaff = (req) =>
  req.user?.role === "Organization" && STAFF_ROLES.includes(req.user?.organizationRole);

const isAdmin = (req) =>
  req.user?.role === "Organization" && req.user?.organizationRole === "OWNER";

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
      message: "Only the organization owner can create, assign or edit tasks.",
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

// Shape one task for the client: derived status plus a couple of conveniences
// the dashboard and lists would otherwise recompute per row.
const decorate = (task) => ({
  ...task,
  status: normalizeStatus(task.status),
  effectiveStatus: effectiveStatus(task),
  daysUntilDue: daysUntilDue(task.dueDate),
  progressCount: task.progress?.length || 0,
  lastUpdate: task.progress?.length ? task.progress[task.progress.length - 1] : null,
});

// ---------------------------------------------------------------------------
// Input sanitisers
// ---------------------------------------------------------------------------
const toDateOrNull = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
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

const isAssignedTo = (task, userId) =>
  (task.assignees || []).some((a) => String(a.userId) === String(userId));

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
// ADMIN — every task, with filters
// @route GET /api/v1/tasks
// ===========================================================================
export const getTasks = async (req, res) => {
  try {
    if (denyNonAdmin(req, res)) return;

    const { status, priority, assignee, search } = req.query;
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
    let data = tasks.map(decorate);

    // Status is filtered AFTER decorating, because "Overdue" is derived and so
    // cannot be expressed as a query on the stored field.
    if (status && TASK_STATUSES.includes(normalizeStatus(status))) {
      data = data.filter((t) => t.effectiveStatus === normalizeStatus(status));
    }

    return res.status(200).json({ success: true, total: data.length, data });
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

    const data = tasks.map(decorate);

    // A compact summary so the member view can show their own counts without
    // calling the admin-only stats endpoint.
    const stats = data.reduce(
      (acc, t) => {
        acc.total++;
        acc[t.effectiveStatus] = (acc[t.effectiveStatus] || 0) + 1;
        return acc;
      },
      { total: 0 }
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

    const decorated = tasks.map(decorate);

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
// One task. Admin sees any; a member only one assigned to them.
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

    if (!task) return res.status(404).json({ success: false, message: "Task not found." });

    // A member may only open a task they are on. Same 404 as a missing task, so
    // this cannot be used to probe which task ids exist.
    if (!isAdmin(req) && !isAssignedTo(task, req.user._id)) {
      return res.status(404).json({ success: false, message: "Task not found." });
    }

    return res.status(200).json({ success: true, data: decorate(task) });
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
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: "Task title is required." });
    }
    if (!description?.trim()) {
      return res.status(400).json({ success: false, message: "Task description is required." });
    }

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

    return res.status(201).json({
      success: true,
      message: "Task created and assigned.",
      data: decorate(task.toObject()),
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
    } = req.body;

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
    if (assignees !== undefined) {
      const resolved = await resolveAssignees(assignees, req.user.organizationId);
      if (!resolved.length) {
        return res.status(400).json({
          success: false,
          message: "Assign the task to at least one active team member.",
        });
      }
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

    return res.status(200).json({
      success: true,
      message: "Task updated.",
      data: decorate(task.toObject()),
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
      `Rescheduled — due ${
        task.dueDate ? new Date(task.dueDate).toLocaleString() : "cleared"
      }`;

    task.progress.push({
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
      data: decorate(task.toObject()),
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
// Append a progress update. Admin on any task; a member only on their own.
//
// This is the ONLY write a team member can make. It cannot change assignees,
// priority or dates — only the status, plus a remark and attachments — so
// reassignment stays impossible from the member side.
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
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });

    if (!isAdmin(req) && !isAssignedTo(task, req.user._id)) {
      return res.status(404).json({ success: false, message: "Task not found." });
    }

    const { status, remark, attachments, isReport } = req.body;

    const normalized = normalizeIncomingStatus(status);
    if (!normalized) {
      return res.status(400).json({ success: false, message: "A valid status is required." });
    }
    if (!remark?.trim() && !(Array.isArray(attachments) && attachments.length)) {
      return res.status(400).json({
        success: false,
        message: "Add a remark or an attachment to record an update.",
      });
    }

    const entry = {
      status: normalized,
      remark: remark?.trim() || "",
      attachments: sanitizeAttachments(attachments, req.user),
      isReport: Boolean(isReport),
      authorId: req.user._id,
      authorEmail: req.user.email || "",
      authorRole: req.user.organizationRole || "",
      createdAt: new Date(),
    };

    task.progress.push(entry);
    applyStatusSideEffects(task, normalized, req.user._id);

    await task.save();

    return res.status(201).json({
      success: true,
      message: "Progress recorded.",
      data: decorate(task.toObject()),
    });
  } catch (error) {
    console.error("Add Task Progress Error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const taskPriorities = TASK_PRIORITIES;
export const taskStatuses = TASK_STATUSES;