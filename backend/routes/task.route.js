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
router.get("/my", getMyTasks);
router.get("/stats", getTaskStats);
router.get("/assignable-members", getAssignableMembers);

router.get("/", getTasks);
router.post("/", createTask);

router.get("/:id", getTaskById);
router.put("/:id", updateTask);
router.patch("/:id/reschedule", rescheduleTask);
router.delete("/:id", deleteTask);

// The only write a team member can make.
router.post("/:id/progress", addTaskProgress);

export default router;