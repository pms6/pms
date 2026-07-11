// routes/maintenance.route.js
import express from "express";
import {
  getMaintenance,
  getMaintenanceStats,
  createMaintenance,
  updateMaintenance,
  updateMaintenanceStatus,
  deleteMaintenance,
} from "../controllers/maintenance.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Apply auth to all routes
router.use(protect);

// Summary stats (cards)
router.get("/stats", getMaintenanceStats);

// CRUD
router.get("/", getMaintenance);
router.post("/", createMaintenance);
router.put("/:id", updateMaintenance);
router.delete("/:id", deleteMaintenance);

// Status-only update
router.patch("/:id/status", updateMaintenanceStatus);

export default router;
