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
} from "../controllers/cleaningSchedule.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Declared before "/:id" so they aren't read as ids.
router.get("/months", getCleaningMonths);
router.post("/bulk", createCleaningScheduleBulk);

// CRUD
router.get("/", getCleaningSchedule);
router.get("/:id", getCleaningScheduleById);
router.post("/", createCleaningSchedule);
router.put("/:id", updateCleaningSchedule);
router.delete("/:id", deleteCleaningSchedule);

// Status-only update — the Done column
router.patch("/:id/status", updateCleaningStatus);

export default router;
