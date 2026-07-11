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
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Apply auth to all routes
router.use(protect);

// CRUD
router.get("/", getSuppliers);
router.post("/", createSupplier);
router.get("/:id", getSupplierById);
router.put("/:id", updateSupplier);
router.delete("/:id", deleteSupplier);

// Archive / restore toggle
router.patch("/:id/archive", toggleSupplierArchive);

export default router;
