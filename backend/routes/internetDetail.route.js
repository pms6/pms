// routes/internetDetail.route.js
import express from "express";
import {
  getInternetDetails,
  getInternetDetailById,
  createInternetDetail,
  updateInternetDetail,
  deleteInternetDetail,
  getInternetStats,
} from "../controllers/internetDetail.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// staffOnly as well as protect: these records hold the account passwords and
// bank details for every property's broadband. `protect` alone resolves an
// organizationId for TENANT accounts too, which would hand a tenant the whole
// credentials register.
router.use(protect, staffOnly);

// Summary tiles — fixed path, so it must precede "/:id".
router.get("/stats", getInternetStats);

// CRUD
router.get("/", getInternetDetails);
router.post("/", createInternetDetail);
router.get("/:id", getInternetDetailById);
router.put("/:id", updateInternetDetail);
router.delete("/:id", deleteInternetDetail);

export default router;
