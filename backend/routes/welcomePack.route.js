import express from "express";
import {
  getWelcomePack,
  createWelcomePack,
  updateWelcomePack,
  deleteWelcomePack,
} from "../controllers/welcomePack.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", getWelcomePack);
router.post("/", createWelcomePack);
router.patch("/:id", updateWelcomePack);
router.delete("/:id", deleteWelcomePack);

export default router;