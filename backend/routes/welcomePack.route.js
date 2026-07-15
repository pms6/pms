import express from "express";
import {
  getWelcomePack,
  getMyWelcomePack,
  createWelcomePack,
  updateWelcomePack,
  deleteWelcomePack,
} from "../controllers/welcomePack.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Tenant's own property welcome pack — declared before "/" for clarity.
router.get("/my", getMyWelcomePack);

router.get("/", getWelcomePack);
router.post("/", createWelcomePack);
router.patch("/:id", updateWelcomePack);
router.delete("/:id", deleteWelcomePack);

export default router;