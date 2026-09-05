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
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// Properties are an internal staff resource — a TENANT's organizationId (set
// by `protect` from their own Tenant record) must not let them list, create,
// edit or delete the organization's properties.
router.use(protect, staffOnly);

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