import express from "express";

import authRoutes from "./auth.route.js";
import propertyRoutes from "./property.route.js";
import roomRoutes from "./room.route.js";
import leadRoutes from "./lead.route.js";
import memberRoutes from "./member.route.js";
import ownerRoutes from "./owner.route.js";
import viewingRoutes from "./viewing.Route.js";

const router = express.Router();

router.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "PMS API v1",
    docs: "See DATA_MODEL.md for the schema and build order",
  });
});

// Phase 1 — Core platform
router.use("/auth", authRoutes);
router.use("/properties", propertyRoutes);
router.use("/rooms", roomRoutes);
router.use("/leads", leadRoutes);
router.use("/members", memberRoutes);
router.use("/owners", ownerRoutes);
router.use("/viewings", viewingRoutes);

export default router;