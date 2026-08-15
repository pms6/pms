import express from "express";
import { getAllTenants } from "../controllers/tenanat.controller.js";

const router = express.Router();

// Get all tenants (used in Add Occupancy modal)
router.get("/", getAllTenants);

export default router;
