// routes/supplier.route.js
import express from "express";
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  toggleSupplierArchive,
  deleteSupplier,
} from "../controllers/supplier.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// Apply auth to all routes
// staffOnly as well as protect: `protect` resolves an organizationId for a
// TENANT account too, so without it a tenant could read the whole register.
router.use(protect, staffOnly);

// CRUD
router.get("/", getSuppliers);
router.post("/", createSupplier);
router.get("/:id", getSupplierById);
router.put("/:id", updateSupplier);
router.delete("/:id", deleteSupplier);

// Archive / restore toggle
router.patch("/:id/archive", toggleSupplierArchive);

export default router;
