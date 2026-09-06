// routes/screenMonitor.route.js
import express from "express";
import {
  getPolicy,
  updatePolicy,
  getMySession,
  startSession,
  stopSession,
  addCapture,
  getSessions,
  getSessionById,
  deleteSession,
  runPurge,
} from "../controllers/screenMonitor.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// Staff-only throughout. `protect` resolves an organizationId for a TENANT
// account too, so without staffOnly a tenant could reach the team's
// screenshots — the one thing this feature must never leak.
router.use(protect);
router.use(staffOnly);

// Policy: any staff member may READ the rules they are monitored under; only an
// owner or admin may change them (enforced in the controller).
router.get("/policy", getPolicy);
router.put("/policy", updatePolicy);

// The caller's own shift. Nothing here can touch anybody else's session.
router.get("/me", getMySession);
router.post("/start", startSession);
router.post("/stop", stopSession);
router.post("/capture", addCapture);

// Admin-only review. Declared after the fixed paths so "sessions" and "policy"
// are never read as ids.
router.get("/sessions", getSessions);
router.get("/sessions/:id", getSessionById);
router.delete("/sessions/:id", deleteSession);
router.post("/purge", runPurge);

export default router;
