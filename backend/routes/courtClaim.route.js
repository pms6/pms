// routes/courtClaim.route.js
import express from "express";
import {
  getCourtClaims,
  createCourtClaim,
  updateCourtClaim,
  deleteCourtClaim,
} from "../controllers/courtClaim.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", getCourtClaims);
router.post("/", createCourtClaim);
router.put("/:id", updateCourtClaim);
router.delete("/:id", deleteCourtClaim);

export default router;
