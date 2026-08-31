// routes/agentLocation.route.js
import express from "express";
import {
  getMyLocationState,
  toggleMyLocation,
  pingMyLocation,
  getActiveLocations,
} from "../controllers/agentLocation.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// Everything here is staff-only. `protect` resolves an organizationId for a
// TENANT account too, so without staffOnly a tenant could read the whole team's
// positions — which is exactly the data this feature must not leak.
router.use(protect);
router.use(staffOnly);

// The sharing agent's own endpoints. Each one checks the caller is an AGENT;
// the rest of the team can read the board but not broadcast a position.
router.get("/me", getMyLocationState);
router.patch("/toggle", toggleMyLocation);
router.post("/ping", pingMyLocation);

// The team view — every agent currently sharing. Any staff seat may read it.
router.get("/", getActiveLocations);

export default router;
