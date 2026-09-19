// routes/timeReport.route.js
import express from "express";
import { getWorkHoursReport } from "../controllers/timeReport.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// Staff-only throughout, and the controller narrows it again to owner, admin and
// manager. `protect` resolves an organizationId for a TENANT account too, so
// without staffOnly a tenant could read the team's working hours.
router.use(protect, staffOnly);

router.get("/work-hours", getWorkHoursReport);

export default router;
