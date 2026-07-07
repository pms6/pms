import express from "express";

import authRoutes from "./auth.route.js";
import propertyRoutes from "./property.route.js";
import roomRoutes from "./room.route.js";

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


export default router;