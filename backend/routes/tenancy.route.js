// routes/tenancy.route.js
import express from "express";
import {
  getTenancies,
  getTenancyStats,
  getTenantDirectory,
  getMyRoom,
  createTenancy,
  updateTenancy,
  deleteTenancy,
  inviteTenant,
  inviteAllTenants,
} from "../controllers/tenancy.controller.js";
import { getTenantTimeline } from "../controllers/tenantTimeline.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// Apply auth to all routes
router.use(protect);

// The signed-in tenant's own room/tenancy. The one route here a tenant may
// reach — it is scoped to their own tenancy by email.
//
// There is deliberately no "housemates" route: tenants must never see other
// occupiers' personal details.
router.get("/my-room", getMyRoom);

// Everything below is the organization's tenancy register — every occupier's
// name, email and rent — so it is staff-only. `protect` resolves an
// organizationId for a TENANT account too, which would otherwise hand a tenant
// the whole house's details.
router.use(staffOnly);

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

// One tenant's whole history across every record — the Tenants page timeline.
router.get("/:id/timeline", getTenantTimeline);

// Single onboarding invite
router.patch("/:id/invite", inviteTenant);

export default router;