// routes/propertyRoutes.js
import express from "express";
import {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  deleteProperty,
  restoreProperty,
  updatePropertyStatus,
  getPropertyStats,
} from "../controllers/property.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Apply protect middleware to all routes
router.use(protect);

// Property statistics
router.get("/stats", getPropertyStats);

// CRUD operations
router.post("/", createProperty);
router.get("/", getProperties);
router.get("/:id", getPropertyById);
router.put("/:id", updateProperty);
router.delete("/:id", deleteProperty);

// Special operations
router.patch("/:id/restore", restoreProperty);
router.patch("/:id/status", updatePropertyStatus);

export default router;