import express from "express";
import {
  createVoidPeriod,
  deleteVoidPeriod,
  getLastVoidForRoom,
  getVoidSummary,
  listVoidPeriods,
  restoreVoidPeriod,
  updateVoidPeriod,
} from "../controllers/VoidPeriod.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Void periods are the organization's own financial record. `protect` resolves
// an organizationId for a TENANT account too, so without staffOnly a tenant
// could read — and create — entries in their landlord's loss ledger.
router.use(staffOnly);

router.get("/summary", getVoidSummary);
router.get("/", listVoidPeriods);
router.post("/", createVoidPeriod);
router.put("/:id", updateVoidPeriod);
router.delete("/:id", deleteVoidPeriod);

// Removing a void period is a soft delete, so it can be undone.
router.patch("/:id/restore", restoreVoidPeriod);

router.get("/room/:roomId/last", getLastVoidForRoom);

export default router;
