// routes/checkIn.route.js
import express from "express";
import {
  getCheckIns,
  getMonthlyCheckIns,
  getCheckInById,
  createCheckIn,
  updateCheckIn,
  deleteCheckIn,
} from "../controllers/checkIn.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// The register is internal: it carries tenants' contact details, bank and
// deposit. staffOnly keeps Tenant accounts out, whose own organizationId
// `protect` resolves and which a bare organizationId check would let through.
router.use(protect, staffOnly);

// Fixed path first, so it is not matched as an "/:id".
router.get("/monthly", getMonthlyCheckIns);

router.get("/", getCheckIns);
router.get("/:id", getCheckInById);
router.post("/", createCheckIn);
router.put("/:id", updateCheckIn);
router.delete("/:id", deleteCheckIn);

export default router;
