// routes/companyPassword.route.js
import express from "express";
import {
  getCompanyPasswords,
  getCompanyPasswordById,
  createCompanyPassword,
  updateCompanyPassword,
  deleteCompanyPassword,
} from "../controllers/companyPassword.controller.js";
import { protect, staffOnly } from "../middleware/auth.js";

const router = express.Router();

// Company credentials and key-safe codes — organization-internal, so every
// route is staff-only. `protect` alone would resolve an organizationId for a
// tenant and hand them the lot.
router.use(protect, staffOnly);

router.get("/", getCompanyPasswords);
router.get("/:id", getCompanyPasswordById);
router.post("/", createCompanyPassword);
router.put("/:id", updateCompanyPassword);
router.delete("/:id", deleteCompanyPassword);

export default router;
