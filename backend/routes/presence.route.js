// routes/presence.route.js
import express from "express";
import { ping, goOffline, getPresence } from "../controllers/presence.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// Staff-only. `protect` resolves an organizationId for a TENANT account too, so
// without staffOnly a tenant could read the team's whereabouts.
router.use(protect);
router.use(staffOnly);

// Every staff member beats their own heartbeat; only an owner or admin may read
// the list (enforced in the controller).
router.post("/ping", ping);
router.post("/offline", goOffline);
router.get("/", getPresence);

export default router;
