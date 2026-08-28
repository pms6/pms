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
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Tenant's own viewings — declared before "/" and the ":id" routes, and BEFORE
// staffOnly, since these are the three a tenant is meant to reach. Each one
// scopes itself to the caller's own viewing.
router.get("/my", getMyViewings);
router.patch("/my/:id/cancel", cancelMyViewing);
router.patch("/my/:id/reschedule-request", requestMyViewingReschedule);

// Everything below is the staff board: the whole organization's diary, plus
// scheduling, rescheduling, completing, cancelling and re-opening. Every staff
// seat (OWNER, MANAGER, AGENT, FINANCE) may use all of it.
//
// staffOnly is what keeps tenants out. `protect` resolves an organizationId for
// a TENANT account from their Tenant record, so without this a tenant could
// read and edit every viewing in the organization through these routes.
router.use(staffOnly);

router.get("/", getViewings);
router.post("/", createViewing);
router.put("/:id", updateViewing);
router.patch("/:id/status", updateViewingStatus);
router.patch("/:id/reschedule", rescheduleViewing);
router.patch("/:id/reschedule-request/respond", respondToRescheduleRequest);
router.delete("/:id", deleteViewing);

export default router;