// routes/task.route.js
import express from "express";
import {
  getTasks,
  getMyTasks,
  getTaskStats,
  getTaskById,
  getAssignableMembers,
  createTask,
  updateTask,
  rescheduleTask,
  deleteTask,
  addTaskProgress,
} from "../controllers/task.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Specific paths first, so "/my" and "/stats" are not swallowed by "/:id".
//
// The role checks live in the controller rather than here: every handler needs
// to distinguish admin from member anyway (a member gets a filtered view rather
// than a flat refusal on the shared routes), so keeping it in one place avoids
// two sources of truth for the same rule.

// Readable by any staff member of the organization.
router.get("/my", getMyTasks); // just the ones assigned to me
router.get("/stats", getTaskStats); // dashboard aggregates
router.get("/assignable-members", getAssignableMembers);
router.get("/", getTasks); //     every task on the team

// Registered AFTER every literal GET segment, so "/stats" and
// "/assignable-members" are not matched as an :id and rejected as an invalid id.
router.get("/:id", getTaskById); // one task in full, with its whole history

// Owner only — assigning work.
router.post("/", createTask);
router.put("/:id", updateTask);
router.patch("/:id/reschedule", rescheduleTask);
router.delete("/:id", deleteTask);

// The only write a non-owner can make: a comment from anyone on the team, or a
// status update from an assignee. Never a reassignment.
router.post("/:id/progress", addTaskProgress);

export default router;