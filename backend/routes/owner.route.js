// routes/owner.route.js
import express from "express";
import {
  createOwner,
  getOwners,
  getOwnerById,
  updateOwner,
  deleteOwner,
} from "../controllers/owner.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// All routes are protected
router.use(protect);

router.post("/", createOwner);
router.get("/", getOwners);
router.get("/:id", getOwnerById);
router.put("/:id", updateOwner);
router.delete("/:id", deleteOwner);

export default router;
