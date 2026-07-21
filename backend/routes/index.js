import express from "express";

import authRoutes from "./auth.route.js";
import propertyRoutes from "./property.route.js";
import roomRoutes from "./room.route.js";
import leadRoutes from "./lead.route.js";
import memberRoutes from "./member.route.js";
import ownerRoutes from "./owner.route.js";
import viewingRoutes from "./viewing.Route.js";
import onboardingRoutes from "./onboarding.route.js";
import tenancyRoutes from "./tenancy.route.js";
import supplierRoutes from "./supplier.route.js";
import maintenanceRoutes from "./maintenance.route.js";
import inspectionRoutes from "./inspection.Route.js";
import complianceRoutes from "./compliance.Route.js"
import welcomePackRoutes from "./welcomePack.route.js"
import paymentRoutes from "./payment.route.js"
import publicRoutes from "./public.Route.js"
import auditRoutes from "./auditLog.Route.js"
import tenantRoute from "./tenant.Route.js"

const router = express.Router();

router.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "PMS API v1",
    docs: "See DATA_MODEL.md for the schema and build order",
  });
});

// Public marketing / listings API (no auth) — must be mounted before the
// protected routes so anonymous visitors can browse listings.
router.use("/public", publicRoutes);

// Phase 1 — Core platform
router.use("/auth", authRoutes);
router.use("/tenants", tenantRoute);
router.use("/properties", propertyRoutes);
router.use("/rooms", roomRoutes);
router.use("/leads", leadRoutes);
router.use("/members", memberRoutes);
router.use("/owners", ownerRoutes);
router.use("/viewings", viewingRoutes);
router.use("/onboarding", onboardingRoutes);
router.use("/tenancies", tenancyRoutes);
router.use("/suppliers", supplierRoutes);
router.use("/maintenance", maintenanceRoutes);
router.use("/inspections", inspectionRoutes);
router.use("/compliance", complianceRoutes);
router.use("/welcome-pack", welcomePackRoutes);
router.use("/payments", paymentRoutes);
router.use("/audit", auditRoutes);

export default router;