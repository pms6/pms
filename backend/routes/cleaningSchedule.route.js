// routes/cleaningSchedule.route.js
import express from "express";
import {
  getCleaningSchedule,
  getCleaningMonths,
  getCleaningScheduleById,
  createCleaningSchedule,
  createCleaningScheduleBulk,
  updateCleaningSchedule,
  updateCleaningStatus,
  deleteCleaningSchedule,
  generateCleaningSchedule,
  addCleaningCommunication,
} from "../controllers/cleaningSchedule.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Declared before "/:id" so they aren't read as ids.
router.get("/months", getCleaningMonths);
router.post("/bulk", createCleaningScheduleBulk);
router.post("/generate", staffOnly, generateCleaningSchedule);

// CRUD
router.get("/", getCleaningSchedule);
router.get("/:id", getCleaningScheduleById);
router.post("/", createCleaningSchedule);
router.put("/:id", updateCleaningSchedule);
router.delete("/:id", deleteCleaningSchedule);

// Status-only update — the Done column
router.patch("/:id/status", updateCleaningStatus);

// Message / email / call history — staff only, since an email really is sent.
router.post("/:id/communications", staffOnly, addCleaningCommunication);

export default router;
