import express from "express";

import authRoutes from "./auth.route.js";
import propertyRoutes from "./property.route.js";
import roomRoutes from "./room.route.js";
import leadRoutes from "./lead.route.js";
import memberRoutes from "./member.route.js";
import ownerRoutes from "./owner.route.js";
import viewingRoutes from "./viewing.route.js";
import onboardingRoutes from "./onboarding.route.js";
import tenancyRoutes from "./tenancy.route.js";
import supplierRoutes from "./supplier.route.js";
import maintenanceRoutes from "./maintenance.route.js";
import inspectionRoutes from "./inspection.route.js";
import complianceRoutes from "./compliance.route.js"
import welcomePackRoutes from "./welcomePack.route.js"
import paymentRoutes from "./payment.route.js"
import publicRoutes from "./public.route.js"
import auditRoutes from "./auditLog.route.js"
import tenantRoute from "./tenant.route.js"
import expenseRoutes from "./expense.route.js"
import taskRoutes from "./task.route.js"
import voidPeriodRoutes from "./voidPeriod.Route.js"
import agentLocationRoutes from "./agentLocation.Route.js"
import internetDetailRoutes from "./internetDetail.route.js"
import checkInRoutes from "./checkIn.route.js"
import checkOutRoutes from "./checkOut.route.js"
import depositRegisterRoutes from "./depositRegister.route.js"
import roomStatusRoutes from "./roomStatus.route.js"
import referenceDataRoutes from "./referenceData.route.js"
import clientDatabaseRoutes from "./clientDatabase.route.js"

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
router.use("/expenses", expenseRoutes);
router.use("/tasks", taskRoutes);
router.use("/audit", auditRoutes);
router.use("/void-periods", voidPeriodRoutes);
router.use("/agent-location", agentLocationRoutes);
router.use("/internet-details", internetDetailRoutes);

// Database — the operational registers that replace the office spreadsheets.
// Check-in and check-out own their records; the deposit register and the room
// status list are read-only views built across those records, Property and Room.
router.use("/check-ins", checkInRoutes);
router.use("/check-outs", checkOutRoutes);
router.use("/reference-data", referenceDataRoutes);
router.use("/deposit-register", depositRegisterRoutes);
router.use("/room-status", roomStatusRoutes);
router.use("/client-database", clientDatabaseRoutes);

export default router;