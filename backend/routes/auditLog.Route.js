import express from "express";
import { 
  getAuditLogsAndTasks, 
  addManualNote, 
  createTask, 
  completeTask, 
  getOrganizationMembers
} from "../controllers/auditLog.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/:organizationId/tasks-logs", protect, getAuditLogsAndTasks);
router.post("/:organizationId/notes", protect, addManualNote);
router.post("/:organizationId/tasks", protect, createTask);
router.patch("/tasks/:taskId/complete", protect, completeTask);
router.get("/:organizationId/members", protect, getOrganizationMembers);

export default router;