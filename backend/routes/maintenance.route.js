// routes/maintenance.route.js
import express from "express";
import {
  getMaintenance,
  getMaintenanceById,
  getMaintenanceStats,
  createMaintenance,
  updateMaintenance,
  updateMaintenanceStatus,
  addMaintenanceComment,
  editMaintenanceComment,
  deleteMaintenance,
} from "../controllers/maintenance.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// Apply auth to all routes
router.use(protect);

// Summary stats (cards) — declared before "/:id" so it isn't read as an id.
router.get("/stats", staffOnly, getMaintenanceStats);

// CRUD
router.get("/", getMaintenance);
router.get("/:id", getMaintenanceById);
router.post("/", createMaintenance);
// A tenant may list, read and raise their own requests (the controller scopes
// those to them). Editing, deleting and progressing a job is the office's
// work — without staffOnly a tenant could rewrite any request in the org.
router.put("/:id", staffOnly, updateMaintenance);
router.delete("/:id", staffOnly, deleteMaintenance);

// Status-only update
router.patch("/:id/status", staffOnly, updateMaintenanceStatus);

// The office's discussion on an entry
router.post("/:id/comments", staffOnly, addMaintenanceComment);
router.patch("/:id/comments/:commentId", staffOnly, editMaintenanceComment);

export default router;
