import AuditLog from "../models/AuditLog.js";
import OrganizationMember from "../models/OrganizationMember.js";

// Utility to create audit log
export const createAuditLog = async ({
  organizationId,
  userId,
  category,
  action,
  title,
  description,
  metadata = {},
  req,
  dueDate,
  assignedTo,
  isTask = false,
}) => {
  try {
    const log = await AuditLog.create({
      organizationId,
      userId,
      category,
      action,
      title,
      description,
      metadata,
      ipAddress: req?.ip,
      userAgent: req?.headers?.["user-agent"],
      isTask,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      assignedTo,
      status: isTask ? "PENDING" : undefined, // Important: default status for tasks
    });
    return log;
  } catch (error) {
    console.error("Failed to create audit log:", error);
    throw error; // Better to throw so caller can handle
  }
};

// Get Logs + Tasks
export const getAuditLogsAndTasks = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { category, status, search } = req.query;

    const query = { organizationId };

    if (category) query.category = category;
    if (status) query.status = status;

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const items = await AuditLog.find(query)
      .populate("userId", "name email")
      .populate("assignedTo", "userId") // Will be further populated in frontend if needed
      .populate("completedBy", "name email")
      .sort({ createdAt: -1 });

    const tasks = items.filter(item => item.isTask);
    const logs = items.filter(item => !item.isTask);

    res.json({ 
      tasks, 
      logs, 
      total: items.length 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Add Manual Note
export const addManualNote = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { title, description } = req.body;

    const note = await createAuditLog({
      organizationId,
      userId: req.user.id,
      category: "Organisation Note",
      action: "MANUAL_NOTE",
      title,
      description,
      req,
    });

    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ message: "Failed to add note" });
  }
};

// Create Task
export const createTask = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { title, description, dueDate, assignedTo } = req.body;

    if (!title || !dueDate || !assignedTo) {
      return res.status(400).json({ message: "Title, due date and assigned member are required" });
    }

    const task = await createAuditLog({
      organizationId,
      userId: req.user.id,
      category: "Task",
      action: "TASK_ASSIGNED",
      title,
      description,
      dueDate,
      assignedTo,
      isTask: true,
      req,
    });

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: "Failed to create task" });
  }
};

// Mark Task as Complete
export const completeTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await AuditLog.findOne({ _id: taskId, isTask: true });

    if (!task) return res.status(404).json({ message: "Task not found" });

    task.status = "COMPLETED";
    task.completedAt = new Date();
    task.completedBy = req.user.id;
    await task.save();

    // Log completion as separate audit entry
    await createAuditLog({
      organizationId: task.organizationId,
      userId: req.user.id,
      category: "Task",
      action: "TASK_COMPLETED",
      title: `Completed: ${task.title}`,
      metadata: { originalTaskId: task._id },
      req,
    });

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: "Failed to complete task" });
  }
};

// Get Organization Members for Task Assignment
export const getOrganizationMembers = async (req, res) => {
  try {
    const { organizationId } = req.params;

    const members = await OrganizationMember.find({ 
      organizationId,
      status: "ACTIVE"
    }).populate("userId", "name email");

    res.json({ members });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch members" });
  }
};