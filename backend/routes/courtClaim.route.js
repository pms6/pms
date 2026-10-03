// routes/courtClaim.route.js
import express from "express";
import {
  getCourtClaims,
  createCourtClaim,
  updateCourtClaim,
  deleteCourtClaim,
} from "../controllers/courtClaim.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// staffOnly as well as protect: `protect` resolves an organizationId for a
// TENANT account too, so without it a tenant could read the whole register.
router.use(protect, staffOnly);

router.get("/", getCourtClaims);
router.post("/", createCourtClaim);
router.put("/:id", updateCourtClaim);
router.delete("/:id", deleteCourtClaim);

export default router;
