// routes/owner.route.js
import express from "express";
import {
  createOwner,
  getOwners,
  getOwnerById,
  updateOwner,
  deleteOwner,
} from "../controllers/owner.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// All routes are protected
// staffOnly as well as protect: `protect` resolves an organizationId for a
// TENANT account too, so without it a tenant could read the whole register.
router.use(protect, staffOnly);

router.post("/", createOwner);
router.get("/", getOwners);
router.get("/:id", getOwnerById);
router.put("/:id", updateOwner);
router.delete("/:id", deleteOwner);

export default router;
