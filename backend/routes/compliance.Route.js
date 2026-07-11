import express from "express";
import { getCompliances, createCompliance } from "../controllers/compliance.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", getCompliances);
router.post("/", createCompliance);   // No multer needed anymore

export default router;