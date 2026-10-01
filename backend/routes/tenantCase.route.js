// routes/tenantCase.route.js
import express from "express";
import {
  getCaseOptions,
  getCases,
  getCase,
  createCase,
  updateCase,
  addCaseActivity,
  deleteCase,
} from "../controllers/tenantCase.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// The whole team works tenant cases; tenants never see them.
router.use(protect, staffOnly);

router.get("/options", getCaseOptions);
router.get("/", getCases);
router.post("/", createCase);
router.get("/:id", getCase);
router.put("/:id", updateCase);
router.delete("/:id", deleteCase);
router.post("/:id/activity", addCaseActivity);

export default router;
