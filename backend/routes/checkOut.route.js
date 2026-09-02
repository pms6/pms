// routes/checkOut.route.js
import express from "express";
import {
  getCheckOuts,
  getCheckOutById,
  getOpenCheckIns,
  createCheckOut,
  updateCheckOut,
  deleteCheckOut,
} from "../controllers/checkOut.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

router.use(protect, staffOnly);

// Fixed path first, so it is not matched as an "/:id".
router.get("/open-check-ins", getOpenCheckIns);

router.get("/", getCheckOuts);
router.get("/:id", getCheckOutById);
router.post("/", createCheckOut);
router.put("/:id", updateCheckOut);
router.delete("/:id", deleteCheckOut);

export default router;
