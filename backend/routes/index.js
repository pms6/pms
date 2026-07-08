import express from "express";

import authRoutes from "./auth.route.js";
import propertyRoutes from "./property.route.js";
import roomRoutes from "./room.route.js";
import leadRoutes from "./lead.route.js";
import memberRoutes from "./member.route.js";

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


export default router;