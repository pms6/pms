// routes/stayDuration.route.js
//
// Overall Stay Duration — one section reading both the client register and the
// tenancy register. Read-only: the dates themselves are edited on whichever
// register owns the row.
import express from "express";
import { getStayDurations } from "../controllers/stayDuration.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// Staff-only, like the two registers it reads from — `protect` resolves an
// organizationId for a TENANT account too, so without staffOnly a tenant could
// read how long every one of their housemates has been here.
router.use(protect, staffOnly);

router.get("/", getStayDurations);

export default router;
