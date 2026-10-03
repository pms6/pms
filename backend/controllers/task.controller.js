// controllers/task.controller.js
import mongoose from "mongoose";
import Task, { TASK_PRIORITIES, TASK_STATUSES } from "../models/Task.js";
import OrganizationMember from "../models/OrganizationMember.js";
import User from "../models/User.js";
import Property from "../models/Property.js";
import Notification from "../models/Notification.js";
import { sendEmail } from "../utils/sendEmail.js";
import { orgTeamUserIds } from "../utils/orgTeam.js";
import env from "../config/env.js";

// ---------------------------------------------------------------------------
// Permissions
//
// Admin  = the organization OWNER, or a member promoted to ADMIN. Only they
//          may create, assign, reassign, reschedule, edit or delete a task.
//          Assignment in particular is admin-only: no other role can put work
//          on somebody.
// Member = MANAGER / AGENT / FINANCE / OPERATION. They see the tasks assigned
//          to them, plus every task assigned to OPERATION — the one pool the
//          whole team reads and comments on. What they cannot do is change a
//          task that is not theirs: only an admin or an actual assignee may
//          post a status update, and only an admin may assign.
//
// WHO SEES a task (see canView): its assignees, the person who created it and
// the organization OWNER. Nobody else — including another ADMIN — unless it
// has an OPERATION assignee and is not marked private, in which case every
// staff role does. The table below then applies to the people who can see it:
//
//   action              ADMIN   assignee   other staff   tenant
//   ------------------  -----   --------   -----------   ------
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

const AWAITING_RESPONSE = "Awaiting Response";

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
// The end time is optional, so a task scheduled with only a date and a start
// time falls due on that start date.
const dueAt = (task) => task.dueDate || task.startDate || null;

// Lists read in the order the work is scheduled: earliest start first, so
// overdue work leads and upcoming work follows in time order. A task with no
// date at all has no place on that line and goes to the end, newest first.
const scheduledAt = (task) => {
  const at = task.startDate || task.dueDate;
  return at ? new Date(at).getTime() : null;
};

const bySchedule = (a, b) => {
  const ta = scheduledAt(a);
  const tb = scheduledAt(b);
  if (ta !== null && tb !== null && ta !== tb) return ta - tb;
  if ((ta === null) !== (tb === null)) return ta === null ? 1 : -1;
  return new Date(b.createdAt) - new Date(a.createdAt);
};

export const effectiveStatus = (task) => {
  const s = normalizeStatus(task.status);
  if (s === "Done" || s === "Cancelled") return s;
  const deadline = dueAt(task);
  if (deadline && new Date(deadline) < startOfToday()) return "Overdue";
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
  const status = effectiveStatus(task);
  const open = status !== "Done" && status !== "Cancelled";
  const owner = actionOwnerOf(task);

  return {
    ...task,
    // Each entry says whether THIS viewer may edit it: only a comment, and
    // only by the person who wrote it.
    progress: progress.map((p) => ({
      ...p,
      canEdit: Boolean(
        req && p.kind === "comment" && String(p.authorId || "") === String(req.user._id)
      ),
    })),
    status: normalizeStatus(task.status),
    effectiveStatus: status,

    // Whose move it is. `isShared` is what a list uses to decide whether the
    // owner is worth showing — on a one-person task it is always that person.
    isShared: (task.assignees || []).length > 1,
    actionOwner: owner ? { userId: owner.userId, email: owner.email || "" } : null,
    isMyAction: Boolean(req && open && owner && String(owner.userId) === String(req.user._id)),
    daysUntilDue: daysUntilDue(dueAt(task)),
    progressCount: updates.length,
    commentCount: comments.length,
    lastUpdate: updates.length ? updates[updates.length - 1] : null,
    lastComment: comments.length ? comments[comments.length - 1] : null,

    // Viewer-relative. Absent `req` (nothing does that today) they default to
    // read-only, which is the safe direction for a permission flag.
    isMine: mine,
    canComment: req ? canView(task, req) : false,
    canUpdateStatus: req ? canUpdateStatus(task, req) : false,
    canManage: req ? isAdmin(req) && canView(task, req) : false,
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
 * Is this task open to the whole team?
 *
 * Only work assigned to somebody in OPERATION is — that is the shared pool
 * every role can read and comment on. A task marked private is never
 * team-wide, even with an operation assignee.
 */
const isTeamWide = (task) =>
  !task.isPrivate && (task.assignees || []).some((a) => a.role === "OPERATION");

/**
 * May this caller see this task at all?
 *
 * A task is seen by the people it is assigned to, by whoever created it, and
 * by the organization owner — and by nobody else. Assign it to agent Hamza and
 * only Hamza sees it; assign it to an admin or a manager and only that admin
 * or manager does. Another ADMIN who neither created it nor is on it does not.
 *
 * The exception is a task with an OPERATION assignee, which every staff role
 * can see (see isTeamWide).
 *
 * The tenant boundary is NOT this function's job — every handler queries by
 * organizationId and runs denyNonStaff first, so a tenant account never
 * reaches here.
 */
const canView = (task, req) => {
  if (!isStaff(req)) return false;
  return (
    req.user.organizationRole === "OWNER" ||
    String(task.createdBy) === String(req.user._id) ||
    isAssignedTo(task, req.user._id) ||
    isTeamWide(task)
  );
};

/**
 * The assignee whose action is required right now. Falls back to the first
 * assignee for a task saved before the pointer existed, or whose owner has
 * since been taken off it.
 */
const actionOwnerOf = (task) => {
  const list = task.assignees || [];
  if (!list.length) return null;
  const id = String(task.actionOwnerId || "");
  return list.find((a) => String(a.userId) === id) || list[0];
};

// The requested owner if they are on the task, otherwise the first assignee.
const pickActionOwnerId = (assignees, requestedId) => {
  const list = assignees || [];
  const match = list.find((a) => String(a.userId) === String(requestedId || ""));
  return (match || list[0])?.userId || null;
};

/**
 * May this caller post a STATUS update on this task?
 *
 * The owner can move any task; an assignee can move their own. Everybody else
 * is limited to comments — which is what lets the whole team read and discuss
 * the work without being able to change the state of somebody else's task.
 */
const canUpdateStatus = (task, req) =>
  canView(task, req) && (isAdmin(req) || isAssignedTo(task, req.user._id));

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

/**
 * The in-app half of the alerts below — a Notification row per recipient, so
 * the bell in every role's portal has something to show even when a person
 * never opens the email (or their inbox is a week behind). `recipients` is
 * always the same list email already went to, built by the caller with the
 * actor already filtered out.
 *
 * Never throws: the task/comment/update this is called after is already
 * saved, so a write failure here must not turn a successful action into an
 * error response.
 */
const writeTaskNotifications = async (task, recipients, { type, title, message, actorEmail }) => {
  const docs = (recipients || [])
    .filter((r) => r.userId)
    .map((r) => ({
      organizationId: task.organizationId,
      userId: r.userId,
      type,
      title,
      message: message || "",
      relatedType: "Task",
      relatedId: task._id,
      actorEmail: actorEmail || "",
    }));
  if (!docs.length) return;
  try {
    await Notification.insertMany(docs, { ordered: false });
  } catch (err) {
    console.error("Task notification write failed:", err.message);
  }
};

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

  // Keyed by userId (falling back to email for anything without one) so the
  // in-app write below and the email loop share exactly one recipient list.
  const recipients = new Map();
  for (const a of targets || []) {
    const email = String(a.email || "").trim().toLowerCase();
    if (!email || email === actor) continue;
    const key = a.userId ? String(a.userId) : email;
    recipients.set(key, { userId: a.userId || null, email, role: a.role || "" });
  }

  if (!recipients.size) return;

  const subject = `${isNew ? "New task assigned" : "Added to a task"}: ${task.title}`;

  await Promise.allSettled(
    [...recipients.values()].map(({ email, role }) =>
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

  await writeTaskNotifications(task, [...recipients.values()], {
    type: "task_assigned",
    title: isNew ? "New task assigned to you" : "You were added to a task",
    message: task.title,
    actorEmail: assignedByEmail,
  });
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
    if (!email || email === author) continue;
    const key = a.userId ? String(a.userId) : email;
    recipients.set(key, { userId: a.userId || null, email, role: a.role || "" });
  }

  // The admin who set the task, copied in so they see the thread too.
  const creatorEmail = String(task.createdByEmail || "").trim().toLowerCase();
  if (creatorEmail && creatorEmail !== author) {
    const key = task.createdBy ? String(task.createdBy) : creatorEmail;
    if (!recipients.has(key)) {
      recipients.set(key, { userId: task.createdBy || null, email: creatorEmail, role: "ADMIN" });
    }
  }

  if (!recipients.size) return;

  const subject = `New comment on task: ${task.title}`;

  await Promise.allSettled(
    [...recipients.values()].map(({ email, role }) =>
      sendEmail({
        email,
        subject,
        html: commentEmailHtml({ task, entry, taskUrl: taskUrlFor(role) }),
      }).catch((err) =>
        console.error("Task comment email failed:", email, err.message)
      )
    )
  );

  await writeTaskNotifications(task, [...recipients.values()], {
    type: "task_comment",
    title: "New comment on a task",
    message: `${task.title}${entry.remark ? ` — ${entry.remark}` : ""}`,
    actorEmail: entry.authorEmail,
  });
};

/**
 * In-app only. A status update has never been emailed — see the note at the
 * top of this section — but that left it silent everywhere: nobody found out
 * a task was moved to Done, or reopened, unless they happened to check back.
 * This fills that gap without changing the email behaviour anyone already
 * relies on.
 */
const notifyProgressUpdate = async (task, entry, { awaiting = false, skipUserId = null } = {}) => {
  const actor = String(entry.authorEmail || "").trim().toLowerCase();

  const recipients = new Map();
  for (const a of task.assignees || []) {
    const email = String(a.email || "").trim().toLowerCase();
    if (!email || email === actor) continue;
    // Somebody the task was just handed to gets the "your action is required"
    // notification instead — one alert for one event.
    if (skipUserId && String(a.userId) === String(skipUserId)) continue;
    const key = a.userId ? String(a.userId) : email;
    recipients.set(key, { userId: a.userId || null, email, role: a.role || "" });
  }

  const creatorEmail = String(task.createdByEmail || "").trim().toLowerCase();
  if (creatorEmail && creatorEmail !== actor) {
    const key = task.createdBy ? String(task.createdBy) : creatorEmail;
    if (!recipients.has(key)) {
      recipients.set(key, { userId: task.createdBy || null, email: creatorEmail, role: "ADMIN" });
    }
  }

  // A task moved to "Awaiting Response" is stuck on somebody's answer, so every
  // admin hears about it — not only the one who happened to create the task.
  if (awaiting) {
    try {
      // Not broadcast to admins who cannot open the task — with no roles asked
      // for, this comes back as the organization owner alone.
      const adminIds = await orgTeamUserIds(
        task.organizationId,
        isTeamWide(task) ? ADMIN_ROLES : []
      );
      for (const id of adminIds) {
        if (id === String(entry.authorId || "") || recipients.has(id)) continue;
        if (skipUserId && id === String(skipUserId)) continue;
        recipients.set(id, { userId: id, email: "", role: "ADMIN" });
      }
    } catch (err) {
      console.error("Task admin lookup failed:", err.message);
    }
  }

  if (!recipients.size) return;

  const who = entry.authorEmail || "Someone";
  await writeTaskNotifications(task, [...recipients.values()], {
    type: awaiting ? "task_awaiting_response" : "task_update",
    title: awaiting ? "Task awaiting response" : `Task moved to ${entry.status}`,
    message: `${who} updated "${task.title}"${entry.remark ? `: ${entry.remark}` : ""}`,
    actorEmail: entry.authorEmail,
  });
};

/**
 * In-app only. Tells the person a shared task has just been passed to that it
 * is now waiting on them. Nothing is sent when they passed it to themselves.
 */
const notifyActionRequired = async (task, owner, { actorId, actorEmail, remark }) => {
  if (!owner?.userId || String(owner.userId) === String(actorId || "")) return;
  await writeTaskNotifications(task, [owner], {
    type: "task_action_required",
    title: "Your action is required on a task",
    message: `${actorEmail || "Someone"} passed "${task.title}" to you${remark ? `: ${remark}` : ""}`,
    actorEmail,
  });
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

    const { status, priority, assignee, property, search, dueToday } = req.query;
    const filter = { organizationId: req.user.organizationId, isDeleted: false };

    if (priority && TASK_PRIORITIES.includes(priority)) filter.priority = priority;
    if (assignee && mongoose.isValidObjectId(assignee)) filter["assignees.userId"] = assignee;
    if (property && mongoose.isValidObjectId(property)) filter.propertyId = property;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const tasks = await Task.find(filter).lean();
    // Visibility BEFORE decorating: a task that fails canView must not leak
    // through decorate's flags, counts or last-touched preview.
    const visible = tasks.filter((t) => canView(t, req)).sort(bySchedule);
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

    data = await withUnreadNotifications(data, req);

    return res.status(200).json({ success: true, total: data.length, data, stats });
  } catch (error) {
    console.error("Get Tasks Error:", error);
    return res.status(500).json({ success: false, message: "Failed to load tasks." });
  }
};

/**
 * Attach the viewer's own unread in-app notifications to each task, so a list
 * can badge exactly which tasks have news for this person (a new assignment,
 * comment or update) instead of leaving them to match bell entries by title.
 *
 * `unreadNotifications` is the count; `unreadTypes` the distinct kinds, newest
 * first. Read with find() rather than aggregate() so Mongoose casts the ids.
 */
const withUnreadNotifications = async (tasks, req) => {
  if (!tasks.length) return tasks;
  const rows = await Notification.find({
    organizationId: req.user.organizationId,
    userId: req.user._id,
    relatedType: "Task",
    relatedId: { $in: tasks.map((t) => t._id) },
    read: false,
  })
    .select("relatedId type")
    .sort({ createdAt: -1 })
    .lean();

  const byTask = new Map();
  for (const n of rows) {
    const key = String(n.relatedId);
    const entry = byTask.get(key) || { count: 0, types: [] };
    entry.count++;
    if (!entry.types.includes(n.type)) entry.types.push(n.type);
    byTask.set(key, entry);
  }

  return tasks.map((t) => {
    const entry = byTask.get(String(t._id));
    return { ...t, unreadNotifications: entry?.count || 0, unreadTypes: entry?.types || [] };
  });
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
    }).lean();

    const data = await withUnreadNotifications(
      tasks.sort(bySchedule).map((t) => decorate(t, req)),
      req
    );

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

    // A private task the caller cannot open must not be counted for them either.
    const decorated = tasks.filter((t) => canView(t, req)).map((t) => decorate(t, req));

    const byStatus = {
      "Not Started": 0,
      "In Progress": 0,
      "Action Required": 0,
      "Awaiting Response": 0,
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
            "Action Required": 0,
            "Awaiting Response": 0,
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
    const upcomingWithUnread = await withUnreadNotifications(upcoming, req);

    // Most recently touched, by the last progress entry or the task itself.
    const lastTouched = (t) =>
      new Date(t.lastUpdate?.createdAt || t.updatedAt || t.createdAt).getTime();
    const recent = await withUnreadNotifications(
      [...decorated].sort((a, b) => lastTouched(b) - lastTouched(a)).slice(0, 8),
      req
    );

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
      upcoming: upcomingWithUnread,
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
      isPrivate,
      actionOwnerId,
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: "Task title is required." });
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
      description: description?.trim() || "",
      propertyId: property.propertyId,
      property: property.property,
      assignees: resolved,
      actionOwnerId: pickActionOwnerId(resolved, actionOwnerId),
      isPrivate: Boolean(isPrivate),
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

    if (normalized === AWAITING_RESPONSE) {
      await notifyProgressUpdate(
        task,
        { status: normalized, remark: "", authorId: req.user._id, authorEmail: req.user.email || "" },
        { awaiting: true }
      );
    }

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
    if (!task || !canView(task, req)) {
      return res.status(404).json({ success: false, message: "Task not found." });
    }

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
      isPrivate,
      actionOwnerId,
    } = req.body;

    const ownerBefore = String(actionOwnerOf(task)?.userId || "");

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
      task.description = description?.trim() || "";
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

    // Keep the action owner on the task: the one the admin picked, or — if the
    // person holding it was just unassigned — whoever is now first.
    if (assignees !== undefined || actionOwnerId !== undefined) {
      task.actionOwnerId = pickActionOwnerId(
        task.assignees,
        actionOwnerId !== undefined ? actionOwnerId : task.actionOwnerId
      );
    }
    if (isPrivate !== undefined) task.isPrivate = Boolean(isPrivate);

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
    const awaiting =
      normalized === AWAITING_RESPONSE && normalizeStatus(task.status) !== AWAITING_RESPONSE;
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

    // The admin moved the action to somebody else from the edit form. A person
    // who was only just added has already been told by the assignment alert.
    const ownerNow = actionOwnerOf(task);
    if (
      ownerNow &&
      task.assignees.length > 1 &&
      String(ownerNow.userId) !== ownerBefore &&
      !newlyAssigned.some((a) => String(a.userId) === String(ownerNow.userId))
    ) {
      await notifyActionRequired(task, ownerNow, {
        actorId: req.user._id,
        actorEmail: req.user.email || "",
        remark: "",
      });
    }

    // The edit form can move the status too, without writing a progress entry.
    if (awaiting) {
      await notifyProgressUpdate(
        task,
        { status: normalized, remark: "", authorId: req.user._id, authorEmail: req.user.email || "" },
        { awaiting }
      );
    }

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
    if (!task || !canView(task, req)) {
      return res.status(404).json({ success: false, message: "Task not found." });
    }

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

    const task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: false,
    });

    // An admin cannot delete a private task they are not allowed to see.
    if (!task || !canView(task, req)) {
      return res.status(404).json({ success: false, message: "Task not found." });
    }

    task.isDeleted = true;
    task.deletedAt = new Date();
    await task.save();

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

    const { status, remark, attachments, isReport, handTo } = req.body;

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

    // Hand-over: the author has done their part and passes the task to another
    // assignee. Only an update can do it, and only to somebody on the task.
    const ownerBefore = actionOwnerOf(task);
    const handedTo =
      !isComment && handTo
        ? (task.assignees || []).find(
            (a) =>
              String(a.userId) === String(handTo) &&
              String(a.userId) !== String(ownerBefore?.userId || "")
          ) || null
        : null;

    const entry = {
      kind: isComment ? "comment" : "update",
      status: normalized,
      handedToEmail: handedTo?.email || "",
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
    // Only the move ONTO the status alerts the admins — a second note posted
    // while it is still waiting should not ping them all again.
    const awaiting =
      normalized === AWAITING_RESPONSE && normalizeStatus(task.status) !== AWAITING_RESPONSE;
    if (!isComment) applyStatusSideEffects(task, normalized, req.user._id);
    if (handedTo) task.actionOwnerId = handedTo.userId;

    await task.save();

    // Only after the save — a comment nobody could read is not worth emailing
    // about. Awaited so a send is at least attempted before the response, but
    // it swallows its own failures: the comment is stored either way.
    if (isComment) await notifyCommentRecipients(task, entry);
    else {
      await notifyProgressUpdate(task, entry, { awaiting, skipUserId: handedTo?.userId });
      if (handedTo) {
        await notifyActionRequired(task, handedTo, {
          actorId: req.user._id,
          actorEmail: req.user.email || "",
          remark: entry.remark,
        });
      }
    }

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

// ===========================================================================
// Edit the wording of a comment. Only the person who wrote it may — not an
// admin, not another assignee — and only a comment: a status update is the
// record of how the work moved and stays as written.
//
// @route PATCH /api/v1/tasks/:id/progress/:entryId
// ===========================================================================
export const editTaskComment = async (req, res) => {
  try {
    if (denyNonStaff(req, res)) return;
    if (
      !mongoose.isValidObjectId(req.params.id) ||
      !mongoose.isValidObjectId(req.params.entryId)
    ) {
      return res.status(400).json({ success: false, message: "Invalid id." });
    }

    const task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      isDeleted: false,
    });
    if (!task || !canView(task, req)) {
      return res.status(404).json({ success: false, message: "Task not found." });
    }

    const entry = task.progress.id(req.params.entryId);
    if (!entry || entry.kind !== "comment") {
      return res.status(404).json({ success: false, message: "Comment not found." });
    }
    if (String(entry.authorId || "") !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "Only the person who wrote a comment can edit it.",
      });
    }

    const remark = String(req.body?.remark ?? "").trim();
    if (!remark && !entry.attachments?.length) {
      return res.status(400).json({ success: false, message: "A comment cannot be empty." });
    }

    entry.remark = remark;
    entry.editedAt = new Date();
    await task.save();

    return res.status(200).json({
      success: true,
      message: "Comment updated.",
      data: decorate(task.toObject(), req),
    });
  } catch (error) {
    console.error("Edit Task Comment Error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const taskPriorities = TASK_PRIORITIES;
export const taskStatuses = TASK_STATUSES;