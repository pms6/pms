// routes/tenancy.route.js
import express from "express";
import {
  getTenancies,
  getTenancyStats,
  getTenantDirectory,
  getMyHousemates,
  getMyRoom,
  createTenancy,
  updateTenancy,
  deleteTenancy,
  inviteTenant,
  inviteAllTenants,
} from "../controllers/tenancy.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Apply auth to all routes
router.use(protect);

// The signed-in tenant's housemates (others in the same property)
router.get("/housemates", getMyHousemates);

// The signed-in tenant's own room/tenancy
router.get("/my-room", getMyRoom);

// Occupancy overview stats (summary cards)
router.get("/stats", getTenancyStats);

// Full tenant directory — current, past and upcoming tenancies with the
// property, room, profile and onboarding file behind each one. Staff only;
// the controller rejects TENANT accounts explicitly.
router.get("/directory", getTenantDirectory);

// Bulk onboarding invite
router.post("/invite-all", inviteAllTenants);

// CRUD
router.get("/", getTenancies);
router.post("/", createTenancy);
router.put("/:id", updateTenancy);
router.delete("/:id", deleteTenancy);

// Single onboarding invite
router.patch("/:id/invite", inviteTenant);

export default router;