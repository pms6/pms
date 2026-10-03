import express from "express";
import { getAllTenants } from "../controllers/tenanat.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// Staff-only: the list carries tenants' names and emails, which must never be
// readable anonymously or by another tenant.
router.use(protect, staffOnly);

// Get all tenants (used in Add Occupancy modal)
router.get("/", getAllTenants);

export default router;
