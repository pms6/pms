import express from "express";
import {
  getViewings,
  getMyViewings,
  cancelMyViewing,
  createViewing,
  updateViewing,
  deleteViewing,
  updateViewingStatus,
} from "../controllers/viewing.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Tenant's own viewings — declared before "/" and the ":id" routes.
router.get("/my", getMyViewings);
router.patch("/my/:id/cancel", cancelMyViewing);

// Protect all routes with auth middleware (assumed)
router.get("/", getViewings);
router.post("/", createViewing);
router.put("/:id", updateViewing);
router.patch("/:id/status", updateViewingStatus);
router.delete("/:id", deleteViewing);

export default router;