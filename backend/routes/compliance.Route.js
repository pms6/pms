import express from "express";
import { getCompliances, createCompliance, getMyCompliance } from "../controllers/compliance.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

// Tenant's own property compliance — must be declared before "/" for clarity.
router.get("/my", getMyCompliance);

router.get("/", getCompliances);
router.post("/", createCompliance);   // No multer needed anymore

export default router;