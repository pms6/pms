import express from "express";
import {
  getViewings,
  createViewing,
  updateViewing,
  deleteViewing,
  updateViewingStatus,
} from "../controllers/viewing.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Protect all routes with auth middleware
router.get("/", getViewings);
router.post("/", createViewing);
router.put("/:id", updateViewing);
router.patch("/:id/status", updateViewingStatus);
router.delete("/:id", deleteViewing);

export default router;