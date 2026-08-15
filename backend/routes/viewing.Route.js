import express from "express";
import {
  getViewings,
  getMyViewings,
  cancelMyViewing,
  createViewing,
  updateViewing,
  deleteViewing,
  updateViewingStatus,
  rescheduleViewing,
  requestMyViewingReschedule,
  respondToRescheduleRequest,
} from "../controllers/viewing.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Tenant's own viewings — declared before "/" and the ":id" routes.
router.get("/my", getMyViewings);
router.patch("/my/:id/cancel", cancelMyViewing);
router.patch("/my/:id/reschedule-request", requestMyViewingReschedule);

// Protect all routes with auth middleware (assumed)
router.get("/", getViewings);
router.post("/", createViewing);
router.put("/:id", updateViewing);
router.patch("/:id/status", updateViewingStatus);
router.patch("/:id/reschedule", rescheduleViewing);
router.patch("/:id/reschedule-request/respond", respondToRescheduleRequest);
router.delete("/:id", deleteViewing);

export default router;