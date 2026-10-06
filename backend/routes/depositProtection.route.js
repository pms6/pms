import express from "express";
import { protect, staffOnly } from "../middleware/auth.js";
import { listDepositProtection, createDepositProtection, updateDepositProtection, deleteDepositProtection } from "../controllers/depositProtection.controller.js";

const router = express.Router();
router.use(protect, staffOnly);
router.get("/", listDepositProtection);
router.post("/", createDepositProtection);
router.put("/:id", updateDepositProtection);
router.delete("/:id", deleteDepositProtection);
export default router;
